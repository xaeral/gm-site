(function () {
  if (!window.React || !window.ReactDOM || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  var shared = window.CampaignAtlasCharactersShared || {};
  var characterService = window.CharacterService;
  var relationshipService = window.RelationshipService;
  var mapLayoutService = window.MapLayoutService;
  // Clan/Sect/Status/Tags filtering (state, panel UI, AND/OR predicate) is
  // owned entirely by character-directory-filters.js, shared verbatim with
  // the Relationship Map's own Character Directory -- neither page
  // reimplements it.
  var characterDirectoryFilters = window.CharacterDirectoryFilters;
  if (!characterService || !relationshipService || !characterDirectoryFilters || !shared.CharacterBiographyWorkspace || !shared.CharacterProfileWorkspace || !shared.CharacterProfilePortrait) {
    return;
  }

  var CharacterProfileWorkspace = shared.CharacterProfileWorkspace;
  var CharacterProfilePortrait = shared.CharacterProfilePortrait;
  var CHANNEL_NAME = "campaign-atlas-characters";
  var sourceId = "characters-page-" + Date.now() + "-" + Math.floor(Math.random() * 100000);

  function normalizeString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  function generateCharacterId() {
    return "char-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function initialSelectedCharacterId() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      return params.get("character") || params.get("selected") || null;
    } catch (_error) {
      return null;
    }
  }

  function App() {
    var _records = useState([]);
    var characters = _records[0];
    var setCharacters = _records[1];

    var _relationships = useState([]);
    var relationships = _relationships[0];
    var setRelationships = _relationships[1];

    var _selectedId = useState(initialSelectedCharacterId());
    var selectedId = _selectedId[0];
    var setSelectedId = _selectedId[1];

    // CharacterProfileWorkspace owns its own view/edit toggle internally,
    // seeded once from `startInEdit` whenever its `character.id` changes --
    // it has no external "force edit mode" API. To let the list's pencil
    // icon jump straight into edit mode (even for the character that's
    // already selected), we key the workspace on this request's id+nonce:
    // a new nonce forces React to unmount/remount it, which re-seeds
    // editMode from startInEdit exactly once per request.
    var _editRequest = useState(null);
    var editRequest = _editRequest[0];
    var setEditRequest = _editRequest[1];

    function requestEditCharacter(characterId) {
      setSelectedId(characterId);
      setEditRequest({ id: characterId, nonce: Date.now() + "-" + Math.random().toString(36).slice(2, 8) });
    }

    // A brand-new character being created. Only exists in local state --
    // and is never added to the Relationship Map -- until the Storyteller
    // saves it, at which point it's persisted exclusively via
    // CharacterService and appears in the Character List like any other.
    var _draftNewCharacter = useState(null);
    var draftNewCharacter = _draftNewCharacter[0];
    var setDraftNewCharacter = _draftNewCharacter[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

    var _loading = useState(true);
    var loading = _loading[0];
    var setLoading = _loading[1];

    // Clan/Sect/Status/Tags filter state, panel UI and matching predicate
    // -- all owned by the shared hook (see character-directory-filters.js)
    // so this page and the Relationship Map's Character Directory can
    // never drift apart.
    var characterFilters = characterDirectoryFilters.useCharacterDirectoryFilters(characters);

    var saveTimerRef = useRef(null);
    var channelRef = useRef(null);

    useEffect(function () {
      var cancelled = false;
      Promise.all([characterService.getAll(), relationshipService.getAll()])
        .then(function (results) {
          if (cancelled) {
            return;
          }
          var nextCharacters = Array.isArray(results[0]) ? results[0] : [];
          var nextRelationships = Array.isArray(results[1]) ? results[1] : [];
          setCharacters(nextCharacters);
          setRelationships(nextRelationships);
          setSelectedId(function (current) {
            if (current && nextCharacters.some(function (entry) { return entry.id === current; })) {
              return current;
            }
            return nextCharacters[0] ? nextCharacters[0].id : null;
          });
          setLoading(false);
        })
        .catch(function () {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return function () {
        cancelled = true;
      };
    }, []);

    useEffect(function () {
      if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") {
        return;
      }
      var channel = new window.BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = function (event) {
        var message = event && event.data ? event.data : null;
        if (!message || message.source === sourceId) {
          return;
        }

        if (message.type === "characters-snapshot" && Array.isArray(message.characters)) {
          setCharacters(message.characters);
          if (Array.isArray(message.relationships)) {
            setRelationships(message.relationships);
          }
          setSelectedId(function (current) {
            if (current && message.characters.some(function (entry) { return entry.id === current; })) {
              return current;
            }
            return message.characters[0] ? message.characters[0].id : null;
          });
          return;
        }

        if (message.type === "character-updated" && message.character && message.character.id) {
          setCharacters(function (prev) {
            return prev.map(function (entry) {
              return entry.id === message.character.id ? Object.assign({}, entry, message.character) : entry;
            });
          });
        }
      };

      return function () {
        channelRef.current = null;
        channel.close();
      };
    }, []);

    var filteredCharacters = useMemo(function () {
      var term = normalizeString(search, "").toLowerCase();
      return characters.filter(function (entry) {
        var name = normalizeString(entry.name, "Unnamed");
        var clan = normalizeString(entry.clan, "None");
        var sect = normalizeString(entry.sect, "None");

        if (term) {
          var haystack = (name + " " + clan + " " + sect).toLowerCase();
          if (haystack.indexOf(term) === -1) {
            return false;
          }
        }

        return characterFilters.matchesFilters(entry);
      });
    }, [characters, search, characterFilters.matchesFilters]);

    var selectedCharacter = useMemo(function () {
      return characters.find(function (entry) { return entry.id === selectedId; }) || null;
    }, [characters, selectedId]);

    function persistCharacterUpdate(nextCharacter) {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(function () {
        saveTimerRef.current = null;
        characterService.save(nextCharacter).catch(function () { return null; });
      }, 120);

      var channel = channelRef.current;
      if (channel) {
        channel.postMessage({
          type: "character-updated",
          source: sourceId,
          character: shared.clone(nextCharacter)
        });
      }
    }

    function togglePinned(entry) {
      var nextCharacter = Object.assign({}, entry, { pinned: !entry.pinned });
      setCharacters(function (prev) {
        return prev.map(function (item) { return item.id === entry.id ? nextCharacter : item; });
      });
      persistCharacterUpdate(nextCharacter);
    }

    function saveSelectedCharacter(updatedCharacter) {
      if (!selectedCharacter) {
        return;
      }
      setCharacters(function (prev) {
        return prev.map(function (entry) {
          if (entry.id !== selectedCharacter.id) {
            return entry;
          }
          // The Characters page is the canonical editor, including portraits
          // -- whatever the workspace produced (name/clan/sect/status/bio/
          // portrait/etc.) is persisted as-is.
          var candidate = Object.assign({}, shared.clone(updatedCharacter || {}));
          var nextCharacter = Object.assign({}, entry, candidate);
          persistCharacterUpdate(nextCharacter);
          return nextCharacter;
        });
      });
    }

    function broadcastSnapshot(nextCharacters, nextRelationships) {
      var channel = channelRef.current;
      if (!channel) {
        return;
      }
      channel.postMessage({
        type: "characters-snapshot",
        source: sourceId,
        characters: nextCharacters.map(function (entry) { return shared.clone(entry); }),
        relationships: nextRelationships.map(function (entry) { return shared.clone(entry); })
      });
    }

    // Character creation. The Characters page is the only place a character
    // record can be created -- the draft only exists in local state (never
    // added to the Relationship Map) until explicitly saved, at which point
    // it's persisted exclusively through CharacterService.
    function startNewCharacter() {
      setDraftNewCharacter({ id: generateCharacterId(), name: "" });
      setSelectedId(null);
    }

    function cancelNewCharacter() {
      setDraftNewCharacter(null);
    }

    function saveNewCharacter(newCharacterRecord) {
      if (!draftNewCharacter) {
        return;
      }
      var normalized = Object.assign({}, shared.clone(newCharacterRecord || {}), { id: draftNewCharacter.id });
      normalized.name = normalizeString(normalized.name, "Unnamed Character");

      var nextCharacters = characters.concat([normalized]);
      setCharacters(nextCharacters);
      setDraftNewCharacter(null);
      setSelectedId(normalized.id);

      characterService.save(normalized).catch(function () { return null; });
      broadcastSnapshot(nextCharacters, relationships);
    }

    // Character deletion. Only the Characters page can delete a character
    // record. Deleting cleans up every other module's references to it so
    // nothing is left orphaned: the character itself (CharacterService),
    // its Relationship Map layout entry (MapLayoutService), and any
    // relationships that name it (RelationshipService).
    function deleteCharacter(entry) {
      if (!entry || !entry.id) {
        return;
      }
      if (!window.confirm("Delete " + (entry.name || "this character") + "? This cannot be undone and will remove them from any relationships and the Relationship Map.")) {
        return;
      }

      var characterId = entry.id;
      var nextCharacters = characters.filter(function (item) { return item.id !== characterId; });
      var nextRelationships = relationships.filter(function (rel) { return rel.from !== characterId && rel.to !== characterId; });

      setCharacters(nextCharacters);
      setRelationships(nextRelationships);
      setSelectedId(function (current) { return current === characterId ? (nextCharacters[0] ? nextCharacters[0].id : null) : current; });
      if (draftNewCharacter && draftNewCharacter.id === characterId) {
        setDraftNewCharacter(null);
      }

      characterService.delete(characterId).catch(function () { return null; });
      relationshipService.saveAll(nextRelationships).catch(function () { return null; });
      if (mapLayoutService && mapLayoutService.deleteNodeLayout) {
        mapLayoutService.deleteNodeLayout(characterId).catch(function () { return null; });
      }

      broadcastSnapshot(nextCharacters, nextRelationships);
    }

    return html`
      <div className="character-db-page">
        <section className="search-panel card">
          <label htmlFor="characterSearch">Search Characters</label>
          <div className="search-row">
            <input id="characterSearch" type="search" placeholder="Search by name, clan, sect..." autoComplete="off" value=${search} onInput=${function (event) { setSearch(event.target.value); }} />
            ${characterFilters.renderFilterControl()}
            <button type="button" className="location-add-button" title="New Character" aria-label="New Character" onClick=${startNewCharacter}>+</button>
          </div>
          ${characterFilters.renderActiveFilters()}
        </section>

        <section className="character-db-layout">
          <aside className="character-db-list-panel card">
            <h3>Character List</h3>
            <div className="character-db-list-scroll">
              ${loading ? html`<p className="hint">Loading characters...</p>` : null}
              ${!loading && !filteredCharacters.length ? html`<p className="hint">No characters match your current search and filters.</p>` : null}
              ${filteredCharacters.map(function (entry) {
                var isActive = entry.id === selectedId;
                return React.createElement(
                  "button",
                  {
                    key: "char-list-item-" + entry.id,
                    type: "button",
                    className: "character-db-list-item" + (isActive ? " active" : ""),
                    onClick: function () { setSelectedId(entry.id); }
                  },
                  React.createElement(CharacterProfilePortrait, {
                    record: entry,
                    className: "character-db-list-portrait-frame"
                  }),
                  React.createElement(
                    "span",
                    { className: "character-db-list-meta" },
                    React.createElement("strong", null, entry.name || "Unnamed Character"),
                    React.createElement("span", null, normalizeString(entry.clan, "None") + " • " + normalizeString(entry.sect, "None"))
                  ),
                  html`<${shared.ListCardActions} actions=${[
                    { key: "favorite", icon: "../assets/Icons/pin.svg", label: entry.pinned ? "Unpin character" : "Pin character", active: entry.pinned, onClick: function () { togglePinned(entry); } },
                    { key: "edit", icon: "../assets/Icons/edit.svg", label: "Edit " + (entry.name || "character"), onClick: function () { requestEditCharacter(entry.id); } },
                    { key: "delete", icon: "../assets/Icons/delete.svg", label: "Delete " + (entry.name || "character"), destructive: true, onClick: function () { deleteCharacter(entry); } }
                  ]} />`
                );
              })}
            </div>
          </aside>

          <article className="character-db-profile-panel card">
            ${draftNewCharacter
              ? html`<${CharacterProfileWorkspace}
                  character=${draftNewCharacter}
                  characters=${characters}
                  relationships=${relationships}
                  editable=${true}
                  allowPortraitEdit=${true}
                  startInEdit=${true}
                  onSave=${saveNewCharacter}
                  onRequestClose=${cancelNewCharacter}
                  onOpenStoryNote=${function (note) {
                    var focus = encodeURIComponent(String((note && note.focusText) || (note && note.title) || ""));
                    window.location.href = "gm-notes.html?focus=" + focus;
                  }}
                />`
              : (selectedCharacter
                  ? html`<${CharacterProfileWorkspace}
                      key=${selectedCharacter.id + "-" + (editRequest && editRequest.id === selectedCharacter.id ? editRequest.nonce : "view")}
                      character=${selectedCharacter}
                      characters=${characters}
                      relationships=${relationships}
                      editable=${true}
                      allowPortraitEdit=${true}
                      startInEdit=${Boolean(editRequest && editRequest.id === selectedCharacter.id)}
                      showEditButton=${false}
                      onSave=${saveSelectedCharacter}
                      onOpenStoryNote=${function (note) {
                        var focus = encodeURIComponent(String((note && note.focusText) || (note && note.title) || ""));
                        window.location.href = "gm-notes.html?focus=" + focus;
                      }}
                    />`
                  : html`<div className="character-db-empty"><h3>Select a Character</h3><p>Choose a character from the list to open the complete shared profile workspace.</p></div>`)}
          </article>
        </section>
      </div>
    `;
  }

  var root = document.getElementById("charactersDatabaseApp");
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(React.createElement(App));
})();
