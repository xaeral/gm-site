(function () {
  if (window.ChronicleNotebook) {
    return;
  }

  var DB_NAME = "ChronicleNotebook";
  var DB_VERSION = 2;
  var STORE_FOLDERS = "folders";
  var STORE_NOTE_META = "noteMetadata";
  var STORE_NOTE_BODY = "noteBodies";
  var STORE_NOTE_LEGACY = "notes";
  var DEFAULT_FOLDER_DEFS = [
    { id: "campaign-notes", title: "Campaign Notes", kind: "system", order: 0, collapsed: false },
    { id: "session-notes", title: "Session Notes", kind: "system", order: 1, collapsed: false },
    { id: "plot-hooks", title: "Plot Hooks", kind: "system", order: 2, collapsed: false },
    { id: "factions", title: "Factions", kind: "system", order: 3, collapsed: false },
    { id: "mysteries", title: "Mysteries", kind: "system", order: 4, collapsed: false },
    { id: "locations", title: "Locations", kind: "system", order: 5, collapsed: false },
    { id: "npc-plans", title: "NPC Plans", kind: "system", order: 6, collapsed: false },
    { id: "archive", title: "Archive", kind: "system", order: 7, collapsed: true }
  ];

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

  function openNotebookDb() {
    return new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        var legacyNotesStore = null;

        if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
          db.createObjectStore(STORE_FOLDERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NOTE_META)) {
          db.createObjectStore(STORE_NOTE_META, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NOTE_BODY)) {
          db.createObjectStore(STORE_NOTE_BODY, { keyPath: "id" });
        }
        if (db.objectStoreNames.contains(STORE_NOTE_LEGACY)) {
          legacyNotesStore = event.target.transaction.objectStore(STORE_NOTE_LEGACY);
        }

        if (!legacyNotesStore) {
          return;
        }

        var metaStore = event.target.transaction.objectStore(STORE_NOTE_META);
        var bodyStore = event.target.transaction.objectStore(STORE_NOTE_BODY);
        var cursorRequest = legacyNotesStore.openCursor();
        cursorRequest.onsuccess = function (cursorEvent) {
          var cursor = cursorEvent.target.result;
          if (!cursor) {
            return;
          }
          var source = cursor.value || {};
          var normalizedMeta = normalizeNoteMetadata(source, source.folderId);
          var normalizedBody = normalizeNoteContent(source);
          metaStore.put(normalizedMeta);
          bodyStore.put(normalizedBody);
          cursor.continue();
        };
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Unable to open ChronicleNotebook IndexedDB.")); };
    });
  }

  function sortByOrderThenName(a, b) {
    var orderDiff = Number(a.order || 0) - Number(b.order || 0);
    if (orderDiff) {
      return orderDiff;
    }
    return String(a.title || "").localeCompare(String(b.title || ""));
  }

  function previewFromHtml(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("script, style, noscript").forEach(function (el) { el.remove(); });
    var text = (doc.body && doc.body.textContent) ? doc.body.textContent : "";
    text = text.replace(/\s+/g, " ").trim();
    if (!text) {
      return "";
    }
    return text.length > 180 ? text.slice(0, 177) + "..." : text;
  }

  function normalizeFolder(folder, index) {
    var source = folder && typeof folder === "object" ? folder : {};
    return {
      id: String(source.id || source.title || "folder-" + index),
      title: String(source.title || "Untitled Folder"),
      kind: String(source.kind || "custom"),
      order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
      collapsed: Boolean(source.collapsed),
      parentId: source.parentId ? String(source.parentId) : "",
      createdAt: String(source.createdAt || new Date().toISOString()),
      updatedAt: String(source.updatedAt || new Date().toISOString())
    };
  }

  function normalizeNoteMetadata(note, folderId) {
    var source = note && typeof note === "object" ? note : {};
    var now = new Date().toISOString();
    var previewText = String(source.previewText || source.preview || "").trim();
    if (!previewText && source.bodyHtml) {
      previewText = previewFromHtml(source.bodyHtml);
    }
    var characterIds = Array.isArray(source.characterIds) ? source.characterIds.map(String) : [];
    var locationIds = Array.isArray(source.locationIds) ? source.locationIds.map(String) : [];
    var tags = Array.isArray(source.tags) ? source.tags.map(String) : [];
    var timelineEvents = Array.isArray(source.timelineEvents) ? clone(source.timelineEvents) : [];
    return {
      id: String(source.id || "note-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
      folderId: String(source.folderId || folderId || "campaign-notes"),
      title: String(source.title || "Untitled Note"),
      sessionLabel: String(source.sessionLabel || ""),
      characterIds: characterIds,
      locationIds: locationIds,
      tags: tags,
      pinned: Boolean(source.pinned),
      archived: Boolean(source.archived),
      previewText: previewText,
      searchText: buildSearchText({
        title: source.title,
        previewText: previewText,
        sessionLabel: source.sessionLabel,
        tags: tags,
        characterIds: characterIds,
        locationIds: locationIds,
        timelineEvents: timelineEvents,
        folderId: source.folderId || folderId || "campaign-notes"
      }),
      timelineEvents: timelineEvents,
      createdAt: String(source.createdAt || now),
      updatedAt: String(source.updatedAt || now)
    };
  }

  function normalizeNoteContent(note) {
    var source = note && typeof note === "object" ? note : {};
    var now = new Date().toISOString();
    return {
      id: String(source.id || "note-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
      bodyHtml: String(source.bodyHtml || source.body || "<p></p>"),
      attachments: Array.isArray(source.attachments) ? clone(source.attachments) : [],
      timelineEvents: Array.isArray(source.timelineEvents) ? clone(source.timelineEvents) : [],
      createdAt: String(source.createdAt || now),
      updatedAt: String(source.updatedAt || now)
    };
  }

  function buildSearchText(note) {
    var source = note || {};
    return [
      String(source.title || ""),
      String(source.previewText || ""),
      String(source.sessionLabel || ""),
      String(source.folderTitle || source.folderId || ""),
      Array.isArray(source.tags) ? source.tags.join(" ") : "",
      Array.isArray(source.characterIds) ? source.characterIds.join(" ") : "",
      Array.isArray(source.locationIds) ? source.locationIds.join(" ") : "",
      Array.isArray(source.timelineEvents)
        ? source.timelineEvents.map(function (event) {
            return [event.characterId, event.year, event.title, event.description].join(" ");
          }).join(" ")
        : ""
    ].join(" ").toLowerCase();
  }

  function notePreview(note) {
    if (!note) {
      return "No preview available.";
    }
    var preview = String(note.previewText || "").trim();
    if (preview) {
      return preview;
    }
    var text = String(note.bodyHtml || "").trim();
    if (!text) {
      return "No preview available.";
    }
    return previewFromHtml(text) || "No preview available.";
  }

  async function ensureSeedData(db) {
    var folderTxn = db.transaction([STORE_FOLDERS], "readwrite");
    var folderStore = folderTxn.objectStore(STORE_FOLDERS);
    var folders = await requestToPromise(folderStore.getAll());
    if (!Array.isArray(folders) || !folders.length) {
      DEFAULT_FOLDER_DEFS.forEach(function (folder) {
        folderStore.put(normalizeFolder(folder, folder.order));
      });
    } else {
      var existingIds = {};
      folders.forEach(function (folder) {
        if (folder && folder.id) {
          existingIds[String(folder.id)] = true;
        }
      });
      DEFAULT_FOLDER_DEFS.forEach(function (folder) {
        if (!existingIds[folder.id]) {
          folderStore.put(normalizeFolder(folder, folder.order));
        }
      });
    }
    await transactionToPromise(folderTxn);
  }

  async function readNotebookState() {
    var db = await openNotebookDb();
    await ensureSeedData(db);
    var txn = db.transaction([STORE_FOLDERS, STORE_NOTE_META], "readonly");
    var foldersPromise = requestToPromise(txn.objectStore(STORE_FOLDERS).getAll());
    var notesPromise = requestToPromise(txn.objectStore(STORE_NOTE_META).getAll());
    await transactionToPromise(txn);
    var folders = (await foldersPromise || []).map(normalizeFolder).sort(sortByOrderThenName);
    var notes = (await notesPromise || []).map(function (note) { return normalizeNoteMetadata(note); }).sort(function (a, b) {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    return {
      folders: folders,
      notes: notes
    };
  }

  async function readNoteMetadata(noteId) {
    if (!noteId) {
      return null;
    }
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_NOTE_META], "readonly");
    var note = await requestToPromise(txn.objectStore(STORE_NOTE_META).get(String(noteId)));
    await transactionToPromise(txn);
    return note ? normalizeNoteMetadata(note) : null;
  }

  async function readNoteContent(noteId) {
    if (!noteId) {
      return null;
    }
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_NOTE_BODY], "readonly");
    var content = await requestToPromise(txn.objectStore(STORE_NOTE_BODY).get(String(noteId)));
    await transactionToPromise(txn);
    return content ? normalizeNoteContent(content) : null;
  }

  async function readNoteById(noteId) {
    var meta = await readNoteMetadata(noteId);
    if (!meta) {
      return null;
    }
    var content = await readNoteContent(noteId);
    return Object.assign({}, meta, content || {});
  }

  async function saveFolder(folder) {
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_FOLDERS], "readwrite");
    txn.objectStore(STORE_FOLDERS).put(normalizeFolder(folder, Number(folder && folder.order) || 0));
    await transactionToPromise(txn);
  }

  async function saveNote(note, folderId) {
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_NOTE_META, STORE_NOTE_BODY], "readwrite");
    var normalizedMeta = normalizeNoteMetadata(note, folderId);
    var normalizedBody = normalizeNoteContent(note);
    normalizedMeta.updatedAt = new Date().toISOString();
    normalizedBody.updatedAt = normalizedMeta.updatedAt;
    if (!normalizedMeta.createdAt) {
      normalizedMeta.createdAt = normalizedMeta.updatedAt;
    }
    if (!normalizedBody.createdAt) {
      normalizedBody.createdAt = normalizedBody.updatedAt;
    }
    normalizedMeta.previewText = previewFromHtml(normalizedBody.bodyHtml || "");
    normalizedMeta.searchText = buildSearchText(normalizedMeta);
    txn.objectStore(STORE_NOTE_META).put(normalizedMeta);
    txn.objectStore(STORE_NOTE_BODY).put(normalizedBody);
    await transactionToPromise(txn);
    return Object.assign({}, normalizedMeta, normalizedBody);
  }

  async function deleteNote(noteId) {
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_NOTE_META, STORE_NOTE_BODY], "readwrite");
    var key = String(noteId);
    txn.objectStore(STORE_NOTE_META).delete(key);
    txn.objectStore(STORE_NOTE_BODY).delete(key);
    await transactionToPromise(txn);
  }

  async function moveNote(noteId, folderId) {
    var meta = await readNoteMetadata(noteId);
    if (!meta) {
      return null;
    }
    meta.folderId = String(folderId || "campaign-notes");
    return saveNote(meta, meta.folderId);
  }

  function getFolderById(state, folderId) {
    return (state.folders || []).find(function (folder) { return folder.id === folderId; }) || null;
  }

  function getNoteSearchText(note, state) {
    var folder = getFolderById(state || {}, note.folderId);
    var source = Object.assign({}, note || {});
    if (folder && folder.title) {
      source.folderTitle = folder.title;
    }
    return buildSearchText(source);
  }

  function filterNotes(notes, state, filters, searchTerm) {
    var criteria = filters && typeof filters === "object" ? filters : {};
    var term = String(searchTerm || "").trim().toLowerCase();
    return (notes || []).filter(function (note) {
      if (criteria.folderIds && criteria.folderIds.length && criteria.folderIds.indexOf(note.folderId) < 0) {
        return false;
      }
      if (criteria.sessions && criteria.sessions.length && criteria.sessions.indexOf(note.sessionLabel) < 0) {
        return false;
      }
      if (criteria.characters && criteria.characters.length && !(note.characterIds || []).some(function (id) { return criteria.characters.indexOf(id) >= 0; })) {
        return false;
      }
      if (criteria.locations && criteria.locations.length && !(note.locationIds || []).some(function (id) { return criteria.locations.indexOf(id) >= 0; })) {
        return false;
      }
      if (criteria.tags && criteria.tags.length && !(note.tags || []).some(function (tag) { return criteria.tags.indexOf(tag) >= 0; })) {
        return false;
      }
      if (!term) {
        return true;
      }
      return getNoteSearchText(note, state).indexOf(term) >= 0;
    });
  }

  async function createFolder(name) {
    var state = await readNotebookState();
    var folder = normalizeFolder({
      id: "folder-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      title: String(name || "New Folder").trim() || "New Folder",
      kind: "custom",
      order: (state.folders || []).length,
      collapsed: false
    }, (state.folders || []).length);
    await saveFolder(folder);
    return folder;
  }

  async function createNote(folderId) {
    var now = new Date().toISOString();
    var note = {
      id: "note-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      folderId: folderId || "campaign-notes",
      title: "Untitled Note",
      sessionLabel: "",
      characterIds: [],
      locationIds: [],
      tags: [],
      pinned: false,
      archived: false,
      previewText: "",
      timelineEvents: [],
      bodyHtml: "<p></p>",
      attachments: [],
      createdAt: now,
      updatedAt: now
    };
    await saveNote(note, folderId);
    return normalizeNoteMetadata(note, folderId);
  }

  function getDefaultFolderId() {
    return DEFAULT_FOLDER_DEFS[0].id;
  }

  window.ChronicleNotebook = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    DEFAULT_FOLDER_DEFS: clone(DEFAULT_FOLDER_DEFS),
    clone: clone,
    openNotebookDb: openNotebookDb,
    readNotebookState: readNotebookState,
    readNoteMetadata: readNoteMetadata,
    readNoteContent: readNoteContent,
    readNoteById: readNoteById,
    saveFolder: saveFolder,
    saveNote: saveNote,
    deleteNote: deleteNote,
    moveNote: moveNote,
    createFolder: createFolder,
    createNote: createNote,
    notePreview: notePreview,
    getFolderById: getFolderById,
    getNoteSearchText: getNoteSearchText,
    filterNotes: filterNotes,
    getDefaultFolderId: getDefaultFolderId,
    previewFromHtml: previewFromHtml
  };
})();
