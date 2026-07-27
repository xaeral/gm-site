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
  var characterService = window.CharacterService || null;

  if (!notebook || !shared.CharacterBiographyWorkspace || !window.MentionEditor) {
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

  // Single call site for reading "which entities does this bodyHtml
  // mention" -- reuses the Mention Editor's own chip-parsing logic (the
  // mention chips written into the HTML are already the source of truth
  // for entity references) rather than tracking a second, separately
  // maintained id list that can drift out of sync with the text.
  function mentionedEntitiesFromHtml(bodyHtml) {
    if (!window.MentionEditor || typeof window.MentionEditor.extractMentionEntities !== "function") {
      return [];
    }
    return window.MentionEditor.extractMentionEntities(bodyHtml);
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

    // Notes open read-only by default, matching Character/Location/Session --
    // editing controls only render when editMode is true, and can only be
    // switched on from the Notebook Explorer's pencil icon (or by creating
    // a new note). Saving/cancelling always returns to view mode.
    var _editMode = useState(false);
    var editMode = _editMode[0];
    var setEditMode = _editMode[1];

    var _searchTerm = useState("");
    var searchTerm = _searchTerm[0];
    var setSearchTerm = _searchTerm[1];

    var _explorerSearch = useState("");
    var explorerSearch = _explorerSearch[0];
    var setExplorerSearch = _explorerSearch[1];

    var _filters = useState({ sessions: [], characters: [], locations: [], tags: [] });
    var filters = _filters[0];
    var setFilters = _filters[1];

    var _collapsedFolders = useState({});
    var collapsedFolders = _collapsedFolders[0];
    var setCollapsedFolders = _collapsedFolders[1];

    var _status = useState("Loading notebook...");
    var status = _status[0];
    var setStatus = _status[1];

    var noteBodyCacheRef = useRef({});

    useEffect(function () {
      var cancelled = false;
      Promise.all([
        notebook.readNotebookState(),
        characterService ? characterService.getAll() : Promise.resolve([]),
        shared.readLocationRecords ? shared.readLocationRecords() : Promise.resolve([])
      ]).then(function (results) {
        if (cancelled) {
          return;
        }

        var notebookState = results[0] || { folders: [], notes: [] };
        var characterList = results[1] || [];
        var locationState = results[2] || [];
        var notes = notebookState.notes || [];

        setState({ folders: notebookState.folders || [], notes: notes });
        setCharacters(Array.isArray(characterList) ? characterList : []);
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

    function summaryFromSavedNote(savedNote) {
      return {
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
    }

    function applySavedNoteToState(savedNote) {
      setState(function (current) {
        var nextSummary = summaryFromSavedNote(savedNote);
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
    }

    async function saveDraftNote() {
      if (!draft) {
        return;
      }
      try {
        var mentioned = mentionedEntitiesFromHtml(draft.bodyHtml);
        var payload = clone(draft);
        payload.characterIds = uniqueStrings(mentioned.filter(function (entity) { return entity.type === "character"; }).map(function (entity) { return entity.id; }));
        payload.locationIds = uniqueStrings(mentioned.filter(function (entity) { return entity.type === "location"; }).map(function (entity) { return entity.id; }));
        var savedNote = await notebook.saveNote(payload, payload.folderId);
        applySavedNoteToState(savedNote);
        setDraft(clone(savedNote));
        setEditMode(false);
        setStatus("Note saved.");
      } catch (_error) {
        setStatus("Unable to save note.");
      }
    }

    function cancelDraftEdit() {
      if (!selectedNoteId) {
        setEditMode(false);
        return;
      }
      var cached = noteBodyCacheRef.current[selectedNoteId];
      if (cached) {
        setDraft(clone(cached));
      }
      setEditMode(false);
    }

    async function toggleNotePinned(noteSummary) {
      if (!noteSummary || !noteSummary.id) {
        return;
      }
      var full = noteBodyCacheRef.current[noteSummary.id] || await notebook.readNoteById(noteSummary.id);
      if (!full) {
        return;
      }
      var next = clone(full);
      next.pinned = !next.pinned;
      var savedNote = await notebook.saveNote(next, next.folderId);
      applySavedNoteToState(savedNote);
      if (selectedNoteId === savedNote.id) {
        setDraft(function (current) {
          return current ? Object.assign({}, current, { pinned: savedNote.pinned }) : current;
        });
      }
    }

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

    var selectedFolderTitle = (function () {
      var found = (state.folders || []).find(function (folder) { return folder.id === selectedFolderId; });
      return found ? found.title : "Unfiled";
    })();

    // Character Tags / Location Tags are a live read of the mentions
    // actually present in the note body -- not a separately edited list --
    // so they can never drift out of sync with what the Rich Text Note
    // says, and update immediately as mentions are added or removed.
    var mentionedEntities = useMemo(function () {
      return draft ? mentionedEntitiesFromHtml(draft.bodyHtml) : [];
    }, [draft && draft.bodyHtml]);

    var selectedCharacterObjects = mentionedEntities.filter(function (entity) { return entity.type === "character"; }).map(function (entity) {
      return { id: entity.id, label: entity.label };
    });

    var selectedLocationObjects = mentionedEntities.filter(function (entity) { return entity.type === "location"; }).map(function (entity) {
      return { id: entity.id, label: entity.label };
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

    // Keeps the raw text the user is typing (tagsInput) separate from the
    // parsed tag array (tags) -- the input's displayed value always mirrors
    // tagsInput verbatim, so commas/spaces/trailing-comma-while-typing are
    // never silently eaten by round-tripping through split/join on every
    // keystroke. `tags` (used for search/filter elsewhere) still stays
    // continuously parsed in the background.
    function updateTags(value) {
      setDraft(function (current) {
        if (!current) {
          return current;
        }
        var next = clone(current);
        next.tagsInput = value;
        next.tags = String(value || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean);
        return next;
      });
    }

    function selectNote(noteId) {
      setSelectedNoteId(noteId);
      setEditMode(false);
    }

    function editNoteEntry(noteId) {
      setSelectedNoteId(noteId);
      setEditMode(true);
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
      setEditMode(true);
    }

    async function createFolderFromPrompt() {
      var name = window.prompt("Folder name", "Custom Folder");
      if (!name) {
        return;
      }
      await notebook.createFolder(name);
      await refreshNotebookState("Folder created.");
    }

    function isFolderCollapsed(folder) {
      return Object.prototype.hasOwnProperty.call(collapsedFolders, folder.id) ? collapsedFolders[folder.id] : true;
    }

    function toggleFolder(folder) {
      setCollapsedFolders(function (prev) {
        var currentlyCollapsed = Object.prototype.hasOwnProperty.call(prev, folder.id) ? prev[folder.id] : true;
        var next = Object.assign({}, prev);
        next[folder.id] = !currentlyCollapsed;
        return next;
      });
    }

    async function moveNote(noteId, folderId) {
      await notebook.moveNote(noteId, folderId);
      await refreshNotebookState("Note moved.");
    }

    async function deleteNoteEntry(noteSummary) {
      if (!noteSummary || !noteSummary.id) {
        return;
      }
      if (!window.confirm("Delete \"" + (noteSummary.title || "this note") + "\"?")) {
        return;
      }
      await notebook.deleteNote(noteSummary.id);
      delete noteBodyCacheRef.current[noteSummary.id];
      var nextState = await refreshNotebookState("Note deleted.");
      if (selectedNoteId === noteSummary.id) {
        var first = (nextState.notes || [])[0] || null;
        setSelectedNoteId(first ? first.id : null);
        setEditMode(false);
      }
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
              var collapsed = isFolderCollapsed(folder);
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
                <button type="button" className="notebook-folder-header" aria-expanded=${!collapsed} onClick=${function () { toggleFolder(folder); }}>
                  <span className="notebook-folder-caret" aria-hidden="true">${shared.Icon({ icon: collapsed ? "../assets/Icons/chevron-right.svg" : "../assets/Icons/chevron-down.svg", size: 13 })}</span>
                  <span className="notebook-folder-title">${folder.title}</span>
                  <span className="notebook-folder-count">${folderNotes.length}</span>
                </button>
                ${collapsed ? null : html`<div className="notebook-note-stack">
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
                      <${shared.ListCardActions} actions=${[
                        { key: "pin", icon: "../assets/Icons/pin.svg", label: note.pinned ? "Unpin " + (note.title || "note") : "Pin " + (note.title || "note"), active: note.pinned, onClick: function () { toggleNotePinned(note); } },
                        { key: "edit", icon: "../assets/Icons/edit.svg", label: "Edit " + (note.title || "note"), onClick: function () { editNoteEntry(note.id); } },
                        { key: "delete", icon: "../assets/Icons/delete.svg", label: "Delete " + (note.title || "note"), destructive: true, onClick: function () { deleteNoteEntry(note); } }
                      ]} />
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
              ${editMode
                ? html`<input
                    type="text"
                    className="notebook-title-input"
                    value=${draft.title || ""}
                    onInput=${function (event) { updateDraftField("title", event.target.value); }}
                    placeholder="Note title"
                  />`
                : html`<h1 className="notebook-title-input">${draft.title || "Untitled Note"}</h1>`}
              <div className="notebook-editor-actions">
                ${editMode
                  ? html`<div className="profile-edit-actions-row">
                      <button type="button" onClick=${function () { updateDraftField("archived", !draft.archived); }}>${draft.archived ? "Unarchive" : "Archive"}</button>
                      <button type="button" className="profile-save-button" onClick=${saveDraftNote}>Save</button>
                      <button type="button" className="profile-cancel-button secondary" onClick=${cancelDraftEdit}>Cancel</button>
                    </div>`
                  : null}
              </div>
            </div>

            ${editMode ? html`<div className="notebook-metadata-grid">
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
                <input value=${draft.tagsInput !== undefined ? draft.tagsInput : (draft.tags || []).join(", ")} onInput=${function (event) { updateTags(event.target.value); }} placeholder="prep, rumor, important" />
              </label>
            </div>` : html`<div className="notebook-metadata-grid location-overview-readonly">
              <div className="location-readonly-field">
                <span className="location-readonly-label">Folder</span>
                <strong className="location-readonly-value">${selectedFolderTitle}</strong>
              </div>
              <div className="location-readonly-field">
                <span className="location-readonly-label">Linked Session</span>
                <strong className="location-readonly-value">${draft.sessionLabel || "No session"}</strong>
              </div>
              <div className="location-readonly-field">
                <span className="location-readonly-label">General Tags</span>
                <${shared.TagChips} items=${draft.tags || []} empty="No tags." />
              </div>
              <div className="location-readonly-field">
                <span className="location-readonly-label">Pin Status</span>
                <strong className="location-readonly-value">${draft.pinned ? "Pinned" : "Not Pinned"}</strong>
              </div>
              <div className="location-readonly-field">
                <span className="location-readonly-label">Archive Status</span>
                <strong className="location-readonly-value">${draft.archived ? "Archived" : "Active"}</strong>
              </div>
            </div>`}

            <div className="notebook-mention-rows">
              <section className="notebook-reference-card">
                <h4>Character Tags</h4>
                <${ChipList}
                  items=${selectedCharacterObjects}
                  empty="No tagged characters."
                  onClick=${function (item) { if (item && item.id) { window.location.href = "characters.html?character=" + encodeURIComponent(item.id); } }}
                />
              </section>
              <section className="notebook-reference-card">
                <h4>Location Tags</h4>
                <${ChipList}
                  items=${selectedLocationObjects}
                  empty="No tagged locations."
                  onClick=${function (item) { if (item && item.id) { window.location.href = "locations.html?location=" + encodeURIComponent(item.id); } }}
                />
              </section>
            </div>

            <section className="notebook-body-card">
              <div className="section-heading notebook-writing-heading">
                <h3>Rich Text Note${editMode ? " Editor" : ""}</h3>
                <span className="note-subtitle">${editMode ? "Type @ to mention Characters, Locations, Tags, Clans, Sects & Timeline Events • # for quick location tags • " + status : status}</span>
              </div>
              <${window.MentionEditor.MentionRichTextEditor}
                editable=${editMode}
                value=${String(draft.bodyHtml || "")}
                onChange=${function (htmlValue) { updateDraftField("bodyHtml", htmlValue); }}
                editorClassName="rich-editor profile-rich-editor character-rich-text notebook-editor"
                viewerClassName="profile-biography-content character-rich-text"
              />
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
