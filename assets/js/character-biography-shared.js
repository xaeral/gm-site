(function () {
  var ReactRef = window.React;
  if (!ReactRef) {
    return;
  }

  var useEffect = ReactRef.useEffect;
  var useLayoutEffect = ReactRef.useLayoutEffect;
  var useRef = ReactRef.useRef;
  var useState = ReactRef.useState;

  var DB_NAME = "CampaignAtlas";
  var DB_VERSION = 1;
  var STORE_CHARACTERS = "characters";
  var STORE_RELATIONSHIPS = "relationships";
  var STORE_TIMELINE = "timeline";

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed.")); };
    });
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
      return String(character.bioHtml);
    }
    var plainText = String(character.bio || "").trim();
    if (!plainText) {
      return "<p>No biography added yet.</p>";
    }
    return "<p>" + plainText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>") + "</p>";
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

    var characters = await charactersPromise;
    var relationships = await relationshipsPromise;
    var timelineEntries = await timelinePromise;

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

    var nextCharacter = clone(character);
    var timelineEvents = clone(nextCharacter.timeline || []);
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
          createBiographyToolbarButton({ key: "image", className: "toolbar-icon-image", title: "Insert image", label: "🖼", active: false, onClick: insertImage })
        )
      ),
      ReactRef.createElement("div", {
        ref: editorRef,
        className: editorClassName,
        contentEditable: "true",
        suppressContentEditableWarning: "true",
        onFocus: refreshToolbarState,
        onKeyUp: refreshToolbarState,
        onMouseUp: refreshToolbarState,
        onInput: syncEditorToChange
      })
    );
  }

  window.CampaignAtlasCharactersShared = {
    clone: clone,
    characterBiographyHtml: characterBiographyHtml,
    readCampaignAtlasState: readCampaignAtlasState,
    saveCharacterToCampaignAtlas: saveCharacterToCampaignAtlas,
    CharacterBiographyWorkspace: CharacterBiographyWorkspace
  };
})();
