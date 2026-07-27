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
  if (!characterService || !shared.clone) {
    return;
  }

  var CHANNEL_NAME = "campaign-atlas-characters";
  var sourceId = "timeline-page-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
  var SORT_OPTIONS = [
    { value: "chronological-asc", label: "Chronological (Oldest -> Newest)" },
    { value: "chronological-desc", label: "Chronological (Newest -> Oldest)" },
    { value: "title-asc", label: "Event Title (A -> Z)" },
    { value: "title-desc", label: "Event Title (Z -> A)" },
    { value: "character-asc", label: "Character Name (A -> Z)" },
    { value: "character-desc", label: "Character Name (Z -> A)" }
  ];

  var DEFAULT_EVENT_TYPE = "character";
  var EVENT_TYPES = [
    { value: "character", label: "Character", icon: "../assets/Icons/Characters.svg", color: "#8b1a2b" },
    { value: "political", label: "Political", icon: "../assets/Icons/politics.svg", color: "#d4af37" },
    { value: "conflict", label: "Conflict", icon: "../assets/Icons/conflict.svg", color: "#cc5500" },
    { value: "location", label: "Location", icon: "../assets/Icons/location.svg", color: "#4169e1" },
    { value: "session", label: "Session", icon: "../assets/Icons/session.svg", color: "#7c3aed" },
    { value: "story-arc", label: "Story Arc", icon: "../assets/Icons/story-arc.svg", color: "#109c96" }
  ];
  var EVENT_TYPES_BY_VALUE = EVENT_TYPES.reduce(function (map, type) {
    map[type.value] = type;
    return map;
  }, {});

  // System-generated lifecycle events (Born/Embraced/Died) always use their
  // own dedicated icon, overriding whatever Event Type icon would otherwise
  // apply -- these entries have no user-editable Event Type at all.
  var SYSTEM_TYPE_ICONS = {
    birth: "../assets/Icons/born.svg",
    embrace: "../assets/Icons/embraced.svg",
    death: "../assets/Icons/died.svg"
  };

  function eventTypeInfo(value) {
    return EVENT_TYPES_BY_VALUE[value] || EVENT_TYPES_BY_VALUE[DEFAULT_EVENT_TYPE];
  }

  function normalizeEventType(value) {
    return EVENT_TYPES_BY_VALUE[value] ? value : DEFAULT_EVENT_TYPE;
  }

  function normalizeString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  function parseTags(raw) {
    if (Array.isArray(raw)) {
      return raw.map(function (item) { return normalizeString(item, ""); }).filter(Boolean);
    }
    return String(raw || "")
      .split(",")
      .map(function (item) { return normalizeString(item, ""); })
      .filter(Boolean);
  }

  function parseDateInfo(value) {
    var raw = normalizeString(value, "");
    var isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (isoMatch) {
      var y = Number(isoMatch[1]);
      var m = Number(isoMatch[2]);
      var d = Number(isoMatch[3]);
      return {
        key: Date.UTC(y, Math.max(0, m - 1), Math.max(1, d)),
        yearLabel: String(y),
        displayDate: raw,
        hasDate: true
      };
    }
    var yearMatch = /^(\d{4})$/.exec(raw);
    if (yearMatch) {
      var year = Number(yearMatch[1]);
      return {
        key: Date.UTC(year, 0, 1),
        yearLabel: String(year),
        displayDate: String(year),
        hasDate: true
      };
    }
    var containedYear = /(\d{4})/.exec(raw);
    if (containedYear) {
      var parsed = Number(containedYear[1]);
      return {
        key: Date.UTC(parsed, 0, 1),
        yearLabel: String(parsed),
        displayDate: raw,
        hasDate: true
      };
    }
    return {
      key: Number.POSITIVE_INFINITY,
      yearLabel: "Unknown",
      displayDate: raw,
      hasDate: false
    };
  }

  function normalizeTimelineEvent(rawEvent, ownerId) {
    var event = rawEvent && typeof rawEvent === "object" ? rawEvent : {};
    var known = {
      id: true,
      date: true,
      title: true,
      description: true,
      storyArc: true,
      relatedSession: true,
      session: true,
      location: true,
      locationId: true,
      gmNotes: true,
      tags: true,
      characterIds: true,
      eventType: true
    };
    var extraMeta = {};
    Object.keys(event).forEach(function (key) {
      if (!known[key]) {
        extraMeta[key] = event[key];
      }
    });
    var characterIds = Array.isArray(event.characterIds)
      ? event.characterIds.map(function (value) { return normalizeString(value, ""); }).filter(Boolean)
      : [];
    if (!characterIds.length && ownerId) {
      characterIds = [normalizeString(ownerId, "")].filter(Boolean);
    }
    var seenCharacterIds = {};
    characterIds = characterIds.filter(function (id) {
      if (seenCharacterIds[id]) {
        return false;
      }
      seenCharacterIds[id] = true;
      return true;
    });
    return {
      id: normalizeString(event.id, ""),
      date: normalizeString(event.date, ""),
      title: normalizeString(event.title, "Untitled Event"),
      description: normalizeString(event.description, ""),
      storyArc: normalizeString(event.storyArc, ""),
      relatedSession: normalizeString(event.relatedSession || event.session, ""),
      // `location` is legacy free text, preserved as-is (never written by
      // new saves once locationId is set) purely so pre-existing events
      // keep displaying exactly as they did before this field existed --
      // see the modal's Location field / saveModalEvent.
      location: normalizeString(event.location, ""),
      locationId: normalizeString(event.locationId, ""),
      gmNotes: normalizeString(event.gmNotes, ""),
      tags: parseTags(event.tags),
      characterIds: characterIds,
      eventType: normalizeEventType(event.eventType),
      extraMeta: extraMeta
    };
  }

  function sortTimelineEvents(events) {
    return (events || []).slice().sort(function (a, b) {
      var left = parseDateInfo(a.date);
      var right = parseDateInfo(b.date);
      if (left.key !== right.key) {
        return left.key - right.key;
      }
      return normalizeString(a.title, "").localeCompare(normalizeString(b.title, ""));
    });
  }

  function createEventId() {
    return "evt-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
  }

  function masterTimelineEntries(characters) {
    var entries = [];
    var characterById = {};
    (characters || []).forEach(function (character) {
      if (character && character.id) {
        characterById[character.id] = character;
      }
    });

    (characters || []).forEach(function (character) {
      var timeline = Array.isArray(character.timeline) ? character.timeline : [];
      timeline.forEach(function (rawEvent, index) {
        var event = normalizeTimelineEvent(rawEvent, character.id);
        var dateInfo = parseDateInfo(event.date);
        entries.push({
          key: "evt:" + character.id + ":" + (event.id || "idx-" + index),
          ownerId: character.id,
          sourceIndex: index,
          eventId: event.id,
          event: event,
          system: false,
          character: character,
          dateInfo: dateInfo
        });
      });

      var lifecycleDates = shared.resolveCharacterLifecycleDates ? shared.resolveCharacterLifecycleDates(character) : {};
      [
        { type: "birth", title: "Born", date: lifecycleDates.dateOfBirth },
        { type: "embrace", title: "Embraced", date: lifecycleDates.dateOfEmbrace },
        { type: "death", title: "Died", date: lifecycleDates.dateOfDeath }
      ].forEach(function (lifecycleEvent) {
        var eventDate = normalizeString(lifecycleEvent.date, "");
        if (!eventDate) {
          return;
        }
        entries.push({
          key: "sys:" + character.id + ":" + lifecycleEvent.type,
          ownerId: character.id,
          sourceIndex: -1,
          eventId: "",
          system: true,
          systemType: lifecycleEvent.type,
          event: {
            id: "",
            date: eventDate,
            title: lifecycleEvent.title,
            description: "",
            storyArc: "",
            relatedSession: "",
            location: "",
            gmNotes: "",
            tags: []
          },
          character: character,
          dateInfo: parseDateInfo(eventDate)
        });
      });
    });

    // A multi-character event is physically duplicated into every linked
    // character's own timeline array (so each character's personal Timeline
    // section shows it), but the master Chronicle Timeline list should show
    // it exactly once, with every linked character resolved for chip
    // display -- so dedupe by event id and attach `linkedCharacters`.
    var seenEventIds = {};
    var deduped = [];
    entries.forEach(function (entry) {
      if (entry.system) {
        entry.linkedCharacters = [entry.character];
        deduped.push(entry);
        return;
      }
      if (entry.eventId) {
        if (seenEventIds[entry.eventId]) {
          return;
        }
        seenEventIds[entry.eventId] = true;
      }
      var ids = (entry.event.characterIds && entry.event.characterIds.length) ? entry.event.characterIds : [entry.ownerId];
      var linkedCharacters = ids.map(function (id) { return characterById[id]; }).filter(Boolean);
      entry.linkedCharacters = linkedCharacters.length ? linkedCharacters : [entry.character];
      entry.character = entry.linkedCharacters[0];
      deduped.push(entry);
    });
    entries = deduped;

    entries.sort(function (a, b) {
      if (a.dateInfo.key !== b.dateInfo.key) {
        return a.dateInfo.key - b.dateInfo.key;
      }
      var byName = normalizeString(a.character && a.character.name, "").localeCompare(normalizeString(b.character && b.character.name, ""));
      if (byName !== 0) {
        return byName;
      }
      return normalizeString(a.event && a.event.title, "").localeCompare(normalizeString(b.event && b.event.title, ""));
    });

    return entries;
  }

  function selectedFilterValues(filters, options) {
    return options.filter(function (option) { return Boolean(filters[option.value]); });
  }

  function buildFilterSummary(labelPlural, filters, options) {
    var selected = selectedFilterValues(filters, options).map(function (item) { return item.label; });
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

  function App() {
    var _characters = useState([]);
    var characters = _characters[0];
    var setCharacters = _characters[1];

    var _locations = useState([]);
    var locations = _locations[0];
    var setLocations = _locations[1];

    var _loading = useState(true);
    var loading = _loading[0];
    var setLoading = _loading[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

    var _sortMode = useState("chronological-desc");
    var sortMode = _sortMode[0];
    var setSortMode = _sortMode[1];

    var _characterFilters = useState({});
    var characterFilters = _characterFilters[0];
    var setCharacterFilters = _characterFilters[1];

    var _clanFilters = useState({});
    var clanFilters = _clanFilters[0];
    var setClanFilters = _clanFilters[1];

    var _sectFilters = useState({});
    var sectFilters = _sectFilters[0];
    var setSectFilters = _sectFilters[1];

    var _activeDropdown = useState(null);
    var activeDropdown = _activeDropdown[0];
    var setActiveDropdown = _activeDropdown[1];

    var _focusedFilterIndex = useState({ character: 0, clan: 0, sect: 0, sort: 0 });
    var focusedFilterIndex = _focusedFilterIndex[0];
    var setFocusedFilterIndex = _focusedFilterIndex[1];

    var _expandedEntryKey = useState(null);
    var expandedEntryKey = _expandedEntryKey[0];
    var setExpandedEntryKey = _expandedEntryKey[1];

    var _modalState = useState({
      open: false,
      mode: "add",
      ownerId: "",
      eventId: "",
      sourceIndex: -1,
      draft: {
        characterIds: [],
        eventType: DEFAULT_EVENT_TYPE,
        year: "",
        title: "",
        description: "",
        storyArc: "",
        relatedSession: "",
        locationId: "",
        legacyLocation: "",
        gmNotes: "",
        tags: "",
        extraMeta: {}
      }
    });
    var modalState = _modalState[0];
    var setModalState = _modalState[1];

    var channelRef = useRef(null);
    var filterRootRef = useRef(null);
    var filterTriggerRefs = useRef({ character: null, clan: null, sect: null, sort: null });
    var filterOptionRefs = useRef({ character: [], clan: [], sect: [], sort: [] });

    useEffect(function () {
      var cancelled = false;
      characterService.getAll()
        .then(function (characters) {
          if (cancelled) {
            return;
          }
          var nextCharacters = Array.isArray(characters) ? characters : [];
          setCharacters(nextCharacters.map(function (character) {
            var next = Object.assign({}, character);
            next.timeline = sortTimelineEvents((next.timeline || []).map(function (rawEvent) {
              return normalizeTimelineEvent(rawEvent, character.id);
            }));
            return next;
          }));
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

    // Locations for the Event Type modal's Location picker -- fetched once
    // and kept live via subscribeLocationRecordChanges so a location
    // created/renamed/deleted from the Locations page (or another tab)
    // shows up here too, not just ones created through this picker itself.
    useEffect(function () {
      var cancelled = false;
      function loadLocations() {
        if (typeof shared.readLocationRecords !== "function") {
          return;
        }
        shared.readLocationRecords().then(function (records) {
          if (cancelled) {
            return;
          }
          setLocations(Array.isArray(records) ? records : []);
        }).catch(function () {
          if (!cancelled) {
            setLocations([]);
          }
        });
      }
      loadLocations();
      var unsubscribe = typeof shared.subscribeLocationRecordChanges === "function"
        ? shared.subscribeLocationRecordChanges(loadLocations)
        : function () {};
      return function () {
        cancelled = true;
        unsubscribe();
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
          setCharacters(message.characters.map(function (character) {
            var next = Object.assign({}, character);
            next.timeline = sortTimelineEvents((next.timeline || []).map(function (rawEvent) {
              return normalizeTimelineEvent(rawEvent, character.id);
            }));
            return next;
          }));
          return;
        }

        if (message.type === "character-updated" && message.character && message.character.id) {
          var incoming = Object.assign({}, message.character);
          incoming.timeline = sortTimelineEvents((incoming.timeline || []).map(function (rawEvent) {
            return normalizeTimelineEvent(rawEvent, incoming.id);
          }));
          setCharacters(function (prev) {
            var found = false;
            var next = prev.map(function (entry) {
              if (entry.id !== incoming.id) {
                return entry;
              }
              found = true;
              return Object.assign({}, entry, incoming);
            });
            if (!found) {
              next.push(incoming);
            }
            return next;
          });
        }
      };

      return function () {
        channelRef.current = null;
        channel.close();
      };
    }, []);

    useEffect(function () {
      if (!activeDropdown) {
        return;
      }

      function onPointerDown(event) {
        var root = filterRootRef.current;
        if (!root || root.contains(event.target)) {
          return;
        }
        setActiveDropdown(null);
      }

      function onEscape(event) {
        if (event.key !== "Escape") {
          return;
        }
        var current = activeDropdown;
        setActiveDropdown(null);
        window.requestAnimationFrame(function () {
          var trigger = filterTriggerRefs.current[current];
          if (trigger && typeof trigger.focus === "function") {
            trigger.focus();
          }
        });
      }

      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [activeDropdown]);

    var characterOptions = useMemo(function () {
      return characters
        .map(function (character) {
          return {
            value: character.id,
            label: normalizeString(character.name, "Unnamed Character")
          };
        })
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [characters]);

    var locationOptions = useMemo(function () {
      return (locations || [])
        .filter(function (location) { return location && location.id; })
        .map(function (location) {
          return { id: location.id, label: normalizeString(location.name, "Unnamed Location") };
        })
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [locations]);

    var clanOptions = useMemo(function () {
      var seen = {};
      var options = [];
      characters.forEach(function (entry) {
        var value = normalizeString(entry.clan, "None");
        if (!seen[value]) {
          seen[value] = true;
          options.push({ value: value, label: value });
        }
      });
      return options.sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [characters]);

    var sectOptions = useMemo(function () {
      var seen = {};
      var options = [];
      characters.forEach(function (entry) {
        var value = normalizeString(entry.sect, "None");
        if (!seen[value]) {
          seen[value] = true;
          options.push({ value: value, label: value });
        }
      });
      return options.sort(function (a, b) { return a.label.localeCompare(b.label); });
    }, [characters]);

    useEffect(function () {
      if (!activeDropdown) {
        return;
      }
      var optionList = activeDropdown === "character"
        ? characterOptions
        : (activeDropdown === "clan"
          ? clanOptions
          : (activeDropdown === "sect" ? sectOptions : SORT_OPTIONS));
      var maxIndex = activeDropdown === "sort"
        ? Math.max(0, optionList.length - 1)
        : optionList.length;
      var currentIndex = focusedFilterIndex[activeDropdown] || 0;
      var clamped = Math.max(0, Math.min(maxIndex, currentIndex));
      if (clamped !== currentIndex) {
        setFocusedFilterIndex(function (prev) {
          var next = Object.assign({}, prev);
          next[activeDropdown] = clamped;
          return next;
        });
        return;
      }
      window.requestAnimationFrame(function () {
        var refs = filterOptionRefs.current[activeDropdown] || [];
        var target = refs[clamped];
        if (target && typeof target.focus === "function") {
          target.focus();
        }
      });
    }, [activeDropdown, focusedFilterIndex, characterOptions, clanOptions, sectOptions]);

    var timelineEntries = useMemo(function () {
      return masterTimelineEntries(characters);
    }, [characters]);

    useEffect(function () {
      if (!expandedEntryKey) {
        return;
      }
      var exists = timelineEntries.some(function (entry) { return entry.key === expandedEntryKey; });
      if (!exists) {
        setExpandedEntryKey(null);
      }
    }, [timelineEntries, expandedEntryKey]);

    var filteredEntries = useMemo(function () {
      var term = normalizeString(search, "").toLowerCase();
      var activeCharacterIds = Object.keys(characterFilters).filter(function (key) { return characterFilters[key]; });
      var activeClans = Object.keys(clanFilters).filter(function (key) { return clanFilters[key]; });
      var activeSects = Object.keys(sectFilters).filter(function (key) { return sectFilters[key]; });

      return timelineEntries.filter(function (entry) {
        var characterName = normalizeString(entry.character && entry.character.name, "Unnamed Character");
        var clan = normalizeString(entry.character && entry.character.clan, "None");
        var sect = normalizeString(entry.character && entry.character.sect, "None");
        var title = normalizeString(entry.event && entry.event.title, "");
        var description = normalizeString(entry.event && entry.event.description, "");

        if (term) {
          var haystack = (title + " " + characterName + " " + description).toLowerCase();
          if (haystack.indexOf(term) === -1) {
            return false;
          }
        }

        if (activeCharacterIds.length) {
          var entryCharacterIds = (entry.event && entry.event.characterIds && entry.event.characterIds.length)
            ? entry.event.characterIds
            : [entry.ownerId];
          var matchesActiveCharacter = entryCharacterIds.some(function (id) { return activeCharacterIds.indexOf(id) !== -1; });
          if (!matchesActiveCharacter) {
            return false;
          }
        }

        if (activeClans.length && activeClans.indexOf(clan) === -1) {
          return false;
        }

        if (activeSects.length && activeSects.indexOf(sect) === -1) {
          return false;
        }

        return true;
      });
    }, [timelineEntries, search, characterFilters, clanFilters, sectFilters]);

    var sortedEntries = useMemo(function () {
      var indexed = filteredEntries.map(function (entry, index) {
        return { entry: entry, index: index };
      });

      function titleValue(item) {
        return normalizeString(item.entry.event && item.entry.event.title, "");
      }

      function characterValue(item) {
        return normalizeString(item.entry.character && item.entry.character.name, "");
      }

      indexed.sort(function (left, right) {
        var primary = 0;
        if (sortMode === "chronological-asc") {
          primary = left.entry.dateInfo.key - right.entry.dateInfo.key;
        } else if (sortMode === "chronological-desc") {
          primary = right.entry.dateInfo.key - left.entry.dateInfo.key;
        } else if (sortMode === "title-asc") {
          primary = titleValue(left).localeCompare(titleValue(right));
        } else if (sortMode === "title-desc") {
          primary = titleValue(right).localeCompare(titleValue(left));
        } else if (sortMode === "character-asc") {
          primary = characterValue(left).localeCompare(characterValue(right));
        } else if (sortMode === "character-desc") {
          primary = characterValue(right).localeCompare(characterValue(left));
        }

        if (primary !== 0) {
          return primary;
        }

        // Stable fallback prevents visual shuffling when primary values tie.
        return left.index - right.index;
      });

      return indexed.map(function (item) { return item.entry; });
    }, [filteredEntries, sortMode]);

    function allOptionsSelected(options, filters) {
      return options.length > 0 && options.every(function (option) { return Boolean(filters[option.value]); });
    }

    function setAllFilters(mapSetter, options, enabled) {
      mapSetter(function () {
        if (!enabled) {
          return {};
        }
        var next = {};
        options.forEach(function (option) {
          next[option.value] = true;
        });
        return next;
      });
    }

    function toggleFilter(mapSetter, value) {
      mapSetter(function (prev) {
        var next = Object.assign({}, prev);
        next[value] = !Boolean(next[value]);
        return next;
      });
    }

    function openFilterDropdown(kind, options, filters) {
      var selected = selectedFilterValues(filters, options);
      var startIndex = selected.length ? Math.max(1, options.indexOf(selected[0]) + 1) : 0;
      setFocusedFilterIndex(function (prev) {
        var next = Object.assign({}, prev);
        next[kind] = startIndex;
        return next;
      });
      setActiveDropdown(kind);
    }

    function toggleFilterDropdown(kind, options, filters) {
      if (activeDropdown === kind) {
        setActiveDropdown(null);
        return;
      }
      openFilterDropdown(kind, options, filters);
    }

    function moveFilterFocus(kind, delta, optionsLength) {
      setFocusedFilterIndex(function (prev) {
        var next = Object.assign({}, prev);
        var total = optionsLength + 1;
        var base = next[kind] || 0;
        var moved = (base + delta + total) % total;
        next[kind] = moved;
        return next;
      });
    }

    function setFilterFocus(kind, index) {
      setFocusedFilterIndex(function (prev) {
        var next = Object.assign({}, prev);
        next[kind] = index;
        return next;
      });
    }

    function toggleFilterByIndex(kind, options, filters, mapSetter, index) {
      if (index === 0) {
        setAllFilters(mapSetter, options, !allOptionsSelected(options, filters));
        return;
      }
      var option = options[index - 1];
      if (!option) {
        return;
      }
      toggleFilter(mapSetter, option.value);
    }

    function onFilterPanelKeyDown(kind, options, filters, mapSetter, event) {
      var currentIndex = focusedFilterIndex[kind] || 0;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFilterFocus(kind, 1, options.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFilterFocus(kind, -1, options.length);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setFilterFocus(kind, 0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setFilterFocus(kind, options.length);
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggleFilterByIndex(kind, options, filters, mapSetter, currentIndex);
      }
    }

    function onFilterTriggerKeyDown(kind, options, filters, event) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilterDropdown(kind, options, filters);
      }
    }

    function openSortDropdown() {
      var selectedIndex = SORT_OPTIONS.findIndex(function (option) {
        return option.value === sortMode;
      });
      setFocusedFilterIndex(function (prev) {
        var next = Object.assign({}, prev);
        next.sort = selectedIndex >= 0 ? selectedIndex : 0;
        return next;
      });
      setActiveDropdown("sort");
    }

    function toggleSortDropdown() {
      if (activeDropdown === "sort") {
        setActiveDropdown(null);
        return;
      }
      openSortDropdown();
    }

    function onSortTriggerKeyDown(event) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSortDropdown();
      }
    }

    function setSortFocus(index) {
      setFocusedFilterIndex(function (prev) {
        var next = Object.assign({}, prev);
        next.sort = index;
        return next;
      });
    }

    function chooseSortMode(nextMode) {
      setSortMode(nextMode);
      setActiveDropdown(null);
    }

    function onSortPanelKeyDown(event) {
      var current = focusedFilterIndex.sort || 0;
      var max = Math.max(0, SORT_OPTIONS.length - 1);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSortFocus((current + 1) > max ? 0 : current + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSortFocus((current - 1) < 0 ? max : current - 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setSortFocus(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setSortFocus(max);
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        var target = SORT_OPTIONS[current];
        if (target) {
          chooseSortMode(target.value);
        }
      }
    }

    function renderSortDropdown() {
      var dropdownOpen = activeDropdown === "sort";
      var panelId = "timeline-filter-panel-sort";
      var selected = SORT_OPTIONS.find(function (option) {
        return option.value === sortMode;
      }) || SORT_OPTIONS[0];

      filterOptionRefs.current.sort = [];

      return React.createElement(
        "div",
        { className: "character-filter-dropdown", "data-filter-dropdown": "sort" },
        React.createElement("span", { className: "character-filter-label", id: "sortTimelineFilterLabel" }, "Sort"),
        React.createElement(
          "button",
          {
            type: "button",
            className: "character-filter-trigger" + (dropdownOpen ? " open" : ""),
            "aria-haspopup": "menu",
            "aria-expanded": dropdownOpen ? "true" : "false",
            "aria-controls": panelId,
            "aria-labelledby": "sortTimelineFilterLabel",
            ref: function (node) { filterTriggerRefs.current.sort = node; },
            onClick: toggleSortDropdown,
            onKeyDown: onSortTriggerKeyDown
          },
          React.createElement("span", { className: "character-filter-trigger-text" }, selected.label),
          React.createElement("span", { className: "character-filter-trigger-caret", "aria-hidden": "true" }, "v")
        ),
        dropdownOpen
          ? React.createElement(
              "div",
              {
                id: panelId,
                className: "character-filter-menu",
                role: "menu",
                "aria-labelledby": "sortTimelineFilterLabel",
                onKeyDown: onSortPanelKeyDown
              },
              SORT_OPTIONS.map(function (option, index) {
                var checked = option.value === sortMode;
                return React.createElement(
                  "button",
                  {
                    key: "sort-option-" + option.value,
                    type: "button",
                    className: "character-filter-option" + (checked ? " checked" : ""),
                    role: "menuitemradio",
                    "aria-checked": checked ? "true" : "false",
                    tabIndex: -1,
                    ref: function (node) { filterOptionRefs.current.sort[index] = node; },
                    onMouseEnter: function () { setSortFocus(index); },
                    onClick: function () { chooseSortMode(option.value); }
                  },
                  React.createElement("span", { className: "character-filter-check", "aria-hidden": "true" }),
                  React.createElement("span", null, option.label)
                );
              })
            )
          : null
      );
    }

    function renderFilterDropdown(kind, label, labelPlural, options, filters, mapSetter) {
      var summary = buildFilterSummary(labelPlural, filters, options);
      var allSelected = allOptionsSelected(options, filters);
      var dropdownOpen = activeDropdown === kind;
      var panelId = "timeline-filter-panel-" + kind;

      filterOptionRefs.current[kind] = [];

      return React.createElement(
        "div",
        { className: "character-filter-dropdown", "data-filter-dropdown": kind },
        React.createElement("span", { className: "character-filter-label", id: kind + "TimelineFilterLabel" }, label),
        React.createElement(
          "button",
          {
            type: "button",
            className: "character-filter-trigger" + (dropdownOpen ? " open" : ""),
            "aria-haspopup": "menu",
            "aria-expanded": dropdownOpen ? "true" : "false",
            "aria-controls": panelId,
            "aria-labelledby": kind + "TimelineFilterLabel",
            ref: function (node) { filterTriggerRefs.current[kind] = node; },
            onClick: function () { toggleFilterDropdown(kind, options, filters); },
            onKeyDown: function (event) { onFilterTriggerKeyDown(kind, options, filters, event); }
          },
          React.createElement("span", { className: "character-filter-trigger-text" }, summary),
          React.createElement("span", { className: "character-filter-trigger-caret", "aria-hidden": "true" }, "v")
        ),
        dropdownOpen
          ? React.createElement(
              "div",
              {
                id: panelId,
                className: "character-filter-menu",
                role: "menu",
                "aria-labelledby": kind + "TimelineFilterLabel",
                onKeyDown: function (event) { onFilterPanelKeyDown(kind, options, filters, mapSetter, event); }
              },
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "character-filter-option" + (allSelected ? " checked" : ""),
                  role: "menuitemcheckbox",
                  "aria-checked": allSelected ? "true" : "false",
                  tabIndex: -1,
                  ref: function (node) { filterOptionRefs.current[kind][0] = node; },
                  onMouseEnter: function () { setFilterFocus(kind, 0); },
                  onClick: function () { toggleFilterByIndex(kind, options, filters, mapSetter, 0); }
                },
                React.createElement("span", { className: "character-filter-check", "aria-hidden": "true" }),
                React.createElement("span", null, "Select All")
              ),
              React.createElement("div", { className: "character-filter-divider", "aria-hidden": "true" }),
              options.map(function (option, optionIndex) {
                var checked = Boolean(filters[option.value]);
                var domIndex = optionIndex + 1;
                return React.createElement(
                  "button",
                  {
                    key: kind + "-option-" + option.value,
                    type: "button",
                    className: "character-filter-option" + (checked ? " checked" : ""),
                    role: "menuitemcheckbox",
                    "aria-checked": checked ? "true" : "false",
                    tabIndex: -1,
                    ref: function (node) { filterOptionRefs.current[kind][domIndex] = node; },
                    onMouseEnter: function () { setFilterFocus(kind, domIndex); },
                    onClick: function () { toggleFilterByIndex(kind, options, filters, mapSetter, domIndex); }
                  },
                  React.createElement("span", { className: "character-filter-check", "aria-hidden": "true" }),
                  React.createElement("span", null, option.label)
                );
              })
            )
          : null
      );
    }

    function openAddModal() {
      var defaultCharacter = characterOptions[0] ? characterOptions[0].value : "";
      setModalState({
        open: true,
        mode: "add",
        ownerId: "",
        eventId: "",
        sourceIndex: -1,
        draft: {
          characterIds: defaultCharacter ? [defaultCharacter] : [],
          eventType: DEFAULT_EVENT_TYPE,
          year: "",
          title: "",
          description: "",
          storyArc: "",
          relatedSession: "",
          locationId: "",
          legacyLocation: "",
          gmNotes: "",
          tags: "",
          extraMeta: {}
        }
      });
    }

    function openEditModal(entry) {
      if (!entry || entry.system) {
        return;
      }
      var linkedIds = (entry.event.characterIds && entry.event.characterIds.length)
        ? entry.event.characterIds.slice()
        : [entry.ownerId];
      setModalState({
        open: true,
        mode: "edit",
        ownerId: entry.ownerId,
        eventId: entry.eventId,
        sourceIndex: entry.sourceIndex,
        draft: {
          characterIds: linkedIds,
          eventType: normalizeEventType(entry.event.eventType),
          year: normalizeString(entry.event.date, ""),
          title: normalizeString(entry.event.title, ""),
          description: normalizeString(entry.event.description, ""),
          storyArc: normalizeString(entry.event.storyArc, ""),
          relatedSession: normalizeString(entry.event.relatedSession, ""),
          locationId: normalizeString(entry.event.locationId, ""),
          legacyLocation: normalizeString(entry.event.location, ""),
          gmNotes: normalizeString(entry.event.gmNotes, ""),
          tags: (entry.event.tags || []).join(", "),
          extraMeta: Object.assign({}, entry.event.extraMeta || {})
        }
      });
    }

    function updateModalField(field, value) {
      setModalState(function (prev) {
        var nextDraft = Object.assign({}, prev.draft);
        nextDraft[field] = value;
        return Object.assign({}, prev, { draft: nextDraft });
      });
    }

    function closeModal() {
      setModalState(function (prev) {
        return Object.assign({}, prev, { open: false });
      });
    }

    function persistCharacters(changedCharacters) {
      var channel = channelRef.current;
      (changedCharacters || []).forEach(function (character) {
        characterService.save(character).catch(function () { return null; });
        if (channel) {
          channel.postMessage({
            type: "character-updated",
            source: sourceId,
            character: shared.clone(character)
          });
        }
      });
    }

    function saveModalEvent() {
      if (!modalState.open) {
        return;
      }
      var draft = modalState.draft || {};
      var targetCharacterIds = Array.isArray(draft.characterIds) ? draft.characterIds.filter(Boolean) : [];
      var title = normalizeString(draft.title, "");
      if (!targetCharacterIds.length || !title) {
        window.alert("At least one Character and an Event Title are required.");
        return;
      }

      var eventId = modalState.mode === "edit" && modalState.eventId ? modalState.eventId : createEventId();
      var normalizedEvent = {
        id: eventId,
        date: normalizeString(draft.year, ""),
        title: title,
        description: normalizeString(draft.description, ""),
        storyArc: normalizeString(draft.storyArc, ""),
        relatedSession: normalizeString(draft.relatedSession, ""),
        // A picked/created locationId always supersedes the legacy free-text
        // value; if the user never touched the Location picker on an old
        // event, its original free text is preserved untouched instead of
        // being silently dropped by this save.
        locationId: normalizeString(draft.locationId, ""),
        location: draft.locationId ? "" : normalizeString(draft.legacyLocation, ""),
        gmNotes: normalizeString(draft.gmNotes, ""),
        tags: parseTags(draft.tags),
        characterIds: targetCharacterIds,
        eventType: normalizeEventType(draft.eventType),
        extraMeta: Object.assign({}, draft.extraMeta || {})
      };
      if (modalState.mode !== "edit") {
        normalizedEvent.createdAt = new Date().toISOString();
      }

      var changedById = {};
      var nextCharacters = characters.map(function (character) {
        var next = Object.assign({}, character);
        next.timeline = sortTimelineEvents((character.timeline || []).map(function (rawEvent) {
          return normalizeTimelineEvent(rawEvent, character.id);
        }));
        return next;
      });

      if (modalState.mode === "edit") {
        // The event may have been physically duplicated into several
        // characters' own timeline arrays -- drop every existing copy
        // (wherever it lives) before re-adding it under the current set of
        // linked characters, since that set may have changed.
        nextCharacters.forEach(function (character) {
          var before = character.timeline.length;
          character.timeline = character.timeline.filter(function (event) {
            var matchesId = modalState.eventId && event.id === modalState.eventId;
            var matchesLegacyIndex = !modalState.eventId && character.id === modalState.ownerId;
            return !(matchesId || matchesLegacyIndex);
          });
          if (character.timeline.length !== before) {
            changedById[character.id] = character;
          }
        });
      }

      targetCharacterIds.forEach(function (characterId) {
        var targetCharacter = nextCharacters.find(function (entry) { return entry.id === characterId; });
        if (!targetCharacter) {
          return;
        }
        targetCharacter.timeline = sortTimelineEvents((targetCharacter.timeline || []).concat([normalizedEvent]));
        changedById[targetCharacter.id] = targetCharacter;
      });

      setCharacters(nextCharacters);
      persistCharacters(Object.keys(changedById).map(function (id) { return changedById[id]; }));
      closeModal();
    }

    function deleteModalEvent() {
      if (!modalState.open || modalState.mode !== "edit") {
        return;
      }
      if (!window.confirm("Delete this event?")) {
        return;
      }

      var eventId = modalState.eventId;
      var changedCharacters = [];
      var nextCharacters = characters.map(function (character) {
        var next = Object.assign({}, character);
        next.timeline = sortTimelineEvents((character.timeline || []).map(function (rawEvent) {
          return normalizeTimelineEvent(rawEvent, character.id);
        }));
        var before = next.timeline.length;
        next.timeline = next.timeline.filter(function (event, index) {
          var matchesId = eventId && event.id === eventId;
          var matchesLegacyIndex = !eventId && next.id === modalState.ownerId && index === modalState.sourceIndex;
          return !(matchesId || matchesLegacyIndex);
        });
        if (next.timeline.length !== before) {
          changedCharacters.push(next);
        }
        return next;
      });

      setCharacters(nextCharacters);
      persistCharacters(changedCharacters);
      closeModal();
    }

    return html`
      <div className="chronicle-page">
        <section className="search-panel card chronicle-controls-card">
          <div className="chronicle-controls-head">
            <label htmlFor="timelineSearch">Search Timeline</label>
            <button type="button" className="chronicle-add-event" onClick=${openAddModal}>Add Event</button>
          </div>
          <div className="search-row">
            <input
              id="timelineSearch"
              type="search"
              placeholder="Search by event title, character, or description..."
              autoComplete="off"
              value=${search}
              onInput=${function (event) { setSearch(event.target.value); }}
            />
          </div>
          <div className="character-filter-grid" ref=${filterRootRef}>
            ${renderFilterDropdown("character", "Character", "Characters", characterOptions, characterFilters, setCharacterFilters)}
            ${renderFilterDropdown("clan", "Clan", "Clans", clanOptions, clanFilters, setClanFilters)}
            ${renderFilterDropdown("sect", "Sect", "Sects", sectOptions, sectFilters, setSectFilters)}
            ${renderSortDropdown()}
          </div>
        </section>

        <section className="card chronicle-timeline-card">
          <div className="section-heading chronicle-heading">
            <h3>Chronicle Timeline</h3>
            <span>${sortedEntries.length} Events</span>
          </div>
          <div className="chronicle-list" role="list">
            ${loading ? html`<p className="hint">Loading timeline events...</p>` : null}
            ${!loading && !sortedEntries.length ? html`<p className="hint">No timeline events match your current search and filters.</p>` : null}
            ${sortedEntries.map(function (entry, index) {
              var isExpanded = expandedEntryKey === entry.key;
              var linkedCharacters = (entry.linkedCharacters && entry.linkedCharacters.length ? entry.linkedCharacters : [entry.character]).filter(Boolean);
              var characterNames = linkedCharacters.map(function (character) { return normalizeString(character.name, "Unnamed Character"); }).join(", ");
              var linkedLocation = entry.event.locationId
                ? locations.find(function (location) { return location.id === entry.event.locationId; })
                : null;
              var locationDisplayText = linkedLocation ? normalizeString(linkedLocation.name, "Unnamed Location") : entry.event.location;
              var eventType = eventTypeInfo(entry.event.eventType);
              var iconPath = entry.system ? (SYSTEM_TYPE_ICONS[entry.systemType] || SYSTEM_TYPE_ICONS.birth) : eventType.icon;
              var iconColor = entry.system ? undefined : eventType.color;
              var accentStyle = entry.system ? undefined : { "--chronicle-entry-accent": eventType.color };
              var showYearHeading = index === 0 || sortedEntries[index - 1].dateInfo.yearLabel !== entry.dateInfo.yearLabel;
              return html`${showYearHeading ? html`<div key=${"year-" + entry.key} className="chronicle-year-heading" role="presentation">
                <span className="chronicle-year-label">${entry.dateInfo.yearLabel}</span>
                <span className="chronicle-year-rule" aria-hidden="true"></span>
              </div>` : null}
              <article
                key=${entry.key}
                className=${"chronicle-entry" + (isExpanded ? " expanded" : "") + (entry.system ? " system" : "")}
                style=${accentStyle}
                role="listitem"
                onClick=${function () { setExpandedEntryKey(isExpanded ? null : entry.key); }}>
                <div className="chronicle-entry-actions">
                  ${!entry.system ? html`<button
                    type="button"
                    className="chronicle-entry-action chronicle-edit-action"
                    aria-label="Edit event"
                    title="Edit event"
                    onClick=${function (event) {
                      event.stopPropagation();
                      openEditModal(entry);
                    }}
                  >${shared.Icon({ icon: "../assets/Icons/edit.svg", size: 15 })}</button>` : null}
                </div>
                <div className="chronicle-entry-summary">
                  <span className="chronicle-entry-icon">${shared.Icon({ icon: iconPath, color: iconColor, className: "chronicle-entry-icon-svg" })}</span>
                  <span className="chronicle-entry-title">${entry.event.title || "Untitled Event"}</span>
                  ${characterNames ? html`<span className="chronicle-entry-badge"><span aria-hidden="true">${shared.Icon({ icon: "../assets/Icons/Characters.svg", size: 13 })}</span> ${characterNames}</span>` : null}
                  ${locationDisplayText ? html`<span className="chronicle-entry-badge"><span aria-hidden="true">${shared.Icon({ icon: "../assets/Icons/location.svg", size: 13 })}</span> ${locationDisplayText}</span>` : null}
                  ${entry.event.relatedSession ? html`<span className="chronicle-entry-badge"><span aria-hidden="true">${shared.Icon({ icon: "../assets/Icons/session.svg", size: 13 })}</span> ${entry.event.relatedSession}</span>` : null}
                </div>
                ${isExpanded ? html`<div className="chronicle-entry-details">
                  ${!entry.system && linkedCharacters.length ? html`<div className="chronicle-entry-characters">
                    <strong>Characters:</strong>
                    <div className="notebook-chip-list">
                      ${linkedCharacters.map(function (character) {
                        return html`<button
                          type="button"
                          key=${"linked-char-" + character.id}
                          className="notebook-chip location-link-chip"
                          onClick=${function (event) {
                            event.stopPropagation();
                            window.location.href = "characters.html?character=" + character.id;
                          }}
                        ><span>${normalizeString(character.name, "Unnamed Character")}</span></button>`;
                      })}
                    </div>
                  </div>` : null}
                  <p><strong>Date:</strong> ${entry.dateInfo.displayDate || "Unknown"}</p>
                  ${!entry.system ? html`<p className="chronicle-entry-type-row"><strong>Event Type:</strong> ${shared.Icon({ icon: eventType.icon, color: eventType.color, className: "chronicle-entry-type-icon" })} ${eventType.label}</p>` : null}
                  ${entry.event.description ? html`<p><strong>Description:</strong> ${entry.event.description}</p>` : null}
                  ${entry.event.tags && entry.event.tags.length ? html`<p><strong>Tags:</strong> ${entry.event.tags.join(", ")}</p>` : null}
                  ${entry.event.gmNotes ? html`<p><strong>GM Notes:</strong> ${entry.event.gmNotes}</p>` : null}
                  ${entry.event.relatedSession ? html`<p><strong>Related Session:</strong> ${entry.event.relatedSession}</p>` : null}
                  ${entry.event.storyArc ? html`<p><strong>Story Arc:</strong> ${entry.event.storyArc}</p>` : null}
                  ${linkedLocation ? html`<p><strong>Location:</strong> <button
                      type="button"
                      className="notebook-chip location-link-chip"
                      onClick=${function (event) {
                        event.stopPropagation();
                        window.location.href = "locations.html?location=" + linkedLocation.id;
                      }}
                    ><span>${normalizeString(linkedLocation.name, "Unnamed Location")}</span></button></p>`
                    : (entry.event.location ? html`<p><strong>Location:</strong> ${entry.event.location}</p>` : null)}
                </div>` : null}
              </article>`;
            })}
          </div>
        </section>

        ${modalState.open ? html`<div className="chronicle-modal" role="dialog" aria-modal="true" aria-label=${modalState.mode === "edit" ? "Edit event" : "Add event"}>
          <div className="chronicle-modal-backdrop" onClick=${closeModal}></div>
          <div className="chronicle-modal-panel card">
            <div className="chronicle-modal-head">
              <h3>${modalState.mode === "edit" ? "Edit Event" : "Add Event"}</h3>
              <button type="button" className="icon-button chronicle-modal-close-button" aria-label="Close dialog" onClick=${closeModal}>×</button>
            </div>
            <div className="chronicle-modal-grid">
              <div className="chronicle-span-2">
                <${shared.OwnerDropdown}
                  id="timelineEventCharacterField"
                  label="Characters"
                  characters=${characters}
                  values=${modalState.draft.characterIds}
                  onChange=${function (ids) { updateModalField("characterIds", ids); }}
                  noneLabel="No characters selected"
                  itemLabelPlural="Characters"
                />
              </div>
              <div className="chronicle-span-2">
                <span className="character-filter-label">Event Type</span>
                <div className="event-type-picker" role="radiogroup" aria-label="Event Type">
                  ${EVENT_TYPES.map(function (type) {
                    var selected = normalizeEventType(modalState.draft.eventType) === type.value;
                    return html`<button
                      type="button"
                      key=${"event-type-" + type.value}
                      role="radio"
                      aria-checked=${selected ? "true" : "false"}
                      className=${"event-type-option" + (selected ? " selected" : "")}
                      style=${{ "--event-type-color": type.color }}
                      onClick=${function () { updateModalField("eventType", type.value); }}
                    >
                      <span className="event-type-icon">${shared.Icon({ icon: type.icon, color: type.color, className: "event-type-icon-svg" })}</span>
                      <span>${type.label}</span>
                    </button>`;
                  })}
                </div>
              </div>
              <label>Year / Date
                <input type="text" value=${modalState.draft.year} onInput=${function (event) { updateModalField("year", event.target.value); }} placeholder="YYYY or YYYY-MM-DD" />
              </label>
              <label className="chronicle-span-2">Event Title
                <input type="text" value=${modalState.draft.title} onInput=${function (event) { updateModalField("title", event.target.value); }} placeholder="Event title" />
              </label>
              <label className="chronicle-span-2">Description
                <textarea rows="4" value=${modalState.draft.description} onInput=${function (event) { updateModalField("description", event.target.value); }} placeholder="Event description"></textarea>
              </label>
              <label>Story Arc
                <input type="text" value=${modalState.draft.storyArc} onInput=${function (event) { updateModalField("storyArc", event.target.value); }} placeholder="Optional" />
              </label>
              <label>Session
                <input type="text" value=${modalState.draft.relatedSession} onInput=${function (event) { updateModalField("relatedSession", event.target.value); }} placeholder="Optional" />
              </label>
              <div>
                <${shared.EntityPickerField}
                  entityType="location"
                  label="Location"
                  value=${modalState.draft.locationId}
                  options=${locationOptions}
                  onChange=${function (id) { updateModalField("locationId", id); }}
                  onCreated=${function (created) { setLocations(function (prev) { return prev.concat([{ id: created.id, name: created.label }]); }); }}
                  placeholder="Search locations..."
                  createLabelNoun="Location"
                />
              </div>
              <label>Tags
                <input type="text" value=${modalState.draft.tags} onInput=${function (event) { updateModalField("tags", event.target.value); }} placeholder="tag1, tag2" />
              </label>
              <label className="chronicle-span-2">GM Notes
                <textarea rows="3" value=${modalState.draft.gmNotes} onInput=${function (event) { updateModalField("gmNotes", event.target.value); }} placeholder="Optional"></textarea>
              </label>
            </div>
            <div className="chronicle-modal-actions">
              ${modalState.mode === "edit" ? html`<button type="button" className="chronicle-delete" onClick=${deleteModalEvent}>Delete Event</button>` : null}
              <button type="button" onClick=${saveModalEvent}>Save Event</button>
            </div>
          </div>
        </div>` : null}
      </div>
    `;
  }

  var root = document.getElementById("timelineApp");
  if (!root) {
    return;
  }

  ReactDOM.createRoot(root).render(React.createElement(App));
})();
