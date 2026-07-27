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
  var characterService = window.CharacterService;
  var relationshipService = window.RelationshipService;
  if (!characterService || !relationshipService || !shared.readLocationRecords || !shared.readLocationRecordById || !shared.saveLocationRecord || !shared.CharacterBiographyWorkspace) {
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

    // Locations open read-only by default, matching the Character page --
    // editing controls only render when editMode is true. Saving itself is
    // unchanged (still the existing debounced autosave on `draft`); this
    // only toggles which JSX is shown.
    var _editMode = useState(false);
    var editMode = _editMode[0];
    var setEditMode = _editMode[1];

    var _imageryLightbox = useState(null);
    var imageryLightbox = _imageryLightbox[0];
    var setImageryLightbox = _imageryLightbox[1];
    var imageFieldInputRef = useRef(null);
    var mapFieldInputRef = useRef(null);
    var floorPlanFieldInputRef = useRef(null);

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
      Promise.all([characterService.getAll(), relationshipService.getAll()])
        .then(function (results) {
          if (cancelled) {
            return null;
          }
          setCharacters(Array.isArray(results[0]) ? results[0] : []);
          setRelationships(Array.isArray(results[1]) ? results[1] : []);
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
    }, [
      draft && draft.id, draft && draft.name, draft && draft.type, draft && draft.detailsHtml, draft && draft.description,
      JSON.stringify(draft && draft.tags ? draft.tags : []),
      JSON.stringify(draft && draft.ownerIds ? draft.ownerIds : []),
      JSON.stringify(draft && draft.images ? draft.images : []),
      JSON.stringify(draft && draft.mapLinks ? draft.mapLinks : []),
      JSON.stringify(draft && draft.floorPlans ? draft.floorPlans : []),
      dialogOpen
    ]);

    var ownerLookup = useMemo(function () {
      var map = {};
      (characters || []).forEach(function (character) {
        map[character.id] = character.name || character.id;
      });
      return map;
    }, [characters]);

    function resolveOwnerLabels(location) {
      var ownerIds = location && Array.isArray(location.ownerIds) ? location.ownerIds : [];
      if (!ownerIds.length) {
        return [OWNER_NONE_LABEL];
      }
      return ownerIds.map(function (ownerId) { return ownerLookup[ownerId] || ownerId; });
    }

    function enrichLocation(location) {
      var next = clone(location);
      next.ownerNames = resolveOwnerLabels(next);
      next.previewText = next.previewText || stripHtml(next.detailsHtml || next.description || "");
      next.searchText = [next.name, next.type, next.ownerNames.join(" "), next.description, next.detailsHtml, (next.tags || []).join(" ")].join(" ").toLowerCase();
      return next;
    }

    var enrichedLocations = useMemo(function () {
      return (locations || []).map(enrichLocation);
    }, [locations, ownerLookup]);

    var typeOptions = useMemo(function () {
      return filterSummaryOptions(enrichedLocations.map(function (location) { return normalizeString(location.type, "Notable Place"); }));
    }, [enrichedLocations]);

    var ownerOptions = useMemo(function () {
      return filterSummaryOptions(enrichedLocations.reduce(function (all, location) {
        return all.concat(location.ownerNames || []);
      }, []));
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
        if (activeTypes.length && activeTypes.indexOf(normalizeString(location.type, "Notable Place")) === -1) {
          return false;
        }
        if (activeOwners.length && !(location.ownerNames || []).some(function (name) { return activeOwners.indexOf(name) !== -1; })) {
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
        // Keep the raw typed text (tagsInput) separate from the parsed
        // array (tags) -- the input mirrors tagsInput verbatim so commas/
        // spaces/trailing commas are never eaten by round-tripping through
        // split/join on every keystroke, while tags stays continuously
        // parsed for search/filter consumers elsewhere.
        if (field === "tags") {
          next.tagsInput = value;
          next.tags = normalizeTags(value);
        }
        return next;
      });
    }

    // Imagery: Image/Map/Floor Plan are each a single-upload field, stored
    // as a 0-or-1-item array on the existing images/mapLinks/floorPlans
    // fields (already whitelisted by normalizeLocationRecord in
    // character-biography-shared.js -- reusing them, rather than inventing
    // new field names, means the save/normalize round-trip needs no
    // changes). Mirrors the character portrait upload's exact
    // FileReader.readAsDataURL pattern; there is no separate blob-storage
    // optimization for locations (see saveLocationRecord), so the data URL
    // is simply stored as-is, same as every other location field.
    function getImageFieldInputRef(fieldKey) {
      if (fieldKey === "images") {
        return imageFieldInputRef;
      }
      if (fieldKey === "mapLinks") {
        return mapFieldInputRef;
      }
      return floorPlanFieldInputRef;
    }

    function handleImageFieldFile(fieldKey, event) {
      var file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          return;
        }
        handleDraftChange(fieldKey, [{
          id: "img-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          dataUrl: dataUrl,
          name: file.name || "",
          uploadedAt: new Date().toISOString()
        }]);
      };
      reader.readAsDataURL(file);
    }

    function removeImageFieldEntry(fieldKey) {
      handleDraftChange(fieldKey, []);
    }

    useEffect(function () {
      if (!imageryLightbox) {
        return;
      }
      function onEscape(event) {
        if (event.key === "Escape") {
          setImageryLightbox(null);
        }
      }
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("keydown", onEscape);
      };
    }, [imageryLightbox]);

    function renderImageField(fieldKey, label) {
      var inputRef = getImageFieldInputRef(fieldKey);
      var source = draft || selectedLocation || {};
      var current = (Array.isArray(source[fieldKey]) ? source[fieldKey] : [])[0] || null;
      return html`<div className="location-future-card location-imagery-field">
        <strong>${label}</strong>
        ${current
          ? html`<div className="location-imagery-thumb-wrap">
              <button
                type="button"
                className="location-imagery-thumb-button"
                aria-label=${"View " + label + " full size"}
                onClick=${function () { setImageryLightbox({ url: current.dataUrl, label: label }); }}
              >
                <img className="location-imagery-thumb" src=${current.dataUrl} alt=${label} />
              </button>
              ${editMode ? html`<div className="location-imagery-actions">
                <button type="button" onClick=${function () { inputRef.current && inputRef.current.click(); }}>Replace</button>
                <button type="button" className="destructive" onClick=${function () { removeImageFieldEntry(fieldKey); }}>Remove</button>
              </div>` : null}
            </div>`
          : (editMode
              ? html`<button type="button" className="location-imagery-upload-button" onClick=${function () { inputRef.current && inputRef.current.click(); }}>+ Upload ${label}</button>`
              : html`<p className="hint location-imagery-empty">No ${label.toLowerCase()} uploaded.</p>`)}
        ${editMode ? html`<input
          ref=${inputRef}
          type="file"
          accept="image/*"
          style=${{ display: "none" }}
          onChange=${function (event) { handleImageFieldFile(fieldKey, event); }}
        />` : null}
      </div>`;
    }

    function handleDialogChange(field, value) {
      setDialogDraft(function (current) {
        if (!current) {
          return current;
        }
        var next = clone(current);
        next[field] = value;
        if (field === "tags") {
          next.tagsInput = value;
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
      setEditMode(false);
    }

    async function editLocation(locationId) {
      if (draft) {
        await shared.saveLocationRecord(draft);
      }
      setSelectedId(locationId);
      setEditMode(true);
    }

    async function deleteLocation(location) {
      if (!location || !location.id) {
        return;
      }
      if (!window.confirm("Delete " + (location.name || "this location") + "? This cannot be undone.")) {
        return;
      }
      await shared.deleteLocationRecord(location.id);
      setLocations(function (current) { return (current || []).filter(function (entry) { return entry.id !== location.id; }); });
      setSelectedId(function (current) { return current === location.id ? null : current; });
    }

    async function openNewLocationDialog() {
      setDialogDraft({
        name: "",
        type: "Domain",
        ownerIds: [],
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
      var record = await shared.saveLocationRecord({
        id: "location-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        name: name,
        type: type,
        ownerIds: Array.isArray(dialogDraft.ownerIds) ? dialogDraft.ownerIds : [],
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
      if (Array.isArray(location.ownerIds)) {
        ids = ids.concat(location.ownerIds);
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
              var ownerLabel = (location.ownerNames || []).join(", ");
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
                <${shared.ListCardActions} actions=${[
                  { key: "edit", icon: "✎", label: "Edit " + (location.name || "location"), onClick: function () { editLocation(location.id); } },
                  { key: "delete", icon: "🗑", label: "Delete " + (location.name || "location"), destructive: true, onClick: function () { deleteLocation(location); } }
                ]} />
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
                  <div className="location-overview-heading-actions">
                    <span className="note-subtitle">${status}</span>
                    ${editMode
                      ? html`<button type="button" className="profile-save-button" onClick=${function () { setEditMode(false); }}>Done</button>`
                      : html`<button type="button" className="profile-biography-edit-button" onClick=${function () { setEditMode(true); }}>Edit</button>`}
                  </div>
                </div>
                ${editMode ? html`<div className="location-overview-grid">
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
                  <${shared.OwnerDropdown}
                    id="locationOwnerField"
                    label="Owner"
                    characters=${characters}
                    values=${draft ? draft.ownerIds : (selectedLocation.ownerIds || [])}
                    onChange=${function (ownerIds) { handleDraftChange("ownerIds", ownerIds); }}
                  />
                  <label>Tags
                    <input type="text" value=${draft ? (draft.tagsInput !== undefined ? draft.tagsInput : (draft.tags || []).join(", ")) : (selectedLocation.tags || []).join(", ")} onInput=${function (event) { handleDraftChange("tags", event.target.value); }} placeholder="Court, Secret, Tremere, Downtown" />
                  </label>
                </div>` : html`<div className="location-overview-grid location-overview-readonly">
                  <div className="location-readonly-field">
                    <span className="location-readonly-label">Location Name</span>
                    <strong className="location-readonly-value">${selectedLocation.name || "Unnamed Location"}</strong>
                  </div>
                  <div className="location-readonly-field">
                    <span className="location-readonly-label">Location Type</span>
                    <strong className="location-readonly-value">${selectedType}</strong>
                  </div>
                  <div className="location-readonly-field">
                    <span className="location-readonly-label">Owner</span>
                    <${shared.TagChips} items=${(selectedLocation.ownerIds && selectedLocation.ownerIds.length) ? selectedLocation.ownerNames : []} empty="None" />
                  </div>
                  <div className="location-readonly-field">
                    <span className="location-readonly-label">Tags</span>
                    <${shared.TagChips} items=${selectedLocation.tags || []} empty="No tags." />
                  </div>
                </div>`}
              </section>

              <section className="profile-section location-details-section">
                <div className="section-heading">
                  <h3>Details</h3>
                  <span className="note-subtitle">Rich text description</span>
                </div>
                ${dialogOpen ? html`<p className="hint">Close the new location dialog to edit the selected location details.</p>` : html`<${shared.CharacterBiographyWorkspace}
                  editable=${editMode}
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
                ${linkedCharacters.length ? html`<div className="notebook-chip-list location-link-chip-list">
                  ${linkedCharacters.map(function (character) {
                    return html`<button type="button" key=${character.id} className="notebook-chip location-link-chip" onClick=${function () { window.location.href = "characters.html?character=" + encodeURIComponent(character.id); }}>
                      <span>${character.label}</span>
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

              <section className="profile-section location-imagery-section">
                <div className="section-heading">
                  <h3>Imagery</h3>
                  <span className="note-subtitle">Upload a single image, map, and floor plan</span>
                </div>
                <div className="location-future-grid">
                  ${renderImageField("images", "Image")}
                  ${renderImageField("mapLinks", "Map")}
                  ${renderImageField("floorPlans", "Floor Plan")}
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
            <${shared.OwnerDropdown}
              id="locationOwnerDialogField"
              label="Owner"
              characters=${characters}
              values=${dialogDraft ? dialogDraft.ownerIds : []}
              onChange=${function (ownerIds) { handleDialogChange("ownerIds", ownerIds); }}
            />
            <label className="chronicle-span-2">Tags
              <input type="text" value=${dialogDraft ? (dialogDraft.tagsInput !== undefined ? dialogDraft.tagsInput : (dialogDraft.tags || []).join(", ")) : ""} onInput=${function (event) { handleDialogChange("tags", event.target.value); }} placeholder="Court, Secret, Tremere, Downtown" />
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

      ${imageryLightbox ? html`<div className="chronicle-modal location-imagery-lightbox">
        <div className="chronicle-modal-backdrop" onClick=${function () { setImageryLightbox(null); }}></div>
        <div className="chronicle-modal-panel location-imagery-lightbox-panel">
          <div className="chronicle-modal-head">
            <h3>${imageryLightbox.label}</h3>
            <button type="button" className="icon-button chronicle-modal-close-button" aria-label="Close preview" onClick=${function () { setImageryLightbox(null); }}>×</button>
          </div>
          <div className="location-imagery-lightbox-body">
            <img className="location-imagery-lightbox-image" src=${imageryLightbox.url} alt=${imageryLightbox.label} />
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
