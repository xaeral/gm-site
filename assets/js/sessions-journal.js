(function () {
  if (!window.React || !window.ReactDOM || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  var journal = window.ChronicleSessionJournal;
  var shared = window.CampaignAtlasCharactersShared || {};

  if (!journal || !shared.readCampaignAtlasState || !shared.saveCharacterToCampaignAtlas || !shared.CharacterBiographyWorkspace) {
    var target = document.getElementById("sessionJournalApp");
    if (target) {
      target.textContent = "Session Journal data layer unavailable.";
    }
    return;
  }

  function clone(value) {
    return shared.clone ? shared.clone(value) : JSON.parse(JSON.stringify(value));
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

  function stableHash(value) {
    var text = String(value || "");
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function formatDateDisplay(value) {
    var date = String(value || "").trim();
    if (!date) {
      return "Date not set";
    }
    var parsed = new Date(date + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }
    return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
  }

  function plainTextFromHtml(htmlValue) {
    var container = document.createElement("div");
    container.innerHTML = String(htmlValue || "");
    container.querySelectorAll("br").forEach(function (node) {
      node.replaceWith(document.createTextNode("\n"));
    });
    container.querySelectorAll("p, div, li, blockquote, h1, h2, h3, h4, h5, h6, tr").forEach(function (node) {
      if (node.childNodes.length) {
        node.appendChild(document.createTextNode("\n"));
      }
    });
    var text = (container.textContent || "").replace(/\r/g, "");
    return text;
  }

  function detectMentionState(editor) {
    if (!editor) {
      return null;
    }
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return null;
    }
    var range = selection.getRangeAt(0).cloneRange();
    try {
      range.selectNodeContents(editor);
      range.setEnd(selection.anchorNode, selection.anchorOffset);
    } catch (_error) {
      return null;
    }
    var textBeforeCaret = range.toString();
    var match = /(?:^|\s)([@#])([\w'-]*)$/.exec(textBeforeCaret);
    if (!match) {
      return null;
    }
    return { trigger: match[1], query: match[2] };
  }

  function applyMentionAutocomplete(mentionState, optionLabel) {
    if (!mentionState || !optionLabel) {
      return;
    }
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }
    var query = String(mentionState.query || "");
    var normalizedOption = String(optionLabel || "");
    var suffix = normalizedOption;
    if (query && normalizedOption.toLowerCase().indexOf(query.toLowerCase()) === 0) {
      suffix = normalizedOption.slice(query.length);
    }
    document.execCommand("insertText", false, suffix + " ");
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

    var summary = !selectedLabels.length
      ? allLabel
      : (selectedLabels.length === 1 ? selectedLabels[0] : (selectedLabels.length + " Selected"));

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
        <span className="character-filter-trigger-text">${summary}</span>
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

  function TimelineReviewModal(props) {
    var open = props.open;
    var events = props.events || [];
    var characterOptions = props.characterOptions || [];
    var locationOptions = props.locationOptions || [];
    var onChangeEvent = props.onChangeEvent;
    var onToggleAccept = props.onToggleAccept;
    var onRemove = props.onRemove;
    var onCancel = props.onCancel;
    var onConfirm = props.onConfirm;

    if (!open) {
      return null;
    }

    return html`<div className="chronicle-modal" role="dialog" aria-modal="true" aria-label="Timeline events detected">
      <div className="chronicle-modal-backdrop" onClick=${onCancel}></div>
      <div className="chronicle-modal-panel card session-review-modal">
        <div className="chronicle-modal-head">
          <h3>Timeline Events Detected</h3>
          <button type="button" className="icon-button chronicle-modal-close-button" aria-label="Close dialog" onClick=${onCancel}>×</button>
        </div>
        <div className="session-review-list">
          ${events.length ? events.map(function (event, index) {
            return html`<section className="session-review-item" key=${"review-event-" + event.id + "-" + index}>
              <div className="session-review-item-head">
                <label className="session-review-accept">
                  <input type="checkbox" checked=${event.accepted ? "checked" : undefined} onChange=${function () { onToggleAccept(index); }} />
                  <span>${event.accepted ? "✓" : "○"} ${event.rawText}</span>
                </label>
                <button type="button" onClick=${function () { onRemove(index); }}>Remove</button>
              </div>
              <div className="chronicle-modal-grid session-review-grid">
                <label>Event Date <span className="required-mark" aria-hidden="true">*</span>
                  <input type="date" required=${true} value=${event.date || ""} onInput=${function (entry) { onChangeEvent(index, "date", entry.target.value); }} />
                </label>
                <label>Associated Location
                  <select value=${event.locationId || ""} onChange=${function (entry) { onChangeEvent(index, "locationId", entry.target.value); }}>
                    <option value="">None</option>
                    ${locationOptions.map(function (option, optionIndex) {
                      return html`<option key=${"review-location-option-" + option.value + "-" + optionIndex} value=${option.value}>${option.label}</option>`;
                    })}
                  </select>
                </label>
                <label className="chronicle-span-2">Event Title
                  <input type="text" value=${event.title || ""} onInput=${function (entry) { onChangeEvent(index, "title", entry.target.value); }} />
                </label>
                <label className="chronicle-span-2">Event Description
                  <textarea rows="3" value=${event.description || ""} onInput=${function (entry) { onChangeEvent(index, "description", entry.target.value); }}></textarea>
                </label>
                <label className="chronicle-span-2">Associated Character(s)
                  <select multiple value=${event.characterIds || []} onChange=${function (entry) {
                    var selected = Array.from(entry.target.selectedOptions || []).map(function (opt) { return opt.value; });
                    onChangeEvent(index, "characterIds", selected);
                  }}>
                    ${characterOptions.map(function (option, optionIndex) {
                      return html`<option key=${"review-character-option-" + option.value + "-" + optionIndex} value=${option.value}>${option.label}</option>`;
                    })}
                  </select>
                </label>
              </div>
              ${event.accepted && !event.date ? html`<p className="hint session-review-warning">Event Date is required before this event can be added to the Timeline.</p>` : null}
              ${event.accepted && !(event.characterIds || []).length ? html`<p className="hint session-review-warning">Select at least one Associated Character so this event can be linked into the Timeline.</p>` : null}
            </section>`;
          }) : html`<p className="hint">No timeline events detected.</p>`}
        </div>
        <div className="chronicle-modal-actions">
          <button type="button" onClick=${onCancel}>Cancel</button>
          <button type="button" onClick=${onConfirm}>Confirm Events</button>
        </div>
      </div>
    </div>`;
  }

  function App() {
    var _state = useState({ sessions: [] });
    var state = _state[0];
    var setState = _state[1];

    var _characters = useState([]);
    var characters = _characters[0];
    var setCharacters = _characters[1];

    var _locations = useState([]);
    var locations = _locations[0];
    var setLocations = _locations[1];

    var _selectedSessionId = useState(null);
    var selectedSessionId = _selectedSessionId[0];
    var setSelectedSessionId = _selectedSessionId[1];

    var _draft = useState(null);
    var draft = _draft[0];
    var setDraft = _draft[1];

    var _status = useState("Loading sessions...");
    var status = _status[0];
    var setStatus = _status[1];

    var _searchTerm = useState("");
    var searchTerm = _searchTerm[0];
    var setSearchTerm = _searchTerm[1];

    var _explorerSearch = useState("");
    var explorerSearch = _explorerSearch[0];
    var setExplorerSearch = _explorerSearch[1];

    var _filters = useState({ characters: [], locations: [], tags: [], dates: [] });
    var filters = _filters[0];
    var setFilters = _filters[1];

    var _mentionState = useState(null);
    var mentionState = _mentionState[0];
    var setMentionState = _mentionState[1];

    var _reviewOpen = useState(false);
    var reviewOpen = _reviewOpen[0];
    var setReviewOpen = _reviewOpen[1];

    var _reviewEvents = useState([]);
    var reviewEvents = _reviewEvents[0];
    var setReviewEvents = _reviewEvents[1];

    var draftCacheRef = useRef({});

    useEffect(function () {
      var cancelled = false;
      Promise.all([
        journal.readSessionJournalState(),
        shared.readCampaignAtlasState(),
        shared.readLocationRecords ? shared.readLocationRecords() : Promise.resolve([])
      ]).then(function (results) {
        if (cancelled) {
          return;
        }
        var journalState = results[0] || { sessions: [] };
        var atlas = results[1] || { characters: [] };
        var locationRecords = results[2] || [];
        setState({ sessions: journalState.sessions || [] });
        setCharacters(Array.isArray(atlas.characters) ? atlas.characters : []);
        setLocations(Array.isArray(locationRecords) ? locationRecords : []);
        if (!selectedSessionId && journalState.sessions && journalState.sessions.length) {
          setSelectedSessionId(journalState.sessions[0].id);
        }
        setStatus("Session journal ready.");
      }).catch(function () {
        if (!cancelled) {
          setStatus("Unable to load session journal.");
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
      if (!selectedSessionId) {
        setDraft(null);
        return;
      }
      setMentionState(null);
      var cached = draftCacheRef.current[selectedSessionId];
      if (cached) {
        setDraft(clone(cached));
        return;
      }
      setDraft(null);
      var cancelled = false;
      journal.readSessionById(selectedSessionId).then(function (session) {
        if (cancelled || !session || session.id !== selectedSessionId) {
          return;
        }
        draftCacheRef.current[session.id] = clone(session);
        setDraft(clone(session));
      }).catch(function () {
        if (!cancelled) {
          setStatus("Unable to load selected session.");
        }
      });
      return function () {
        cancelled = true;
      };
    }, [selectedSessionId]);

    var characterOptions = useMemo(function () {
      return (characters || []).map(function (character) {
        return { value: character.id, label: character.name || character.id };
      }).sort(function (a, b) {
        return a.label.localeCompare(b.label);
      });
    }, [characters]);

    var locationOptions = useMemo(function () {
      var fromStore = (locations || []).map(function (location) {
        var id = normalizeString(location.id, "");
        var label = normalizeString(location.name, id || "Unknown Location");
        return { value: id || label, label: label };
      });
      var unique = {};
      fromStore.forEach(function (entry) {
        if (entry && entry.value && !unique[entry.value]) {
          unique[entry.value] = entry;
        }
      });
      return Object.keys(unique).map(function (key) { return unique[key]; }).sort(function (a, b) {
        return a.label.localeCompare(b.label);
      });
    }, [locations]);

    var tagOptions = useMemo(function () {
      return uniqueStrings((state.sessions || []).reduce(function (all, session) {
        return all.concat(Array.isArray(session.tags) ? session.tags : []);
      }, [])).map(function (tag) {
        return { value: tag, label: tag };
      });
    }, [state.sessions]);

    var dateOptions = useMemo(function () {
      return uniqueStrings((state.sessions || []).map(function (session) { return session.datePlayed; })).map(function (date) {
        return { value: date, label: formatDateDisplay(date) };
      });
    }, [state.sessions]);

    var visibleSessions = useMemo(function () {
      return journal.filterSessions(state.sessions || [], filters, searchTerm);
    }, [state.sessions, searchTerm, JSON.stringify(filters)]);

    var explorerSessions = useMemo(function () {
      var term = normalizeString(explorerSearch, "").toLowerCase();
      if (!term) {
        return visibleSessions;
      }
      return visibleSessions.filter(function (session) {
        var title = String(session.title || "").toLowerCase();
        var number = String(session.sessionNumber || "").toLowerCase();
        var date = String(session.datePlayed || "").toLowerCase();
        return title.indexOf(term) >= 0 || number.indexOf(term) >= 0 || date.indexOf(term) >= 0;
      });
    }, [visibleSessions, explorerSearch]);

    function toggleFilterValue(field, value) {
      setFilters(function (current) {
        var next = clone(current);
        var bucket = Array.isArray(next[field]) ? next[field] : [];
        next[field] = bucket.indexOf(value) >= 0 ? bucket.filter(function (entry) { return entry !== value; }) : bucket.concat([value]);
        return next;
      });
    }

    function clearFilters() {
      setSearchTerm("");
      setFilters({ characters: [], locations: [], tags: [], dates: [] });
    }

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

    function parseInlineReferences(sessionDraft) {
      var bodyText = plainTextFromHtml(sessionDraft.bodyHtml || "");
      var lines = bodyText.split(/\n+/);
      var characterMatches = [];
      var locationMatches = [];

      lines.forEach(function (line) {
        var characterRegex = /@([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,4})/g;
        var locationRegex = /#([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,4})/g;
        var match;
        while ((match = characterRegex.exec(line))) {
          characterMatches.push(normalizeString(match[1], ""));
        }
        while ((match = locationRegex.exec(line))) {
          locationMatches.push(normalizeString(match[1], ""));
        }
      });

      var characterIds = uniqueStrings(characterMatches.map(function (name) {
        var found = characterOptions.find(function (option) { return option.label.toLowerCase() === name.toLowerCase(); })
          || characterOptions.find(function (option) { return option.label.toLowerCase().indexOf(name.toLowerCase()) >= 0; });
        return found ? found.value : "";
      }).filter(Boolean));

      var locationIds = uniqueStrings(locationMatches.map(function (name) {
        var found = locationOptions.find(function (option) { return option.label.toLowerCase() === name.toLowerCase(); })
          || locationOptions.find(function (option) { return option.label.toLowerCase().indexOf(name.toLowerCase()) >= 0; });
        return found ? found.value : "";
      }).filter(Boolean));

      var timelineDetected = [];
      lines.forEach(function (line, index) {
        var trimmed = String(line || "").trim();
        if (!trimmed) {
          return;
        }
        var eventMatches = trimmed.match(/!\s*([^!].*?)(?=\s*!\s*|$)/g);
        if (!eventMatches || !eventMatches.length) {
          return;
        }
        eventMatches.forEach(function (eventChunk, chunkIndex) {
          var raw = String(eventChunk || "").replace(/^!\s*/, "").trim();
          if (!raw) {
            return;
          }
          var eventCharacterIds = uniqueStrings(characterOptions.filter(function (option) {
            return raw.toLowerCase().indexOf(option.label.toLowerCase()) >= 0;
          }).map(function (option) { return option.value; }));
          var eventLocation = locationOptions.find(function (option) {
            return raw.toLowerCase().indexOf(option.label.toLowerCase()) >= 0;
          });
          timelineDetected.push({
            id: "detected-" + index + "-" + chunkIndex + "-" + stableHash(raw),
            rawText: raw,
            accepted: true,
            date: normalizeString(sessionDraft.datePlayed, ""),
            title: raw.length > 90 ? raw.slice(0, 90) : raw,
            description: raw,
            characterIds: eventCharacterIds,
            locationId: eventLocation ? eventLocation.value : ""
          });
        });
      });

      return {
        characterIds: characterIds,
        locationIds: locationIds,
        timelineDetected: timelineDetected,
        bodyText: bodyText
      };
    }

    function handleEditorKeyUp(_event, editor) {
      setMentionState(detectMentionState(editor));
    }

    function handleEditorKeyDown(event, editor) {
      if (!mentionState) {
        return;
      }
      var options = mentionState.trigger === "@" ? characterOptions : locationOptions;
      var filtered = options.filter(function (option) {
        return !mentionState.query || option.label.toLowerCase().indexOf(mentionState.query.toLowerCase()) >= 0;
      });
      if (!filtered.length) {
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        applyMentionAutocomplete(mentionState, filtered[0].label);
        setMentionState(detectMentionState(editor));
      }
      if (event.key === "Escape") {
        setMentionState(null);
      }
    }

    async function applyTimelineToCharacters(sessionPayload, acceptedEvents) {
      var validEvents = (acceptedEvents || []).filter(function (event) {
        return event && normalizeString(event.date, "") && (event.characterIds || []).length;
      });
      if (!validEvents.length) {
        return;
      }
      var atlas = await shared.readCampaignAtlasState();
      var characterById = {};
      (atlas.characters || []).forEach(function (character) {
        characterById[character.id] = clone(character);
      });

      var changedIds = {};

      validEvents.forEach(function (event) {
        (event.characterIds || []).forEach(function (characterId) {
          var character = characterById[characterId];
          if (!character) {
            return;
          }
          var timeline = Array.isArray(character.timeline) ? character.timeline.slice() : [];
          var sourceId = "session-journal:" + sessionPayload.id + ":" + event.id;
          var exists = timeline.some(function (item) {
            return item && item.sourceId === sourceId;
          });
          if (exists) {
            return;
          }
          timeline.push({
            id: "tl-" + sourceId,
            date: normalizeString(event.date, sessionPayload.datePlayed || ""),
            title: event.title || event.rawText || "Session Event",
            description: event.description || event.rawText || "",
            location: event.locationId || "",
            relatedSession: "Session " + sessionPayload.sessionNumber,
            sourceId: sourceId
          });
          character.timeline = timeline;
          characterById[characterId] = character;
          changedIds[characterId] = true;
        });
      });

      var changedCharacters = Object.keys(changedIds).map(function (id) { return characterById[id]; });
      if (!changedCharacters.length) {
        return;
      }
      await Promise.all(changedCharacters.map(function (character) {
        return shared.saveCharacterToCampaignAtlas(character);
      }));

      if (typeof window.BroadcastChannel === "function") {
        var channel = new window.BroadcastChannel("campaign-atlas-characters");
        changedCharacters.forEach(function (character) {
          channel.postMessage({ type: "character-updated", source: "session-journal", character: clone(character) });
        });
        channel.close();
      }
    }

    async function commitSaveFromReview(currentDraft, detected, reviewList) {
      var accepted = (reviewList || []).filter(function (entry) { return entry && entry.accepted; });
      var payload = clone(currentDraft);
      payload.characterIds = detected.characterIds;
      payload.locationIds = detected.locationIds;
      payload.timelineEvents = accepted.map(function (entry) {
        return {
          id: entry.id,
          date: entry.date,
          title: entry.title,
          description: entry.description,
          characterIds: entry.characterIds || [],
          locationId: entry.locationId || "",
          rawText: entry.rawText || ""
        };
      });
      payload.lastEditedAt = new Date().toISOString();
      var saved = await journal.saveSession(payload);
      draftCacheRef.current[saved.id] = clone(saved);
      setDraft(clone(saved));
      var nextState = await journal.readSessionJournalState();
      setState({ sessions: nextState.sessions || [] });
      await applyTimelineToCharacters(saved, accepted);
      setStatus("Session saved. " + accepted.length + " timeline event" + (accepted.length === 1 ? "" : "s") + " applied.");
    }

    async function saveSessionWithReview() {
      if (!draft) {
        return;
      }
      var detected = parseInlineReferences(draft);
      if (detected.timelineDetected.length) {
        setReviewEvents(detected.timelineDetected);
        setReviewOpen(true);
        return;
      }
      await commitSaveFromReview(draft, detected, []);
    }

    async function confirmTimelineReview() {
      if (!draft) {
        return;
      }
      var accepted = (reviewEvents || []).filter(function (entry) { return entry && entry.accepted; });
      if (accepted.some(function (entry) { return !normalizeString(entry.date, ""); })) {
        window.alert("Every accepted event needs an Event Date before it can be added to the Timeline.");
        return;
      }
      if (accepted.some(function (entry) { return !(entry.characterIds || []).length; })) {
        window.alert("Every accepted event needs at least one Associated Character before it can be added to the Timeline.");
        return;
      }
      var detected = parseInlineReferences(draft);
      await commitSaveFromReview(draft, detected, reviewEvents);
      setReviewOpen(false);
      setReviewEvents([]);
    }

    function cancelTimelineReview() {
      setReviewOpen(false);
      setReviewEvents([]);
    }

    function updateReviewEvent(index, field, value) {
      setReviewEvents(function (current) {
        var next = (current || []).slice();
        if (!next[index]) {
          return current;
        }
        next[index] = Object.assign({}, next[index], {});
        next[index][field] = value;
        return next;
      });
    }

    function toggleReviewAccepted(index) {
      setReviewEvents(function (current) {
        var next = (current || []).slice();
        if (!next[index]) {
          return current;
        }
        next[index] = Object.assign({}, next[index], { accepted: !next[index].accepted });
        return next;
      });
    }

    function removeReviewEvent(index) {
      setReviewEvents(function (current) {
        var next = (current || []).slice();
        if (index >= 0 && index < next.length) {
          next.splice(index, 1);
        }
        return next;
      });
    }

    async function selectSession(sessionId) {
      setSelectedSessionId(sessionId);
    }

    async function createSession() {
      var created = await journal.createSession();
      draftCacheRef.current[created.id] = clone(created);
      var nextState = await journal.readSessionJournalState();
      setState({ sessions: nextState.sessions || [] });
      setSelectedSessionId(created.id);
      setStatus("Session created.");
    }

    async function deleteSession() {
      if (!draft || !window.confirm("Delete this session?")) {
        return;
      }
      await journal.deleteSession(draft.id);
      delete draftCacheRef.current[draft.id];
      var nextState = await journal.readSessionJournalState();
      setState({ sessions: nextState.sessions || [] });
      var first = (nextState.sessions || [])[0] || null;
      setSelectedSessionId(first ? first.id : null);
      setStatus("Session deleted.");
    }

    var liveSummary = useMemo(function () {
      if (!draft) {
        return {
          characterCount: 0,
          locationCount: 0,
          eventCount: 0,
          words: 0,
          lastEdited: "Not saved yet"
        };
      }
      var parsed = parseInlineReferences(draft);
      var words = parsed.bodyText.trim() ? parsed.bodyText.trim().split(/\s+/).length : 0;
      return {
        characterCount: parsed.characterIds.length,
        locationCount: parsed.locationIds.length,
        eventCount: parsed.timelineDetected.length,
        words: words,
        lastEdited: draft.lastEditedAt ? new Date(draft.lastEditedAt).toLocaleString() : "Not saved yet"
      };
    }, [draft && draft.bodyHtml, draft && draft.lastEditedAt, JSON.stringify(characterOptions), JSON.stringify(locationOptions)]);

    var mentionOptions = useMemo(function () {
      if (!mentionState) {
        return [];
      }
      var options = mentionState.trigger === "@" ? characterOptions : locationOptions;
      return options.filter(function (option) {
        return !mentionState.query || option.label.toLowerCase().indexOf(mentionState.query.toLowerCase()) >= 0;
      }).slice(0, 12);
    }, [mentionState, characterOptions, locationOptions]);

    return html`<section className="gm-notebook-page session-journal-page">
      <div className="gm-notebook-global-toolbar session-journal-toolbar card">
        <div className="gm-notebook-global-search">
          <label htmlFor="sessionSearch">Search</label>
          <input id="sessionSearch" type="search" value=${searchTerm} placeholder="Search sessions, recaps, tags..." onInput=${function (event) { setSearchTerm(event.target.value); }} />
        </div>
        <div className="gm-notebook-filter-row">
          <${SearchFilterDropdown}
            key="session-filter-character"
            id="sessionCharacterFilter"
            label="Character"
            allLabel="All Characters"
            options=${characterOptions}
            selected=${filters.characters}
            onToggle=${function (value) { toggleFilterValue("characters", value); }}
          />
          <${SearchFilterDropdown}
            key="session-filter-location"
            id="sessionLocationFilter"
            label="Location"
            allLabel="All Locations"
            options=${locationOptions}
            selected=${filters.locations}
            onToggle=${function (value) { toggleFilterValue("locations", value); }}
          />
          <${SearchFilterDropdown}
            key="session-filter-tag"
            id="sessionTagFilter"
            label="Tags"
            allLabel="All Tags"
            options=${tagOptions}
            selected=${filters.tags}
            onToggle=${function (value) { toggleFilterValue("tags", value); }}
          />
          <${SearchFilterDropdown}
            key="session-filter-date"
            id="sessionDateFilter"
            label="Date"
            allLabel="All Dates"
            options=${dateOptions}
            selected=${filters.dates}
            onToggle=${function (value) { toggleFilterValue("dates", value); }}
          />
          <button type="button" className="notebook-clear-button" onClick=${clearFilters}>Clear Filters</button>
        </div>
        <button type="button" className="notebook-primary-add" aria-label="Create new session" onClick=${createSession}>+</button>
      </div>

      <div className="gm-notebook-workspace">
        <aside className="gm-notebook-explorer session-explorer">
          <div className="gm-notebook-explorer-head">
            <h3>Session Explorer</h3>
            <p>${explorerSessions.length} Session${explorerSessions.length === 1 ? "" : "s"}</p>
          </div>
          <div className="gm-notebook-explorer-controls">
            <input type="search" placeholder="Search Sessions" value=${explorerSearch} onInput=${function (event) { setExplorerSearch(event.target.value); }} />
          </div>
          <div className="session-explorer-list">
            ${explorerSessions.length ? explorerSessions.map(function (session, index) {
              var isActive = session.id === selectedSessionId;
              return html`<button key=${"session-card-" + session.id + "-" + index} type="button" className=${"notebook-note-card session-card" + (isActive ? " active" : "") + (session.pinned ? " pinned" : "")} onClick=${function () { selectSession(session.id); }}>
                <strong>Session ${session.sessionNumber || "?"}</strong>
                <span>${session.title || "Untitled Session"}</span>
                <p>${formatDateDisplay(session.datePlayed)}</p>
              </button>`;
            }) : html`<p className="hint">${(state.sessions || []).length ? "No sessions match current search and filters." : "No sessions yet."}</p>`}
          </div>
        </aside>

        <section className="gm-notebook-editor session-editor">
          ${draft ? html`
            <div className="notebook-editor-header">
              <input type="text" className="notebook-title-input" value=${draft.title || ""} placeholder="Session Title" onInput=${function (event) { updateDraftField("title", event.target.value); }} />
              <div className="notebook-editor-actions">
                <button type="button" onClick=${function () { updateDraftField("pinned", !draft.pinned); }}>${draft.pinned ? "Unpin" : "Pin"}</button>
                <button type="button" onClick=${function () { updateDraftField("archived", !draft.archived); }}>${draft.archived ? "Unarchive" : "Archive"}</button>
                <button type="button" className="destructive" onClick=${deleteSession}>Delete</button>
                <button type="button" onClick=${saveSessionWithReview}>Save</button>
              </div>
            </div>

            <div className="notebook-metadata-grid session-metadata-grid">
              <label>Session Number
                <input type="number" min="1" value=${draft.sessionNumber || 1} onInput=${function (event) { updateDraftField("sessionNumber", Number(event.target.value || 1)); }} />
              </label>
              <label>Date Played
                <input type="date" value=${draft.datePlayed || ""} onInput=${function (event) { updateDraftField("datePlayed", event.target.value); }} />
              </label>
              <label>General Tags
                <input value=${(draft.tags || []).join(", ")} onInput=${function (event) { updateDraftField("tags", String(event.target.value || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean)); }} placeholder="boons, blood-hunt, praxis" />
              </label>
            </div>

            <section className="notebook-reference-card session-summary-card">
              <div className="section-heading">
                <h3>Live Summary</h3>
                <span className="note-subtitle">Updates as you write</span>
              </div>
              <div className="session-summary-grid">
                <article><strong>Characters Mentioned</strong><span>${liveSummary.characterCount}</span></article>
                <article><strong>Locations Mentioned</strong><span>${liveSummary.locationCount}</span></article>
                <article><strong>Timeline Events Detected</strong><span>${liveSummary.eventCount}</span></article>
                <article><strong>Word Count</strong><span>${liveSummary.words}</span></article>
                <article className="session-summary-span-2"><strong>Last Edited</strong><span>${liveSummary.lastEdited}</span></article>
              </div>
            </section>

            <section className="notebook-body-card session-journal-body">
              <div className="section-heading notebook-writing-heading">
                <h3>Session Journal</h3>
                <span className="note-subtitle">Type naturally with @Character, #Location, and !Important Event • ${status}</span>
              </div>
              <${shared.CharacterBiographyWorkspace}
                editable=${true}
                value=${String(draft.bodyHtml || "")}
                onChange=${function (htmlValue) { updateDraftField("bodyHtml", htmlValue); updateDraftField("lastEditedAt", new Date().toISOString()); }}
                editorClassName="rich-editor profile-rich-editor character-rich-text session-rich-editor"
                viewerClassName="profile-biography-content character-rich-text"
                onEditorKeyUp=${handleEditorKeyUp}
                onEditorKeyDown=${handleEditorKeyDown}
              />
              ${mentionState ? html`<div className="notebook-mention-picker session-mention-picker">
                <div className="section-heading">
                  <h3>${mentionState.trigger === "@" ? "Character Suggestions" : "Location Suggestions"}</h3>
                  <span className="note-subtitle">Enter or Tab to accept • Esc to dismiss</span>
                </div>
                <div className="notebook-mention-results">
                  ${mentionOptions.length ? mentionOptions.map(function (option, index) {
                    return html`<button key=${"session-mention-" + option.value + "-" + index} type="button" className="notebook-mention-option" onClick=${function () { applyMentionAutocomplete(mentionState, option.label); setMentionState(null); }}>
                      <strong>${option.label}</strong>
                    </button>`;
                  }) : html`<p className="hint">No matches.</p>`}
                </div>
              </div>` : null}
            </section>
          ` : ((state.sessions || []).length ? html`<div className="profile-empty">Select or create a session to begin journaling.</div>` : html`<div className="session-empty-state">
              <h3>No sessions have been recorded yet.</h3>
              <p>Start your campaign's record by logging your first session.</p>
              <button type="button" className="session-empty-create" onClick=${createSession}>+ Create Session</button>
            </div>`)}
        </section>
      </div>

      <${TimelineReviewModal}
        open=${reviewOpen}
        events=${reviewEvents}
        characterOptions=${characterOptions}
        locationOptions=${locationOptions}
        onChangeEvent=${updateReviewEvent}
        onToggleAccept=${toggleReviewAccepted}
        onRemove=${removeReviewEvent}
        onCancel=${cancelTimelineReview}
        onConfirm=${confirmTimelineReview}
      />
    </section>`;
  }

  var root = document.getElementById("sessionJournalApp");
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(React.createElement(App));
})();
