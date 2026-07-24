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
  if (!shared.readCampaignAtlasState || !shared.saveCharacterToCampaignAtlas || !shared.clone) {
    return;
  }

  var CHANNEL_NAME = "campaign-atlas-characters";
  var sourceId = "timeline-page-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
  var FALLBACK_PORTRAIT_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%2313131a'/%3E%3Ccircle cx='40' cy='30' r='14' fill='%23d10d40' fill-opacity='0.6'/%3E%3Crect x='20' y='48' width='40' height='22' rx='11' fill='%23d10d40' fill-opacity='0.4'/%3E%3C/svg%3E";

  function normalizeString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  function portraitSrc(character) {
    var portraitValue = character && character.portrait;
    if (portraitValue && typeof portraitValue === "object") {
      portraitValue = portraitValue.image || portraitValue.src || "Default.png";
    }
    var raw = normalizeString(portraitValue, "Default.png");
    if (!raw || raw === "Default.png") {
      return FALLBACK_PORTRAIT_DATA_URI;
    }
    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw) || raw.indexOf("blob:") === 0) {
      return raw;
    }
    return "../Relationship map/" + encodeURIComponent(raw);
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

  function normalizeTimelineEvent(rawEvent) {
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
      gmNotes: true,
      tags: true
    };
    var extraMeta = {};
    Object.keys(event).forEach(function (key) {
      if (!known[key]) {
        extraMeta[key] = event[key];
      }
    });
    return {
      id: normalizeString(event.id, ""),
      date: normalizeString(event.date, ""),
      title: normalizeString(event.title, "Untitled Event"),
      description: normalizeString(event.description, ""),
      storyArc: normalizeString(event.storyArc, ""),
      relatedSession: normalizeString(event.relatedSession || event.session, ""),
      location: normalizeString(event.location, ""),
      gmNotes: normalizeString(event.gmNotes, ""),
      tags: parseTags(event.tags),
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

    (characters || []).forEach(function (character) {
      var timeline = Array.isArray(character.timeline) ? character.timeline : [];
      timeline.forEach(function (rawEvent, index) {
        var event = normalizeTimelineEvent(rawEvent);
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

      if (normalizeString(character.dateOfBirth, "")) {
        var birthDate = normalizeString(character.dateOfBirth, "");
        entries.push({
          key: "sys:" + character.id + ":birth",
          ownerId: character.id,
          sourceIndex: -1,
          eventId: "",
          system: true,
          systemType: "birth",
          event: {
            id: "",
            date: birthDate,
            title: "Born",
            description: "",
            storyArc: "",
            relatedSession: "",
            location: "",
            gmNotes: "",
            tags: []
          },
          character: character,
          dateInfo: parseDateInfo(birthDate)
        });
      }

      if (normalizeString(character.dateOfDeath, "")) {
        var deathDate = normalizeString(character.dateOfDeath, "");
        entries.push({
          key: "sys:" + character.id + ":death",
          ownerId: character.id,
          sourceIndex: -1,
          eventId: "",
          system: true,
          systemType: "death",
          event: {
            id: "",
            date: deathDate,
            title: "Died",
            description: "",
            storyArc: "",
            relatedSession: "",
            location: "",
            gmNotes: "",
            tags: []
          },
          character: character,
          dateInfo: parseDateInfo(deathDate)
        });
      }
    });

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

    var _loading = useState(true);
    var loading = _loading[0];
    var setLoading = _loading[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

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

    var _focusedFilterIndex = useState({ character: 0, clan: 0, sect: 0 });
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
        characterId: "",
        year: "",
        title: "",
        description: "",
        storyArc: "",
        relatedSession: "",
        location: "",
        gmNotes: "",
        tags: "",
        extraMeta: {}
      }
    });
    var modalState = _modalState[0];
    var setModalState = _modalState[1];

    var channelRef = useRef(null);
    var filterRootRef = useRef(null);
    var filterTriggerRefs = useRef({ character: null, clan: null, sect: null });
    var filterOptionRefs = useRef({ character: [], clan: [], sect: [] });

    useEffect(function () {
      var cancelled = false;
      shared.readCampaignAtlasState()
        .then(function (state) {
          if (cancelled) {
            return;
          }
          var nextCharacters = Array.isArray(state.characters) ? state.characters : [];
          setCharacters(nextCharacters.map(function (character) {
            var next = Object.assign({}, character);
            next.timeline = sortTimelineEvents((next.timeline || []).map(normalizeTimelineEvent));
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
            next.timeline = sortTimelineEvents((next.timeline || []).map(normalizeTimelineEvent));
            return next;
          }));
          return;
        }

        if (message.type === "character-updated" && message.character && message.character.id) {
          var incoming = Object.assign({}, message.character);
          incoming.timeline = sortTimelineEvents((incoming.timeline || []).map(normalizeTimelineEvent));
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
        : (activeDropdown === "clan" ? clanOptions : sectOptions);
      var maxIndex = optionList.length;
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

        if (activeCharacterIds.length && activeCharacterIds.indexOf(entry.ownerId) === -1) {
          return false;
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
          characterId: defaultCharacter,
          year: "",
          title: "",
          description: "",
          storyArc: "",
          relatedSession: "",
          location: "",
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
      setModalState({
        open: true,
        mode: "edit",
        ownerId: entry.ownerId,
        eventId: entry.eventId,
        sourceIndex: entry.sourceIndex,
        draft: {
          characterId: entry.ownerId,
          year: normalizeString(entry.event.date, ""),
          title: normalizeString(entry.event.title, ""),
          description: normalizeString(entry.event.description, ""),
          storyArc: normalizeString(entry.event.storyArc, ""),
          relatedSession: normalizeString(entry.event.relatedSession, ""),
          location: normalizeString(entry.event.location, ""),
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
        shared.saveCharacterToCampaignAtlas(character).catch(function () { return null; });
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
      var targetCharacterId = normalizeString(draft.characterId, "");
      var title = normalizeString(draft.title, "");
      if (!targetCharacterId || !title) {
        window.alert("Character and Event Title are required.");
        return;
      }

      var normalizedEvent = {
        id: modalState.mode === "edit" && modalState.eventId ? modalState.eventId : createEventId(),
        date: normalizeString(draft.year, ""),
        title: title,
        description: normalizeString(draft.description, ""),
        storyArc: normalizeString(draft.storyArc, ""),
        relatedSession: normalizeString(draft.relatedSession, ""),
        location: normalizeString(draft.location, ""),
        gmNotes: normalizeString(draft.gmNotes, ""),
        tags: parseTags(draft.tags),
        extraMeta: Object.assign({}, draft.extraMeta || {})
      };

      var changedById = {};
      var nextCharacters = characters.map(function (character) {
        var next = Object.assign({}, character);
        next.timeline = sortTimelineEvents((character.timeline || []).map(normalizeTimelineEvent));
        return next;
      });

      if (modalState.mode === "edit") {
        var sourceCharacter = nextCharacters.find(function (entry) { return entry.id === modalState.ownerId; });
        if (sourceCharacter) {
          var removed = false;
          sourceCharacter.timeline = sourceCharacter.timeline.filter(function (event, index) {
            var matchesId = modalState.eventId && event.id === modalState.eventId;
            var matchesIndex = !modalState.eventId && index === modalState.sourceIndex;
            if ((matchesId || matchesIndex) && !removed) {
              removed = true;
              return false;
            }
            return true;
          });
          sourceCharacter.timeline = sortTimelineEvents(sourceCharacter.timeline);
          changedById[sourceCharacter.id] = sourceCharacter;
        }
      }

      var targetCharacter = nextCharacters.find(function (entry) { return entry.id === targetCharacterId; });
      if (!targetCharacter) {
        window.alert("Selected character could not be found.");
        return;
      }
      targetCharacter.timeline = sortTimelineEvents((targetCharacter.timeline || []).concat([normalizedEvent]));
      changedById[targetCharacter.id] = targetCharacter;

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

      var changedCharacters = [];
      var nextCharacters = characters.map(function (character) {
        var next = Object.assign({}, character);
        next.timeline = sortTimelineEvents((character.timeline || []).map(normalizeTimelineEvent));
        if (next.id === modalState.ownerId) {
          var removed = false;
          next.timeline = next.timeline.filter(function (event, index) {
            var matchesId = modalState.eventId && event.id === modalState.eventId;
            var matchesIndex = !modalState.eventId && index === modalState.sourceIndex;
            if ((matchesId || matchesIndex) && !removed) {
              removed = true;
              return false;
            }
            return true;
          });
          next.timeline = sortTimelineEvents(next.timeline);
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
          </div>
        </section>

        <section className="card chronicle-timeline-card">
          <div className="section-heading chronicle-heading">
            <h3>Chronicle Timeline</h3>
            <span>${filteredEntries.length} Events</span>
          </div>
          <div className="chronicle-list" role="list">
            ${loading ? html`<p className="hint">Loading timeline events...</p>` : null}
            ${!loading && !filteredEntries.length ? html`<p className="hint">No timeline events match your current search and filters.</p>` : null}
            ${filteredEntries.map(function (entry) {
              var isExpanded = expandedEntryKey === entry.key;
              var characterName = normalizeString(entry.character && entry.character.name, "Unnamed Character");
              return html`<article
                key=${entry.key}
                className=${"chronicle-entry" + (isExpanded ? " expanded" : "") + (entry.system ? " system" : "")}
                role="listitem"
                onClick=${function () { setExpandedEntryKey(isExpanded ? null : entry.key); }}
                onDoubleClick=${function () { openEditModal(entry); }}>
                <div className="chronicle-entry-row">
                  <div className="chronicle-entry-year">${entry.dateInfo.yearLabel}</div>
                  <img className="chronicle-entry-portrait" src=${portraitSrc(entry.character)} alt=${characterName} onError=${function (event) { event.currentTarget.src = FALLBACK_PORTRAIT_DATA_URI; }} />
                  <div className="chronicle-entry-main">
                    <strong>${characterName}</strong>
                    <p>${entry.event.title || "Untitled Event"}</p>
                  </div>
                </div>
                ${isExpanded ? html`<div className="chronicle-entry-details">
                  <p><strong>Date:</strong> ${entry.dateInfo.displayDate || "Unknown"}</p>
                  ${entry.event.description ? html`<p><strong>Description:</strong> ${entry.event.description}</p>` : null}
                  ${entry.event.gmNotes ? html`<p><strong>GM Notes:</strong> ${entry.event.gmNotes}</p>` : null}
                  ${entry.event.storyArc ? html`<p><strong>Story Arc:</strong> ${entry.event.storyArc}</p>` : null}
                  ${entry.event.relatedSession ? html`<p><strong>Related Session:</strong> ${entry.event.relatedSession}</p>` : null}
                  ${entry.event.location ? html`<p><strong>Location:</strong> ${entry.event.location}</p>` : null}
                  ${entry.event.tags && entry.event.tags.length ? html`<p><strong>Tags:</strong> ${entry.event.tags.join(", ")}</p>` : null}
                  ${Object.keys(entry.event.extraMeta || {}).map(function (key) {
                    var value = entry.event.extraMeta[key];
                    if (value === undefined || value === null || value === "") {
                      return null;
                    }
                    var label = key.replace(/([A-Z])/g, " $1").replace(/^./, function (letter) { return letter.toUpperCase(); });
                    var rendered = typeof value === "string" ? value : JSON.stringify(value);
                    return html`<p key=${entry.key + "-extra-" + key}><strong>${label}:</strong> ${rendered}</p>`;
                  })}
                  ${entry.system ? html`<p className="hint">System-generated event from date of birth/death.</p>` : html`<p className="hint">Double-click to edit this event.</p>`}
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
              <button type="button" onClick=${closeModal}>Close</button>
            </div>
            <div className="chronicle-modal-grid">
              <label>Character
                <select value=${modalState.draft.characterId} onChange=${function (event) { updateModalField("characterId", event.target.value); }}>
                  ${characterOptions.map(function (option) {
                    return html`<option key=${"modal-character-" + option.value} value=${option.value}>${option.label}</option>`;
                  })}
                </select>
              </label>
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
              <label>Location
                <input type="text" value=${modalState.draft.location} onInput=${function (event) { updateModalField("location", event.target.value); }} placeholder="Optional" />
              </label>
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
