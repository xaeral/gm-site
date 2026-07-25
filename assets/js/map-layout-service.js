(function () {
  if (window.MapLayoutService) {
    return;
  }

  var STORE_NODE_LAYOUT = "nodeLayout";
  var STORE_ZONES = "zones";
  var STORE_SESSIONS = "sessions";
  var STORE_SETTINGS = "settings";

  function shared() {
    return window.CampaignAtlasCharactersShared || null;
  }

  function clone(value) {
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

  async function openDb() {
    var api = shared();
    if (!api || !api.openCampaignAtlasDb) {
      throw new Error("CampaignAtlasCharactersShared is not available.");
    }
    return api.openCampaignAtlasDb();
  }

  // ---- Node layout: per-character position, outline color, size, shape, hidden ----

  async function getNodeLayouts() {
    var db = await openDb();
    var transaction = db.transaction([STORE_NODE_LAYOUT], "readonly");
    var recordsPromise = requestToPromise(transaction.objectStore(STORE_NODE_LAYOUT).getAll());
    await transactionToPromise(transaction);
    var records = (await recordsPromise) || [];
    var byId = {};
    records.forEach(function (record) {
      if (record && record.id) {
        byId[record.id] = record;
      }
    });
    return byId;
  }

  async function saveNodeLayouts(layoutRecords) {
    var records = Array.isArray(layoutRecords) ? layoutRecords : [];
    if (!records.length) {
      return;
    }
    var db = await openDb();
    var transaction = db.transaction([STORE_NODE_LAYOUT], "readwrite");
    var store = transaction.objectStore(STORE_NODE_LAYOUT);
    records.forEach(function (record) {
      if (record && record.id) {
        store.put(record);
      }
    });
    await transactionToPromise(transaction);
  }

  async function clearNodeLayouts() {
    var db = await openDb();
    var transaction = db.transaction([STORE_NODE_LAYOUT], "readwrite");
    transaction.objectStore(STORE_NODE_LAYOUT).clear();
    await transactionToPromise(transaction);
  }

  async function deleteNodeLayout(characterId) {
    if (!characterId) {
      return;
    }
    var db = await openDb();
    var transaction = db.transaction([STORE_NODE_LAYOUT], "readwrite");
    transaction.objectStore(STORE_NODE_LAYOUT).delete(String(characterId));
    await transactionToPromise(transaction);
  }

  // ---- Zone assignments ----

  async function getZones() {
    var db = await openDb();
    var transaction = db.transaction([STORE_ZONES], "readonly");
    var recordsPromise = requestToPromise(transaction.objectStore(STORE_ZONES).getAll());
    await transactionToPromise(transaction);
    return clone((await recordsPromise) || []);
  }

  async function saveZones(zones) {
    var db = await openDb();
    var transaction = db.transaction([STORE_ZONES], "readwrite");
    var store = transaction.objectStore(STORE_ZONES);
    store.clear();
    (Array.isArray(zones) ? zones : []).forEach(function (zone) { store.put(clone(zone)); });
    await transactionToPromise(transaction);
  }

  // ---- Viewport state (pan/zoom) ----

  async function getViewport() {
    var db = await openDb();
    var transaction = db.transaction([STORE_SETTINGS], "readonly");
    var recordPromise = requestToPromise(transaction.objectStore(STORE_SETTINGS).get("viewport"));
    await transactionToPromise(transaction);
    var record = await recordPromise;
    return record && record.viewport ? clone(record.viewport) : null;
  }

  async function saveViewport(viewport) {
    if (!viewport || typeof viewport !== "object") {
      return;
    }
    var db = await openDb();
    var transaction = db.transaction([STORE_SETTINGS], "readwrite");
    transaction.objectStore(STORE_SETTINGS).put({ id: "viewport", viewport: clone(viewport) });
    await transactionToPromise(transaction);
  }

  // ---- View-specific preferences: map title, session scratch notes, tag/
  // category definitions and any other Relationship-Map-only settings ----

  async function getPreferences() {
    var db = await openDb();
    var transaction = db.transaction([STORE_SESSIONS, STORE_SETTINGS], "readonly");
    var sessionsPromise = requestToPromise(transaction.objectStore(STORE_SESSIONS).get("current"));
    var settingsPromise = requestToPromise(transaction.objectStore(STORE_SETTINGS).get("app"));
    var extraPromise = requestToPromise(transaction.objectStore(STORE_SETTINGS).get("extra"));
    await transactionToPromise(transaction);

    var storedSession = await sessionsPromise;
    var storedSettings = await settingsPromise;
    var storedExtra = await extraPromise;

    var preferences = {};
    if (storedExtra && storedExtra.data && typeof storedExtra.data === "object") {
      preferences = clone(storedExtra.data);
    }
    if (storedSession) {
      if (storedSession.session !== undefined) {
        preferences.session = storedSession.session;
      }
      preferences.notes = clone(storedSession.notes || []);
    }
    if (storedSettings) {
      if (storedSettings.title !== undefined) {
        preferences.title = storedSettings.title;
      }
      preferences.relationshipCategories = clone(storedSettings.relationshipCategories || []);
      preferences.tagGroups = clone(storedSettings.tagGroups || []);
    }
    return preferences;
  }

  async function savePreferences(preferences) {
    var source = preferences && typeof preferences === "object" ? preferences : {};
    var db = await openDb();
    var transaction = db.transaction([STORE_SESSIONS, STORE_SETTINGS], "readwrite");

    var sessionsStore = transaction.objectStore(STORE_SESSIONS);
    var settingsStore = transaction.objectStore(STORE_SETTINGS);

    sessionsStore.put({
      id: "current",
      session: source.session,
      notes: clone(source.notes || [])
    });

    settingsStore.put({
      id: "app",
      title: source.title,
      relationshipCategories: clone(source.relationshipCategories || []),
      tagGroups: clone(source.tagGroups || [])
    });

    var extra = {};
    Object.keys(source).forEach(function (key) {
      if (["title", "session", "notes", "relationshipCategories", "tagGroups"].indexOf(key) >= 0) {
        return;
      }
      extra[key] = clone(source[key]);
    });
    settingsStore.put({ id: "extra", data: extra });

    await transactionToPromise(transaction);
  }

  async function clearSessionScratch() {
    var db = await openDb();
    var transaction = db.transaction([STORE_SESSIONS], "readwrite");
    transaction.objectStore(STORE_SESSIONS).clear();
    await transactionToPromise(transaction);
  }

  // MapLayoutService owns only Relationship Map view state: node positions,
  // zone assignments, viewport, hidden/visible flags and view-specific
  // preferences. It must never store character metadata or relationship
  // details -- those belong to CharacterService and RelationshipService.
  window.MapLayoutService = {
    getNodeLayouts: getNodeLayouts,
    saveNodeLayouts: saveNodeLayouts,
    clearNodeLayouts: clearNodeLayouts,
    deleteNodeLayout: deleteNodeLayout,
    getZones: getZones,
    saveZones: saveZones,
    getViewport: getViewport,
    saveViewport: saveViewport,
    getPreferences: getPreferences,
    savePreferences: savePreferences,
    clearSessionScratch: clearSessionScratch
  };
})();
