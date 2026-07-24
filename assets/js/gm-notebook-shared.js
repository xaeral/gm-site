(function () {
  if (window.ChronicleNotebook) {
    return;
  }

  var DB_NAME = "ChronicleNotebook";
  var DB_VERSION = 1;
  var STORE_FOLDERS = "folders";
  var STORE_NOTES = "notes";
  var DEFAULT_FOLDER_DEFS = [
    { id: "campaign-notes", title: "Campaign Notes", kind: "system", order: 0, collapsed: false },
    { id: "session-notes", title: "Session Notes", kind: "system", order: 1, collapsed: false },
    { id: "plot-hooks", title: "Plot Hooks", kind: "system", order: 2, collapsed: false },
    { id: "factions", title: "Factions", kind: "system", order: 3, collapsed: false },
    { id: "mysteries", title: "Mysteries", kind: "system", order: 4, collapsed: false },
    { id: "locations", title: "Locations", kind: "system", order: 5, collapsed: false },
    { id: "npc-plans", title: "NPC Plans", kind: "system", order: 6, collapsed: false }
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
        if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
          db.createObjectStore(STORE_FOLDERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NOTES)) {
          db.createObjectStore(STORE_NOTES, { keyPath: "id" });
        }
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

  function normalizeNote(note, folderId) {
    var source = note && typeof note === "object" ? note : {};
    var now = new Date().toISOString();
    var timelineEvents = Array.isArray(source.timelineEvents) ? source.timelineEvents.slice() : [];
    return {
      id: String(source.id || "note-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
      folderId: String(source.folderId || folderId || "campaign-notes"),
      title: String(source.title || "Untitled Note"),
      bodyHtml: String(source.bodyHtml || source.body || "<p></p>"),
      sessionLabel: String(source.sessionLabel || ""),
      characterIds: Array.isArray(source.characterIds) ? source.characterIds.map(String) : [],
      locationIds: Array.isArray(source.locationIds) ? source.locationIds.map(String) : [],
      tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
      pinned: Boolean(source.pinned),
      archived: Boolean(source.archived),
      attachments: Array.isArray(source.attachments) ? clone(source.attachments) : [],
      timelineEvents: timelineEvents.map(function (event) {
        return {
          id: String(event.id || "timeline-link-" + Date.now()),
          characterId: String(event.characterId || ""),
          year: String(event.year || ""),
          title: String(event.title || ""),
          description: String(event.description || "")
        };
      }),
      createdAt: String(source.createdAt || now),
      updatedAt: String(source.updatedAt || now)
    };
  }

  function stripHtml(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("script, style, noscript").forEach(function (el) { el.remove(); });
    var text = (doc.body && doc.body.textContent) ? doc.body.textContent : "";
    return text.replace(/\s+/g, " ").trim();
  }

  function noteSearchText(note, folderTitle) {
    var source = note || {};
    var textParts = [
      String(source.title || ""),
      stripHtml(source.bodyHtml || ""),
      String(source.sessionLabel || ""),
      String(folderTitle || ""),
      (Array.isArray(source.tags) ? source.tags.join(" ") : ""),
      (Array.isArray(source.characterIds) ? source.characterIds.join(" ") : ""),
      (Array.isArray(source.locationIds) ? source.locationIds.join(" ") : ""),
      (Array.isArray(source.timelineEvents)
        ? source.timelineEvents.map(function (event) {
            return [event.characterId, event.year, event.title, event.description].join(" ");
          }).join(" ")
        : "")
    ];
    return textParts.join(" ").toLowerCase();
  }

  function notePreview(note) {
    var text = stripHtml(note.bodyHtml || "");
    if (!text) {
      return "No preview available.";
    }
    return text.length > 180 ? text.slice(0, 177) + "..." : text;
  }

  async function ensureSeedData(db) {
    var folderTxn = db.transaction([STORE_FOLDERS], "readwrite");
    var folderStore = folderTxn.objectStore(STORE_FOLDERS);
    var folders = await requestToPromise(folderStore.getAll());
    if (!Array.isArray(folders) || !folders.length) {
      DEFAULT_FOLDER_DEFS.forEach(function (folder) {
        folderStore.put(normalizeFolder(folder, folder.order));
      });
    }
    await transactionToPromise(folderTxn);
  }

  async function readNotebookState() {
    var db = await openNotebookDb();
    await ensureSeedData(db);
    var txn = db.transaction([STORE_FOLDERS, STORE_NOTES], "readonly");
    var foldersPromise = requestToPromise(txn.objectStore(STORE_FOLDERS).getAll());
    var notesPromise = requestToPromise(txn.objectStore(STORE_NOTES).getAll());
    await transactionToPromise(txn);
    var folders = (await foldersPromise || []).map(normalizeFolder).sort(sortByOrderThenName);
    var notes = (await notesPromise || []).map(function (note) { return normalizeNote(note); }).sort(function (a, b) {
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

  async function saveFolder(folder) {
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_FOLDERS], "readwrite");
    txn.objectStore(STORE_FOLDERS).put(normalizeFolder(folder, Number(folder && folder.order) || 0));
    await transactionToPromise(txn);
  }

  async function saveNote(note, folderId) {
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_NOTES], "readwrite");
    var normalized = normalizeNote(note, folderId);
    normalized.updatedAt = new Date().toISOString();
    if (!normalized.createdAt) {
      normalized.createdAt = normalized.updatedAt;
    }
    txn.objectStore(STORE_NOTES).put(normalized);
    await transactionToPromise(txn);
    return normalized;
  }

  async function deleteNote(noteId) {
    var db = await openNotebookDb();
    var txn = db.transaction([STORE_NOTES], "readwrite");
    txn.objectStore(STORE_NOTES).delete(String(noteId));
    await transactionToPromise(txn);
  }

  async function moveNote(noteId, folderId) {
    var state = await readNotebookState();
    var note = state.notes.find(function (entry) { return entry.id === noteId; });
    if (!note) {
      return null;
    }
    note.folderId = String(folderId || "campaign-notes");
    return saveNote(note);
  }

  function getFolderById(state, folderId) {
    return (state.folders || []).find(function (folder) { return folder.id === folderId; }) || null;
  }

  function getNoteSearchText(note, state) {
    var folder = getFolderById(state || {}, note.folderId);
    return noteSearchText(note, folder && folder.title);
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
    var note = normalizeNote({
      folderId: folderId || "campaign-notes",
      title: "Untitled Note",
      bodyHtml: "<p></p>",
      sessionLabel: "",
      characterIds: [],
      locationIds: [],
      tags: [],
      pinned: false,
      archived: false,
      attachments: [],
      timelineEvents: []
    }, folderId || "campaign-notes");
    await saveNote(note, folderId);
    return note;
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
    saveFolder: saveFolder,
    saveNote: saveNote,
    deleteNote: deleteNote,
    moveNote: moveNote,
    createFolder: createFolder,
    createNote: createNote,
    notePreview: notePreview,
    stripHtml: stripHtml,
    getFolderById: getFolderById,
    getNoteSearchText: getNoteSearchText,
    filterNotes: filterNotes,
    getDefaultFolderId: getDefaultFolderId
  };
})();
