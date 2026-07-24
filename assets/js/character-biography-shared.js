(function () {
  var ReactRef = window.React;
  if (!ReactRef) {
    return;
  }

  var useEffect = ReactRef.useEffect;
  var useLayoutEffect = ReactRef.useLayoutEffect;
  var useRef = ReactRef.useRef;
  var useState = ReactRef.useState;
  var html = window.htm ? window.htm.bind(ReactRef.createElement) : null;

  var DB_NAME = "CampaignAtlas";
  var DB_VERSION = 1;
  var STORE_CHARACTERS = "characters";
  var STORE_RELATIONSHIPS = "relationships";
  var STORE_TIMELINE = "timeline";
  var PORTRAIT_BLOB_MARKER = "__campaignAtlasPortraitBlob__";
  var DEFAULT_PORTRAIT = "Default.png";
  var PORTRAIT_EDITOR_SIZE = 320;

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function toNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function imgPath(fileName) {
    return "../Relationship map/" + encodeURIComponent(fileName);
  }

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed.")); };
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== "string" || dataUrl.indexOf("data:") !== 0) {
      return null;
    }
    var parts = dataUrl.split(",");
    if (parts.length < 2) {
      return null;
    }
    var header = parts[0];
    var body = parts.slice(1).join(",");
    var mimeMatch = /data:([^;]+);base64/i.exec(header);
    try {
      var binary = window.atob(body);
      var length = binary.length;
      var bytes = new Uint8Array(length);
      for (var i = 0; i < length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeMatch ? mimeMatch[1] : "application/octet-stream" });
    } catch (_error) {
      return null;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      if (!(blob instanceof Blob)) {
        resolve("");
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Failed to read portrait blob."));
      };
      reader.readAsDataURL(blob);
    });
  }

  function serializeCharacterForStorage(character) {
    var record = clone(character) || {};
    var portraitValue = record.portrait;
    var portraitObject = portraitValue && typeof portraitValue === "object" ? clone(portraitValue) : null;
    var portraitImage = portraitObject ? portraitObject.image : (typeof portraitValue === "string" ? portraitValue : "");

    if (typeof portraitImage === "string" && portraitImage.indexOf("data:image/") === 0) {
      var blob = dataUrlToBlob(portraitImage);
      if (blob) {
        if (portraitObject) {
          portraitObject.image = PORTRAIT_BLOB_MARKER;
          record.portrait = portraitObject;
        } else {
          record.portrait = PORTRAIT_BLOB_MARKER;
        }
        record.__portraitBlob = blob;
      }
    }

    return record;
  }

  async function deserializeCharacterFromStorage(character) {
    var record = Object.assign({}, character || {});
    if (record.portrait && typeof record.portrait === "object") {
      record.portrait = Object.assign({}, record.portrait);
    }

    var blob = record.__portraitBlob;
    delete record.__portraitBlob;

    if (blob instanceof Blob) {
      var dataUrl = await blobToDataUrl(blob);
      if (record.portrait && typeof record.portrait === "object" && record.portrait.image === PORTRAIT_BLOB_MARKER) {
        record.portrait.image = dataUrl || DEFAULT_PORTRAIT;
      } else if (record.portrait === PORTRAIT_BLOB_MARKER) {
        record.portrait = dataUrl || DEFAULT_PORTRAIT;
      }
    } else if (record.portrait && typeof record.portrait === "object" && record.portrait.image === PORTRAIT_BLOB_MARKER) {
      record.portrait.image = DEFAULT_PORTRAIT;
    } else if (record.portrait === PORTRAIT_BLOB_MARKER) {
      record.portrait = DEFAULT_PORTRAIT;
    }

    return record;
  }

  function transactionToPromise(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(transaction.error || new Error("IndexedDB transaction failed.")); };
      transaction.onabort = function () { reject(transaction.error || new Error("IndexedDB transaction aborted.")); };
    });
  }

  function openCampaignAtlasDb() {
    return new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
          db.createObjectStore(STORE_CHARACTERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_RELATIONSHIPS)) {
          db.createObjectStore(STORE_RELATIONSHIPS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_TIMELINE)) {
          db.createObjectStore(STORE_TIMELINE, { keyPath: "id" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Unable to open CampaignAtlas IndexedDB.")); };
    });
  }

  function characterBiographyHtml(character) {
    if (!character) {
      return "";
    }
    if (character.bioHtml && String(character.bioHtml).trim()) {
      return String(character.bioHtml).replace(/<img(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
    }
    var plainText = String(character.bio || "").trim();
    if (!plainText) {
      return "<p>No biography added yet.</p>";
    }
    return ("<p>" + plainText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>") + "</p>").replace(/<img(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
  }

  function applyCharacterTimeline(characters, timelineEntries) {
    var byId = {};
    (timelineEntries || []).forEach(function (entry) {
      if (!entry || !entry.id) {
        return;
      }
      byId[entry.id] = clone(entry.events || []);
    });
    return (characters || []).map(function (character) {
      var nextCharacter = clone(character) || {};
      if (byId[nextCharacter.id] !== undefined) {
        nextCharacter.timeline = clone(byId[nextCharacter.id]);
      }
      return nextCharacter;
    });
  }

  async function readCampaignAtlasState() {
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_CHARACTERS, STORE_RELATIONSHIPS, STORE_TIMELINE], "readonly");
    var charactersReq = transaction.objectStore(STORE_CHARACTERS).getAll();
    var relationshipsReq = transaction.objectStore(STORE_RELATIONSHIPS).getAll();
    var timelineReq = transaction.objectStore(STORE_TIMELINE).getAll();

    var charactersPromise = requestToPromise(charactersReq);
    var relationshipsPromise = requestToPromise(relationshipsReq);
    var timelinePromise = requestToPromise(timelineReq);

    await transactionToPromise(transaction);

    var charactersRaw = await charactersPromise;
    var relationships = await relationshipsPromise;
    var timelineEntries = await timelinePromise;

    var characters = await Promise.all((charactersRaw || []).map(deserializeCharacterFromStorage));

    return {
      characters: applyCharacterTimeline(characters || [], timelineEntries || []),
      relationships: clone(relationships || [])
    };
  }

  async function saveCharacterToCampaignAtlas(character) {
    if (!character || !character.id) {
      return;
    }

    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_CHARACTERS, STORE_TIMELINE], "readwrite");
    var characterStore = transaction.objectStore(STORE_CHARACTERS);
    var timelineStore = transaction.objectStore(STORE_TIMELINE);

    var existingCharacterPromise = requestToPromise(characterStore.get(character.id));
    var existingTimelinePromise = requestToPromise(timelineStore.get(character.id));

    var existingCharacter = await existingCharacterPromise;
    var existingTimelineRecord = await existingTimelinePromise;

    var incoming = clone(character);
    var incomingHasPortrait = Object.prototype.hasOwnProperty.call(incoming, "portrait");
    var incomingHasLegacyPortraitSource = Object.prototype.hasOwnProperty.call(incoming, "portraitUploadSource");
    var incomingHasLegacyPortraitScale = Object.prototype.hasOwnProperty.call(incoming, "portraitScale");
    var incomingHasLegacyPortraitOffsetX = Object.prototype.hasOwnProperty.call(incoming, "portraitOffsetX");
    var incomingHasLegacyPortraitOffsetY = Object.prototype.hasOwnProperty.call(incoming, "portraitOffsetY");
    var incomingHasTimeline = Object.prototype.hasOwnProperty.call(incoming, "timeline");

    var mergedCharacter = Object.assign({}, clone(existingCharacter || {}), incoming);
    var nextCharacter = serializeCharacterForStorage(mergedCharacter);

    if (!incomingHasPortrait && existingCharacter && Object.prototype.hasOwnProperty.call(existingCharacter, "portrait")) {
      nextCharacter.portrait = clone(existingCharacter.portrait);
      if (Object.prototype.hasOwnProperty.call(existingCharacter, "__portraitBlob")) {
        nextCharacter.__portraitBlob = existingCharacter.__portraitBlob;
      }
    }
    if (!incomingHasLegacyPortraitSource && existingCharacter && Object.prototype.hasOwnProperty.call(existingCharacter, "portraitUploadSource")) {
      nextCharacter.portraitUploadSource = clone(existingCharacter.portraitUploadSource);
    }
    if (!incomingHasLegacyPortraitScale && existingCharacter && Object.prototype.hasOwnProperty.call(existingCharacter, "portraitScale")) {
      nextCharacter.portraitScale = clone(existingCharacter.portraitScale);
    }
    if (!incomingHasLegacyPortraitOffsetX && existingCharacter && Object.prototype.hasOwnProperty.call(existingCharacter, "portraitOffsetX")) {
      nextCharacter.portraitOffsetX = clone(existingCharacter.portraitOffsetX);
    }
    if (!incomingHasLegacyPortraitOffsetY && existingCharacter && Object.prototype.hasOwnProperty.call(existingCharacter, "portraitOffsetY")) {
      nextCharacter.portraitOffsetY = clone(existingCharacter.portraitOffsetY);
    }

    var timelineEvents = incomingHasTimeline
      ? clone(nextCharacter.timeline || [])
      : clone((existingTimelineRecord && existingTimelineRecord.events) || []);
    delete nextCharacter.timeline;

    characterStore.put(nextCharacter);
    timelineStore.put({ id: nextCharacter.id, events: timelineEvents });

    await transactionToPromise(transaction);
  }

  function createBiographyToolbarButton(options) {
    var props = options && typeof options === "object" ? options : {};
    return ReactRef.createElement(
      "button",
      {
        key: props.key,
        type: "button",
        className: "rich-toolbar-button " + (props.className || "") + (props.active ? " active" : ""),
        title: props.title,
        "aria-label": props.ariaLabel || props.title,
        "aria-pressed": props.active ? "true" : "false",
        onMouseDown: function (event) { event.preventDefault(); },
        onClick: props.onClick
      },
      props.label
    );
  }

  function CharacterBiographyWorkspace(props) {
    var settings = props && typeof props === "object" ? props : {};
    var editable = Boolean(settings.editable);
    var htmlValue = String(settings.value || "");
    var onChange = typeof settings.onChange === "function" ? settings.onChange : function () {};
    var editorClassName = settings.editorClassName || "rich-editor profile-rich-editor character-rich-text";
    var viewerClassName = settings.viewerClassName || "profile-biography-content character-rich-text";
    var externalEditorRef = settings.editorRef || null;
    var onEditorInput = typeof settings.onEditorInput === "function" ? settings.onEditorInput : function () {};
    var onEditorKeyUp = typeof settings.onEditorKeyUp === "function" ? settings.onEditorKeyUp : function () {};
    var onEditorKeyDown = typeof settings.onEditorKeyDown === "function" ? settings.onEditorKeyDown : function () {};
    var onEditorFocus = typeof settings.onEditorFocus === "function" ? settings.onEditorFocus : function () {};

    var editorRef = useRef(null);
    var lastSyncedRef = useRef(null);
    var _toolbarState = useState({});
    var toolbarState = _toolbarState[0];
    var setToolbarState = _toolbarState[1];

    useLayoutEffect(function () {
      if (!editable) {
        lastSyncedRef.current = null;
        return;
      }
      var editor = editorRef.current;
      var current = lastSyncedRef.current;
      if (!editor || (current && current.html === htmlValue)) {
        return;
      }
      if (editor.innerHTML !== htmlValue) {
        editor.innerHTML = htmlValue;
      }
      lastSyncedRef.current = { html: htmlValue };
    }, [editable, htmlValue]);

    useEffect(function () {
      if (!editable) {
        setToolbarState({});
      }
    }, [editable]);

    function selectionElement() {
      var editor = editorRef.current;
      var selection = window.getSelection();
      if (!editor || !selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
        return null;
      }
      return selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement;
    }

    function ancestorTag(tagName) {
      var editor = editorRef.current;
      var node = selectionElement();
      var expected = String(tagName).toUpperCase();
      while (node && node !== editor) {
        if (node.tagName === expected) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    function refreshToolbarState() {
      var editor = editorRef.current;
      if (!editor || document.activeElement !== editor) {
        return;
      }
      setToolbarState({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        h1: Boolean(ancestorTag("h1")),
        h2: Boolean(ancestorTag("h2")),
        bulletList: document.queryCommandState("insertUnorderedList"),
        numberedList: document.queryCommandState("insertOrderedList"),
        alignLeft: document.queryCommandState("justifyLeft"),
        alignCenter: document.queryCommandState("justifyCenter"),
        alignRight: document.queryCommandState("justifyRight"),
        callout: Boolean(ancestorTag("blockquote"))
      });
    }

    function syncEditorToChange() {
      var editor = editorRef.current;
      if (!editor) {
        return;
      }
      var nextHtml = editor.innerHTML;
      lastSyncedRef.current = { html: nextHtml };
      onChange(nextHtml);
      onEditorInput(nextHtml, editor);
    }

    function runCommand(command, value) {
      var editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.focus();
      document.execCommand(command, false, value);
      syncEditorToChange();
      refreshToolbarState();
    }

    function toggleHeading(tagName) {
      runCommand("formatBlock", ancestorTag(tagName) ? "<p>" : "<" + tagName + ">");
    }

    function insertSpoiler() {
      var editor = editorRef.current;
      var selection = window.getSelection();
      if (!editor || !selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
        return;
      }
      var range = selection.getRangeAt(0);
      var spoiler = document.createElement("details");
      spoiler.className = "bio-spoiler";
      var summary = document.createElement("summary");
      summary.textContent = "Spoiler";
      var content = document.createElement("div");
      content.className = "bio-spoiler-content";
      if (range.collapsed) {
        content.appendChild(document.createElement("br"));
      } else {
        content.appendChild(range.extractContents());
      }
      spoiler.appendChild(summary);
      spoiler.appendChild(content);
      range.insertNode(spoiler);
      range.setStartAfter(spoiler);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      syncEditorToChange();
      refreshToolbarState();
    }

    function insertImage() {
      var url = window.prompt("Image URL");
      if (!url) {
        return;
      }
      runCommand("insertImage", url);
    }

    function insertHtml(htmlString) {
      var editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.focus();
      document.execCommand("insertHTML", false, htmlString);
      syncEditorToChange();
      refreshToolbarState();
    }

    function insertTable() {
      insertHtml('<table><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table>');
    }

    function insertChecklist() {
      insertHtml('<ul class="bio-checklist"><li>Checklist item</li><li>Checklist item</li></ul>');
    }

    if (!editable) {
      return ReactRef.createElement("div", {
        className: viewerClassName,
        dangerouslySetInnerHTML: { __html: characterBiographyHtml({ bioHtml: htmlValue }) }
      });
    }

    return ReactRef.createElement(
      "div",
      { className: "profile-biography-editor" },
      ReactRef.createElement(
        "div",
        { className: "rich-toolbar", role: "toolbar", "aria-label": "Biography formatting" },
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "bold", className: "toolbar-icon-bold", title: "Bold", label: "B", active: toolbarState.bold, onClick: function () { runCommand("bold"); } }),
          createBiographyToolbarButton({ key: "italic", className: "toolbar-icon-italic", title: "Italic", label: "I", active: toolbarState.italic, onClick: function () { runCommand("italic"); } }),
          createBiographyToolbarButton({ key: "underline", className: "toolbar-icon-underline", title: "Underline", label: "U", active: toolbarState.underline, onClick: function () { runCommand("underline"); } })
        ),
        ReactRef.createElement("div", { className: "rich-toolbar-divider", "aria-hidden": "true" }),
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "heading-1", className: "toolbar-icon-heading", title: "Heading 1", label: "H1", active: toolbarState.h1, onClick: function () { toggleHeading("h1"); } }),
          createBiographyToolbarButton({ key: "heading-2", className: "toolbar-icon-heading", title: "Heading 2", label: "H2", active: toolbarState.h2, onClick: function () { toggleHeading("h2"); } })
        ),
        ReactRef.createElement("div", { className: "rich-toolbar-divider", "aria-hidden": "true" }),
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "list-bullet", className: "toolbar-icon-list", title: "Bullet list", label: "•≡", active: toolbarState.bulletList, onClick: function () { runCommand("insertUnorderedList"); } }),
          createBiographyToolbarButton({ key: "list-numbered", className: "toolbar-icon-list", title: "Numbered list", label: "1≡", active: toolbarState.numberedList, onClick: function () { runCommand("insertOrderedList"); } })
        ),
        ReactRef.createElement("div", { className: "rich-toolbar-divider", "aria-hidden": "true" }),
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "align-left", className: "toolbar-icon-align-left", title: "Align left", label: "≡", active: toolbarState.alignLeft, onClick: function () { runCommand("justifyLeft"); } }),
          createBiographyToolbarButton({ key: "align-center", className: "toolbar-icon-align-center", title: "Align centre", label: "≡", active: toolbarState.alignCenter, onClick: function () { runCommand("justifyCenter"); } }),
          createBiographyToolbarButton({ key: "align-right", className: "toolbar-icon-align-right", title: "Align right", label: "≡", active: toolbarState.alignRight, onClick: function () { runCommand("justifyRight"); } })
        ),
        ReactRef.createElement("div", { className: "rich-toolbar-divider", "aria-hidden": "true" }),
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "callout", className: "toolbar-icon-callout", title: "Callout block", label: "❝", active: toolbarState.callout, onClick: function () { runCommand("formatBlock", "<blockquote>"); } }),
          createBiographyToolbarButton({ key: "rule", className: "toolbar-icon-rule", title: "Horizontal rule", label: "―", active: false, onClick: function () { runCommand("insertHorizontalRule"); } })
        ),
        ReactRef.createElement("div", { className: "rich-toolbar-divider", "aria-hidden": "true" }),
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "spoiler", className: "toolbar-icon-spoiler", title: "Insert spoiler block", label: "◐", active: false, onClick: insertSpoiler }),
          createBiographyToolbarButton({ key: "image", className: "toolbar-icon-image", title: "Insert image", label: "🖼", active: false, onClick: insertImage }),
          createBiographyToolbarButton({ key: "table", className: "toolbar-icon-table", title: "Insert table", label: "▦", active: false, onClick: insertTable }),
          createBiographyToolbarButton({ key: "checklist", className: "toolbar-icon-checklist", title: "Insert checklist", label: "☑", active: false, onClick: insertChecklist })
        )
      ),
      ReactRef.createElement("div", {
        ref: function (node) {
          editorRef.current = node;
          if (externalEditorRef) {
            externalEditorRef.current = node;
          }
        },
        className: editorClassName,
        contentEditable: "true",
        suppressContentEditableWarning: "true",
        onFocus: function (event) {
          refreshToolbarState();
          onEditorFocus(event);
        },
        onKeyUp: function (event) {
          refreshToolbarState();
          onEditorKeyUp(event, editorRef.current);
        },
        onKeyDown: function (event) {
          onEditorKeyDown(event, editorRef.current);
        },
        onMouseUp: refreshToolbarState,
        onInput: syncEditorToChange
      })
    );
  }

  function normalizeIsoDate(value) {
    if (value === null || value === undefined) {
      return "";
    }
    var text = String(value).trim();
    if (!text) {
      return "";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    var parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString().slice(0, 10);
  }

  function formatDisplayDate(value) {
    var iso = normalizeIsoDate(value);
    if (!iso) {
      return value || "";
    }
    var parsed = new Date(iso + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      return iso;
    }
    return parsed.toLocaleDateString();
  }

  function normalizeTimelineEvent(event) {
    var input = event && typeof event === "object" ? event : {};
    return {
      date: normalizeIsoDate(input.date),
      title: String(input.title || ""),
      description: String(input.description || ""),
      gmNotes: String(input.gmNotes || "")
    };
  }

  function timelineEventsFromAny(rawTimeline) {
    if (Array.isArray(rawTimeline)) {
      return rawTimeline.map(normalizeTimelineEvent);
    }
    if (typeof rawTimeline === "string") {
      return rawTimeline
        .split(/\r?\n/)
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; })
        .map(function (line) {
          return normalizeTimelineEvent({ date: "", title: line, description: "" });
        });
    }
    return [];
  }

  function sortTimelineEvents(events) {
    var mapped = (events || []).map(normalizeTimelineEvent).map(function (event, index) {
      return {
        event: event,
        index: index,
        hasDate: Boolean(event.date),
        dateValue: event.date ? Date.parse(event.date + "T00:00:00") : Number.POSITIVE_INFINITY
      };
    });

    mapped.sort(function (a, b) {
      if (a.hasDate && b.hasDate) {
        if (a.dateValue !== b.dateValue) {
          return a.dateValue - b.dateValue;
        }
        return a.index - b.index;
      }
      if (a.hasDate && !b.hasDate) {
        return -1;
      }
      if (!a.hasDate && b.hasDate) {
        return 1;
      }
      return a.index - b.index;
    });

    return mapped.map(function (entry) { return entry.event; });
  }

  function timelineEventsForDisplay(events, dateOfBirth, dateOfDeath) {
    var merged = (events || []).map(function (event, sourceIndex) {
      var normalized = normalizeTimelineEvent(event);
      return {
        sourceIndex: sourceIndex,
        event: normalized,
        isSystem: false,
        sequence: sourceIndex,
        sortPriority: 1,
        hasDate: Boolean(normalized.date),
        dateValue: normalized.date ? Date.parse(normalized.date + "T00:00:00") : Number.POSITIVE_INFINITY
      };
    });

    var manualTitles = merged.reduce(function (titles, entry) {
      var title = entry.event.title.trim().toLowerCase();
      if (title) {
        titles[title] = true;
      }
      return titles;
    }, {});

    [
      { id: "birth", title: "Birth", date: normalizeIsoDate(dateOfBirth) },
      { id: "death", title: "Death", date: normalizeIsoDate(dateOfDeath) }
    ].forEach(function (systemEvent, systemIndex) {
      if (!systemEvent.date || manualTitles[systemEvent.title.toLowerCase()]) {
        return;
      }
      merged.push({
        sourceIndex: "system-" + systemEvent.id,
        event: { date: systemEvent.date, title: systemEvent.title, description: "", gmNotes: "" },
        isSystem: true,
        sequence: (events || []).length + systemIndex,
        sortPriority: systemEvent.id === "birth" ? 0 : 2,
        hasDate: true,
        dateValue: Date.parse(systemEvent.date + "T00:00:00")
      });
    });

    return merged.sort(function (a, b) {
      if (a.hasDate && b.hasDate) {
        if (a.dateValue !== b.dateValue) {
          return a.dateValue - b.dateValue;
        }
        if (a.sortPriority !== b.sortPriority) {
          return a.sortPriority - b.sortPriority;
        }
        return a.sequence - b.sequence;
      }
      if (a.hasDate && !b.hasDate) {
        return -1;
      }
      if (!a.hasDate && b.hasDate) {
        return 1;
      }
      return a.sequence - b.sequence;
    });
  }

  function timelineEventLabel(event) {
    var normalized = normalizeTimelineEvent(event);
    var title = normalized.title.trim() || "Untitled Event";
    var year = normalized.date ? normalized.date.slice(0, 4) : "";
    return year ? "(" + year + ") " + title : title;
  }

  function parseDossierEntries(rawText) {
    var text = String(rawText || "").replace(/\r\n?/g, "\n").trim();
    if (!text) {
      return [];
    }

    var lines = text.split("\n");
    var hasLegacyBullets = lines.some(function (line) { return /^\s*-\s+/.test(line); });

    if (hasLegacyBullets) {
      var entries = [];
      var current = [];

      lines.forEach(function (line) {
        var isLegacyStart = /^\s*-\s*/.test(line);
        if (isLegacyStart) {
          if (current.length) {
            var completed = current.join("\n").trim();
            if (completed) {
              entries.push(completed);
            }
          }
          current = [line.replace(/^\s*-\s*/, "").trim()];
          return;
        }

        if (!line.trim()) {
          return;
        }

        if (!current.length) {
          current = [line.trim()];
          return;
        }

        current.push(line.trimEnd());
      });

      if (current.length) {
        var finalLegacy = current.join("\n").trim();
        if (finalLegacy) {
          entries.push(finalLegacy);
        }
      }

      return entries;
    }

    if (/\n\s*\n/.test(text)) {
      return text
        .split(/\n\s*\n+/)
        .map(function (chunk) {
          return chunk
            .split("\n")
            .map(function (line) { return line.trimEnd(); })
            .join("\n")
            .trim();
        })
        .filter(function (entry) { return entry.length > 0; });
    }

    return lines.map(function (line) { return line.trim(); }).filter(function (line) { return line.length > 0; });
  }

  function dossierEntryGroup(options) {
    var opts = options && typeof options === "object" ? options : {};
    var rootKey = opts.key;
    var title = opts.title || "";
    var entryText = opts.entryText || "";
    var accentColor = opts.accentColor || "var(--accent-red)";
    var emptyText = opts.emptyText || "Not set";
    var entries = parseDossierEntries(entryText);

    return html`<article className="profile-info-card dossier-field-card" key=${rootKey}>
      ${title ? html`<h4>${title}</h4>` : null}
      ${entries.length
        ? html`<div className="dossier-entry-list">
          ${entries.map(function (entry, index) {
            return html`<div className="dossier-entry" style=${{ "--dossier-accent-color": accentColor }} key=${"dossier-entry-" + title + "-" + index}>
              <p>${entry}</p>
            </div>`;
          })}
        </div>`
        : html`<p>${emptyText}</p>`}
    </article>`;
  }

  function parseNoteBlocksFromText(text) {
    var raw = String(text || "").replace(/\r/g, "").trim();
    if (!raw) {
      return [];
    }
    return raw
      .split(/\n\s*\n+/)
      .map(function (block) { return block.trim(); })
      .filter(function (block) { return block.length > 0; })
      .map(function (block, index) {
        var lines = block.split(/\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        var title = lines[0] || ("Note " + (index + 1));
        var preview = lines.slice(1).join(" ").trim() || title;
        var tags = [];
        preview.replace(/#([a-zA-Z0-9_-]+)/g, function (_, tag) {
          if (tags.indexOf(tag) < 0) {
            tags.push(tag);
          }
          return _;
        });
        return {
          id: "story-note-" + index,
          title: title,
          preview: preview,
          tags: tags,
          updatedAt: "",
          source: "gm-notes",
          focusText: title
        };
      });
  }

  function htmlToReadableText(htmlInput) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(htmlInput || ""), "text/html");
    doc.querySelectorAll("script, style, noscript").forEach(function (el) { el.remove(); });
    var root = doc.querySelector(".doc-content, .kix-page-content-wrapper, .kix-page, main, article, body") || doc.body;
    var blocks = root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
    var lines = [];
    blocks.forEach(function (block) {
      var line = (block.textContent || "").replace(/\s+/g, " ").trim();
      if (line) {
        lines.push(line);
      }
    });
    return lines.join("\n\n");
  }

  async function readGmNotesEntries() {
    var notebook = window.ChronicleNotebook;
    if (notebook && typeof notebook.readNotebookState === "function") {
      var state = await notebook.readNotebookState();
      return (state.notes || [])
        .filter(function (note) {
          return !note.archived;
        })
        .map(function (note) {
          return {
            id: note.id,
            title: note.title || "Untitled Note",
            preview: notebook.notePreview(note),
            tags: Array.isArray(note.tags) ? note.tags.slice() : [],
            updatedAt: note.updatedAt || note.createdAt || "",
            source: "notebook",
            focusText: note.title || "",
            noteId: note.id,
            folderId: note.folderId,
            sessionLabel: note.sessionLabel || "",
            characterIds: Array.isArray(note.characterIds) ? note.characterIds.slice() : [],
            locationIds: Array.isArray(note.locationIds) ? note.locationIds.slice() : [],
            bodyHtml: note.bodyHtml || ""
          };
        });
    }

    var draftText = "";
    var updatedAt = "";
    try {
      draftText = String(localStorage.getItem("gmDashboard.scratchDraft") || "");
      updatedAt = String(localStorage.getItem("gmDashboard.scratchDraftUpdated") || "");
    } catch (_error) {
      draftText = "";
    }

    var entries = parseNoteBlocksFromText(draftText).map(function (entry, index) {
      var next = Object.assign({}, entry);
      next.id = "scratch-note-" + index;
      next.source = "scratchpad";
      next.updatedAt = updatedAt;
      return next;
    });

    try {
      var response = await fetch("/integrations/gdocs-content", { cache: "no-store" });
      if (!response.ok) {
        response = await fetch("/integrations/gdocs", { cache: "no-store" });
      }
      if (response.ok) {
        var htmlPayload = await response.text();
        var publishedText = htmlToReadableText(htmlPayload);
        parseNoteBlocksFromText(publishedText).forEach(function (entry, index) {
          entries.push(Object.assign({}, entry, { id: "published-note-" + index, source: "published" }));
        });
      }
    } catch (_fetchError) {
      return entries;
    }
    return entries;
  }

  function storyNoteMatchesCharacter(note, character) {
    if (!note || !character) {
      return false;
    }
    if (Array.isArray(note.characterIds) && note.characterIds.some(function (id) { return String(id) === String(character.id); })) {
      return true;
    }
    var text = (String(note.title || "") + " " + String(note.preview || "")).toLowerCase();
    var keys = [];
    if (character.name) {
      keys.push(String(character.name).toLowerCase());
    }
    if (character.id) {
      keys.push(String(character.id).toLowerCase());
    }
    if (character.clan && String(character.clan).toLowerCase() !== "none") {
      keys.push(String(character.clan).toLowerCase());
    }
    if (character.sect && String(character.sect).toLowerCase() !== "none") {
      keys.push(String(character.sect).toLowerCase());
    }
    (Array.isArray(character.tags) ? character.tags : []).forEach(function (tag) {
      keys.push(String(tag || "").toLowerCase());
    });
    return keys.some(function (key) {
      return key && text.indexOf(key) >= 0;
    });
  }

  function normalizeCharacterForProfile(character) {
    var source = character && typeof character === "object" ? clone(character) : {};
    source.timeline = sortTimelineEvents(timelineEventsFromAny(source.timeline));
    source.storytellerNotes = source.storytellerNotes !== undefined
      ? String(source.storytellerNotes || "")
      : String(source.gmNotes || "");
    source.gmOnlyInformation = source.gmOnlyInformation !== undefined
      ? String(source.gmOnlyInformation || "")
      : String(source.gmNotes || "");
    source.dateOfBirth = normalizeIsoDate(source.dateOfBirth);
    source.dateOfDeath = normalizeIsoDate(source.dateOfDeath);
    source.tags = Array.isArray(source.tags) ? source.tags.slice() : [];
    source.bioHtml = characterBiographyHtml(source);
    return source;
  }

  function renderPortraitSource(portrait) {
    if (!portrait) {
      return imgPath(DEFAULT_PORTRAIT);
    }
    if (/^(https?:|data:|blob:)/i.test(portrait)) {
      return portrait;
    }
    return imgPath(portrait);
  }

  function portraitDimensions(record, portraitObject) {
    return {
      width: Math.max(1, toNumber(portraitObject && portraitObject.imageWidth, 1)),
      height: Math.max(1, toNumber(portraitObject && portraitObject.imageHeight, 1))
    };
  }

  function portraitScaleFactors(imageWidth, imageHeight) {
    var width = Math.max(1, toNumber(imageWidth, 1));
    var height = Math.max(1, toNumber(imageHeight, 1));
    if (width >= height) {
      return {
        width: width / height,
        height: 1
      };
    }
    return {
      width: 1,
      height: height / width
    };
  }

  function normalizeLegacyOffset(rawOffset) {
    var value = toNumber(rawOffset, 0);
    if (Math.abs(value) > 3) {
      return value / PORTRAIT_EDITOR_SIZE;
    }
    return value;
  }

  function clampCropCenter(cropCenterX, cropCenterY, zoom, imageWidth, imageHeight) {
    var factors = portraitScaleFactors(imageWidth, imageHeight);
    var safeZoom = Math.max(1, toNumber(zoom, 1));
    var minX = 0.5 / (factors.width * safeZoom);
    var minY = 0.5 / (factors.height * safeZoom);
    return {
      x: clamp(toNumber(cropCenterX, 0.5), minX, 1 - minX),
      y: clamp(toNumber(cropCenterY, 0.5), minY, 1 - minY)
    };
  }

  function canonicalPortraitFromRecord(record) {
    var sourceRecord = record && typeof record === "object" ? record : {};
    var portraitObject = (sourceRecord.portrait && typeof sourceRecord.portrait === "object") ? sourceRecord.portrait : null;

    var source = DEFAULT_PORTRAIT;
    if (portraitObject && portraitObject.image) {
      source = portraitObject.image;
    } else if (portraitObject && portraitObject.source) {
      source = portraitObject.source;
    } else if (typeof sourceRecord.portrait === "string" && sourceRecord.portrait) {
      source = sourceRecord.portrait;
    } else if (sourceRecord.portraitUploadSource) {
      source = sourceRecord.portraitUploadSource;
    }

    var zoom = 1;
    if (portraitObject && portraitObject.zoom !== undefined) {
      zoom = toNumber(portraitObject.zoom, 1);
    } else if (portraitObject && portraitObject.scale !== undefined) {
      zoom = toNumber(portraitObject.scale, 1);
    } else if (sourceRecord.portraitScale !== undefined) {
      zoom = toNumber(sourceRecord.portraitScale, 1);
    }
    zoom = Math.max(1, zoom);

    var dimensions = portraitDimensions(sourceRecord, portraitObject);
    var cropCenterX = 0.5;
    var cropCenterY = 0.5;

    if (portraitObject && portraitObject.cropCenterX !== undefined && portraitObject.cropCenterY !== undefined) {
      cropCenterX = toNumber(portraitObject.cropCenterX, 0.5);
      cropCenterY = toNumber(portraitObject.cropCenterY, 0.5);
    } else if (portraitObject && portraitObject.cropX !== undefined && portraitObject.cropY !== undefined) {
      cropCenterX = toNumber(portraitObject.cropX, 0.5);
      cropCenterY = toNumber(portraitObject.cropY, 0.5);
    } else if (sourceRecord.portraitOffsetX !== undefined || sourceRecord.portraitOffsetY !== undefined) {
      var legacyOffsetX = normalizeLegacyOffset(sourceRecord.portraitOffsetX);
      var legacyOffsetY = normalizeLegacyOffset(sourceRecord.portraitOffsetY);
      var factors = portraitScaleFactors(dimensions.width, dimensions.height);
      cropCenterX = 0.5 - (legacyOffsetX / (factors.width * zoom));
      cropCenterY = 0.5 - (legacyOffsetY / (factors.height * zoom));
    }

    var clamped = clampCropCenter(cropCenterX, cropCenterY, zoom, dimensions.width, dimensions.height);
    return {
      image: source,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
      cropCenterX: clamped.x,
      cropCenterY: clamped.y,
      zoom: zoom,
      cropX: clamped.x,
      cropY: clamped.y
    };
  }

  function portraitRenderModel(config) {
    var imageWidth = Math.max(1, toNumber(config.imageWidth, 1));
    var imageHeight = Math.max(1, toNumber(config.imageHeight, 1));
    var zoom = Math.max(1, toNumber(config.zoom, 1));
    var factors = portraitScaleFactors(imageWidth, imageHeight);
    var center = clampCropCenter(config.cropCenterX, config.cropCenterY, zoom, imageWidth, imageHeight);
    return {
      widthScale: factors.width * zoom,
      heightScale: factors.height * zoom,
      cropCenterX: center.x,
      cropCenterY: center.y,
      zoom: zoom,
      imageWidth: imageWidth,
      imageHeight: imageHeight
    };
  }

  function portraitState(record) {
    if (!record) {
      return {
        source: DEFAULT_PORTRAIT,
        src: imgPath(DEFAULT_PORTRAIT),
        imageWidth: 1,
        imageHeight: 1,
        zoom: 1,
        cropCenterX: 0.5,
        cropCenterY: 0.5
      };
    }
    var canonicalPortrait = canonicalPortraitFromRecord(record);
    return {
      source: canonicalPortrait.image,
      src: renderPortraitSource(canonicalPortrait.image),
      imageWidth: canonicalPortrait.imageWidth,
      imageHeight: canonicalPortrait.imageHeight,
      zoom: canonicalPortrait.zoom,
      cropCenterX: canonicalPortrait.cropCenterX,
      cropCenterY: canonicalPortrait.cropCenterY
    };
  }

  function portraitMediaStyle(record) {
    var state = portraitState(record);
    var model = portraitRenderModel({
      imageWidth: state.imageWidth,
      imageHeight: state.imageHeight,
      cropCenterX: state.cropCenterX,
      cropCenterY: state.cropCenterY,
      zoom: state.zoom
    });
    var widthPercent = model.widthScale * 100;
    var heightPercent = model.heightScale * 100;
    var leftPercent = (0.5 - (model.cropCenterX * model.widthScale)) * 100;
    var topPercent = (0.5 - (model.cropCenterY * model.heightScale)) * 100;
    return {
      width: widthPercent + "%",
      height: heightPercent + "%",
      left: leftPercent + "%",
      top: topPercent + "%",
      transform: "none"
    };
  }

  function CharacterProfilePortrait(props) {
    var settings = props && typeof props === "object" ? props : {};
    var record = settings.record || null;
    var className = "profile-portrait-shell" + (settings.editable ? " editable" : "") + (settings.className ? " " + settings.className : "");
    var state = portraitState(record);
    var label = (record && record.name ? String(record.name) : "Unnamed Character") + " portrait";

    return html`<div className=${className} onClick=${settings.onClick}>
      <img
        className="profile-portrait-image"
        src=${state.src}
        alt=${label}
        style=${portraitMediaStyle(record)}
        onError=${function (event) { event.currentTarget.src = imgPath(DEFAULT_PORTRAIT); }}
      />
      ${settings.editable ? html`<div className="profile-portrait-overlay"><span>Change Portrait</span><span>Upload Image</span></div>` : null}
    </div>`;
  }

  function CharacterProfileWorkspace(props) {
    if (!html) {
      return null;
    }
    var settings = props && typeof props === "object" ? props : {};
    var character = settings.character || null;
    var characters = Array.isArray(settings.characters) ? settings.characters : [];
    var relationships = Array.isArray(settings.relationships) ? settings.relationships : [];
    var onSave = typeof settings.onSave === "function" ? settings.onSave : function () {};
    var onRequestClose = typeof settings.onRequestClose === "function" ? settings.onRequestClose : null;
    var editable = settings.editable !== false;

    var _editMode = useState(Boolean(settings.startInEdit));
    var editMode = _editMode[0];
    var setEditMode = _editMode[1];

    var _activeTab = useState("biography");
    var activeTab = _activeTab[0];
    var setActiveTab = _activeTab[1];

    var _draft = useState(character ? normalizeCharacterForProfile(character) : null);
    var draft = _draft[0];
    var setDraft = _draft[1];

    var _expandedTimelineKey = useState(null);
    var expandedTimelineKey = _expandedTimelineKey[0];
    var setExpandedTimelineKey = _expandedTimelineKey[1];

    var _storyNotes = useState([]);
    var storyNotes = _storyNotes[0];
    var setStoryNotes = _storyNotes[1];

    var _storyNotesLoading = useState(false);
    var storyNotesLoading = _storyNotesLoading[0];
    var setStoryNotesLoading = _storyNotesLoading[1];

    useEffect(function () {
      setDraft(character ? normalizeCharacterForProfile(character) : null);
      setEditMode(Boolean(settings.startInEdit));
      setActiveTab("biography");
      setExpandedTimelineKey(null);
    }, [character && character.id]);

    useEffect(function () {
      var cancelled = false;
      if (!character) {
        setStoryNotes([]);
        return function () { cancelled = true; };
      }
      setStoryNotesLoading(true);
      readGmNotesEntries()
        .then(function (entries) {
          if (cancelled) {
            return;
          }
          setStoryNotes((entries || []).filter(function (entry) {
            return storyNoteMatchesCharacter(entry, character);
          }));
        })
        .catch(function () {
          if (!cancelled) {
            setStoryNotes([]);
          }
        })
        .finally(function () {
          if (!cancelled) {
            setStoryNotesLoading(false);
          }
        });
      return function () { cancelled = true; };
    }, [character && character.id, character && character.name, character && character.clan, character && character.sect, JSON.stringify(character && character.tags ? character.tags : [])]);

    function openStoryNote(note) {
      if (typeof settings.onOpenStoryNote === "function") {
        settings.onOpenStoryNote(note);
        return;
      }
      var focus = encodeURIComponent(String((note && note.focusText) || (note && note.title) || ""));
      window.location.href = "gm-notes.html?focus=" + focus;
    }

    function updateDraftField(field, value) {
      setDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var next = clone(prev);
        next[field] = value;
        return next;
      });
    }

    function updateTimelineEvent(index, field, value) {
      setDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var events = (prev.timeline || []).slice();
        if (index < 0 || index >= events.length) {
          return prev;
        }
        var updated = normalizeTimelineEvent(events[index]);
        updated[field] = field === "date" ? normalizeIsoDate(value) : String(value || "");
        events[index] = updated;
        var next = clone(prev);
        next.timeline = events;
        return next;
      });
    }

    function addTimelineEvent() {
      setDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var next = clone(prev);
        next.timeline = (next.timeline || []).slice();
        next.timeline.push({ date: "", title: "", description: "", gmNotes: "" });
        return next;
      });
    }

    function removeTimelineEvent(index) {
      setDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var next = clone(prev);
        next.timeline = (next.timeline || []).slice();
        if (index >= 0 && index < next.timeline.length) {
          next.timeline.splice(index, 1);
        }
        return next;
      });
      setExpandedTimelineKey(null);
    }

    function commitSave() {
      if (!draft) {
        return;
      }
      var next = clone(character || {});
      var edited = normalizeCharacterForProfile(draft);
      Object.keys(edited).forEach(function (key) {
        next[key] = edited[key];
      });

      // Characters page does not own portrait editing by default.
      if (!settings.allowPortraitEdit) {
        if (character && Object.prototype.hasOwnProperty.call(character, "portrait")) {
          next.portrait = clone(character.portrait);
        } else {
          delete next.portrait;
        }
        if (character && Object.prototype.hasOwnProperty.call(character, "portraitUploadSource")) {
          next.portraitUploadSource = clone(character.portraitUploadSource);
        }
        if (character && Object.prototype.hasOwnProperty.call(character, "portraitScale")) {
          next.portraitScale = clone(character.portraitScale);
        }
        if (character && Object.prototype.hasOwnProperty.call(character, "portraitOffsetX")) {
          next.portraitOffsetX = clone(character.portraitOffsetX);
        }
        if (character && Object.prototype.hasOwnProperty.call(character, "portraitOffsetY")) {
          next.portraitOffsetY = clone(character.portraitOffsetY);
        }
      }

      next.name = String(next.name || "").trim() || "Unnamed Character";
      next.timeline = sortTimelineEvents(timelineEventsFromAny(next.timeline));
      next.storytellerNotes = String(next.storytellerNotes || "");
      next.gmOnlyInformation = String(next.gmOnlyInformation || "");
      next.gmNotes = String(next.storytellerNotes || "");
      next.bioHtml = String(next.bioHtml || "");
      next.bio = String(next.bioHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      next.tags = String(next.tagsText || next.tags || "")
        .split(",")
        .map(function (tag) { return String(tag || "").trim(); })
        .filter(function (tag) { return tag.length > 0; });
      delete next.tagsText;
      onSave(next);
      setEditMode(false);
    }

    if (!character || !draft) {
      return html`<section className="character-profile-page"><div className="profile-empty">No character selected.</div></section>`;
    }

    var linked = relationships.filter(function (rel) {
      return rel && (rel.from === character.id || rel.to === character.id);
    });
    var timelineDisplayEvents = timelineEventsForDisplay(draft.timeline || [], draft.dateOfBirth, draft.dateOfDeath);
    var timelineCanEdit = editMode && editable;

    function detailTableRow(label, key, options) {
      var config = options && typeof options === "object" ? options : {};
      var value = String(draft[key] || "");
      if (!timelineCanEdit) {
        var display = config.type === "date" ? (formatDisplayDate(value) || "Not set") : (value || "Not set");
        return html`<div className="profile-detail-row" key=${"profile-detail-" + key}>
          <dt>${label}</dt>
          <dd>${display}</dd>
        </div>`;
      }
      return html`<div className="profile-detail-row editable" key=${"profile-detail-" + key}>
        <dt>${label}</dt>
        <dd>
          ${config.multiline
            ? html`<textarea rows=${config.rows || 2} value=${value} onInput=${function (event) { updateDraftField(key, event.target.value); }}></textarea>`
            : html`<input type=${config.type || "text"} value=${value} onInput=${function (event) { updateDraftField(key, event.target.value); }} />`}
        </dd>
      </div>`;
    }

    var statusTags = (draft.tags || []).slice();
    if (draft.status) {
      statusTags.unshift(draft.status);
    }

    return html`<section className="character-profile-page">
      <div className="profile-dossier-shell">
        <div className="profile-content-container">
          <header className="profile-header">
            <div className="profile-header-main">
              <${CharacterProfilePortrait} record=${draft} className="profile-header-portrait" />
              <div className="profile-title-block">
                ${timelineCanEdit
                  ? html`<input className="profile-name-input" value=${draft.name || ""} onInput=${function (event) { updateDraftField("name", event.target.value); }} />`
                  : html`<h1>${draft.name || "Unnamed Character"}</h1>`}
                <div className="profile-header-facts">
                  <span><strong>Clan</strong>${draft.clan || "None"}</span>
                  <span><strong>Sect</strong>${draft.sect || "None"}</span>
                  <span><strong>Generation</strong>${draft.generation || "Unknown"}</span>
                  <span><strong>Predator Type</strong>${draft.predatorType || "Unknown"}</span>
                </div>
                <div className="profile-header-tags" aria-label="Status tags">
                  ${statusTags.length
                    ? statusTags.map(function (tag, index) {
                        return html`<span className="tag" key=${"header-tag-" + index}>${tag}</span>`;
                      })
                    : html`<span className="tag">No Status Tags</span>`}
                </div>
                ${timelineCanEdit ? html`<div className="profile-header-editor-grid">
                  <input value=${draft.clan || ""} onInput=${function (event) { updateDraftField("clan", event.target.value); }} placeholder="Clan" />
                  <input value=${draft.sect || ""} onInput=${function (event) { updateDraftField("sect", event.target.value); }} placeholder="Sect" />
                  <input value=${draft.generation || ""} onInput=${function (event) { updateDraftField("generation", event.target.value); }} placeholder="Generation" />
                  <input value=${draft.predatorType || ""} onInput=${function (event) { updateDraftField("predatorType", event.target.value); }} placeholder="Predator Type" />
                  <input value=${draft.status || ""} onInput=${function (event) { updateDraftField("status", event.target.value); }} placeholder="Status" />
                  <input value=${(Array.isArray(draft.tags) ? draft.tags.join(", ") : "")} onInput=${function (event) { updateDraftField("tags", event.target.value.split(",").map(function (tag) { return tag.trim(); }).filter(Boolean)); }} placeholder="Tags (comma separated)" />
                </div>` : null}
              </div>
            </div>
            <div className="profile-header-controls">
              ${onRequestClose ? html`<button type="button" className="icon-button-34 profile-close-button" onClick=${onRequestClose}>x</button>` : null}
            </div>
          </header>

          <div className="profile-layout">
            <main className="profile-main-column">
              <article className="profile-biography profile-tabbed-workspace">
                <div className="profile-tab-header profile-biography-head">
                  <div className="profile-tab-list" role="tablist" aria-label="Character profile tabs">
                    <button
                      type="button"
                      role="tab"
                      className=${"profile-tab-button" + (activeTab === "biography" ? " active" : "")}
                      aria-selected=${activeTab === "biography" ? "true" : "false"}
                      onClick=${function () { setActiveTab("biography"); }}
                    >
                      Biography
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className=${"profile-tab-button" + (activeTab === "story-notes" ? " active" : "")}
                      aria-selected=${activeTab === "story-notes" ? "true" : "false"}
                      onClick=${function () { setActiveTab("story-notes"); }}
                    >
                      Story Notes
                    </button>
                  </div>
                  ${editable ? html`<div className="profile-tab-actions">
                    ${timelineCanEdit
                      ? html`<div className="profile-edit-actions-row"><button type="button" onClick=${commitSave}>Save</button><button type="button" onClick=${function () { setDraft(normalizeCharacterForProfile(character)); setEditMode(false); }}>Cancel</button></div>`
                      : html`<button type="button" className="profile-biography-edit-button" onClick=${function () { setEditMode(true); }}>Edit</button>`}
                  </div>` : null}
                </div>

                <div className="profile-tab-panels">
                  <section className="profile-tab-panel" role="tabpanel" aria-hidden=${activeTab === "biography" ? "false" : "true"} hidden=${activeTab !== "biography"}>
                    <${CharacterBiographyWorkspace}
                      editable=${timelineCanEdit}
                      value=${String(draft.bioHtml || "")}
                      onChange=${function (htmlValue) { updateDraftField("bioHtml", htmlValue); }}
                      editorClassName="rich-editor profile-rich-editor character-rich-text"
                      viewerClassName="profile-biography-content character-rich-text"
                    />
                  </section>

                  <section className="profile-tab-panel" role="tabpanel" aria-hidden=${activeTab === "story-notes" ? "false" : "true"} hidden=${activeTab !== "story-notes"}>
                    ${storyNotesLoading ? html`<p className="hint">Loading referenced notes...</p>` : null}
                    ${!storyNotesLoading && storyNotes.length ? html`<div className="story-notes-list">
                      ${storyNotes.map(function (note, index) {
                        return html`<button type="button" key=${note.id || ("story-note-item-" + index)} className="story-note-item" onClick=${function () { openStoryNote(note); }}>
                          <strong>${note.title || "Untitled Note"}</strong>
                          <p>${note.preview || "No preview available."}</p>
                          <div className="story-note-meta">
                            <span>${note.updatedAt ? ("Updated " + formatDisplayDate(note.updatedAt)) : "Updated date unavailable"}</span>
                            ${note.tags && note.tags.length ? html`<span>${note.tags.join(", ")}</span>` : null}
                          </div>
                        </button>`;
                      })}
                    </div>` : null}
                    ${!storyNotesLoading && !storyNotes.length ? html`<p className="hint">No story notes reference this character.</p>` : null}
                  </section>
                </div>
              </article>

              <section className="profile-section">
                <h3>Storyteller Notes</h3>
                ${timelineCanEdit
                  ? html`<textarea rows="6" value=${draft.storytellerNotes || ""} onInput=${function (event) { updateDraftField("storytellerNotes", event.target.value); }} placeholder="Storyteller-facing notes"></textarea>`
                  : html`<p>${draft.storytellerNotes || "No storyteller notes yet."}</p>`}
              </section>

              <section className="profile-section gm-only">
                <h3>GM-Only Information</h3>
                ${timelineCanEdit
                  ? html`<textarea rows="6" value=${draft.gmOnlyInformation || ""} onInput=${function (event) { updateDraftField("gmOnlyInformation", event.target.value); }} placeholder="Private GM-only information"></textarea>`
                  : html`<p>${draft.gmOnlyInformation || "No GM-only notes yet."}</p>`}
              </section>

              <section className="profile-section profile-relationship-section">
                <h3>Relationships</h3>
                ${linked.length ? html`<div className="profile-relationship-grid">
                  ${linked.map(function (rel, index) {
                    var otherId = rel.from === character.id ? rel.to : rel.from;
                    var other = characters.find(function (entry) { return entry.id === otherId; });
                    var relationshipKey = rel && rel.id ? String(rel.id) : ("rel-" + index + "-" + otherId);
                    return html`<article className="profile-relationship-card" key=${"rel-" + relationshipKey}>
                      <strong>${other ? other.name : "Unknown Character"}</strong>
                      <span>${rel.type || "Relationship"}</span>
                    </article>`;
                  })}
                </div>` : html`<p className="hint">No tracked relationships.</p>`}
              </section>

              <section className="profile-section profile-timeline-section">
                <h3>Timeline</h3>
                ${timelineCanEdit ? html`<div className="timeline-log-toolbar"><button type="button" onClick=${addTimelineEvent}>Add Event</button></div>` : null}
                <div className="profile-timeline-list">
                  ${timelineDisplayEvents.length ? timelineDisplayEvents.map(function (entry) {
                    var item = normalizeTimelineEvent(entry.event);
                    var key = String(entry.sourceIndex);
                    var isExpanded = expandedTimelineKey === key;
                    var isSystem = entry.isSystem;
                    var yearLabel = item.date ? item.date.slice(0, 4) : "----";
                    return html`<article className=${"chronicle-entry profile-timeline-entry" + (isExpanded ? " expanded" : "") + (isSystem ? " system" : "") + " expandable"} key=${"timeline-entry-" + key}>
                      <div className="timeline-log-head" onClick=${function () { setExpandedTimelineKey(isExpanded ? null : key); }}>
                        <div className="timeline-log-main chronicle-entry-row">
                          <span className="chronicle-entry-year">${yearLabel}</span>
                          <span className="timeline-log-caret">${isExpanded ? "v" : ">"}</span>
                          <p className="timeline-log-title-row"><strong>${item.title || "Untitled Event"}</strong>${isSystem ? html`<span className="timeline-system-badge">System Event</span>` : null}</p>
                          ${isExpanded ? html`<p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>` : null}
                        </div>
                        ${timelineCanEdit && !isSystem && isExpanded ? html`<div className="timeline-log-actions"><button type="button" className="timeline-action-button" onClick=${function (event) { event.stopPropagation(); removeTimelineEvent(entry.sourceIndex); }}>Delete</button></div>` : null}
                      </div>
                      ${isExpanded ? html`<div className="timeline-log-editor">
                        <label>Date</label>
                        <input type="date" value=${item.date || ""} disabled=${!timelineCanEdit || isSystem} onInput=${function (event) { updateTimelineEvent(entry.sourceIndex, "date", event.target.value); }} />
                        <label>Event Title</label>
                        <input value=${item.title || ""} disabled=${!timelineCanEdit || isSystem} onInput=${function (event) { updateTimelineEvent(entry.sourceIndex, "title", event.target.value); }} />
                        <label>Description</label>
                        <textarea rows="3" value=${item.description || ""} disabled=${!timelineCanEdit || isSystem} onInput=${function (event) { updateTimelineEvent(entry.sourceIndex, "description", event.target.value); }}></textarea>
                        <label>GM Notes</label>
                        <textarea rows="3" value=${item.gmNotes || ""} disabled=${!timelineCanEdit || isSystem} onInput=${function (event) { updateTimelineEvent(entry.sourceIndex, "gmNotes", event.target.value); }}></textarea>
                      </div>` : null}
                    </article>`;
                  }) : html`<p className="hint">No timeline entries yet.</p>`}
                </div>
              </section>
            </main>

            <aside className="profile-info-column">
              <article className="profile-section profile-details-panel">
                <h3>Character Details</h3>
                <dl className="profile-details-table">
                  ${detailTableRow("Clan", "clan")}
                  ${detailTableRow("Sect", "sect")}
                  ${detailTableRow("Generation", "generation")}
                  ${detailTableRow("Predator Type", "predatorType")}
                  ${detailTableRow("Concept", "concept", { multiline: true })}
                  ${detailTableRow("Ambition", "ambition", { multiline: true })}
                  ${detailTableRow("Desire", "desire", { multiline: true })}
                  ${timelineCanEdit ? detailTableRow("Convictions", "convictions", { multiline: true }) : null}
                  ${timelineCanEdit ? detailTableRow("Touchstones", "touchstones", { multiline: true }) : null}
                  ${detailTableRow("True Age", "trueAge")}
                  ${detailTableRow("Apparent Age", "apparentAge")}
                  ${detailTableRow("Date of Birth", "dateOfBirth", { type: "date" })}
                  ${detailTableRow("Date of Death", "dateOfDeath", { type: "date" })}
                  ${detailTableRow("Sire", "sire")}
                </dl>
                ${!timelineCanEdit ? dossierEntryGroup({ key: "profile-convictions-" + character.id, title: "Convictions", entryText: draft.convictions, accentColor: "#d10d40", emptyText: "Not set" }) : null}
                ${!timelineCanEdit ? dossierEntryGroup({ key: "profile-touchstones-" + character.id, title: "Touchstones", entryText: draft.touchstones, accentColor: "#d10d40", emptyText: "Not set" }) : null}
              </article>
            </aside>
          </div>
        </div>
      </div>
    </section>`;
  }

  window.CampaignAtlasCharactersShared = {
    clone: clone,
    characterBiographyHtml: characterBiographyHtml,
    normalizeIsoDate: normalizeIsoDate,
    formatDisplayDate: formatDisplayDate,
    normalizeTimelineEvent: normalizeTimelineEvent,
    timelineEventsFromAny: timelineEventsFromAny,
    sortTimelineEvents: sortTimelineEvents,
    timelineEventsForDisplay: timelineEventsForDisplay,
    timelineEventLabel: timelineEventLabel,
    parseDossierEntries: parseDossierEntries,
    dossierEntryGroup: dossierEntryGroup,
    renderPortraitSource: renderPortraitSource,
    canonicalPortraitFromRecord: canonicalPortraitFromRecord,
    portraitState: portraitState,
    portraitMediaStyle: portraitMediaStyle,
    normalizeCharacterForProfile: normalizeCharacterForProfile,
    readGmNotesEntries: readGmNotesEntries,
    readCampaignAtlasState: readCampaignAtlasState,
    saveCharacterToCampaignAtlas: saveCharacterToCampaignAtlas,
    CharacterBiographyWorkspace: CharacterBiographyWorkspace,
    CharacterProfilePortrait: CharacterProfilePortrait,
    CharacterProfileWorkspace: CharacterProfileWorkspace
  };
})();
