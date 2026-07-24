(function () {
  if (window.ChronicleSessionJournal) {
    return;
  }

  var DB_NAME = "ChronicleSessionJournal";
  var DB_VERSION = 1;
  var STORE_SESSION_META = "sessionMetadata";
  var STORE_SESSION_BODY = "sessionBodies";

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

  function openSessionJournalDb() {
    return new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_SESSION_META)) {
          db.createObjectStore(STORE_SESSION_META, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_SESSION_BODY)) {
          db.createObjectStore(STORE_SESSION_BODY, { keyPath: "id" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Unable to open Session Journal IndexedDB.")); };
    });
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

  function buildSearchText(session) {
    var source = session || {};
    return [
      String(source.sessionNumber || ""),
      String(source.title || ""),
      String(source.datePlayed || ""),
      String(source.previewText || ""),
      Array.isArray(source.tags) ? source.tags.join(" ") : "",
      Array.isArray(source.characterIds) ? source.characterIds.join(" ") : "",
      Array.isArray(source.locationIds) ? source.locationIds.join(" ") : "",
      Array.isArray(source.timelineEvents) ? source.timelineEvents.map(function (event) {
        return [event.title, event.description, event.year, event.locationId].join(" ");
      }).join(" ") : ""
    ].join(" ").toLowerCase();
  }

  function normalizeSessionMetadata(session) {
    var source = session && typeof session === "object" ? session : {};
    var now = new Date().toISOString();
    var tags = Array.isArray(source.tags) ? source.tags.map(String) : [];
    var characterIds = Array.isArray(source.characterIds) ? source.characterIds.map(String) : [];
    var locationIds = Array.isArray(source.locationIds) ? source.locationIds.map(String) : [];
    var timelineEvents = Array.isArray(source.timelineEvents) ? clone(source.timelineEvents) : [];
    var previewText = String(source.previewText || "").trim() || previewFromHtml(source.bodyHtml || "");

    var normalized = {
      id: String(source.id || "session-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
      sessionNumber: Number.isFinite(Number(source.sessionNumber)) ? Number(source.sessionNumber) : 1,
      title: String(source.title || "Untitled Session"),
      datePlayed: String(source.datePlayed || ""),
      tags: tags,
      characterIds: characterIds,
      locationIds: locationIds,
      pinned: Boolean(source.pinned),
      archived: Boolean(source.archived),
      timelineEvents: timelineEvents,
      previewText: previewText,
      lastEditedAt: String(source.lastEditedAt || source.updatedAt || now),
      createdAt: String(source.createdAt || now),
      updatedAt: String(source.updatedAt || now)
    };
    normalized.searchText = buildSearchText(normalized);
    return normalized;
  }

  function normalizeSessionBody(session) {
    var source = session && typeof session === "object" ? session : {};
    var now = new Date().toISOString();
    return {
      id: String(source.id || "session-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
      bodyHtml: String(source.bodyHtml || "<p></p>"),
      createdAt: String(source.createdAt || now),
      updatedAt: String(source.updatedAt || now)
    };
  }

  function sortSessionsForExplorer(a, b) {
    var dateA = String(a.datePlayed || "");
    var dateB = String(b.datePlayed || "");
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    if (Number(a.sessionNumber || 0) !== Number(b.sessionNumber || 0)) {
      return Number(b.sessionNumber || 0) - Number(a.sessionNumber || 0);
    }
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  }

  async function ensureSeedData(db) {
    var txn = db.transaction([STORE_SESSION_META, STORE_SESSION_BODY], "readwrite");
    var metaStore = txn.objectStore(STORE_SESSION_META);
    var bodyStore = txn.objectStore(STORE_SESSION_BODY);
    var existing = await requestToPromise(metaStore.getAll());
    if (!Array.isArray(existing) || !existing.length) {
      var seeds = Array.isArray(window.GMData && window.GMData.sessions) ? window.GMData.sessions : [];
      seeds.forEach(function (entry, index) {
        var label = String(entry || "");
        var parts = label.split(":");
        var numberMatch = /session\s*(\d+)/i.exec(parts[0] || "");
        var now = new Date().toISOString();
        var id = "session-seed-" + index;
        var title = (parts[1] || label || "Session Recap").trim();
        var number = numberMatch ? Number(numberMatch[1]) : (index + 1);
        var date = "";
        var meta = normalizeSessionMetadata({
          id: id,
          sessionNumber: number,
          title: title,
          datePlayed: date,
          tags: [],
          characterIds: [],
          locationIds: [],
          timelineEvents: [],
          previewText: "",
          pinned: false,
          archived: false,
          createdAt: now,
          updatedAt: now,
          lastEditedAt: now
        });
        var body = normalizeSessionBody({ id: id, bodyHtml: "<p></p>", createdAt: now, updatedAt: now });
        metaStore.put(meta);
        bodyStore.put(body);
      });
    }
    await transactionToPromise(txn);
  }

  async function readSessionJournalState() {
    var db = await openSessionJournalDb();
    await ensureSeedData(db);
    var txn = db.transaction([STORE_SESSION_META], "readonly");
    var metadataPromise = requestToPromise(txn.objectStore(STORE_SESSION_META).getAll());
    await transactionToPromise(txn);
    var metadata = (await metadataPromise || []).map(normalizeSessionMetadata).sort(sortSessionsForExplorer);
    return { sessions: metadata };
  }

  async function readSessionById(sessionId) {
    if (!sessionId) {
      return null;
    }
    var db = await openSessionJournalDb();
    var txn = db.transaction([STORE_SESSION_META, STORE_SESSION_BODY], "readonly");
    var metaPromise = requestToPromise(txn.objectStore(STORE_SESSION_META).get(String(sessionId)));
    var bodyPromise = requestToPromise(txn.objectStore(STORE_SESSION_BODY).get(String(sessionId)));
    await transactionToPromise(txn);
    var meta = await metaPromise;
    if (!meta) {
      return null;
    }
    var body = await bodyPromise;
    var normalizedMeta = normalizeSessionMetadata(meta);
    var normalizedBody = normalizeSessionBody(body || meta);
    return Object.assign({}, normalizedMeta, normalizedBody);
  }

  async function saveSession(session) {
    if (!session || !session.id) {
      return null;
    }
    var db = await openSessionJournalDb();
    var txn = db.transaction([STORE_SESSION_META, STORE_SESSION_BODY], "readwrite");
    var metaStore = txn.objectStore(STORE_SESSION_META);
    var existingMeta = await requestToPromise(metaStore.get(String(session.id)));
    var merged = Object.assign({}, clone(existingMeta || {}), clone(session || {}));
    var now = new Date().toISOString();
    merged.updatedAt = now;
    merged.lastEditedAt = now;
    if (!merged.createdAt) {
      merged.createdAt = now;
    }
    var meta = normalizeSessionMetadata(merged);
    var body = normalizeSessionBody(merged);
    body.updatedAt = now;
    if (!body.createdAt) {
      body.createdAt = now;
    }
    metaStore.put(meta);
    txn.objectStore(STORE_SESSION_BODY).put(body);
    await transactionToPromise(txn);
    return Object.assign({}, meta, body);
  }

  async function createSession(seed) {
    var state = await readSessionJournalState();
    var maxNumber = (state.sessions || []).reduce(function (max, entry) {
      return Math.max(max, Number(entry.sessionNumber || 0));
    }, 0);
    var nextNumber = maxNumber + 1;
    var nowIso = new Date().toISOString();
    var date = nowIso.slice(0, 10);
    var next = Object.assign({
      id: "session-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      sessionNumber: nextNumber,
      title: "Session " + nextNumber,
      datePlayed: date,
      tags: [],
      characterIds: [],
      locationIds: [],
      pinned: false,
      archived: false,
      timelineEvents: [],
      previewText: "",
      bodyHtml: "<p></p>",
      createdAt: nowIso,
      updatedAt: nowIso,
      lastEditedAt: nowIso
    }, seed || {});
    return saveSession(next);
  }

  async function deleteSession(sessionId) {
    if (!sessionId) {
      return;
    }
    var db = await openSessionJournalDb();
    var txn = db.transaction([STORE_SESSION_META, STORE_SESSION_BODY], "readwrite");
    txn.objectStore(STORE_SESSION_META).delete(String(sessionId));
    txn.objectStore(STORE_SESSION_BODY).delete(String(sessionId));
    await transactionToPromise(txn);
  }

  function filterSessions(sessions, filters, searchTerm) {
    var criteria = filters && typeof filters === "object" ? filters : {};
    var term = String(searchTerm || "").trim().toLowerCase();
    return (sessions || []).filter(function (session) {
      if (criteria.characters && criteria.characters.length && !(session.characterIds || []).some(function (id) { return criteria.characters.indexOf(id) >= 0; })) {
        return false;
      }
      if (criteria.locations && criteria.locations.length && !(session.locationIds || []).some(function (id) { return criteria.locations.indexOf(id) >= 0; })) {
        return false;
      }
      if (criteria.tags && criteria.tags.length && !(session.tags || []).some(function (tag) { return criteria.tags.indexOf(tag) >= 0; })) {
        return false;
      }
      if (criteria.dates && criteria.dates.length && criteria.dates.indexOf(String(session.datePlayed || "")) < 0) {
        return false;
      }
      if (term && String(session.searchText || "").indexOf(term) < 0) {
        return false;
      }
      return true;
    }).sort(sortSessionsForExplorer);
  }

  function stripHtml(htmlValue) {
    return String(htmlValue || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  window.ChronicleSessionJournal = {
    clone: clone,
    readSessionJournalState: readSessionJournalState,
    readSessionById: readSessionById,
    saveSession: saveSession,
    createSession: createSession,
    deleteSession: deleteSession,
    filterSessions: filterSessions,
    stripHtml: stripHtml,
    previewFromHtml: previewFromHtml
  };
})();
