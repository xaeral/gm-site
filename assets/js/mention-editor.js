(function () {
  if (!window.React || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  // Reusable Mention Editor -- a contentEditable rich-text surface (built on
  // top of the app's existing CharacterBiographyWorkspace toolbar/editor, so
  // formatting/undo/paste behaviour stays identical to every other rich-text
  // field in the app) with one thing added: typing "@" opens a live search
  // across Characters, Locations, Tags, Clans, Sects and Timeline Events,
  // and selecting a result inserts a MENTION -- an atomic, non-editable DOM
  // node (`contenteditable="false"`) carrying the entity's type+id as data
  // attributes, not a plain-text token. Mentions are first-class nodes in
  // the editor's DOM model: the browser natively treats a nested
  // contenteditable="false" element as a single unit for cursor movement,
  // selection and deletion, which is what makes "atomic" editing work here
  // without a custom text-editing engine.
  //
  // First adopted by GM Notes and Session Notes (see pages/gm-notes.html /
  // pages/sessions.html + assets/js/gm-notes.js / assets/js/sessions-journal.js).
  // Any future editor (Character Biography, Timeline Event descriptions,
  // Location Notes, Story Arc Notes, ...) that currently renders
  // `<${shared.CharacterBiographyWorkspace} value=... onChange=.../>` can
  // adopt mentions by rendering `<${window.MentionEditor.MentionRichTextEditor}
  // value=... onChange=.../>` instead -- the props are a superset of
  // CharacterBiographyWorkspace's, so no other changes are required.

  var ENTITY_ICONS = {
    character: "👤",
    location: "📍",
    tag: "🏷",
    clan: "🩸",
    sect: "🏛",
    "timeline-event": "📅"
  };

  var ENTITY_LABELS = {
    character: "Character",
    location: "Location",
    tag: "Tag",
    clan: "Clan",
    sect: "Sect",
    "timeline-event": "Timeline Event"
  };

  var MAX_RESULTS = 8;
  var MENTION_TRIGGER_PATTERN = /(?:^|[\s([{])@([^\s@]{0,60})$/;
  // "#" is a Location-only shortcut trigger, distinct from "@"'s full
  // multi-type search -- e.g. "#Forum" searches Locations only, and its
  // create-prompt creates a Location directly (no "choose a type" step,
  // since the type is already implied by the trigger character itself).
  var HASH_TRIGGER_PATTERN = /(?:^|[\s([{])#([^\s#]{0,60})$/;
  var HASH_TRIGGER_ENTITY_TYPE = "location";

  function uniqueByKey(list) {
    var seen = {};
    var result = [];
    list.forEach(function (item) {
      var key = item.type + ":" + item.id;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      result.push(item);
    });
    return result;
  }

  // Pulls a fresh candidate list from every supported Chronicle data source.
  // Deliberately NOT cached/subscribed -- this only runs while the "@"
  // dropdown is open (a short-lived interaction), so a fresh read on every
  // keystroke is simpler than maintaining a live index and is always
  // current by construction.
  async function collectMentionCandidates() {
    var shared = window.CampaignAtlasCharactersShared || {};
    var characters = [];
    var locations = [];
    var tagGroups = [];

    try {
      if (window.CharacterService && typeof window.CharacterService.getAll === "function") {
        characters = await window.CharacterService.getAll();
      }
    } catch (_error) {
      characters = [];
    }

    try {
      if (typeof shared.readLocationRecords === "function") {
        locations = await shared.readLocationRecords();
      }
    } catch (_error2) {
      locations = [];
    }

    try {
      if (window.MapLayoutService && typeof window.MapLayoutService.getPreferences === "function") {
        var prefs = await window.MapLayoutService.getPreferences();
        tagGroups = Array.isArray(prefs && prefs.tagGroups) ? prefs.tagGroups : [];
      }
    } catch (_error3) {
      tagGroups = [];
    }

    var candidates = [];

    (characters || []).forEach(function (character) {
      if (!character || !character.id) {
        return;
      }
      candidates.push({
        type: "character",
        id: character.id,
        label: String(character.name || "Unnamed Character")
      });

      (Array.isArray(character.timeline) ? character.timeline : []).forEach(function (event) {
        if (!event || !event.id) {
          return;
        }
        candidates.push({
          type: "timeline-event",
          id: event.id,
          ownerId: character.id,
          label: String(event.title || "Untitled Event")
        });
      });
    });

    (locations || []).forEach(function (location) {
      if (!location || !location.id) {
        return;
      }
      candidates.push({
        type: "location",
        id: location.id,
        label: String(location.name || "Unnamed Location")
      });
    });

    var tagNames = [];
    tagGroups.forEach(function (group) {
      (Array.isArray(group && group.tags) ? group.tags : []).forEach(function (tag) {
        var name = String((tag && tag.name) || "").trim();
        if (name && tagNames.indexOf(name) === -1) {
          tagNames.push(name);
        }
      });
    });
    tagNames.forEach(function (name) {
      candidates.push({ type: "tag", id: name, label: name });
    });

    (shared.CLAN_OPTIONS || []).forEach(function (clan) {
      if (clan && clan !== "None") {
        candidates.push({ type: "clan", id: clan, label: clan });
      }
    });
    (shared.SECT_OPTIONS || []).forEach(function (sect) {
      if (sect && sect !== "None") {
        candidates.push({ type: "sect", id: sect, label: sect });
      }
    });

    return uniqueByKey(candidates);
  }

  // Case-insensitive partial-name match, alphabetical across every entity
  // type together (matching e.g. "@mar" -> Marcus Vitel, Margaret
  // Whitlock, Market Square in that order regardless of type).
  function filterMentionCandidates(candidates, query) {
    var term = String(query || "").trim().toLowerCase();
    var matches = !term
      ? candidates.slice()
      : candidates.filter(function (candidate) {
          return candidate.label.toLowerCase().indexOf(term) !== -1;
        });
    matches.sort(function (a, b) { return a.label.localeCompare(b.label); });
    return matches.slice(0, MAX_RESULTS);
  }

  async function searchMentionCandidates(query, entityFilter) {
    var candidates = await collectMentionCandidates();
    if (entityFilter) {
      candidates = candidates.filter(function (candidate) { return candidate.type === entityFilter; });
    }
    return filterMentionCandidates(candidates, query);
  }

  // Finds an "@query" run ending exactly at the caret, scanning back from
  // the caret through the editor's full text (so it still works if the "@"
  // and the caret are separated by earlier mention nodes -- their rendered
  // text, e.g. "@Marcus Vitel", is part of range.toString() too, but can
  // never itself match this pattern since it's not preceded by whitespace
  // relative to a *new*, still-open "@").
  function detectMentionTrigger(editor) {
    if (!editor) {
      return null;
    }
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return null;
    }
    var anchorNode = selection.anchorNode;
    if (!anchorNode || !editor.contains(anchorNode)) {
      return null;
    }
    var range = document.createRange();
    try {
      range.selectNodeContents(editor);
      range.setEnd(anchorNode, selection.anchorOffset);
    } catch (_error) {
      return null;
    }
    var textBeforeCaret = range.toString();
    var atMatch = MENTION_TRIGGER_PATTERN.exec(textBeforeCaret);
    if (atMatch) {
      return { trigger: "@", query: atMatch[1], entityFilter: null };
    }
    var hashMatch = HASH_TRIGGER_PATTERN.exec(textBeforeCaret);
    if (hashMatch) {
      return { trigger: "#", query: hashMatch[1], entityFilter: HASH_TRIGGER_ENTITY_TYPE };
    }
    return null;
  }

  function caretClientRect(editor) {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return null;
    }
    var range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);
    var rects = range.getClientRects();
    if (rects.length) {
      return rects[0];
    }
    var rect = range.getBoundingClientRect();
    if (rect && (rect.width || rect.height || rect.top || rect.left)) {
      return rect;
    }
    var editorRect = editor.getBoundingClientRect();
    return { top: editorRect.top, bottom: editorRect.top + 20, left: editorRect.left, right: editorRect.left, height: 20 };
  }

  function buildMentionElement(candidate) {
    var span = document.createElement("span");
    span.className = "mention-chip";
    span.setAttribute("contenteditable", "false");
    span.setAttribute("data-mention", "1");
    span.setAttribute("data-entity-type", candidate.type);
    span.setAttribute("data-entity-id", candidate.id);
    span.setAttribute("data-entity-label", candidate.label);
    if (candidate.ownerId) {
      span.setAttribute("data-entity-owner-id", candidate.ownerId);
    }
    span.appendChild(document.createTextNode("@"));
    var labelSpan = document.createElement("span");
    labelSpan.className = "mention-chip-label";
    labelSpan.textContent = candidate.label;
    span.appendChild(labelSpan);
    return span;
  }

  // Replaces the "@query" text immediately before the caret with an atomic
  // mention node. Assumes "@" and the query stayed within the caret's own
  // text node, which holds for continuous typing (the trigger regex can't
  // match across a line break or an existing mention node either).
  //
  // Deliberately uses direct Range/DOM manipulation rather than
  // execCommand("insertHTML", ...): Chrome's insertHTML on a contentEditable
  // root can leave surrounding markup in a shape (observed: a stray trailing
  // empty <p>) where the caret it reports afterward silently refuses further
  // execCommand("insertText") calls. Building the exact DOM ourselves --
  // mention span followed by an empty text node as the caret's landing spot
  // -- keeps the result predictable and guarantees the caret sits inside a
  // real text node afterward, which is what makes typing immediately after
  // a mention work. A synthetic `input` event is dispatched afterward so
  // CharacterBiographyWorkspace's existing onInput->onChange sync still
  // fires exactly as it would for any other edit.
  function insertMentionAtTrigger(editor, candidate, query, triggerAnchor) {
    var selection = window.getSelection();
    // The multi-step "create a new entity" flow can move focus into a name
    // text field between when the "@query" trigger was detected and when
    // creation actually finishes, which can drop the editor's own
    // selection. triggerAnchor (captured back when the trigger first fired)
    // lets that selection be restored precisely before doing the replace,
    // regardless of whatever the browser's live selection is at this point.
    if (triggerAnchor && triggerAnchor.node && triggerAnchor.node.isConnected) {
      editor.focus();
      try {
        var restoreRange = document.createRange();
        restoreRange.setStart(triggerAnchor.node, triggerAnchor.offset);
        restoreRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(restoreRange);
      } catch (_error) {
        // Fall through and use whatever the live selection currently is.
      }
    }
    if (!selection || !selection.rangeCount) {
      return false;
    }
    var caretRange = selection.getRangeAt(0);
    var container = caretRange.endContainer;
    var neededLength = String(query || "").length + 1;
    if (container.nodeType !== 3 || caretRange.endOffset < neededLength) {
      return false;
    }

    var replaceRange = document.createRange();
    replaceRange.setStart(container, caretRange.endOffset - neededLength);
    replaceRange.setEnd(container, caretRange.endOffset);
    replaceRange.deleteContents();

    var insertionPoint = replaceRange.startContainer;
    var insertionOffset = replaceRange.startOffset;
    var mentionNode = buildMentionElement(candidate);
    var anchorText = document.createTextNode("");

    if (insertionPoint.nodeType === 3) {
      var afterText = insertionPoint.splitText(insertionOffset);
      var parent = insertionPoint.parentNode;
      parent.insertBefore(mentionNode, afterText);
      parent.insertBefore(anchorText, afterText);
    } else {
      var refNode = insertionPoint.childNodes[insertionOffset] || null;
      insertionPoint.insertBefore(mentionNode, refNode);
      insertionPoint.insertBefore(anchorText, refNode);
    }

    // Defensive cleanup for a pre-existing contentEditable quirk (reproduces
    // with plain native typing, nothing to do with mentions specifically):
    // typing into a brand-new, still-essentially-empty note can leave an
    // orphaned empty block element (e.g. an empty <p></p>) dangling as a
    // root-level sibling of otherwise-unwrapped inline content. When a
    // mention's caret anchor ends up immediately before that empty block,
    // Chrome disables execCommand for that exact position, which would
    // silently break typing right after the mention. Removing the empty
    // block is always safe -- it has no content -- and only triggers when
    // the mention itself is a direct, unwrapped child of the editor root
    // (i.e. exactly this scenario).
    if (mentionNode.parentNode === editor) {
      var sibling = anchorText.nextSibling;
      while (sibling && sibling.nodeType === 3 && !sibling.textContent) {
        sibling = sibling.nextSibling;
      }
      if (sibling && sibling.nodeType === 1 && !sibling.nextSibling && !sibling.textContent.trim() && !sibling.querySelector("img,br,hr,table,input,textarea")) {
        sibling.remove();
      }
    }

    editor.focus();
    var caretFix = document.createRange();
    caretFix.setStart(anchorText, 0);
    caretFix.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caretFix);

    editor.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: false, inputType: "insertText" }));
    return true;
  }

  function navigationHrefFor(entityType, entityId, ownerId) {
    if (entityType === "character") {
      return "characters.html?character=" + encodeURIComponent(entityId);
    }
    if (entityType === "location") {
      return "locations.html?location=" + encodeURIComponent(entityId);
    }
    if (entityType === "timeline-event") {
      return "timeline.html?event=" + encodeURIComponent(entityId) + "&owner=" + encodeURIComponent(ownerId || "");
    }
    return null;
  }

  // Live rename propagation: re-resolves every mention chip's displayed
  // label against the CURRENT character/location record (by id), patching
  // just the label text node in place -- never touches the rest of the
  // editor's DOM or fires onChange, so it can't disturb an in-progress
  // edit or the cursor. Tags/Clans/Sects have no id independent of their
  // name in this app's data model (see character-directory-filters.js),
  // so there is nothing to re-resolve for them; a mention chip that
  // references a since-deleted character/location instead gets a
  // `.mention-chip-missing` marker rather than silently going stale.
  async function refreshMentionLabels(editor) {
    if (!editor) {
      return;
    }
    var nodes = editor.querySelectorAll('.mention-chip[data-entity-type="character"], .mention-chip[data-entity-type="location"]');
    if (!nodes.length) {
      return;
    }
    var needsCharacters = false;
    var needsLocations = false;
    nodes.forEach(function (node) {
      if (node.getAttribute("data-entity-type") === "character") {
        needsCharacters = true;
      } else {
        needsLocations = true;
      }
    });

    var shared = window.CampaignAtlasCharactersShared || {};
    var characters = [];
    var locations = [];
    try {
      if (needsCharacters && window.CharacterService && typeof window.CharacterService.getAll === "function") {
        characters = await window.CharacterService.getAll();
      }
    } catch (_error) {
      characters = [];
    }
    try {
      if (needsLocations && typeof shared.readLocationRecords === "function") {
        locations = await shared.readLocationRecords();
      }
    } catch (_error2) {
      locations = [];
    }

    var charById = {};
    characters.forEach(function (c) { charById[c.id] = c; });
    var locById = {};
    locations.forEach(function (l) { locById[l.id] = l; });

    nodes.forEach(function (node) {
      var type = node.getAttribute("data-entity-type");
      var id = node.getAttribute("data-entity-id");
      var entity = type === "character" ? charById[id] : locById[id];
      var labelNode = node.querySelector(".mention-chip-label");
      if (!labelNode) {
        return;
      }
      if (entity) {
        var name = String(entity.name || node.getAttribute("data-entity-label") || "");
        if (labelNode.textContent !== name) {
          labelNode.textContent = name;
        }
        node.setAttribute("data-entity-label", name);
        node.classList.remove("mention-chip-missing");
      } else {
        node.classList.add("mention-chip-missing");
      }
    });
  }

  function moveActiveIndex(dropdown, delta) {
    if (!dropdown || !dropdown.items.length) {
      return dropdown;
    }
    var next = dropdown.activeIndex + delta;
    if (next < 0) {
      next = dropdown.items.length - 1;
    }
    if (next >= dropdown.items.length) {
      next = 0;
    }
    return Object.assign({}, dropdown, { activeIndex: next });
  }

  // Entity types creatable from the Mention Editor -- Clans/Sects are
  // reference data (fixed option lists, not records with an id of their
  // own) and are deliberately excluded.
  var CREATABLE_TYPES = [
    { type: "character", label: "Character", icon: ENTITY_ICONS.character },
    { type: "location", label: "Location", icon: ENTITY_ICONS.location },
    { type: "timeline-event", label: "Timeline Event", icon: ENTITY_ICONS["timeline-event"] },
    { type: "tag", label: "Tag", icon: ENTITY_ICONS.tag }
  ];

  function generateEntityId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  // Each creator below calls the exact same save function the entity's own
  // "New ..." flow already uses (CharacterService.save, saveLocationRecord,
  // MapLayoutService.savePreferences), just with a minimal record whose
  // name is the text the user was already typing -- so a mention created
  // this way is indistinguishable, from every other page's point of view,
  // from one created through that page's own UI.
  async function createCharacterEntity(name) {
    var svc = window.CharacterService;
    if (!svc || typeof svc.save !== "function") {
      return null;
    }
    var id = generateEntityId("char");
    await svc.save({ id: id, name: name });
    return { type: "character", id: id, label: name };
  }

  async function createLocationEntity(name) {
    var shared = window.CampaignAtlasCharactersShared || {};
    if (typeof shared.saveLocationRecord !== "function") {
      return null;
    }
    var id = generateEntityId("location");
    await shared.saveLocationRecord({ id: id, name: name });
    return { type: "location", id: id, label: name };
  }

  // Tags have no id independent of their name anywhere else in the app
  // (see character-directory-filters.js) -- a new tag is appended to the
  // first existing Tag Manager group (or a new "Custom Tags" group if none
  // exist yet) and referenced by name, same as every other tag mention.
  async function createTagEntity(name) {
    var mapService = window.MapLayoutService;
    if (!mapService || typeof mapService.getPreferences !== "function" || typeof mapService.savePreferences !== "function") {
      return null;
    }
    var prefs = await mapService.getPreferences();
    var tagGroups = (Array.isArray(prefs.tagGroups) ? prefs.tagGroups : []).map(function (group) {
      return Object.assign({}, group, { tags: Array.isArray(group.tags) ? group.tags.slice() : [] });
    });
    var newTag = { id: generateEntityId("tag"), name: name, color: "#d10d40", icon: "", description: "", visible: true };
    if (tagGroups.length) {
      tagGroups[0].tags.push(newTag);
    } else {
      tagGroups.push({ id: generateEntityId("tag-group"), name: "Custom Tags", tags: [newTag] });
    }
    prefs.tagGroups = tagGroups;
    await mapService.savePreferences(prefs);
    return { type: "tag", id: name, label: name };
  }

  // Timeline events are owned by a character record (there is no
  // freestanding "timeline event" store in this app), so creating one
  // needs an owning character chosen first -- see the "choose-owner"
  // dropdown mode below.
  async function createTimelineEventEntity(name, ownerId) {
    var svc = window.CharacterService;
    if (!svc || !ownerId || typeof svc.getAll !== "function" || typeof svc.save !== "function") {
      return null;
    }
    var all = await svc.getAll();
    var owner = all.find(function (c) { return c.id === ownerId; });
    if (!owner) {
      return null;
    }
    var eventId = generateEntityId("evt");
    var nextTimeline = (Array.isArray(owner.timeline) ? owner.timeline : []).concat([
      { id: eventId, title: name, date: "", description: "", tags: [] }
    ]);
    await svc.save(Object.assign({}, owner, { timeline: nextTimeline }));
    return { type: "timeline-event", id: eventId, ownerId: ownerId, label: name };
  }

  function createEntityByType(type, name, ownerId) {
    if (type === "character") {
      return createCharacterEntity(name);
    }
    if (type === "location") {
      return createLocationEntity(name);
    }
    if (type === "tag") {
      return createTagEntity(name);
    }
    if (type === "timeline-event") {
      return createTimelineEventEntity(name, ownerId);
    }
    return Promise.resolve(null);
  }

  async function fetchCharacterOwnerChoices() {
    var svc = window.CharacterService;
    if (!svc || typeof svc.getAll !== "function") {
      return [];
    }
    var all = await svc.getAll();
    return all
      .filter(function (character) { return character && character.id; })
      .map(function (character) { return { id: character.id, label: String(character.name || "Unnamed Character") }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label); });
  }

  // Builds the flat, keyboard-navigable item list a "search" mode dropdown
  // shows: real matches, plus -- only when nothing matched at all -- a
  // trailing "Create ..." prompt.
  function buildSearchItems(results, query, entityFilter) {
    var items = results.map(function (result) { return Object.assign({ kind: "candidate" }, result); });
    var trimmedQuery = String(query || "").trim();
    if (!results.length && trimmedQuery) {
      if (entityFilter) {
        // The trigger already implies the type (e.g. "#" -> Location), so
        // this create-prompt carries createType directly and skips the
        // generic "choose a type" step -- see activateItem.
        var typeLabel = ENTITY_LABELS[entityFilter] || entityFilter;
        items.push({ kind: "create-prompt", createType: entityFilter, label: "Create " + typeLabel + " \"" + trimmedQuery + "\"" });
      } else {
        items.push({ kind: "create-prompt", label: "Create \"" + trimmedQuery + "\"..." });
      }
    }
    return items;
  }

  function MentionRichTextEditor(props) {
    var settings = props && typeof props === "object" ? props : {};
    var shared = window.CampaignAtlasCharactersShared || {};
    var value = String(settings.value || "");
    var onChange = typeof settings.onChange === "function" ? settings.onChange : function () {};
    var editable = Boolean(settings.editable);
    var editorClassName = settings.editorClassName || "rich-editor profile-rich-editor character-rich-text mention-rich-editor";
    var viewerClassName = settings.viewerClassName || "profile-biography-content character-rich-text mention-rich-editor-viewer";
    var passthroughKeyUp = typeof settings.onEditorKeyUp === "function" ? settings.onEditorKeyUp : function () {};
    var passthroughKeyDown = typeof settings.onEditorKeyDown === "function" ? settings.onEditorKeyDown : function () {};
    var passthroughFocus = typeof settings.onEditorFocus === "function" ? settings.onEditorFocus : function () {};
    var onMentionNavigate = typeof settings.onMentionNavigate === "function" ? settings.onMentionNavigate : null;

    var wrapperRef = useRef(null);
    var internalEditorRef = useRef(null);
    var dropdownElRef = useRef(null);
    var searchSeqRef = useRef(0);
    var refreshTimerRef = useRef(null);
    var createdConfirmTimerRef = useRef(null);
    var nameInputIdRef = useRef(null);
    if (!nameInputIdRef.current) {
      nameInputIdRef.current = "mention-editor-name-" + Math.random().toString(36).slice(2, 9);
    }

    var _dropdown = useState(null);
    var dropdown = _dropdown[0];
    var setDropdown = _dropdown[1];

    function closeDropdown() {
      setDropdown(null);
    }

    function runSearch(query, entityFilter) {
      var seq = ++searchSeqRef.current;
      searchMentionCandidates(query, entityFilter).then(function (results) {
        if (seq !== searchSeqRef.current) {
          return;
        }
        setDropdown(function (prev) {
          if (!prev || prev.mode !== "search") {
            return prev;
          }
          return Object.assign({}, prev, { items: buildSearchItems(results, prev.query, prev.entityFilter), activeIndex: 0, loading: false });
        });
      });
    }

    function updateMentionTrigger(editorNode) {
      var detection = detectMentionTrigger(editorNode);
      if (!detection) {
        closeDropdown();
        return;
      }
      var selection = window.getSelection();
      var triggerAnchor = selection && selection.rangeCount
        ? { node: selection.anchorNode, offset: selection.anchorOffset }
        : null;
      var rect = caretClientRect(editorNode);
      setDropdown({
        mode: "search",
        trigger: detection.trigger,
        entityFilter: detection.entityFilter || null,
        query: detection.query,
        nameDraft: detection.query,
        items: [],
        activeIndex: 0,
        rect: rect,
        loading: true,
        triggerAnchor: triggerAnchor
      });
      runSearch(detection.query, detection.entityFilter || null);
    }

    // Single dispatcher for "an item in the dropdown was chosen," regardless
    // of which of the three modes (search / choose-type / choose-owner) it
    // came from -- keeps keyboard (Enter/Tab) and mouse selection, and the
    // Arrow-key navigation in moveActiveIndex, working identically across
    // all of them without mode-specific branches scattered around.
    function activateItem(item) {
      if (!item || !dropdown) {
        return;
      }
      var editorNode = internalEditorRef.current;

      if (item.kind === "candidate") {
        if (!editorNode) {
          return;
        }
        insertMentionAtTrigger(editorNode, item, dropdown.query, dropdown.triggerAnchor);
        closeDropdown();
        return;
      }

      if (item.kind === "create-prompt") {
        if (item.createType) {
          // The trigger already told us the type (e.g. "#" -> location) --
          // create it directly instead of asking the user to pick a type.
          finishCreate(function () { return createEntityByType(item.createType, dropdown.nameDraft); });
          return;
        }
        setDropdown(function (prev) {
          if (!prev) {
            return prev;
          }
          return Object.assign({}, prev, {
            mode: "choose-type",
            items: CREATABLE_TYPES.map(function (entry) {
              return { kind: "create-type", createType: entry.type, label: entry.label, icon: entry.icon };
            }),
            activeIndex: 0
          });
        });
        return;
      }

      if (item.kind === "create-type") {
        if (item.createType === "timeline-event") {
          setDropdown(function (prev) {
            return prev ? Object.assign({}, prev, { mode: "choose-owner", items: [], activeIndex: 0, loading: true }) : prev;
          });
          fetchCharacterOwnerChoices().then(function (choices) {
            setDropdown(function (prev) {
              if (!prev || prev.mode !== "choose-owner") {
                return prev;
              }
              return Object.assign({}, prev, {
                items: choices.map(function (choice) { return { kind: "owner-choice", id: choice.id, label: choice.label }; }),
                activeIndex: 0,
                loading: false
              });
            });
          });
          return;
        }

        finishCreate(function () { return createEntityByType(item.createType, dropdown.nameDraft); });
        return;
      }

      if (item.kind === "owner-choice") {
        finishCreate(function () { return createTimelineEventEntity(dropdown.nameDraft, item.id); });
      }
    }

    // Shared tail for every creation path: run the creator, insert the
    // result as a mention at the original trigger position (using the
    // triggerAnchor captured back when "@" was first typed, since the name
    // field the user may have just been editing moved focus away from the
    // note), then show a brief "Created ..." confirmation with a link to
    // open the new record's own full editor for anyone who wants to fill in
    // more than just a name without losing their place in the note.
    function finishCreate(runCreate) {
      var editorNode = internalEditorRef.current;
      var query = dropdown.query;
      var triggerAnchor = dropdown.triggerAnchor;
      var rect = dropdown.rect;
      setDropdown(function (prev) { return prev ? Object.assign({}, prev, { loading: true }) : prev; });
      runCreate().then(function (created) {
        if (!created) {
          closeDropdown();
          return;
        }
        if (editorNode) {
          insertMentionAtTrigger(editorNode, created, query, triggerAnchor);
        }
        showCreatedConfirmation(created, rect);
      });
    }

    function showCreatedConfirmation(created, rect) {
      setDropdown({
        mode: "created",
        items: [],
        activeIndex: 0,
        rect: rect,
        createdLabel: created.label,
        createdHref: navigationHrefFor(created.type, created.id, created.ownerId)
      });
      if (createdConfirmTimerRef.current) {
        window.clearTimeout(createdConfirmTimerRef.current);
      }
      createdConfirmTimerRef.current = window.setTimeout(function () {
        createdConfirmTimerRef.current = null;
        setDropdown(function (prev) { return prev && prev.mode === "created" ? null : prev; });
      }, 6000);
    }

    function handleKeyUp(event, editorNode) {
      passthroughKeyUp(event, editorNode);
      if (["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].indexOf(event.key) !== -1) {
        return;
      }
      // Once the user has drilled into "choose a type"/"choose an owner",
      // further typing in the editor shouldn't silently yank the dropdown
      // back to a fresh search underneath them -- but a "created" success
      // notice SHOULD be replaced/dismissed the moment they resume typing.
      if (dropdown && (dropdown.mode === "choose-type" || dropdown.mode === "choose-owner")) {
        return;
      }
      updateMentionTrigger(editorNode);
    }

    function handleKeyDown(event, editorNode) {
      if (dropdown) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setDropdown(function (prev) { return moveActiveIndex(prev, 1); });
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setDropdown(function (prev) { return moveActiveIndex(prev, -1); });
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (dropdown.items.length && !dropdown.loading) {
            event.preventDefault();
            activateItem(dropdown.items[dropdown.activeIndex]);
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeDropdown();
          return;
        }
      }
      passthroughKeyDown(event, editorNode);
    }

    function handleFocus(event) {
      passthroughFocus(event);
    }

    function handleWrapperClick(event) {
      var chip = event.target && event.target.closest ? event.target.closest(".mention-chip") : null;
      if (!chip || !wrapperRef.current || !wrapperRef.current.contains(chip)) {
        return;
      }
      var entityType = chip.getAttribute("data-entity-type");
      var entityId = chip.getAttribute("data-entity-id");
      var ownerId = chip.getAttribute("data-entity-owner-id");
      if (onMentionNavigate) {
        onMentionNavigate({ entityType: entityType, entityId: entityId, ownerId: ownerId });
        return;
      }
      var href = navigationHrefFor(entityType, entityId, ownerId);
      if (href) {
        window.location.href = href;
      }
    }

    // Close on outside click / Escape, matching the popover pattern used
    // elsewhere in the app (see character-directory-filters.js).
    useEffect(function () {
      if (!dropdown) {
        return;
      }
      function onPointerDown(event) {
        var ddEl = dropdownElRef.current;
        var editorNode = internalEditorRef.current;
        if ((ddEl && ddEl.contains(event.target)) || (editorNode && editorNode.contains(event.target))) {
          return;
        }
        closeDropdown();
      }
      document.addEventListener("pointerdown", onPointerDown);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
      };
    }, [dropdown]);

    useLayoutEffect(function () {
      if (!dropdown || !dropdown.rect || !dropdownElRef.current || !wrapperRef.current) {
        return;
      }
      var wrapperRect = wrapperRef.current.getBoundingClientRect();
      var ddEl = dropdownElRef.current;
      var margin = 8;
      var top = dropdown.rect.bottom - wrapperRect.top + 4;
      var left = dropdown.rect.left - wrapperRect.left;
      var maxLeft = wrapperRect.width - ddEl.offsetWidth - margin;
      if (left > maxLeft) {
        left = Math.max(margin, maxLeft);
      }
      if (left < margin) {
        left = margin;
      }
      var overflowsBottom = dropdown.rect.bottom + ddEl.offsetHeight + margin > window.innerHeight;
      if (overflowsBottom) {
        top = dropdown.rect.top - wrapperRect.top - ddEl.offsetHeight - 4;
      }
      ddEl.style.top = top + "px";
      ddEl.style.left = left + "px";
    }, [dropdown && dropdown.rect, dropdown && dropdown.items]);

    // Rename propagation: re-check labels on mount, whenever `value`
    // changes (typing, or switching to a different note), and whenever
    // Characters/Locations change anywhere in the app (cross-tab included).
    useEffect(function () {
      function scheduleRefresh() {
        if (refreshTimerRef.current) {
          return;
        }
        refreshTimerRef.current = window.setTimeout(function () {
          refreshTimerRef.current = null;
          refreshMentionLabels(internalEditorRef.current);
        }, 150);
      }

      scheduleRefresh();

      var channel = null;
      if (typeof window.BroadcastChannel === "function") {
        channel = new window.BroadcastChannel("campaign-atlas-characters");
        channel.onmessage = scheduleRefresh;
      }
      var unsubscribeLocations = typeof shared.subscribeLocationRecordChanges === "function"
        ? shared.subscribeLocationRecordChanges(scheduleRefresh)
        : null;

      return function () {
        if (channel) {
          channel.close();
        }
        if (typeof unsubscribeLocations === "function") {
          unsubscribeLocations();
        }
        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }, [value]);

    useEffect(function () {
      return function () {
        if (createdConfirmTimerRef.current) {
          window.clearTimeout(createdConfirmTimerRef.current);
        }
      };
    }, []);

    if (!shared.CharacterBiographyWorkspace) {
      return null;
    }

    return html`<div className="mention-editor-wrapper" ref=${wrapperRef} onClick=${handleWrapperClick}>
      <${shared.CharacterBiographyWorkspace}
        editable=${editable}
        value=${value}
        onChange=${onChange}
        editorClassName=${editorClassName}
        viewerClassName=${viewerClassName}
        editorRef=${internalEditorRef}
        onEditorFocus=${handleFocus}
        onEditorKeyUp=${handleKeyUp}
        onEditorKeyDown=${handleKeyDown}
      />
      ${dropdown ? html`<div className="mention-editor-dropdown" ref=${dropdownElRef} role=${dropdown.mode === "created" ? "status" : "listbox"} aria-label="Mention search results">
        ${dropdown.mode === "created" ? html`<div className="mention-editor-created-confirm">
          <span className="mention-editor-created-message">✓ Created "${dropdown.createdLabel}"</span>
          ${dropdown.createdHref ? html`<button type="button" className="mention-editor-created-open" onClick=${function () { window.location.href = dropdown.createdHref; }}>Open to edit →</button>` : null}
        </div>` : null}

        ${(dropdown.mode === "choose-type" || dropdown.mode === "choose-owner") ? html`<div className="mention-editor-dropdown-heading">
          <label htmlFor=${nameInputIdRef.current}>${dropdown.mode === "choose-type" ? "Create as..." : "Attach to which character?"}</label>
          <input
            id=${nameInputIdRef.current}
            type="text"
            className="mention-editor-name-input"
            value=${dropdown.nameDraft}
            autoFocus=${true}
            onInput=${function (event) {
              var nextValue = event.target.value;
              setDropdown(function (prev) { return prev ? Object.assign({}, prev, { nameDraft: nextValue }) : prev; });
            }}
            onKeyDown=${function (event) {
              if (event.key === "Escape") {
                event.preventDefault();
                closeDropdown();
              }
              event.stopPropagation();
            }}
          />
        </div>` : null}

        ${dropdown.mode !== "created" && dropdown.items.length
          ? dropdown.items.map(function (item, index) {
              var icon = item.kind === "candidate" ? (ENTITY_ICONS[item.type] || "")
                : item.kind === "create-prompt" ? "➕"
                : item.kind === "create-type" ? item.icon
                : ENTITY_ICONS.character;
              var typeLabel = item.kind === "candidate" ? (ENTITY_LABELS[item.type] || "") : "";
              var isCreateRow = item.kind === "create-prompt" || item.kind === "create-type";
              var nameRequired = (item.kind === "create-type" || item.kind === "owner-choice") && !String(dropdown.nameDraft || "").trim();
              return html`<button
                type="button"
                key=${item.kind + "-" + (item.id || item.createType || index) + "-" + index}
                className=${"mention-editor-option" + (index === dropdown.activeIndex ? " active" : "") + (isCreateRow ? " mention-editor-option-create" : "")}
                role="option"
                aria-selected=${index === dropdown.activeIndex}
                disabled=${Boolean(dropdown.loading) || nameRequired}
                onMouseDown=${function (event) { event.preventDefault(); }}
                onMouseEnter=${function () { setDropdown(function (prev) { return prev ? Object.assign({}, prev, { activeIndex: index }) : prev; }); }}
                onClick=${function () { activateItem(item); }}
              >
                <span className="mention-editor-option-icon" aria-hidden="true">${icon}</span>
                <span className="mention-editor-option-label">${item.label}</span>
                ${typeLabel ? html`<span className="mention-editor-option-type">${typeLabel}</span>` : null}
              </button>`;
            })
          : (dropdown.mode !== "created" ? html`<p className="hint mention-editor-empty">${
              dropdown.loading ? "Loading..." : (dropdown.mode === "choose-owner" ? "No characters exist yet." : "No matching entities.")
            }</p>` : null)}
      </div>` : null}
    </div>`;
  }

  window.MentionEditor = {
    MentionRichTextEditor: MentionRichTextEditor,
    searchMentionCandidates: searchMentionCandidates,
    navigationHrefFor: navigationHrefFor,
    createLocationEntity: createLocationEntity,
    ENTITY_ICONS: ENTITY_ICONS,
    ENTITY_LABELS: ENTITY_LABELS
  };
})();
