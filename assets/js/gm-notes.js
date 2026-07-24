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

  function uniqueStrings(values) {
    return Array.from(new Set((values || []).map(function (value) { return String(value || "").trim(); }).filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function stripHtml(htmlValue) {
    return notebook.stripHtml ? notebook.stripHtml(htmlValue) : String(htmlValue || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function optionLabelFromCharacter(character) {
    return character.name + (character.clan ? " • " + character.clan : "") + (character.sect ? " • " + character.sect : "");
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
      ${items.map(function (item) {
        return html`<button
          type="button"
          key=${item.id}
          className="notebook-chip"
          onClick=${function () { if (onClick) { onClick(item); } }}
        >
          <span>${item.label}</span>
          ${onRemove ? html`<strong aria-hidden="true" onClick=${function (event) { event.stopPropagation(); onRemove(item); }}>×</strong>` : null}
        </button>`;
      })}
    </div>`;
  }

  function FilterDropdown(props) {
    var label = props.label;
    var options = props.options || [];
    var selected = props.selected || [];
    var onToggle = props.onToggle;
    var active = props.active;
    var setActive = props.setActive;
    var summary = props.summary || (selected.length ? selected.length + " Selected" : "All");
    var id = props.id;

    return html`<div className="character-filter-dropdown notebook-filter-dropdown">
      <span className="character-filter-label">${label}</span>
      <button
        type="button"
        className=${"character-filter-trigger" + (active ? " open" : "")}
        aria-haspopup="menu"
        aria-expanded=${active ? "true" : "false"}
        aria-controls=${id}
        onClick=${function () { setActive(active ? null : id); }}
      >
        <span className="character-filter-trigger-text">${summary}</span>
        <span className="character-filter-trigger-caret" aria-hidden="true">v</span>
      </button>
      ${active ? html`<div id=${id} className="character-filter-menu notebook-filter-menu" role="menu">
        ${options.length ? options.map(function (option) {
          var checked = selected.indexOf(option.value) >= 0;
          return html`<button
            type="button"
            key=${option.value}
            className=${"character-filter-option" + (checked ? " checked" : "")}
            role="menuitemcheckbox"
            aria-checked=${checked ? "true" : "false"}
            onClick=${function () { onToggle(option.value); }}
          >
            <span className="character-filter-check" aria-hidden="true"></span>
            <span>${option.label}</span>
          </button>`;
        }) : html`<div className="character-filter-option notebook-filter-empty"><span></span><span>No options yet.</span></div>`}
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

    var _selectedNoteId = useState(null);
    var selectedNoteId = _selectedNoteId[0];
    var setSelectedNoteId = _selectedNoteId[1];

    var _draft = useState(null);
    var draft = _draft[0];
    var setDraft = _draft[1];

    var _searchTerm = useState("");
    var searchTerm = _searchTerm[0];
    var setSearchTerm = _searchTerm[1];

    var _activeDropdown = useState(null);
    var activeDropdown = _activeDropdown[0];
    var setActiveDropdown = _activeDropdown[1];

    var _filters = useState({ folderIds: [], sessions: [], characters: [], locations: [], tags: [] });
    var filters = _filters[0];
    var setFilters = _filters[1];

    var _mentionState = useState(null);
    var mentionState = _mentionState[0];
    var setMentionState = _mentionState[1];

    var _status = useState("Loading notebook...");
    var status = _status[0];
    var setStatus = _status[1];

    var editorRef = useRef(null);
    var saveTimerRef = useRef(null);
    var noteBodyCacheRef = useRef({});
    var prefetchRunnerRef = useRef(null);

    useEffect(function () {
      var cancelled = false;
      Promise.all([
        notebook.readNotebookState(),
        shared.readCampaignAtlasState ? shared.readCampaignAtlasState() : Promise.resolve({ characters: [] })
      ]).then(function (results) {
        if (cancelled) {
          return;
        }

        var notebookState = results[0] || { folders: [], notes: [] };
        var characterState = results[1] || { characters: [] };
        var notes = notebookState.notes || [];

        setState({ folders: notebookState.folders || [], notes: notes });
        setCharacters(Array.isArray(characterState.characters) ? characterState.characters : []);
        setStatus(notes.length ? "Notebook ready." : "Notebook ready. Create your first note.");

        if (!selectedNoteId) {
          if (notes.length) {
            setSelectedNoteId(notes[0].id);
          } else {
            notebook.createNote(notebook.getDefaultFolderId()).then(function (note) {
              return notebook.readNotebookState().then(function (nextState) {
                if (cancelled) {
                  return;
                }
                setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
                setSelectedNoteId(note.id);
              });
            });
          }
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
      if (!selectedNoteId) {
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
        });
      }, 250);
      return function () {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [draft && draft.id, draft && draft.title, draft && draft.bodyHtml, draft && draft.folderId, draft && draft.sessionLabel, draft && draft.pinned, draft && draft.archived, JSON.stringify(draft && draft.characterIds ? draft.characterIds : []), JSON.stringify(draft && draft.locationIds ? draft.locationIds : []), JSON.stringify(draft && draft.tags ? draft.tags : [])]);

    var visibleNotes = useMemo(function () {
      return notebook.filterNotes(state.notes || [], state, filters, searchTerm).slice().sort(function (a, b) {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
    }, [state.notes, state.folders, searchTerm, JSON.stringify(filters)]);

    var groupedByFolder = useMemo(function () {
      var groups = {};
      visibleNotes.forEach(function (note) {
        var folderId = note.folderId || notebook.getDefaultFolderId();
        if (!groups[folderId]) {
          groups[folderId] = [];
        }
        groups[folderId].push(note);
      });
      return groups;
    }, [visibleNotes]);

    var folderOptions = useMemo(function () {
      return (state.folders || []).map(function (folder) { return { value: folder.id, label: folder.title }; });
    }, [state.folders]);

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

    var locationOptions = useMemo(function () {
      var seeded = Array.isArray(window.GMData && window.GMData.locations) ? window.GMData.locations : [];
      var noteLocations = (state.notes || []).reduce(function (all, note) {
        return all.concat(Array.isArray(note.locationIds) ? note.locationIds : []);
      }, []);
      return uniqueStrings(seeded.concat(noteLocations)).map(function (location) {
        return { value: location, label: location };
      });
    }, [state.notes]);

    var characterOptions = useMemo(function () {
      return (characters || []).map(function (character) {
        return { value: character.id, label: optionLabelFromCharacter(character) };
      }).sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [characters]);

    var selectedCharacterObjects = (draft && draft.characterIds ? draft.characterIds : []).map(function (id) {
      return characters.find(function (character) { return character.id === id; });
    }).filter(Boolean).map(function (character) {
      return { id: character.id, label: optionLabelFromCharacter(character) };
    });

    var selectedLocationObjects = (draft && draft.locationIds ? draft.locationIds : []).map(function (id) {
      return { id: id, label: id };
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

    async function selectNote(noteId) {
      if (draft) {
        await notebook.saveNote(draft, draft.folderId);
      }
      setSelectedNoteId(noteId);
    }

    async function createNoteInFolder(folderId) {
      var note = await notebook.createNote(folderId || notebook.getDefaultFolderId());
      var nextState = await notebook.readNotebookState();
      setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
      noteBodyCacheRef.current[note.id] = null;
      setSelectedNoteId(note.id);
      setStatus("New note created.");
    }

    async function createFolderFromPrompt() {
      var name = window.prompt("Folder name", "Custom Folder");
      if (!name) {
        return;
      }
      await notebook.createFolder(name);
      var nextState = await notebook.readNotebookState();
      setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
      setStatus("Folder created.");
    }

    async function toggleFolder(folder) {
      var nextFolder = clone(folder);
      nextFolder.collapsed = !folder.collapsed;
      await notebook.saveFolder(nextFolder);
      var nextState = await notebook.readNotebookState();
      setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
    }

    async function moveNote(noteId, folderId) {
      await notebook.moveNote(noteId, folderId);
      var nextState = await notebook.readNotebookState();
      setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
      setStatus("Note moved.");
    }

    function handleEditorKeyUp(event, editor) {
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

    function updateNoteTags(value) {
      updateDraftField("tags", String(value || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean));
    }

    var selectedFolderId = draft ? draft.folderId : notebook.getDefaultFolderId();

    return html`<section className="gm-notebook-workspace">
      <aside className="card gm-notebook-explorer">
        <div className="section-heading">
          <h3>Notebook Explorer</h3>
          <span className="note-subtitle">${visibleNotes.length} notes</span>
        </div>
        <div className="notebook-toolbar">
          <input
            type="search"
            placeholder="Search note title, body, tags, sessions, locations..."
            value=${searchTerm}
            onInput=${function (event) { setSearchTerm(event.target.value); }}
          />
          <div className="notebook-toolbar-actions">
            <button type="button" onClick=${function () { createNoteInFolder(selectedFolderId); }}>New Note</button>
            <button type="button" onClick=${createFolderFromPrompt}>New Folder</button>
          </div>
        </div>

        <div className="notebook-filter-grid">
          <${FilterDropdown}
            id="folderFilterMenu"
            label="Folder"
            options=${folderOptions}
            selected=${filters.folderIds}
            summary=${filters.folderIds && filters.folderIds.length ? filters.folderIds.length + " Selected" : "All Folders"}
            active=${activeDropdown === "folderFilterMenu"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) {
              setFilters(function (current) {
                var next = clone(current);
                next.folderIds = (next.folderIds || []).indexOf(value) >= 0 ? (next.folderIds || []).filter(function (entry) { return entry !== value; }) : (next.folderIds || []).concat([value]);
                return next;
              });
            }}
          />
          <${FilterDropdown}
            id="sessionFilterMenu"
            label="Session"
            options=${sessionOptions}
            selected=${filters.sessions}
            summary=${filters.sessions && filters.sessions.length ? filters.sessions.length + " Selected" : "All Sessions"}
            active=${activeDropdown === "sessionFilterMenu"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) {
              setFilters(function (current) {
                var next = clone(current);
                next.sessions = (next.sessions || []).indexOf(value) >= 0 ? (next.sessions || []).filter(function (entry) { return entry !== value; }) : (next.sessions || []).concat([value]);
                return next;
              });
            }}
          />
          <${FilterDropdown}
            id="characterFilterMenu"
            label="Character"
            options=${characterOptions}
            selected=${filters.characters}
            summary=${filters.characters && filters.characters.length ? filters.characters.length + " Selected" : "All Characters"}
            active=${activeDropdown === "characterFilterMenu"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) {
              setFilters(function (current) {
                var next = clone(current);
                next.characters = (next.characters || []).indexOf(value) >= 0 ? (next.characters || []).filter(function (entry) { return entry !== value; }) : (next.characters || []).concat([value]);
                return next;
              });
            }}
          />
          <${FilterDropdown}
            id="locationFilterMenu"
            label="Location"
            options=${locationOptions}
            selected=${filters.locations}
            summary=${filters.locations && filters.locations.length ? filters.locations.length + " Selected" : "All Locations"}
            active=${activeDropdown === "locationFilterMenu"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) {
              setFilters(function (current) {
                var next = clone(current);
                next.locations = (next.locations || []).indexOf(value) >= 0 ? (next.locations || []).filter(function (entry) { return entry !== value; }) : (next.locations || []).concat([value]);
                return next;
              });
            }}
          />
          <${FilterDropdown}
            id="tagFilterMenu"
            label="Tag"
            options=${tagOptions}
            selected=${filters.tags}
            summary=${filters.tags && filters.tags.length ? filters.tags.length + " Selected" : "All Tags"}
            active=${activeDropdown === "tagFilterMenu"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) {
              setFilters(function (current) {
                var next = clone(current);
                next.tags = (next.tags || []).indexOf(value) >= 0 ? (next.tags || []).filter(function (entry) { return entry !== value; }) : (next.tags || []).concat([value]);
                return next;
              });
            }}
          />
        </div>

        <div className="notebook-folder-list">
          ${(state.folders || []).map(function (folder) {
            var folderNotes = groupedByFolder[folder.id] || [];
            return html`<section
              className="notebook-folder-card"
              key=${folder.id}
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
                <span className="notebook-folder-count">${folderNotes.length} notes</span>
              </button>
              <div className="notebook-folder-actions">
                <button type="button" onClick=${function () { createNoteInFolder(folder.id); }}>+ Note</button>
              </div>
              ${folder.collapsed ? null : html`<div className="notebook-note-stack">
                ${folderNotes.length ? folderNotes.map(function (note) {
                  var noteText = note.previewText || "No preview available.";
                  return html`<button
                    type="button"
                    key=${note.id}
                    draggable="true"
                    className=${"notebook-note-card" + (selectedNoteId === note.id ? " active" : "") + (note.pinned ? " pinned" : "")}
                    onDragStart=${function (event) { event.dataTransfer.setData("text/notebook-note-id", note.id); }}
                    onClick=${function () { selectNote(note.id); }}
                  >
                    <strong>${note.title || "Untitled Note"}</strong>
                    <span>${note.sessionLabel || "No session"}</span>
                    <p>${noteText ? (noteText.length > 120 ? noteText.slice(0, 117) + "..." : noteText) : "No body text yet."}</p>
                    <div className="notebook-note-meta">
                      ${note.pinned ? html`<span className="tag">Pinned</span>` : null}
                      ${note.archived ? html`<span className="tag">Archived</span>` : null}
                      <span className="tag">${note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : "New"}</span>
                    </div>
                  </button>`;
                }) : html`<p className="hint">No notes in this folder.</p>`}
              </div>`}
            </section>`;
          })}
        </div>
      </aside>

      <section className="card gm-notebook-editor">
        ${draft ? html`
          <div className="section-heading notebook-editor-heading">
            <h3>Rich Text Note Editor</h3>
            <div className="notebook-editor-status">
              <span className="tag">${draft.pinned ? "Pinned" : "Unpinned"}</span>
              <span className="tag">${draft.archived ? "Archived" : "Active"}</span>
              <span className="tag">${status}</span>
            </div>
          </div>

          <div className="notebook-editor-shell">
            <div className="notebook-editor-header">
              <input
                type="text"
                className="notebook-title-input"
                value=${draft.title || ""}
                onInput=${function (event) { updateDraftField("title", event.target.value); }}
                placeholder="Note title"
              />
              <div className="notebook-editor-actions">
                <button type="button" onClick=${function () { setDraft(function (current) { var next = clone(current); next.pinned = !next.pinned; return next; }); }}>Pin</button>
                <button type="button" onClick=${function () { setDraft(function (current) { var next = clone(current); next.archived = !next.archived; return next; }); }}>Archive</button>
                <button type="button" className="destructive" onClick=${function () {
                  if (!window.confirm("Delete this note?")) {
                    return;
                  }
                  notebook.deleteNote(draft.id).then(function () {
                    return notebook.readNotebookState();
                  }).then(function (nextState) {
                    setState({ folders: nextState.folders || [], notes: nextState.notes || [] });
                    var first = (nextState.notes || [])[0] || null;
                    setSelectedNoteId(first ? first.id : null);
                    setDraft(first ? clone(first) : null);
                  });
                }}>Delete</button>
              </div>
            </div>

            <div className="notebook-metadata-grid">
              <label>Folder
                <select value=${draft.folderId || notebook.getDefaultFolderId()} onChange=${function (event) { updateDraftField("folderId", event.target.value); }}>
                  ${(state.folders || []).map(function (folder) {
                    return html`<option key=${folder.id} value=${folder.id}>${folder.title}</option>`;
                  })}
                </select>
              </label>
              <label>Session
                <input list="notebook-sessions" value=${draft.sessionLabel || ""} onInput=${function (event) { updateDraftField("sessionLabel", event.target.value); }} placeholder="Session 4" />
              </label>
              <label>General Tags
                <input value=${(draft.tags || []).join(", ")} onInput=${function (event) { updateNoteTags(event.target.value); }} placeholder="prep, rumor, important" />
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
              <div className="section-heading">
                <h3>Note Body</h3>
                <span className="note-subtitle">Type @ for characters or # for locations</span>
              </div>
              <${shared.CharacterBiographyWorkspace}
                editable=${true}
                value=${String(draft.bodyHtml || "")}
                onChange=${function (htmlValue) { updateDraftField("bodyHtml", htmlValue); }}
                editorRef=${editorRef}
                editorClassName="rich-editor profile-rich-editor character-rich-text notebook-editor"
                viewerClassName="profile-biography-content character-rich-text"
                onEditorKeyUp=${handleEditorKeyUp}
              />
              ${mentionState ? html`<div className="notebook-mention-picker">
                <div className="section-heading">
                  <h3>${mentionState.trigger === "@" ? "Character Picker" : "Location Picker"}</h3>
                  <span className="note-subtitle">${mentionState.query ? "Filtering: " + mentionState.query : "Start typing to filter"}</span>
                </div>
                <div className="notebook-mention-results">
                  ${(mentionState.trigger === "@" ? characterOptions : locationOptions)
                    .filter(function (option) { return !mentionState.query || option.label.toLowerCase().indexOf(mentionState.query.toLowerCase()) >= 0; })
                    .slice(0, 12)
                    .map(function (option) {
                      return html`<button key=${option.value} type="button" className="notebook-mention-option" onClick=${function () { addReference(mentionState.trigger === "@" ? "character" : "location", { id: option.value, label: option.label }); }}>
                        <strong>${option.label}</strong>
                      </button>`;
                    })}
                </div>
              </div>` : null}
            </section>
          </div>
        ` : selectedNoteId ? html`<div className="profile-empty">Loading note content...</div>` : html`<div className="profile-empty">No note selected.</div>`}
      </section>

      <datalist id="notebook-sessions">
        ${sessionOptions.map(function (session) { return html`<option key=${session.value} value=${session.value}></option>`; })}
      </datalist>
    </section>`;
  }

  var root = document.getElementById("gmNotebookApp");
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(React.createElement(App));
})();
