(function () {
  if (!window.React || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  function normalizeFilterString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  // Single source of truth for Character Directory filtering (Clan/Sect/
  // Status/Tags), shared between the standalone Characters page
  // (characters-database-react.js) and the Relationship Map's own
  // Character Directory panel (relationship-map-react.js) so neither one
  // reimplements the filter state, panel UI, or AND/OR predicate logic --
  // both call this exact hook and get identical behaviour.
  //
  // Deliberately does NOT handle text search: each caller already has its
  // own search input/state (and, in the Relationship Map's case, its own
  // sort), so this only owns the four filter categories. Callers combine
  // matchesFilters(entry) with their own search predicate when filtering
  // their character list.
  function useCharacterDirectoryFilters() {
    var shared = window.CampaignAtlasCharactersShared || {};
    var mapLayoutService = window.MapLayoutService;

    var _clanFilters = useState({});
    var clanFilters = _clanFilters[0];
    var setClanFilters = _clanFilters[1];

    var _sectFilters = useState({});
    var sectFilters = _sectFilters[0];
    var setSectFilters = _sectFilters[1];

    var _statusFilters = useState({});
    var statusFilters = _statusFilters[0];
    var setStatusFilters = _statusFilters[1];

    var _tagFilters = useState({});
    var tagFilters = _tagFilters[0];
    var setTagFilters = _tagFilters[1];

    var _isFilterPanelOpen = useState(false);
    var isFilterPanelOpen = _isFilterPanelOpen[0];
    var setIsFilterPanelOpen = _isFilterPanelOpen[1];

    // Every section starts collapsed; independently toggled afterward and
    // NOT reset when the panel closes/reopens (only the very first render
    // is "collapsed by default" -- re-collapsing on every reopen would just
    // undo whatever the user chose to look at last).
    var _collapsedFilterSections = useState({ clan: true, sect: true, status: true, tag: true });
    var collapsedFilterSections = _collapsedFilterSections[0];
    var setCollapsedFilterSections = _collapsedFilterSections[1];

    // Filters the Tags section's displayed chip list only -- never touches
    // tagFilters (the actual selections), per "Typing should filter the
    // available tags without affecting any selected filters."
    var _tagSearchQuery = useState("");
    var tagSearchQuery = _tagSearchQuery[0];
    var setTagSearchQuery = _tagSearchQuery[1];

    // "left" (default) or "right" -- recomputed every time the panel opens
    // from the button's actual position and the panel's rendered width, so
    // it never overflows the viewport regardless of where the button sits.
    var _filterPanelAlign = useState("left");
    var filterPanelAlign = _filterPanelAlign[0];
    var setFilterPanelAlign = _filterPanelAlign[1];

    // Tag Manager tag names, fetched once for the Tags filter section --
    // same MapLayoutService.getPreferences() read used by the Tags panel
    // and the character editor's tag picker, so filter options always
    // match whatever the Tag Manager currently defines (never hardcoded).
    var _allTagNames = useState([]);
    var allTagNames = _allTagNames[0];
    var setAllTagNames = _allTagNames[1];

    var filterButtonRef = useRef(null);
    var filterPanelRef = useRef(null);
    var filterChipsRowRef = useRef(null);

    // Filter options come from the configured lists (the same ones the
    // character editor's own Clan/Sect/Status dropdowns use), never from
    // whatever happens to already be in use -- so a clan with zero current
    // characters still shows up as a filterable option, and nothing here
    // is hardcoded separately from that single source of truth.
    var clanOptions = shared.CLAN_OPTIONS || [];
    var sectOptions = shared.SECT_OPTIONS || [];
    var statusOptions = shared.STATUS_OPTIONS || [];

    var tagOptions = useMemo(function () {
      return allTagNames.slice().sort(function (a, b) { return a.localeCompare(b); });
    }, [allTagNames]);

    useEffect(function () {
      var cancelled = false;
      if (!mapLayoutService || typeof mapLayoutService.getPreferences !== "function") {
        return;
      }
      mapLayoutService.getPreferences().then(function (prefs) {
        if (cancelled) {
          return;
        }
        var names = [];
        (Array.isArray(prefs.tagGroups) ? prefs.tagGroups : []).forEach(function (group) {
          (Array.isArray(group.tags) ? group.tags : []).forEach(function (tag) {
            if (tag && tag.name && names.indexOf(tag.name) === -1) {
              names.push(tag.name);
            }
          });
        });
        setAllTagNames(names);
      }).catch(function () { return null; });
      return function () { cancelled = true; };
    }, []);

    // Single combined filter panel (Filter button + one panel, all four
    // categories together) -- closes on outside click or Escape, same as
    // the popovers elsewhere in the app.
    useEffect(function () {
      if (!isFilterPanelOpen) {
        return;
      }

      function onPointerDown(event) {
        var panel = filterPanelRef.current;
        var button = filterButtonRef.current;
        var chipsRow = filterChipsRowRef.current;
        if ((panel && panel.contains(event.target)) || (button && button.contains(event.target)) || (chipsRow && chipsRow.contains(event.target))) {
          return;
        }
        setIsFilterPanelOpen(false);
      }

      function onEscape(event) {
        if (event.key !== "Escape") {
          return;
        }
        setIsFilterPanelOpen(false);
        if (filterButtonRef.current) {
          filterButtonRef.current.focus();
        }
      }

      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [isFilterPanelOpen]);

    // Runs before paint so there's no visible flash at the wrong position.
    // Measured off the BUTTON's position and the panel's own rendered
    // width (both independent of whichever alignment class happened to be
    // set last time) rather than the panel's current left/right offset,
    // which would just measure whatever alignment was already applied.
    useLayoutEffect(function () {
      if (!isFilterPanelOpen) {
        return;
      }
      var button = filterButtonRef.current;
      var panel = filterPanelRef.current;
      if (!button || !panel) {
        return;
      }
      var buttonRect = button.getBoundingClientRect();
      var margin = 12;
      var overflowsRight = buttonRect.left + panel.offsetWidth > window.innerWidth - margin;
      setFilterPanelAlign(overflowsRight ? "right" : "left");
    }, [isFilterPanelOpen]);

    function toggleFilterSectionCollapsed(kind) {
      setCollapsedFilterSections(function (prev) {
        var next = Object.assign({}, prev);
        next[kind] = !prev[kind];
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

    function clearAllFilters() {
      setClanFilters({});
      setSectFilters({});
      setStatusFilters({});
      setTagFilters({});
    }

    // The shared AND/OR predicate: within a category, matching ANY
    // selected value is enough (OR) -- e.g. Clan = Gangrel OR Nosferatu;
    // across categories, every active category must match (AND) -- e.g.
    // that AND Sect = Camarilla. Callers combine this with their own
    // search predicate; it never looks at search text itself.
    var activeClanFilters = useMemo(function () { return Object.keys(clanFilters).filter(function (key) { return clanFilters[key]; }); }, [clanFilters]);
    var activeSectFilters = useMemo(function () { return Object.keys(sectFilters).filter(function (key) { return sectFilters[key]; }); }, [sectFilters]);
    var activeStatusFilters = useMemo(function () { return Object.keys(statusFilters).filter(function (key) { return statusFilters[key]; }); }, [statusFilters]);
    var activeTagFilters = useMemo(function () { return Object.keys(tagFilters).filter(function (key) { return tagFilters[key]; }); }, [tagFilters]);

    function matchesFilters(entry) {
      var clan = normalizeFilterString(entry.clan, "None");
      var sect = normalizeFilterString(entry.sect, "None");
      var status = normalizeFilterString(entry.status, "Unknown");
      var tags = Array.isArray(entry.tags) ? entry.tags : [];

      if (activeClanFilters.length && activeClanFilters.indexOf(clan) === -1) {
        return false;
      }
      if (activeSectFilters.length && activeSectFilters.indexOf(sect) === -1) {
        return false;
      }
      if (activeStatusFilters.length && activeStatusFilters.indexOf(status) === -1) {
        return false;
      }
      if (activeTagFilters.length && !tags.some(function (tag) { return activeTagFilters.indexOf(tag) !== -1; })) {
        return false;
      }
      return true;
    }

    function filterCharacters(characters) {
      return (characters || []).filter(matchesFilters);
    }

    // One chip per selected VALUE (not per category) -- "Clan = Gangrel"
    // and "Clan = Nosferatu" each get their own removable chip.
    var activeFilterChips = useMemo(function () {
      var chips = [];
      function addChips(prefix, filters, mapSetter) {
        Object.keys(filters).forEach(function (value) {
          if (filters[value]) {
            chips.push({ key: prefix + "-" + value, label: value, remove: function () { toggleFilter(mapSetter, value); } });
          }
        });
      }
      addChips("clan", clanFilters, setClanFilters);
      addChips("sect", sectFilters, setSectFilters);
      addChips("status", statusFilters, setStatusFilters);
      addChips("tag", tagFilters, setTagFilters);
      return chips;
    }, [clanFilters, sectFilters, statusFilters, tagFilters]);

    function renderFilterSection(kind, label, options, filters, mapSetter) {
      if (!options.length) {
        return null;
      }
      var collapsed = Boolean(collapsedFilterSections[kind]);
      var selectedCount = options.filter(function (option) { return Boolean(filters[option]); }).length;
      var bodyId = "characterFilterSectionBody-" + kind;

      var displayOptions = options;
      if (kind === "tag" && tagSearchQuery.trim()) {
        var term = tagSearchQuery.trim().toLowerCase();
        displayOptions = options.filter(function (option) { return option.toLowerCase().indexOf(term) !== -1; });
      }

      return html`<div className="character-directory-filter-section" key=${"filter-section-" + kind}>
        <button
          type="button"
          className="character-directory-filter-section-header"
          aria-expanded=${!collapsed}
          aria-controls=${bodyId}
          onClick=${function () { toggleFilterSectionCollapsed(kind); }}
        >
          <span className="character-directory-filter-section-caret" aria-hidden="true">${collapsed ? "▶" : "▼"}</span>
          <span className="character-directory-filter-section-title">${label}</span>
          ${selectedCount ? html`<span className="character-directory-filter-section-count">${selectedCount}</span>` : null}
        </button>
        ${!collapsed ? html`<div className="character-directory-filter-section-body" id=${bodyId}>
          ${kind === "tag" ? html`<input
            type="text"
            className="character-directory-filter-tag-search"
            placeholder="Search tags..."
            value=${tagSearchQuery}
            onInput=${function (event) { setTagSearchQuery(event.target.value); }}
            aria-label="Search tags"
          />` : null}
          <div className="character-directory-filter-chip-list">
            ${displayOptions.length
              ? displayOptions.map(function (option) {
                  var checked = Boolean(filters[option]);
                  return html`<button
                    type="button"
                    key=${kind + "-chip-" + option}
                    className=${"tag-chip" + (checked ? " active" : "")}
                    aria-pressed=${checked}
                    onClick=${function () { toggleFilter(mapSetter, option); }}
                  >${option}</button>`;
                })
              : html`<p className="hint character-directory-filter-empty">No matching ${label.toLowerCase()}.</p>`}
          </div>
        </div>` : null}
      </div>`;
    }

    function renderFilterPanel() {
      return html`<div
        id="characterDirectoryFilterPanel"
        className=${"character-directory-filter-panel" + (filterPanelAlign === "right" ? " align-right" : "")}
        ref=${filterPanelRef}
        role="dialog"
        aria-label="Filter characters"
      >
        <div className="character-directory-filter-panel-body">
          ${renderFilterSection("clan", "Clan", clanOptions, clanFilters, setClanFilters)}
          ${renderFilterSection("sect", "Sect", sectOptions, sectFilters, setSectFilters)}
          ${renderFilterSection("status", "Status", statusOptions, statusFilters, setStatusFilters)}
          ${renderFilterSection("tag", "Tags", tagOptions, tagFilters, setTagFilters)}
        </div>
      </div>`;
    }

    // The button + its anchored panel, ready to drop inline next to a
    // page's own search input.
    function renderFilterControl() {
      return html`<div className="character-directory-filter-anchor">
        <button
          type="button"
          className=${"character-directory-filter-button" + (isFilterPanelOpen ? " open" : "")}
          ref=${filterButtonRef}
          aria-haspopup="dialog"
          aria-expanded=${isFilterPanelOpen}
          aria-controls="characterDirectoryFilterPanel"
          onClick=${function () { setIsFilterPanelOpen(function (prev) { return !prev; }); }}
        >
          ${activeFilterChips.length ? "Filters (" + activeFilterChips.length + ")" : "Filter"}
        </button>
        ${isFilterPanelOpen ? renderFilterPanel() : null}
      </div>`;
    }

    // The removable active-filter chip row + Clear All, meant to render
    // beneath a page's own search input. Returns null when nothing is
    // active so callers can drop it inline unconditionally.
    function renderActiveFilters() {
      if (!activeFilterChips.length) {
        return null;
      }
      return html`<div className="character-directory-active-filters" ref=${filterChipsRowRef}>
        ${activeFilterChips.map(function (chip) {
          return html`<span className="character-directory-filter-chip" key=${chip.key}>
            <span>${chip.label}</span>
            <button type="button" onClick=${chip.remove} aria-label=${"Remove filter " + chip.label}>×</button>
          </span>`;
        })}
        <button type="button" className="character-directory-clear-filters" onClick=${clearAllFilters}>Clear All</button>
      </div>`;
    }

    return {
      clanOptions: clanOptions,
      sectOptions: sectOptions,
      statusOptions: statusOptions,
      tagOptions: tagOptions,
      activeFilterChips: activeFilterChips,
      matchesFilters: matchesFilters,
      filterCharacters: filterCharacters,
      clearAllFilters: clearAllFilters,
      renderFilterControl: renderFilterControl,
      renderActiveFilters: renderActiveFilters
    };
  }

  window.CharacterDirectoryFilters = {
    useCharacterDirectoryFilters: useCharacterDirectoryFilters
  };
})();
