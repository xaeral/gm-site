(function () {
  if (!window.React || !window.ReactDOM || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);
  var OWNER_NONE_LABEL = "None";

  var shared = window.CampaignAtlasCharactersShared || {};
  if (!shared.readCampaignAtlasState || !shared.readLocationRecords || !shared.readLocationRecordById || !shared.saveLocationRecord || !shared.CharacterBiographyWorkspace) {
    return;
  }

  function clone(value) {
    return shared.clone ? shared.clone(value) : JSON.parse(JSON.stringify(value));
  }

  function normalizeString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) {
      return value.map(function (tag) { return String(tag || "").trim(); }).filter(Boolean);
    }
    return String(value || "").split(",").map(function (tag) { return String(tag || "").trim(); }).filter(Boolean);
  }

  function stripHtml(htmlValue) {
    if (window.ChronicleNotebook && typeof window.ChronicleNotebook.stripHtml === "function") {
      return window.ChronicleNotebook.stripHtml(htmlValue);
    }
    return String(htmlValue || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function uniqueStrings(values) {
    return Array.from(new Set((values || []).map(function (value) { return String(value || "").trim(); }).filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function buildFilterSummary(labelPlural, selectedValues) {
    var selected = Array.isArray(selectedValues) ? selectedValues.filter(Boolean) : [];
    if (!selected.length) {
      return "All " + labelPlural;
    }
    if (selected.length === 1) {
      return selected[0];
    }
    if (selected.length === 2) {
      var pair = selected[0] + ", " + selected[1];
      return pair.length <= 24 ? pair : "2 Selected";
    }
    return selected.length + " Selected";
  }

  function initialSelectedLocationId() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      return params.get("location") || params.get("selected") || null;
    } catch (_error) {
      return null;
    }
  }

  function filterSummaryOptions(values) {
    return uniqueStrings(values).map(function (value) {
      return { value: value, label: value };
    });
  }

  function FilterDropdown(props) {
    var label = props.label;
    var labelPlural = props.labelPlural;
    var options = props.options || [];
    var selected = props.selected || [];
    var onToggle = props.onToggle;
    var active = props.active;
    var setActive = props.setActive;
    var id = props.id;
    var summary = props.summary || buildFilterSummary(labelPlural, selected);

    return html`<div className="character-filter-dropdown location-filter-dropdown">
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
      ${active ? html`<div id=${id} className="character-filter-menu location-filter-menu" role="menu">
        ${options.length ? options.map(function (option) {
          var checked = selected.indexOf(option.value) >= 0;
          return html`<button
            key=${option.value}
            type="button"
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

  function OwnerDropdown(props) {
    var id = props.id;
    var label = props.label || "Owner";
    var characters = Array.isArray(props.characters) ? props.characters : [];
    var value = normalizeString(props.value, "");
    var onChange = typeof props.onChange === "function" ? props.onChange : function () {};
    var _open = useState(false);
    var open = _open[0];
    var setOpen = _open[1];
    var _searchTerm = useState("");
    var searchTerm = _searchTerm[0];
    var setSearchTerm = _searchTerm[1];
    var rootRef = useRef(null);

    var ownerOptions = useMemo(function () {
      var seen = {};
      var sorted = characters.map(function (character) {
        return {
          value: String(character && character.id ? character.id : ""),
          label: normalizeString(character && character.name, String(character && character.id ? character.id : ""))
        };
      }).filter(function (option) {
        return option.value && option.label;
      }).sort(function (a, b) {
        return a.label.localeCompare(b.label);
      }).filter(function (option) {
        if (seen[option.value]) {
          return false;
        }
        seen[option.value] = true;
        return true;
      });
      return [{ value: "", label: OWNER_NONE_LABEL }].concat(sorted);
    }, [characters]);

    var selectedOption = ownerOptions.find(function (option) {
      return option.value === value;
    });
    var selectedLabel = selectedOption ? selectedOption.label : OWNER_NONE_LABEL;

    var filteredOptions = useMemo(function () {
      var term = normalizeString(searchTerm, "").toLowerCase();
      if (!term) {
        return ownerOptions;
      }
      return ownerOptions.filter(function (option) {
        return option.label.toLowerCase().indexOf(term) >= 0;
      });
    }, [ownerOptions, searchTerm]);

    useEffect(function () {
      if (!open) {
        setSearchTerm("");
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

    function chooseOwner(ownerId) {
      onChange(normalizeString(ownerId, ""));
      setOpen(false);
      setSearchTerm("");
    }

    return html`<div className="character-filter-dropdown location-owner-dropdown" ref=${rootRef}>
      <span className="character-filter-label">${label}</span>
      <button
        type="button"
        className=${"character-filter-trigger" + (open ? " open" : "")}
        aria-haspopup="listbox"
        aria-expanded=${open ? "true" : "false"}
        aria-controls=${id}
        onClick=${function () { setOpen(!open); }}
      >
        <span className="character-filter-trigger-text">${selectedLabel}</span>
        <span className="character-filter-trigger-caret" aria-hidden="true">v</span>
      </button>
      ${open ? html`<div id=${id} className="character-filter-menu location-owner-menu" role="listbox">
        <div className="location-owner-search-row">
          <input
            type="search"
            placeholder="Search owners..."
            value=${searchTerm}
            autoFocus=${true}
            onInput=${function (event) { setSearchTerm(event.target.value); }}
          />
        </div>
        ${filteredOptions.length ? filteredOptions.map(function (option) {
          var checked = option.value === value;
          return html`<button
            key=${"owner-option-" + (option.value || "none")}
            type="button"
            className=${"character-filter-option" + (checked ? " checked" : "")}
            role="option"
            aria-selected=${checked ? "true" : "false"}
            onClick=${function () { chooseOwner(option.value); }}
          >
            <span className="character-filter-check" aria-hidden="true"></span>
            <span>${option.label}</span>
          </button>`;
        }) : html`<div className="character-filter-option notebook-filter-empty"><span></span><span>No owners found.</span></div>`}
      </div>` : null}
    </div>`;
  }

  function TagChips(props) {
    var items = props.items || [];
    var empty = props.empty || "None";
    var onRemove = props.onRemove;

    if (!items.length) {
      return html`<p className="hint">${empty}</p>`;
    }

    return html`<div className="notebook-chip-list">
      ${items.map(function (item) {
        return html`<button type="button" key=${item} className="notebook-chip">
          <span>${item}</span>
          ${onRemove ? html`<strong aria-hidden="true" onClick=${function (event) { event.stopPropagation(); onRemove(item); }}>×</strong>` : null}
        </button>`;
      })}
    </div>`;
  }

  function LocationApp() {
    var _locations = useState([]);
    var locations = _locations[0];
    var setLocations = _locations[1];

    var _characters = useState([]);
    var characters = _characters[0];
    var setCharacters = _characters[1];

    var _relationships = useState([]);
    var relationships = _relationships[0];
    var setRelationships = _relationships[1];

    var _selectedId = useState(initialSelectedLocationId());
    var selectedId = _selectedId[0];
    var setSelectedId = _selectedId[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

    var _typeFilters = useState({});
    var typeFilters = _typeFilters[0];
    var setTypeFilters = _typeFilters[1];

    var _ownerFilters = useState({});
    var ownerFilters = _ownerFilters[0];
    var setOwnerFilters = _ownerFilters[1];

    var _tagFilters = useState({});
    var tagFilters = _tagFilters[0];
    var setTagFilters = _tagFilters[1];

    var _activeDropdown = useState(null);
    var activeDropdown = _activeDropdown[0];
    var setActiveDropdown = _activeDropdown[1];

    var _loading = useState(true);
    var loading = _loading[0];
    var setLoading = _loading[1];

    var _draft = useState(null);
    var draft = _draft[0];
    var setDraft = _draft[1];

    var _status = useState("Loading locations...");
    var status = _status[0];
    var setStatus = _status[1];

    var _dialogOpen = useState(false);
    var dialogOpen = _dialogOpen[0];
    var setDialogOpen = _dialogOpen[1];

    var _dialogDraft = useState(null);
    var dialogDraft = _dialogDraft[0];
    var setDialogDraft = _dialogDraft[1];

    var saveTimerRef = useRef(null);
    var loadTokenRef = useRef(0);

    useEffect(function () {
      var cancelled = false;
      shared.readCampaignAtlasState()
        .then(function (state) {
          if (cancelled) {
            return null;
          }
          setCharacters(Array.isArray(state.characters) ? state.characters : []);
          setRelationships(Array.isArray(state.relationships) ? state.relationships : []);
          return shared.readLocationRecords();
        })
        .then(function (records) {
          if (cancelled) {
            return null;
          }
          var nextLocations = Array.isArray(records) ? records : [];
          return nextLocations;
        })
        .then(function (nextLocations) {
          if (cancelled) {
            return;
          }
          var resolvedLocations = Array.isArray(nextLocations) ? nextLocations : [];
          setLocations(resolvedLocations);
          setLoading(false);
          if (!selectedId) {
            setSelectedId(resolvedLocations[0] ? resolvedLocations[0].id : null);
          }
          if (!resolvedLocations.length) {
            setStatus("No locations found. Create the first one.");
          }
        })
        .catch(function () {
          if (!cancelled) {
            setLoading(false);
            setStatus("Unable to load locations.");
          }
        });
      return function () {
        cancelled = true;
      };
    }, []);

    useEffect(function () {
      if (!selectedId) {
        setDraft(null);
        return;
      }
      var cached = locations.find(function (entry) { return entry.id === selectedId; });
      if (cached) {
        setDraft(clone(cached));
      }
      var token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      var cancelled = false;
      shared.readLocationRecordById(selectedId).then(function (record) {
        if (cancelled || token !== loadTokenRef.current || !record) {
          return;
        }
        setDraft(clone(record));
      });
      return function () {
        cancelled = true;
      };
    }, [selectedId, locations.length]);

    useEffect(function () {
      if (!draft || dialogOpen) {
        return;
      }
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(function () {
        saveTimerRef.current = null;
        shared.saveLocationRecord(draft).then(function (saved) {
          setLocations(function (current) {
            var found = false;
            var next = (current || []).map(function (entry) {
              if (entry.id === saved.id) {
                found = true;
                return saved;
              }
              return entry;
            });
            if (!found) {
              next.push(saved);
            }
            return next;
          });
          setStatus("Location saved.");
        });
      }, 250);
      return function () {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [draft && draft.id, draft && draft.name, draft && draft.type, draft && draft.ownerId, draft && draft.detailsHtml, draft && draft.description, JSON.stringify(draft && draft.tags ? draft.tags : []), dialogOpen]);

    var ownerLookup = useMemo(function () {
      var map = {};
      (characters || []).forEach(function (character) {
        map[character.id] = character.name || character.id;
      });
      return map;
    }, [characters]);

    function resolveOwnerLabel(location) {
      if (!location) {
        return OWNER_NONE_LABEL;
      }
      var ownerId = normalizeString(location.ownerId, "");
      if (!ownerId) {
        return OWNER_NONE_LABEL;
      }
      return location.ownerName || ownerLookup[ownerId] || ownerId;
    }

    function enrichLocation(location) {
      var next = clone(location);
      next.ownerName = resolveOwnerLabel(next);
      next.previewText = next.previewText || stripHtml(next.detailsHtml || next.description || "");
      next.searchText = [next.name, next.type, next.ownerName, next.description, next.detailsHtml, (next.tags || []).join(" ")].join(" ").toLowerCase();
      return next;
    }

    var enrichedLocations = useMemo(function () {
      return (locations || []).map(enrichLocation);
    }, [locations, ownerLookup]);

    var typeOptions = useMemo(function () {
      return filterSummaryOptions(enrichedLocations.map(function (location) { return normalizeString(location.type, "Notable Place"); }));
    }, [enrichedLocations]);

    var ownerOptions = useMemo(function () {
      return filterSummaryOptions(enrichedLocations.map(function (location) { return resolveOwnerLabel(location); }));
    }, [enrichedLocations, ownerLookup]);

    var tagOptions = useMemo(function () {
      return filterSummaryOptions(enrichedLocations.reduce(function (all, location) {
        return all.concat(Array.isArray(location.tags) ? location.tags : []);
      }, []));
    }, [enrichedLocations]);

    var filteredLocations = useMemo(function () {
      var term = normalizeString(search, "").toLowerCase();
      var activeTypes = Object.keys(typeFilters).filter(function (key) { return typeFilters[key]; });
      var activeOwners = Object.keys(ownerFilters).filter(function (key) { return ownerFilters[key]; });
      var activeTags = Object.keys(tagFilters).filter(function (key) { return tagFilters[key]; });

      return enrichedLocations.filter(function (location) {
        var ownerLabel = resolveOwnerLabel(location);
        if (activeTypes.length && activeTypes.indexOf(normalizeString(location.type, "Notable Place")) === -1) {
          return false;
        }
        if (activeOwners.length && activeOwners.indexOf(ownerLabel) === -1) {
          return false;
        }
        if (activeTags.length && !(location.tags || []).some(function (tag) { return activeTags.indexOf(tag) >= 0; })) {
          return false;
        }
        if (term && location.searchText.indexOf(term) === -1) {
          return false;
        }
        return true;
      });
    }, [enrichedLocations, search, typeFilters, ownerFilters, tagFilters]);

    var selectedLocation = useMemo(function () {
      return enrichedLocations.find(function (entry) { return entry.id === selectedId; }) || null;
    }, [enrichedLocations, selectedId]);

    useEffect(function () {
      if (!activeDropdown) {
        return;
      }
      function onPointerDown(event) {
        if (!event.target.closest || !event.target.closest(".location-filter-dropdown")) {
          setActiveDropdown(null);
        }
      }
      function onEscape(event) {
        if (event.key === "Escape") {
          setActiveDropdown(null);
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [activeDropdown]);

    function setFilterState(mapSetter, value) {
      mapSetter(function (current) {
        var next = Object.assign({}, current);
        next[value] = !Boolean(next[value]);
        return next;
      });
    }

    function handleDraftChange(field, value) {
      setDraft(function (current) {
        if (!current) {
          return current;
        }
        var next = clone(current);
        next[field] = value;
        if (field === "ownerId") {
          next.ownerName = ownerLookup[value] || "";
        }
        if (field === "tags") {
          next.tags = normalizeTags(value);
        }
        return next;
      });
    }

    function handleDialogChange(field, value) {
      setDialogDraft(function (current) {
        if (!current) {
          return current;
        }
        var next = clone(current);
        next[field] = value;
        if (field === "ownerId") {
          next.ownerName = ownerLookup[value] || "";
        }
        if (field === "tags") {
          next.tags = normalizeTags(value);
        }
        return next;
      });
    }

    async function selectLocation(locationId) {
      if (draft) {
        await shared.saveLocationRecord(draft);
      }
      setSelectedId(locationId);
    }

    async function openNewLocationDialog() {
      setDialogDraft({
        name: "",
        type: "Domain",
        ownerId: "",
        ownerName: "",
        detailsHtml: "<p></p>",
        tags: []
      });
      setDialogOpen(true);
    }

    function closeDialog() {
      setDialogOpen(false);
      setDialogDraft(null);
    }

    async function saveNewLocation() {
      if (!dialogDraft) {
        return;
      }
      var name = normalizeString(dialogDraft.name, "");
      var type = normalizeString(dialogDraft.type, "");
      if (!name || !type) {
        setStatus("Location Name and Location Type are required.");
        return;
      }
      var ownerName = ownerLookup[dialogDraft.ownerId] || "";
      var record = await shared.saveLocationRecord({
        id: "location-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        name: name,
        type: type,
        ownerId: normalizeString(dialogDraft.ownerId, ""),
        ownerName: ownerName,
        detailsHtml: String(dialogDraft.detailsHtml || "<p></p>"),
        description: stripHtml(dialogDraft.detailsHtml || ""),
        tags: normalizeTags(dialogDraft.tags),
        images: [],
        floorPlans: [],
        handouts: [],
        travelRoutes: [],
        encounterNotes: [],
        relatedCharacterIds: [],
        locationLinks: [],
        mapLinks: []
      });
      setLocations(function (current) { return (current || []).concat([record]); });
      setDraft(clone(record));
      setDialogOpen(false);
      setDialogDraft(null);
      setSelectedId(record.id);
      setStatus("Location created.");
    }

    function persistAndReload(nextRecord) {
      shared.saveLocationRecord(nextRecord).then(function (saved) {
        setLocations(function (current) {
          return (current || []).map(function (entry) {
            return entry.id === saved.id ? saved : entry;
          });
        });
      });
    }

    function linkedCharactersFor(location) {
      if (!location) {
        return [];
      }
      var ids = [];
      if (location.ownerId) {
        ids.push(location.ownerId);
      }
      if (Array.isArray(location.relatedCharacterIds)) {
        ids = ids.concat(location.relatedCharacterIds);
      }
      (characters || []).forEach(function (character) {
        var timeline = Array.isArray(character.timeline) ? character.timeline : [];
        var matchesTimeline = timeline.some(function (event) {
          var locationText = normalizeString(event.location, "").toLowerCase();
          var haystack = [location.name, location.id].map(function (item) { return normalizeString(item, "").toLowerCase(); });
          if (!locationText) {
            return false;
          }
          return haystack.some(function (token) { return token && locationText.indexOf(token) >= 0; }) || haystack.some(function (token) { return token && token.indexOf(locationText) >= 0; });
        });
        if (matchesTimeline) {
          ids.push(character.id);
        }
      });
      return uniqueStrings(ids).map(function (id) {
        var character = characters.find(function (entry) { return entry.id === id; });
        return character ? { id: character.id, label: character.name || character.id } : null;
      }).filter(Boolean);
    }

    function timelineEventsForLocation(location) {
      if (!location) {
        return [];
      }
      var tokenSet = uniqueStrings([location.id, location.name].concat(location.tags || []).map(function (value) { return String(value || "").toLowerCase(); }));
      var events = [];
      (characters || []).forEach(function (character) {
        (character.timeline || []).forEach(function (event, index) {
          var searchable = [event.title, event.description, event.location, event.storyArc, event.relatedSession].join(" ").toLowerCase();
          var matches = tokenSet.some(function (token) { return token && searchable.indexOf(token) >= 0; });
          if (matches) {
            events.push({
              id: character.id + ":" + (event.id || index),
              characterId: character.id,
              characterName: character.name || "Unnamed Character",
              date: normalizeString(event.date, ""),
              title: normalizeString(event.title, "Untitled Event"),
              description: normalizeString(event.description, ""),
              location: normalizeString(event.location, "")
            });
          }
        });
      });
      return events.sort(function (a, b) {
        return String(b.date || "").localeCompare(String(a.date || ""));
      });
    }

    var storyNotes = useMemo(function () {
      return [];
    }, []);

    useEffect(function () {
      var cancelled = false;
      if (!selectedLocation) {
        setStatus(loading ? "Loading locations..." : "Select a location to edit it.");
        return function () { cancelled = true; };
      }
      shared.readGmNotesEntries().then(function (entries) {
        if (cancelled) {
          return;
        }
        var token = normalizeString(selectedLocation.name, "").toLowerCase();
        var tagged = (entries || []).filter(function (entry) {
          if (Array.isArray(entry.locationIds) && entry.locationIds.indexOf(selectedLocation.id) >= 0) {
            return true;
          }
          var haystack = [entry.title || "", entry.preview || "", entry.bodyHtml || ""].join(" ").toLowerCase();
          return token && haystack.indexOf(token) >= 0;
        });
        setStatus(tagged.length ? tagged.length + " related story notes found." : "No related story notes yet.");
        setDraft(function (current) {
          return current && current.id === selectedLocation.id ? Object.assign({}, current, { storyNotes: tagged }) : current;
        });
      }).catch(function () {
        if (!cancelled) {
          setStatus("Unable to load related story notes.");
        }
      });
      return function () {
        cancelled = true;
      };
    }, [selectedLocation && selectedLocation.id, selectedLocation && selectedLocation.name]);

    var linkedCharacters = selectedLocation ? linkedCharactersFor(selectedLocation) : [];
    var timelineEvents = selectedLocation ? timelineEventsForLocation(selectedLocation) : [];
    var storyNotesFiltered = draft && Array.isArray(draft.storyNotes) ? draft.storyNotes : [];

    var selectedType = selectedLocation ? normalizeString(selectedLocation.type, "Notable Place") : "Notable Place";
    var selectedOwner = selectedLocation ? resolveOwnerLabel(selectedLocation) : "";

    return html`<div className="character-db-page location-db-page">
      <section className="search-panel card location-search-panel">
        <label htmlFor="locationSearch">Search Locations</label>
        <div className="search-row location-search-row">
          <input id="locationSearch" type="search" placeholder="Search by name, owner, details, or tags..." autoComplete="off" value=${search} onInput=${function (event) { setSearch(event.target.value); }} />
          <button type="button" className="location-add-button" onClick=${openNewLocationDialog}>+</button>
        </div>
        <div className="character-filter-grid location-filter-grid">
          <${FilterDropdown}
            id="locationTypeFilter"
            label="Location Type"
            labelPlural="Types"
            options=${typeOptions}
            selected=${Object.keys(typeFilters).filter(function (key) { return typeFilters[key]; })}
            active=${activeDropdown === "locationTypeFilter"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) { setFilterState(setTypeFilters, value); }}
          />
          <${FilterDropdown}
            id="ownerFilter"
            label="Owner"
            labelPlural="Owners"
            options=${ownerOptions}
            selected=${Object.keys(ownerFilters).filter(function (key) { return ownerFilters[key]; })}
            active=${activeDropdown === "ownerFilter"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) { setFilterState(setOwnerFilters, value); }}
          />
          <${FilterDropdown}
            id="tagFilter"
            label="Tags"
            labelPlural="Tags"
            options=${tagOptions}
            selected=${Object.keys(tagFilters).filter(function (key) { return tagFilters[key]; })}
            active=${activeDropdown === "tagFilter"}
            setActive=${setActiveDropdown}
            onToggle=${function (value) { setFilterState(setTagFilters, value); }}
          />
        </div>
      </section>

      <section className="character-db-layout location-db-layout">
        <aside className="character-db-list-panel card location-list-panel">
          <h3>Location List</h3>
          <div className="character-db-list-scroll location-list-scroll">
            ${loading ? html`<p className="hint">Loading locations...</p>` : null}
            ${!loading && !filteredLocations.length ? html`<p className="hint">No locations match your current search and filters.</p>` : null}
            ${filteredLocations.map(function (location) {
              var isActive = location.id === selectedId;
              var ownerLabel = resolveOwnerLabel(location);
              return html`<button
                key=${location.id}
                type="button"
                className=${"character-db-list-item location-list-item" + (isActive ? " active" : "")}
                onClick=${function () { selectLocation(location.id); }}
              >
                <div className="location-list-text">
                  <strong>${location.name || "Unnamed Location"}</strong>
                  <span>${normalizeString(location.type, "Notable Place")} • ${ownerLabel}</span>
                  ${location.tags && location.tags.length ? html`<span>${location.tags.join(", ")}</span>` : null}
                </div>
              </button>`;
            })}
          </div>
        </aside>

        <article className="character-db-profile-panel card location-db-profile-panel">
          ${selectedLocation ? html`
            <div className="character-db-profile-content location-profile-content">
              <section className="profile-section location-overview-section">
                <div className="section-heading">
                  <h3>Overview</h3>
                  <span className="note-subtitle">${status}</span>
                </div>
                <div className="location-overview-grid">
                  <label>Location Name
                    <input type="text" value=${draft ? draft.name : selectedLocation.name || ""} onInput=${function (event) { handleDraftChange("name", event.target.value); }} />
                  </label>
                  <label>Location Type
                    <select value=${draft ? draft.type : selectedType} onChange=${function (event) { handleDraftChange("type", event.target.value); }}>
                      <option value="Domain">Domain</option>
                      <option value="Haven">Haven</option>
                      <option value="Elysium">Elysium</option>
                      <option value="Notable Place">Notable Place</option>
                    </select>
                  </label>
                  <${OwnerDropdown}
                    id="locationOwnerField"
                    label="Owner"
                    characters=${characters}
                    value=${draft ? draft.ownerId : (selectedLocation.ownerId || "")}
                    onChange=${function (ownerId) { handleDraftChange("ownerId", ownerId); }}
                  />
                  <label>Tags
                    <input type="text" value=${draft ? (draft.tags || []).join(", ") : (selectedLocation.tags || []).join(", ")} onInput=${function (event) { handleDraftChange("tags", event.target.value); }} placeholder="Court, Secret, Tremere, Downtown" />
                  </label>
                </div>
              </section>

              <section className="profile-section location-details-section">
                <div className="section-heading">
                  <h3>Details</h3>
                  <span className="note-subtitle">Rich text description</span>
                </div>
                ${dialogOpen ? html`<p className="hint">Close the new location dialog to edit the selected location details.</p>` : html`<${shared.CharacterBiographyWorkspace}
                  editable=${true}
                  value=${String(draft ? draft.detailsHtml : selectedLocation.detailsHtml || "")}
                  onChange=${function (htmlValue) { handleDraftChange("detailsHtml", htmlValue); handleDraftChange("description", stripHtml(htmlValue)); }}
                  editorClassName="rich-editor profile-rich-editor character-rich-text location-rich-editor"
                  viewerClassName="profile-biography-content character-rich-text"
                />`}
              </section>

              <section className="profile-section location-linked-section">
                <div className="section-heading">
                  <h3>Linked Characters</h3>
                  <span className="note-subtitle">Characters connected through ownership or timeline references</span>
                </div>
                ${linkedCharacters.length ? html`<div className="story-notes-list location-link-list">
                  ${linkedCharacters.map(function (character) {
                    return html`<button type="button" key=${character.id} className="story-note-item" onClick=${function () { window.location.href = "characters.html?character=" + encodeURIComponent(character.id); }}>
                      <strong>${character.label}</strong>
                    </button>`;
                  })}
                </div>` : html`<p className="hint">No linked characters yet.</p>`}
              </section>

              <section className="profile-section location-timeline-section">
                <div className="section-heading">
                  <h3>Timeline Events</h3>
                  <span className="note-subtitle">Events referencing this location</span>
                </div>
                ${timelineEvents.length ? html`<div className="story-notes-list">
                  ${timelineEvents.map(function (entry) {
                    return html`<article className="story-note-item" key=${entry.id}>
                      <strong>${entry.title}</strong>
                      <p>${entry.characterName}${entry.date ? " • " + entry.date : ""}</p>
                      ${entry.description ? html`<div className="story-note-meta"><span>${entry.description}</span></div>` : null}
                    </article>`;
                  })}
                </div>` : html`<p className="hint">No timeline events reference this location yet.</p>`}
              </section>

              <section className="profile-section location-story-notes-section">
                <div className="section-heading">
                  <h3>Story Notes</h3>
                  <span className="note-subtitle">GM Notes tagged with this location</span>
                </div>
                ${storyNotesFiltered.length ? html`<div className="story-notes-list">
                  ${storyNotesFiltered.map(function (note, index) {
                    return html`<button type="button" key=${note.id || ("location-note-" + index)} className="story-note-item" onClick=${function () {
                      var focus = encodeURIComponent(String((note && note.focusText) || (note && note.title) || ""));
                      window.location.href = "gm-notes.html?focus=" + focus;
                    }}>
                      <strong>${note.title || "Untitled Note"}</strong>
                      <p>${note.preview || "No preview available."}</p>
                    </button>`;
                  })}
                </div>` : html`<p className="hint">No story notes reference this location yet.</p>`}
              </section>

              <section className="profile-section location-future-section">
                <div className="section-heading">
                  <h3>Future Ready</h3>
                  <span className="note-subtitle">Prepared for future assets</span>
                </div>
                <div className="location-future-grid">
                  <div className="location-future-card"><strong>Images</strong><span>${(selectedLocation.images || []).length} attached</span></div>
                  <div className="location-future-card"><strong>Maps</strong><span>${(selectedLocation.mapLinks || []).length} linked</span></div>
                  <div className="location-future-card"><strong>Floor Plans</strong><span>${(selectedLocation.floorPlans || []).length} attached</span></div>
                  <div className="location-future-card"><strong>Handouts</strong><span>${(selectedLocation.handouts || []).length} attached</span></div>
                  <div className="location-future-card"><strong>Travel Routes</strong><span>${(selectedLocation.travelRoutes || []).length} linked</span></div>
                  <div className="location-future-card"><strong>Encounter Notes</strong><span>${(selectedLocation.encounterNotes || []).length} attached</span></div>
                </div>
              </section>
            </div>
          ` : html`<div className="profile-empty">Select a location to edit it.</div>`}
        </article>
      </section>

      ${dialogOpen ? html`<div className="chronicle-modal location-modal">
        <div className="chronicle-modal-backdrop" onClick=${closeDialog}></div>
        <div className="chronicle-modal-panel card">
          <div className="chronicle-modal-head">
            <h3>New Location</h3>
            <button type="button" className="icon-button chronicle-modal-close-button" aria-label="Close dialog" onClick=${closeDialog}>×</button>
          </div>
          <div className="chronicle-modal-grid">
            <label className="chronicle-span-2">Location Name *
              <input type="text" value=${dialogDraft ? dialogDraft.name : ""} onInput=${function (event) { handleDialogChange("name", event.target.value); }} />
            </label>
            <label>Location Type *
              <select value=${dialogDraft ? dialogDraft.type : "Domain"} onChange=${function (event) { handleDialogChange("type", event.target.value); }}>
                <option value="Domain">Domain</option>
                <option value="Haven">Haven</option>
                <option value="Elysium">Elysium</option>
                <option value="Notable Place">Notable Place</option>
              </select>
            </label>
            <${OwnerDropdown}
              id="locationOwnerDialogField"
              label="Owner"
              characters=${characters}
              value=${dialogDraft ? dialogDraft.ownerId : ""}
              onChange=${function (ownerId) { handleDialogChange("ownerId", ownerId); }}
            />
            <label className="chronicle-span-2">Tags
              <input type="text" value=${dialogDraft ? (dialogDraft.tags || []).join(", ") : ""} onInput=${function (event) { handleDialogChange("tags", event.target.value); }} placeholder="Court, Secret, Tremere, Downtown" />
            </label>
            <div className="chronicle-span-2">
              <div className="section-heading">
                <h3>Details</h3>
                <span className="note-subtitle">Rich text description</span>
              </div>
              <${shared.CharacterBiographyWorkspace}
                editable=${true}
                value=${String(dialogDraft ? dialogDraft.detailsHtml || "<p></p>" : "<p></p>")}
                onChange=${function (htmlValue) { handleDialogChange("detailsHtml", htmlValue); }}
                editorClassName="rich-editor profile-rich-editor character-rich-text location-dialog-editor"
                viewerClassName="profile-biography-content character-rich-text"
              />
            </div>
          </div>
          <div className="chronicle-modal-actions">
            <button type="button" onClick=${closeDialog}>Cancel</button>
            <button type="button" onClick=${saveNewLocation}>Save Location</button>
          </div>
        </div>
      </div>` : null}
    </div>`;
  }

  var root = document.getElementById("locationsDatabaseApp");
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(React.createElement(LocationApp));
})();
