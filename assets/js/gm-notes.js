(function () {
  if (!window.React || !window.ReactDOM || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  var notebook = window.ChronicleNotebook;
  var shared = window.CampaignAtlasCharactersShared || {};

  if (!notebook) {
    var target = document.getElementById("gmNotebookApp");
    if (target) {
      target.textContent = "Notebook data store unavailable.";
    }
    return;
  }

  function clone(value) {
    return notebook.clone ? notebook.clone(value) : JSON.parse(JSON.stringify(value));
  }

  function normalizeString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  function uniqueStrings(values) {
    return Array.from(new Set((values || []).map(function (value) { return String(value || "").trim(); }).filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function optionLabelFromCharacter(character) {
    return character.name + (character.clan ? " • " + character.clan : "") + (character.sect ? " • " + character.sect : "");
  }

  function shortSummary(allLabel, selected) {
    if (!selected || !selected.length) {
      return allLabel;
    }
    if (selected.length === 1) {
      return selected[0];
    }
    return selected.length + " Selected";
  }

  function ChipList(props) {
    var items = props.items || [];
    var empty = props.empty || "None";
    var onRemove = props.onRemove;
    var onClick = props.onClick;

    if (!items.length) {
      return html`<p className="hint">${empty}</p>`;
    }

    return html`<div className="notebook-chip-list">
      ${items.map(function (item, index) {
        return html`<button
          type="button"
          key=${"chip-" + (item.id || item.label || "item") + "-" + index}
          className="notebook-chip"
          onClick=${function () { if (onClick) { onClick(item); } }}
        >
          <span>${item.label}</span>
          ${onRemove ? html`<strong aria-hidden="true" onClick=${function (event) { event.stopPropagation(); onRemove(item); }}>×</strong>` : null}
        </button>`;
      })}
    </div>`;
  }

  function SearchFilterDropdown(props) {
    var id = props.id;
    var label = props.label;
    var allLabel = props.allLabel || "All";
    var options = props.options || [];
    var selected = props.selected || [];
    var onToggle = typeof props.onToggle === "function" ? props.onToggle : function () {};

    var _open = useState(false);
    var open = _open[0];
    var setOpen = _open[1];

    var _query = useState("");
    var query = _query[0];
    var setQuery = _query[1];

    var rootRef = useRef(null);

    useEffect(function () {
      if (!open) {
        setQuery("");
        return;
      }
      function onPointerDown(event) {
        if (rootRef.current && !rootRef.current.contains(event.target)) {
          setOpen(false);
        }
      }
      function onEscape(event) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [open]);

    var selectedLabels = selected.map(function (value) {
      var found = options.find(function (option) { return option.value === value; });
      return found ? found.label : value;
    }).filter(Boolean);

    var filteredOptions = useMemo(function () {
      var term = normalizeString(query, "").toLowerCase();
      if (!term) {
        return options;
      }
      return options.filter(function (option) {
        return String(option.label || "").toLowerCase().indexOf(term) >= 0;
      });
    }, [options, query]);

    return html`<div className="character-filter-dropdown notebook-filter-dropdown" ref=${rootRef}>
      <span className="character-filter-label">${label}</span>
      <button
        type="button"
        className=${"character-filter-trigger" + (open ? " open" : "")}
        aria-haspopup="menu"
        aria-expanded=${open ? "true" : "false"}
        aria-controls=${id}
        onClick=${function () { setOpen(!open); }}
      >
        <span className="character-filter-trigger-text">${shortSummary(allLabel, selectedLabels)}</span>
        <span className="character-filter-trigger-caret" aria-hidden="true">v</span>
      </button>
      ${open ? html`<div id=${id} className="character-filter-menu notebook-filter-menu" role="menu">
        <div className="notebook-filter-search-row">
          <input
            type="search"
            value=${query}
            placeholder="Search..."
            autoFocus=${true}
            onInput=${function (event) { setQuery(event.target.value); }}
          />
        </div>
        ${filteredOptions.length ? filteredOptions.map(function (option, index) {
          var checked = selected.indexOf(option.value) >= 0;
          return html`<button
            type="button"
            key=${id + "-" + option.value + "-" + index}
            className=${"character-filter-option" + (checked ? " checked" : "")}
            role="menuitemcheckbox"
            aria-checked=${checked ? "true" : "false"}
            onClick=${function () { onToggle(option.value); }}
          >
            <span className="character-filter-check" aria-hidden="true"></span>
            <span>${option.label}</span>
          </button>`;
        }) : html`<div className="character-filter-option notebook-filter-empty"><span></span><span>No options found.</span></div>`}
      </div>` : null}
    </div>`;
  }

  function App() {
    var _state = useState({ folders: [], notes: [] });
    var state = _state[0];
    var setState = _state[1];

    var _characters = useState([]);
    var characters = _characters[0];
    var setCharacters = _characters[1];

    var _locations = useState([]);
    var locations = _locations[0];
    var setLocations = _locations[1];

    var _selectedNoteId = useState(null);
    var selectedNoteId = _selectedNoteId[0];
    var setSelectedNoteId = _selectedNoteId[1];

    var _draft = useState(null);
    var draft = _draft[0];
    var setDraft = _draft[1];

    var _searchTerm = useState("");
    var searchTerm = _searchTerm[0];
    var setSearchTerm = _searchTerm[1];

    var _explorerSearch = useState("");
    var explorerSearch = _explorerSearch[0];
    var setExplorerSearch = _explorerSearch[1];

    var _filters = useState({ sessions: [], characters: [], locations: [], tags: [] });
    var filters = _filters[0];
    var setFilters = _filters[1];

    var _mentionState = useState(null);
    var mentionState = _mentionState[0];
    var setMentionState = _mentionState[1];

    var _status = useState("Loading notebook...");
    var status = _status[0];
    var setStatus = _status[1];

    var saveTimerRef = useRef(null);
    var noteBodyCacheRef = useRef({});

    useEffect(function () {
      var cancelled = false;
      Promise.all([
        notebook.readNotebookState(),
        shared.readCampaignAtlasState ? shared.readCampaignAtlasState() : Promise.resolve({ characters: [] }),
        shared.readLocationRecords ? shared.readLocationRecords() : Promise.resolve([])
      ]).then(function (results) {
        if (cancelled) {
          return;
        }

        var notebookState = results[0] || { folders: [], notes: [] };
        var characterState = results[1] || { characters: [] };
        var locationState = results[2] || [];
        var notes = notebookState.notes || [];

        setState({ folders: notebookState.folders || [], notes: notes });
        setCharacters(Array.isArray(characterState.characters) ? characterState.characters : []);
        setLocations(Array.isArray(locationState) ? locationState : []);
        setStatus(notes.length ? "Notebook ready." : "Notebook ready. Create your first note.");

        if (!selectedNoteId && notes.length) {
          setSelectedNoteId(notes[0].id);
        }
      }).catch(function () {
        if (!cancelled) {
          setStatus("Unable to load notebook data.");
        }
      });

      return function () {
        cancelled = true;
      };
    }, []);

    useEffect(function () {
      if (typeof shared.subscribeLocationRecordChanges !== "function") {
        return function () {};
      }
      return shared.subscribeLocationRecordChanges(function () {
        if (!shared.readLocationRecords) {
          return;
        }
        shared.readLocationRecords().then(function (records) {
          setLocations(Array.isArray(records) ? records : []);
        }).catch(function () {});
      });
    }, []);

    useEffect(function () {
      if (!selectedNoteId) {
        setDraft(null);
        return;
      }
      setMentionState(null);
      var cachedNote = noteBodyCacheRef.current[selectedNoteId];
      if (cachedNote) {
        setDraft(clone(cachedNote));
        return;
      }
      setDraft(null);
      var cancelled = false;
      notebook.readNoteById(selectedNoteId).then(function (note) {
        if (cancelled || !note || note.id !== selectedNoteId) {
          return;
        }
        noteBodyCacheRef.current[note.id] = clone(note);
        setDraft(clone(note));
      }).catch(function () {
        if (!cancelled) {
          setStatus("Unable to load note content.");
        }
      });
      return function () {
        cancelled = true;
      };
    }, [selectedNoteId]);

    useEffect(function () {
      if (!state.notes || !state.notes.length) {
        return;
      }
      var ids = state.notes.map(function (note) { return note.id; }).filter(function (id) {
        return !noteBodyCacheRef.current[id];
      });
      if (!ids.length) {
        return;
      }

      var cancelled = false;
      var schedule = window.requestIdleCallback
        ? function (callback) { return window.requestIdleCallback(callback, { timeout: 1200 }); }
        : function (callback) { return window.setTimeout(callback, 0); };

      function pump(queue) {
        if (cancelled || !queue.length) {
          return;
        }
        var batch = queue.splice(0, 4);
        Promise.all(batch.map(function (id) {
          return notebook.readNoteById(id).then(function (note) {
            if (note) {
              noteBodyCacheRef.current[id] = clone(note);
            }
          }).catch(function () { return null; });
        })).then(function () {
          if (!cancelled && queue.length) {
            schedule(function () { pump(queue); });
          }
        });
      }

      schedule(function () { pump(ids.slice()); });
      return function () {
        cancelled = true;
      };
    }, [state.notes.length]);

    useEffect(function () {
      if (!draft) {
        return;
      }
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(function () {
        saveTimerRef.current = null;
        notebook.saveNote(draft, draft.folderId).then(function (savedNote) {
          setState(function (current) {
            var nextSummary = {
              id: savedNote.id,
              folderId: savedNote.folderId,
              title: savedNote.title,
              sessionLabel: savedNote.sessionLabel,
              characterIds: savedNote.characterIds || [],
              locationIds: savedNote.locationIds || [],
              tags: savedNote.tags || [],
              pinned: Boolean(savedNote.pinned),
              archived: Boolean(savedNote.archived),
              previewText: savedNote.previewText || "",
              searchText: savedNote.searchText || "",
              timelineEvents: savedNote.timelineEvents || [],
              createdAt: savedNote.createdAt,
              updatedAt: savedNote.updatedAt
            };
            var found = false;
            var notes = (current.notes || []).map(function (note) {
              if (note.id === savedNote.id) {
                found = true;
                return nextSummary;
              }
              return note;
            });
            if (!found) {
              notes.push(nextSummary);
            }
            return { folders: current.folders, notes: notes };
          });
          noteBodyCacheRef.current[savedNote.id] = clone(savedNote);
          setStatus("Draft saved.");
        }).catch(function () {
          setStatus("Unable to save draft.");
        });
      }, 250);
      return function () {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [draft && draft.id, draft && draft.title, draft && draft.bodyHtml, draft && draft.folderId, draft && draft.sessionLabel, draft && draft.pinned, draft && draft.archived, JSON.stringify(draft && draft.characterIds ? draft.characterIds : []), JSON.stringify(draft && draft.locationIds ? draft.locationIds : []), JSON.stringify(draft && draft.tags ? draft.tags : [])]);

    function toggleFilterValue(field, value) {
      setFilters(function (current) {
        var next = clone(current);
        var bucket = Array.isArray(next[field]) ? next[field] : [];
        next[field] = bucket.indexOf(value) >= 0 ? bucket.filter(function (entry) { return entry !== value; }) : bucket.concat([value]);
        return next;
      });
    }

    var characterOptions = useMemo(function () {
      return (characters || []).map(function (character) {
        return { value: character.id, label: optionLabelFromCharacter(character) };
      }).sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [characters]);

    var locationOptions = useMemo(function () {
      var fromState = (locations || []).map(function (location) {
        var locationId = normalizeString(location.id, "");
        var label = normalizeString(location.name, locationId || "Unknown Location");
        return { value: locationId || label, label: label };
      });
      var merged = {};
      fromState.forEach(function (option) {
        if (option && option.value && !merged[option.value]) {
          merged[option.value] = option;
        }
      });
      return Object.keys(merged).map(function (key) { return merged[key]; }).sort(function (a, b) {
        return a.label.localeCompare(b.label);
      });
    }, [locations]);

    var sessionOptions = useMemo(function () {
      return uniqueStrings((state.notes || []).map(function (note) { return note.sessionLabel; })).map(function (session) {
        return { value: session, label: session };
      });
    }, [state.notes]);

    var tagOptions = useMemo(function () {
      return uniqueStrings((state.notes || []).reduce(function (all, note) {
        return all.concat(Array.isArray(note.tags) ? note.tags : []);
      }, [])).map(function (tag) {
        return { value: tag, label: tag };
      });
    }, [state.notes]);

    var visibleNotes = useMemo(function () {
      return notebook.filterNotes(state.notes || [], state, filters, searchTerm).slice().sort(function (a, b) {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
    }, [state.notes, state.folders, searchTerm, JSON.stringify(filters)]);

    var explorerVisibleNotes = useMemo(function () {
      var term = normalizeString(explorerSearch, "").toLowerCase();
      if (!term) {
        return visibleNotes;
      }
      return visibleNotes.filter(function (note) {
        var title = String(note.title || "").toLowerCase();
        var preview = String(note.previewText || "").toLowerCase();
        return title.indexOf(term) >= 0 || preview.indexOf(term) >= 0;
      });
    }, [visibleNotes, explorerSearch]);

    var groupedByFolder = useMemo(function () {
      var groups = {};
      explorerVisibleNotes.forEach(function (note) {
        var folderId = note.folderId || notebook.getDefaultFolderId();
        if (!groups[folderId]) {
          groups[folderId] = [];
        }
        groups[folderId].push(note);
      });
      return groups;
    }, [explorerVisibleNotes]);

    var selectedFolderId = draft ? (draft.folderId || notebook.getDefaultFolderId()) : notebook.getDefaultFolderId();

    var selectedCharacterObjects = (draft && draft.characterIds ? draft.characterIds : []).map(function (id) {
      return characters.find(function (character) { return character.id === id; });
    }).filter(Boolean).map(function (character) {
      return { id: character.id, label: optionLabelFromCharacter(character) };
    });

    var selectedLocationObjects = (draft && draft.locationIds ? draft.locationIds : []).map(function (id) {
      var value = String(id);
      var found = locationOptions.find(function (option) { return option.value === value; });
      return { id: value, label: found ? found.label : value };
    });

    function updateDraftField(field, value) {
      setDraft(function (current) {
        if (!current) {
          return current;
        }
        var next = clone(current);
        next[field] = value;
        return next;
      });
    }

    function updateTags(value) {
      updateDraftField("tags", String(value || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean));
    }

    async function selectNote(noteId) {
      if (draft) {
        await notebook.saveNote(draft, draft.folderId);
      }
      setSelectedNoteId(noteId);
    }

    async function refreshNotebookState(nextStatus) {
      var nextState = await notebook.readNotebookState();
      setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
      if (nextStatus) {
        setStatus(nextStatus);
      }
      return nextState;
    }

    async function createNote(folderId) {
      var note = await notebook.createNote(folderId || selectedFolderId || notebook.getDefaultFolderId());
      noteBodyCacheRef.current[note.id] = null;
      await refreshNotebookState("New note created.");
      setSelectedNoteId(note.id);
    }

    async function createFolderFromPrompt() {
      var name = window.prompt("Folder name", "Custom Folder");
      if (!name) {
        return;
      }
      await notebook.createFolder(name);
      await refreshNotebookState("Folder created.");
    }

    async function toggleFolder(folder) {
      var nextFolder = clone(folder);
      nextFolder.collapsed = !folder.collapsed;
      await notebook.saveFolder(nextFolder);
      await refreshNotebookState();
    }

    async function moveNote(noteId, folderId) {
      await notebook.moveNote(noteId, folderId);
      await refreshNotebookState("Note moved.");
    }

    async function deleteActiveNote() {
      if (!draft || !window.confirm("Delete this note?")) {
        return;
      }
      await notebook.deleteNote(draft.id);
      delete noteBodyCacheRef.current[draft.id];
      var nextState = await refreshNotebookState("Note deleted.");
      var first = (nextState.notes || [])[0] || null;
      setSelectedNoteId(first ? first.id : null);
    }

    function handleEditorKeyUp(_event, editor) {
      if (!editor) {
        return;
      }
      var selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        setMentionState(null);
        return;
      }

      var range = selection.getRangeAt(0).cloneRange();
      try {
        range.selectNodeContents(editor);
        range.setEnd(selection.anchorNode, selection.anchorOffset);
      } catch (_error) {
        setMentionState(null);
        return;
      }

      var textBeforeCaret = range.toString();
      var match = /(?:^|\s)([@#])([\w-]*)$/.exec(textBeforeCaret);
      if (!match) {
        setMentionState(null);
        return;
      }

      setMentionState({ trigger: match[1], query: match[2] });
    }

    function addReference(kind, item) {
      if (!draft || !item) {
        return;
      }
      var next = clone(draft);
      if (kind === "character") {
        next.characterIds = uniqueStrings((next.characterIds || []).concat([item.id]));
      } else if (kind === "location") {
        next.locationIds = uniqueStrings((next.locationIds || []).concat([item.id]));
      }
      setDraft(next);
      setMentionState(null);
    }

    function removeReference(kind, item) {
      if (!draft || !item) {
        return;
      }
      var next = clone(draft);
      if (kind === "character") {
        next.characterIds = (next.characterIds || []).filter(function (id) { return id !== item.id; });
      } else if (kind === "location") {
        next.locationIds = (next.locationIds || []).filter(function (id) { return id !== item.id; });
      }
      setDraft(next);
    }

    function clearFilters() {
      setSearchTerm("");
      setFilters({ sessions: [], characters: [], locations: [], tags: [] });
    }

    return html`<section className="gm-notebook-page">
      <div className="gm-notebook-global-toolbar card">
        <div className="gm-notebook-global-search">
          <label htmlFor="gmNoteSearch">Search Notes</label>
          <input
            id="gmNoteSearch"
            type="search"
            placeholder="Search title, body, tags, characters, locations..."
            value=${searchTerm}
            onInput=${function (event) { setSearchTerm(event.target.value); }}
          />
        </div>
        <div className="gm-notebook-filter-row">
          <${SearchFilterDropdown}
            id="sessionFilterMenu"
            label="Session"
            allLabel="All Sessions"
            options=${sessionOptions}
            selected=${filters.sessions}
            onToggle=${function (value) { toggleFilterValue("sessions", value); }}
          />
          <${SearchFilterDropdown}
            id="characterFilterMenu"
            label="Character"
            allLabel="All Characters"
            options=${characterOptions}
            selected=${filters.characters}
            onToggle=${function (value) { toggleFilterValue("characters", value); }}
          />
          <${SearchFilterDropdown}
            id="locationFilterMenu"
            label="Location"
            allLabel="All Locations"
            options=${locationOptions}
            selected=${filters.locations}
            onToggle=${function (value) { toggleFilterValue("locations", value); }}
          />
          <${SearchFilterDropdown}
            id="tagFilterMenu"
            label="Tags"
            allLabel="All Tags"
            options=${tagOptions}
            selected=${filters.tags}
            onToggle=${function (value) { toggleFilterValue("tags", value); }}
          />
          <button type="button" className="notebook-clear-button" onClick=${clearFilters}>Clear Filters</button>
        </div>
        <button type="button" className="notebook-primary-add" aria-label="Create note" onClick=${function () { createNote(selectedFolderId); }}>+</button>
      </div>

      <div className="gm-notebook-workspace">
        <aside className="gm-notebook-explorer">
          <div className="gm-notebook-explorer-head">
            <div>
              <h3>Notebook Explorer</h3>
              <p>${explorerVisibleNotes.length} visible notes</p>
            </div>
          </div>

          <div className="gm-notebook-explorer-controls">
            <input
              type="search"
              placeholder="Search explorer..."
              value=${explorerSearch}
              onInput=${function (event) { setExplorerSearch(event.target.value); }}
            />
            <div className="gm-notebook-explorer-actions">
              <button type="button" onClick=${function () { createNote(selectedFolderId); }}>New Note</button>
              <button type="button" onClick=${createFolderFromPrompt}>New Folder</button>
            </div>
          </div>

          <div className="notebook-folder-list">
            ${(state.folders || []).map(function (folder, folderIndex) {
              var folderNotes = groupedByFolder[folder.id] || [];
              return html`<section
                className="notebook-folder-card"
                key=${"folder-" + (folder.id || folder.title || "untitled") + "-" + folderIndex}
                onDragOver=${function (event) { event.preventDefault(); }}
                onDrop=${function (event) {
                  event.preventDefault();
                  var noteId = event.dataTransfer.getData("text/notebook-note-id");
                  if (noteId) {
                    moveNote(noteId, folder.id);
                  }
                }}
              >
                <button type="button" className="notebook-folder-header" onClick=${function () { toggleFolder(folder); }}>
                  <span className="notebook-folder-caret">${folder.collapsed ? ">" : "v"}</span>
                  <span className="notebook-folder-title">${folder.title}</span>
                  <span className="notebook-folder-count">${folderNotes.length}</span>
                </button>
                ${folder.collapsed ? null : html`<div className="notebook-note-stack">
                  ${folderNotes.length ? folderNotes.map(function (note, noteIndex) {
                    return html`<button
                      type="button"
                      key=${"note-" + (note.id || note.title || "untitled") + "-" + noteIndex}
                      draggable="true"
                      className=${"notebook-note-card" + (selectedNoteId === note.id ? " active" : "") + (note.pinned ? " pinned" : "")}
                      onDragStart=${function (event) { event.dataTransfer.setData("text/notebook-note-id", note.id); }}
                      onClick=${function () { selectNote(note.id); }}
                    >
                      <strong>${note.title || "Untitled Note"}</strong>
                      <span>${note.sessionLabel || "No session"}</span>
                    </button>`;
                  }) : html`<p className="hint">No notes in this folder.</p>`}
                </div>`}
              </section>`;
            })}
          </div>
        </aside>

        <section className="gm-notebook-editor">
          ${draft ? html`
            <div className="notebook-editor-header">
              <input
                type="text"
                className="notebook-title-input"
                value=${draft.title || ""}
                onInput=${function (event) { updateDraftField("title", event.target.value); }}
                placeholder="Note title"
              />
              <div className="notebook-editor-actions">
                <button type="button" onClick=${function () { setDraft(function (current) { var next = clone(current); next.pinned = !next.pinned; return next; }); }}>${draft.pinned ? "Unpin" : "Pin"}</button>
                <button type="button" onClick=${function () { setDraft(function (current) { var next = clone(current); next.archived = !next.archived; return next; }); }}>${draft.archived ? "Unarchive" : "Archive"}</button>
                <button type="button" className="destructive" onClick=${deleteActiveNote}>Delete</button>
              </div>
            </div>

            <div className="notebook-metadata-grid">
              <label>Folder
                <select value=${draft.folderId || notebook.getDefaultFolderId()} onChange=${function (event) { updateDraftField("folderId", event.target.value); }}>
                  ${(state.folders || []).map(function (folder, folderIndex) {
                    return html`<option key=${"folder-option-" + (folder.id || folder.title || "untitled") + "-" + folderIndex} value=${folder.id}>${folder.title}</option>`;
                  })}
                </select>
              </label>
              <label>Session
                <input list="notebook-sessions" value=${draft.sessionLabel || ""} onInput=${function (event) { updateDraftField("sessionLabel", event.target.value); }} placeholder="Session 4" />
              </label>
              <label>General Tags
                <input value=${(draft.tags || []).join(", ")} onInput=${function (event) { updateTags(event.target.value); }} placeholder="prep, rumor, important" />
              </label>
            </div>

            <div className="notebook-mention-rows">
              <section className="notebook-reference-card">
                <h4>Character Tags</h4>
                <${ChipList}
                  items=${selectedCharacterObjects}
                  empty="No tagged characters yet."
                  onClick=${function (item) { if (item && item.id) { window.location.href = "characters.html?character=" + encodeURIComponent(item.id); } }}
                  onRemove=${function (item) { removeReference("character", item); }}
                />
              </section>
              <section className="notebook-reference-card">
                <h4>Location Tags</h4>
                <${ChipList}
                  items=${selectedLocationObjects}
                  empty="No tagged locations yet."
                  onClick=${function (item) { if (item && item.id) { window.location.href = "locations.html?location=" + encodeURIComponent(item.id); } }}
                  onRemove=${function (item) { removeReference("location", item); }}
                />
              </section>
            </div>

            <section className="notebook-body-card">
              <div className="section-heading notebook-writing-heading">
                <h3>Rich Text Note Editor</h3>
                <span className="note-subtitle">Type @ for characters or # for locations • ${status}</span>
              </div>
              <${shared.CharacterBiographyWorkspace}
                editable=${true}
                value=${String(draft.bodyHtml || "")}
                onChange=${function (htmlValue) { updateDraftField("bodyHtml", htmlValue); }}
                editorClassName="rich-editor profile-rich-editor character-rich-text notebook-editor"
                viewerClassName="profile-biography-content character-rich-text"
                onEditorKeyUp=${handleEditorKeyUp}
              />

              ${mentionState ? html`<div className="notebook-mention-picker">
                <div className="section-heading">
                  <h3>${mentionState.trigger === "@" ? "Character Tags" : "Location Tags"}</h3>
                  <span className="note-subtitle">${mentionState.query ? "Filtering: " + mentionState.query : "Start typing to filter"}</span>
                </div>
                <div className="notebook-mention-results">
                  ${(mentionState.trigger === "@" ? characterOptions : locationOptions)
                    .filter(function (option) { return !mentionState.query || option.label.toLowerCase().indexOf(mentionState.query.toLowerCase()) >= 0; })
                    .slice(0, 12)
                    .map(function (option, index) {
                      return html`<button key=${"mention-option-" + option.value + "-" + index} type="button" className="notebook-mention-option" onClick=${function () { addReference(mentionState.trigger === "@" ? "character" : "location", { id: option.value, label: option.label }); }}>
                        <strong>${option.label}</strong>
                      </button>`;
                    })}
                </div>
              </div>` : null}
            </section>
          ` : selectedNoteId ? html`<div className="profile-empty">Loading note content...</div>` : html`<div className="profile-empty">
            <p>No note selected.</p>
            <button type="button" onClick=${function () { createNote(selectedFolderId); }}>Create Note</button>
          </div>`}

          <datalist id="notebook-sessions">
            ${sessionOptions.map(function (session, sessionIndex) { return html`<option key=${"session-option-" + session.value + "-" + sessionIndex} value=${session.value}></option>`; })}
          </datalist>
        </section>
      </div>
    </section>`;
  }

  var root = document.getElementById("gmNotebookApp");
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(React.createElement(App));
})();
