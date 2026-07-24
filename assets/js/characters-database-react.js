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
  if (!shared.readCampaignAtlasState || !shared.CharacterBiographyWorkspace) {
    return;
  }

  var CharacterBiographyWorkspace = shared.CharacterBiographyWorkspace;
  var CHANNEL_NAME = "campaign-atlas-characters";
  var sourceId = "characters-page-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
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
    if (!raw) {
      return FALLBACK_PORTRAIT_DATA_URI;
    }
    if (raw === "Default.png") {
      return FALLBACK_PORTRAIT_DATA_URI;
    }
    if (/^data:image\//i.test(raw) || /^https?:\/\//i.test(raw) || raw.indexOf("blob:") === 0) {
      return raw;
    }
    return "../Relationship map/" + encodeURIComponent(raw);
  }

  function relationshipCountFor(characterId, relationships) {
    return (relationships || []).filter(function (entry) {
      return entry && (entry.from === characterId || entry.to === characterId);
    }).length;
  }

  function selectedFilterValues(filters, options) {
    return options.filter(function (option) { return Boolean(filters[option]); });
  }

  function buildFilterSummary(labelPlural, filters, options) {
    var selected = selectedFilterValues(filters, options);
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
    var _records = useState([]);
    var characters = _records[0];
    var setCharacters = _records[1];

    var _relationships = useState([]);
    var relationships = _relationships[0];
    var setRelationships = _relationships[1];

    var _selectedId = useState(null);
    var selectedId = _selectedId[0];
    var setSelectedId = _selectedId[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

    var _loading = useState(true);
    var loading = _loading[0];
    var setLoading = _loading[1];

    var _clanFilters = useState({});
    var clanFilters = _clanFilters[0];
    var setClanFilters = _clanFilters[1];

    var _sectFilters = useState({});
    var sectFilters = _sectFilters[0];
    var setSectFilters = _sectFilters[1];

    var _activeDropdown = useState(null);
    var activeDropdown = _activeDropdown[0];
    var setActiveDropdown = _activeDropdown[1];

    var _focusedFilterIndex = useState({ clan: 0, sect: 0 });
    var focusedFilterIndex = _focusedFilterIndex[0];
    var setFocusedFilterIndex = _focusedFilterIndex[1];

    var saveTimerRef = useRef(null);
    var channelRef = useRef(null);
    var filterRootRef = useRef(null);
    var filterTriggerRefs = useRef({ clan: null, sect: null });
    var filterOptionRefs = useRef({ clan: [], sect: [] });

    useEffect(function () {
      var cancelled = false;
      shared.readCampaignAtlasState()
        .then(function (state) {
          if (cancelled) {
            return;
          }
          var nextCharacters = Array.isArray(state.characters) ? state.characters : [];
          var nextRelationships = Array.isArray(state.relationships) ? state.relationships : [];
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

    var clanOptions = useMemo(function () {
      var seen = {};
      var options = [];
      characters.forEach(function (entry) {
        var value = normalizeString(entry.clan, "None");
        if (!seen[value]) {
          seen[value] = true;
          options.push(value);
        }
      });
      return options.sort();
    }, [characters]);

    var sectOptions = useMemo(function () {
      var seen = {};
      var options = [];
      characters.forEach(function (entry) {
        var value = normalizeString(entry.sect, "None");
        if (!seen[value]) {
          seen[value] = true;
          options.push(value);
        }
      });
      return options.sort();
    }, [characters]);

    var filteredCharacters = useMemo(function () {
      var term = normalizeString(search, "").toLowerCase();
      var activeClanFilters = Object.keys(clanFilters).filter(function (key) { return clanFilters[key]; });
      var activeSectFilters = Object.keys(sectFilters).filter(function (key) { return sectFilters[key]; });

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

        if (activeClanFilters.length && activeClanFilters.indexOf(clan) === -1) {
          return false;
        }

        if (activeSectFilters.length && activeSectFilters.indexOf(sect) === -1) {
          return false;
        }

        return true;
      });
    }, [characters, search, clanFilters, sectFilters]);

    var selectedCharacter = useMemo(function () {
      return characters.find(function (entry) { return entry.id === selectedId; }) || null;
    }, [characters, selectedId]);

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

    useEffect(function () {
      if (!activeDropdown) {
        return;
      }
      var optionList = activeDropdown === "clan" ? clanOptions : sectOptions;
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
    }, [activeDropdown, focusedFilterIndex, clanOptions, sectOptions]);

    function toggleFilter(mapSetter, value) {
      mapSetter(function (prev) {
        var next = Object.assign({}, prev);
        next[value] = !Boolean(next[value]);
        return next;
      });
    }

    function allOptionsSelected(options, filters) {
      return options.length > 0 && options.every(function (option) { return Boolean(filters[option]); });
    }

    function setAllFilters(mapSetter, options, enabled) {
      mapSetter(function () {
        if (!enabled) {
          return {};
        }
        var next = {};
        options.forEach(function (option) {
          next[option] = true;
        });
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

    function setFilterFocus(kind, nextIndex) {
      setFocusedFilterIndex(function (prev) {
        var next = Object.assign({}, prev);
        next[kind] = nextIndex;
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
      toggleFilter(mapSetter, option);
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
      var panelId = "character-filter-panel-" + kind;

      filterOptionRefs.current[kind] = [];

      return React.createElement(
        "div",
        { className: "character-filter-dropdown", "data-filter-dropdown": kind },
        React.createElement("span", { className: "character-filter-label", id: kind + "FilterLabel" }, label),
        React.createElement(
          "button",
          {
            type: "button",
            className: "character-filter-trigger" + (dropdownOpen ? " open" : ""),
            "aria-haspopup": "menu",
            "aria-expanded": dropdownOpen ? "true" : "false",
            "aria-controls": panelId,
            "aria-labelledby": kind + "FilterLabel",
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
                "aria-labelledby": kind + "FilterLabel",
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
                var checked = Boolean(filters[option]);
                var domIndex = optionIndex + 1;
                return React.createElement(
                  "button",
                  {
                    key: kind + "-option-" + option,
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
                  React.createElement("span", null, option)
                );
              })
            )
          : null
      );
    }

    function persistCharacterUpdate(nextCharacter) {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(function () {
        saveTimerRef.current = null;
        shared.saveCharacterToCampaignAtlas(nextCharacter).catch(function () { return null; });
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

    function updateSelectedBiography(nextHtml) {
      if (!selectedCharacter) {
        return;
      }
      setCharacters(function (prev) {
        return prev.map(function (entry) {
          if (entry.id !== selectedCharacter.id) {
            return entry;
          }
          var nextCharacter = Object.assign({}, entry, {
            bioHtml: nextHtml,
            bio: String(nextHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          });
          persistCharacterUpdate(nextCharacter);
          return nextCharacter;
        });
      });
    }

    return html`
      <div className="character-db-page">
        <section className="search-panel card">
          <label htmlFor="characterSearch">Search Characters</label>
          <div className="search-row">
            <input id="characterSearch" type="search" placeholder="Search by name, clan, sect..." autoComplete="off" value=${search} onInput=${function (event) { setSearch(event.target.value); }} />
          </div>
          ${React.createElement(
            "div",
            { className: "character-filter-grid", ref: filterRootRef },
            renderFilterDropdown("clan", "Clan", "Clans", clanOptions, clanFilters, setClanFilters),
            renderFilterDropdown("sect", "Sect", "Sects", sectOptions, sectFilters, setSectFilters)
          )}
        </section>

        <section className="character-db-layout">
          <aside className="character-db-list-panel card">
            <h3>Character List</h3>
            <div className="character-db-list-scroll">
              ${loading ? html`<p className="hint">Loading characters...</p>` : null}
              ${!loading && !filteredCharacters.length ? html`<p className="hint">No characters match your current search and filters.</p>` : null}
              ${filteredCharacters.map(function (entry) {
                var relCount = relationshipCountFor(entry.id, relationships);
                var isActive = entry.id === selectedId;
                return React.createElement(
                  "button",
                  {
                    key: "char-list-item-" + entry.id,
                    type: "button",
                    className: "character-db-list-item" + (isActive ? " active" : ""),
                    onClick: function () { setSelectedId(entry.id); }
                  },
                  React.createElement("img", {
                    className: "character-db-list-portrait",
                    src: portraitSrc(entry),
                    alt: entry.name || "Character portrait",
                    onError: function (event) { event.currentTarget.src = FALLBACK_PORTRAIT_DATA_URI; }
                  }),
                  React.createElement(
                    "span",
                    { className: "character-db-list-meta" },
                    React.createElement("strong", null, entry.name || "Unnamed Character"),
                    React.createElement("span", null, normalizeString(entry.clan, "None") + " - " + normalizeString(entry.sect, "None")),
                    React.createElement("span", null, (entry.generation ? "Generation " + entry.generation : "Generation unknown") + " - " + relCount + " relationships")
                  )
                );
              })}
            </div>
          </aside>

          <article className="character-db-profile-panel card">
            ${selectedCharacter
              ? html`<div className="character-db-profile-content">
                  <div className="character-db-profile-head">
                    <img className="character-db-profile-portrait" src=${portraitSrc(selectedCharacter)} alt=${selectedCharacter.name || "Character portrait"} onError=${function (event) { event.currentTarget.src = FALLBACK_PORTRAIT_DATA_URI; }} />
                    <div>
                      <h3>${selectedCharacter.name || "Unnamed Character"}</h3>
                      <p>${normalizeString(selectedCharacter.clan, "None")} - ${normalizeString(selectedCharacter.sect, "None")}</p>
                      <small>${selectedCharacter.generation ? "Generation " + selectedCharacter.generation : "Generation unknown"}</small>
                    </div>
                  </div>
                  <section className="profile-biography">
                    <div className="profile-biography-head">
                      <h3>Biography</h3>
                    </div>
                    <${CharacterBiographyWorkspace}
                      editable=${true}
                      value=${String(shared.characterBiographyHtml(selectedCharacter) || "")}
                      onChange=${updateSelectedBiography}
                      editorClassName="rich-editor profile-rich-editor character-rich-text"
                      viewerClassName="profile-biography-content character-rich-text"
                    />
                  </section>
                </div>`
              : html`<div className="character-db-empty"><h3>Select a Character</h3><p>Choose a character from the list to open their shared biography workspace.</p></div>`}
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
