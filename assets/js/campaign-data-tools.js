(function () {
  if (window.ChronicleCampaignDataTools) {
    return;
  }

  var EXPORT_FORMAT_VERSION = 1;

  function characterService() {
    return window.CharacterService || null;
  }

  function relationshipService() {
    return window.RelationshipService || null;
  }

  function mapLayoutService() {
    return window.MapLayoutService || null;
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

  function canonicalOpener(dbName) {
    if (dbName === "CampaignAtlas" && window.CampaignAtlasCharactersShared && window.CampaignAtlasCharactersShared.openCampaignAtlasDb) {
      return window.CampaignAtlasCharactersShared.openCampaignAtlasDb;
    }
    if (dbName === "ChronicleSessionJournal" && window.ChronicleSessionJournal && window.ChronicleSessionJournal.openSessionJournalDb) {
      return window.ChronicleSessionJournal.openSessionJournalDb;
    }
    if (dbName === "ChronicleNotebook" && window.ChronicleNotebook && window.ChronicleNotebook.openNotebookDb) {
      return window.ChronicleNotebook.openNotebookDb;
    }
    return null;
  }

  function openDb(name) {
    var canonical = canonicalOpener(name);
    if (canonical) {
      return canonical();
    }
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      var request = window.indexedDB.open(name);
      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () { db.close(); };
        resolve(db);
      };
      request.onerror = function () { reject(request.error || new Error("Unable to open " + name + " IndexedDB.")); };
    });
  }

  async function clearStores(dbName, storeNames) {
    var db = await openDb(dbName);
    try {
      var existing = storeNames.filter(function (name) { return db.objectStoreNames.contains(name); });
      if (!existing.length) {
        return;
      }
      var transaction = db.transaction(existing, "readwrite");
      existing.forEach(function (name) {
        transaction.objectStore(name).clear();
      });
      await transactionToPromise(transaction);
    } finally {
      db.close();
    }
  }

  async function readAllFromStore(dbName, storeName) {
    var db = await openDb(dbName);
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return [];
      }
      var transaction = db.transaction([storeName], "readonly");
      var recordsPromise = requestToPromise(transaction.objectStore(storeName).getAll());
      await transactionToPromise(transaction);
      return (await recordsPromise) || [];
    } finally {
      db.close();
    }
  }

  async function getFromStore(dbName, storeName, key) {
    var db = await openDb(dbName);
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return null;
      }
      var transaction = db.transaction([storeName], "readonly");
      var recordPromise = requestToPromise(transaction.objectStore(storeName).get(key));
      await transactionToPromise(transaction);
      return (await recordPromise) || null;
    } finally {
      db.close();
    }
  }

  async function putRecordsToStore(dbName, storeName, records) {
    if (!Array.isArray(records) || !records.length) {
      return;
    }
    var db = await openDb(dbName);
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return;
      }
      var transaction = db.transaction([storeName], "readwrite");
      var store = transaction.objectStore(storeName);
      records.forEach(function (record) {
        if (record && typeof record === "object") {
          store.put(record);
        }
      });
      await transactionToPromise(transaction);
    } finally {
      db.close();
    }
  }

  async function putRecordToStore(dbName, storeName, record) {
    if (!record || typeof record !== "object") {
      return;
    }
    var db = await openDb(dbName);
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return;
      }
      var transaction = db.transaction([storeName], "readwrite");
      transaction.objectStore(storeName).put(record);
      await transactionToPromise(transaction);
    } finally {
      db.close();
    }
  }

  function broadcast(channelName, message) {
    if (typeof window.BroadcastChannel !== "function") {
      return;
    }
    try {
      var channel = new window.BroadcastChannel(channelName);
      channel.postMessage(message);
      channel.close();
    } catch (_error) {
      // Cross-tab notification is best effort only.
    }
  }

  function notifyCharactersChanged(characters, relationships) {
    broadcast("campaign-atlas-characters", {
      type: "characters-snapshot",
      source: "dev-tools",
      characters: characters || [],
      relationships: relationships || []
    });
  }

  function notifyCharactersCleared() {
    notifyCharactersChanged([], []);
  }

  async function notifyTimelineCleared() {
    var characters = characterService();
    var relationships = relationshipService();
    if (!characters) {
      return;
    }
    try {
      var characterRecords = await characters.getAll();
      var relationshipRecords = relationships ? await relationships.getAll() : [];
      notifyCharactersChanged(characterRecords, relationshipRecords);
    } catch (_error) {
      // Live refresh is best effort; the next page load will still be correct.
    }
  }

  function notifyLocationsChanged(reason) {
    var shared = window.CampaignAtlasCharactersShared;
    if (shared && typeof shared.notifyLocationRecordsChanged === "function") {
      shared.notifyLocationRecordsChanged(reason || "updated");
      return;
    }
    var payload = { reason: reason || "updated", timestamp: Date.now() };
    broadcast("campaign-atlas-locations", payload);
    try {
      window.dispatchEvent(new CustomEvent("campaign-atlas:locations-updated", { detail: payload }));
    } catch (_error) {
      // Best effort.
    }
  }

  async function clearRelationshipMapData() {
    var characters = characterService();
    var relationships = relationshipService();
    var mapLayout = mapLayoutService();
    if (characters) {
      await characters.clearAll();
    }
    if (relationships) {
      await relationships.clearAll();
    }
    if (mapLayout) {
      await mapLayout.saveZones([]);
    }
    notifyCharactersCleared();
  }

  async function clearTimelineData() {
    var characters = characterService();
    if (characters) {
      await characters.clearAllTimelines();
    }
    await notifyTimelineCleared();
  }

  async function clearLocationsData() {
    await clearStores("CampaignAtlas", ["locations"]);
    notifyLocationsChanged("clear");
  }

  async function clearSessionsData() {
    await clearStores("ChronicleSessionJournal", ["sessionMetadata", "sessionBodies"]);
  }

  async function clearGmNotesData() {
    await clearStores("ChronicleNotebook", ["folders", "noteMetadata", "noteBodies", "notes"]);
  }

  async function clearAllCampaignData() {
    // "settings" intentionally excluded so application/workspace preferences survive.
    var characters = characterService();
    var relationships = relationshipService();
    var mapLayout = mapLayoutService();
    if (characters) {
      await characters.clearAll();
    }
    if (relationships) {
      await relationships.clearAll();
    }
    if (mapLayout) {
      await mapLayout.saveZones([]);
      await mapLayout.clearSessionScratch();
    }
    await clearStores("CampaignAtlas", ["locations"]);
    await clearStores("ChronicleSessionJournal", ["sessionMetadata", "sessionBodies"]);
    await clearStores("ChronicleNotebook", ["folders", "noteMetadata", "noteBodies", "notes"]);
    notifyCharactersCleared();
    notifyLocationsChanged("clear");
  }

  // ---- Export / Import ----

  async function exportCampaignData() {
    var shared = window.CampaignAtlasCharactersShared;
    var characters = characterService();
    var relationships = relationshipService();
    var mapLayout = mapLayoutService();

    var characterRecords = characters ? await characters.getAll() : [];
    var relationshipRecords = relationships ? await relationships.getAll() : [];
    var locationRecords = shared && shared.readLocationRecords ? await shared.readLocationRecords() : [];
    var zones = mapLayout ? await mapLayout.getZones() : [];

    var rmSession = await getFromStore("CampaignAtlas", "sessions", "current");
    var rmSettings = await getFromStore("CampaignAtlas", "settings", "app");
    var rmExtra = await getFromStore("CampaignAtlas", "settings", "extra");

    var sessionMetadata = await readAllFromStore("ChronicleSessionJournal", "sessionMetadata");
    var sessionBodies = await readAllFromStore("ChronicleSessionJournal", "sessionBodies");

    var folders = await readAllFromStore("ChronicleNotebook", "folders");
    var noteMetadata = await readAllFromStore("ChronicleNotebook", "noteMetadata");
    var noteBodies = await readAllFromStore("ChronicleNotebook", "noteBodies");

    return {
      app: "Chronicle Codex",
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      campaignAtlas: {
        characters: characterRecords || [],
        relationships: relationshipRecords || [],
        locations: locationRecords || [],
        zones: zones || [],
        session: rmSession || null,
        settings: rmSettings || null,
        settingsExtra: rmExtra || null
      },
      sessionJournal: {
        sessionMetadata: sessionMetadata || [],
        sessionBodies: sessionBodies || []
      },
      gmNotebook: {
        folders: folders || [],
        noteMetadata: noteMetadata || [],
        noteBodies: noteBodies || []
      }
    };
  }

  function slugify(value) {
    var text = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return text || "chronicle-codex-campaign";
  }

  function campaignExportFileName(payload) {
    var title = payload && payload.campaignAtlas && payload.campaignAtlas.settings && payload.campaignAtlas.settings.title;
    var datePart = new Date().toISOString().slice(0, 10);
    return slugify(title) + "-" + datePart + ".json";
  }

  async function exportCampaignToFile() {
    var payload = await exportCampaignData();
    var fileName = campaignExportFileName(payload);
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    try {
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      URL.revokeObjectURL(url);
    }
    return fileName;
  }

  function parseCampaignFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var payload;
        try {
          payload = JSON.parse(String(reader.result || ""));
        } catch (_error) {
          reject(new Error("This file is not valid JSON."));
          return;
        }
        try {
          validateCampaignExport(payload);
        } catch (validationError) {
          reject(validationError);
          return;
        }
        resolve(payload);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Unable to read the selected file."));
      };
      reader.readAsText(file);
    });
  }

  function validateCampaignExport(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("This file is not a valid Chronicle Codex campaign export.");
    }
    if (!payload.campaignAtlas || typeof payload.campaignAtlas !== "object") {
      throw new Error("This file is missing campaign data and cannot be imported.");
    }
    if (!Array.isArray(payload.campaignAtlas.characters) || !Array.isArray(payload.campaignAtlas.relationships)) {
      throw new Error("This file does not look like a Chronicle Codex campaign export.");
    }
    return true;
  }

  async function importCampaignData(payload) {
    validateCampaignExport(payload);
    var atlas = payload.campaignAtlas || {};
    var sessionJournal = payload.sessionJournal || {};
    var gmNotebook = payload.gmNotebook || {};

    var shared = window.CampaignAtlasCharactersShared;
    var characters = characterService();
    var relationships = relationshipService();
    var mapLayout = mapLayoutService();

    // Full replace: importing restores an exact snapshot, so every covered store
    // (including CampaignAtlas "settings") is cleared before the import payload is written.
    if (characters) {
      await characters.clearAll();
    }
    if (relationships) {
      await relationships.clearAll();
    }
    await clearStores("CampaignAtlas", ["locations", "zones", "sessions", "settings"]);
    await clearStores("ChronicleSessionJournal", ["sessionMetadata", "sessionBodies"]);
    await clearStores("ChronicleNotebook", ["folders", "noteMetadata", "noteBodies", "notes"]);

    var characterRecords = Array.isArray(atlas.characters) ? atlas.characters : [];
    if (characters) {
      for (var i = 0; i < characterRecords.length; i += 1) {
        await characters.save(characterRecords[i]);
      }
    }
    if (relationships) {
      await relationships.saveAll(atlas.relationships || []);
    }
    var locations = Array.isArray(atlas.locations) ? atlas.locations : [];
    if (shared && shared.saveLocationRecord) {
      for (var j = 0; j < locations.length; j += 1) {
        await shared.saveLocationRecord(locations[j]);
      }
    }

    if (mapLayout) {
      await mapLayout.saveZones(atlas.zones || []);
    } else {
      await putRecordsToStore("CampaignAtlas", "zones", atlas.zones || []);
    }
    if (atlas.session) {
      await putRecordToStore("CampaignAtlas", "sessions", atlas.session);
    }
    if (atlas.settings) {
      await putRecordToStore("CampaignAtlas", "settings", atlas.settings);
    }
    if (atlas.settingsExtra) {
      await putRecordToStore("CampaignAtlas", "settings", atlas.settingsExtra);
    }

    await putRecordsToStore("ChronicleSessionJournal", "sessionMetadata", sessionJournal.sessionMetadata || []);
    await putRecordsToStore("ChronicleSessionJournal", "sessionBodies", sessionJournal.sessionBodies || []);

    await putRecordsToStore("ChronicleNotebook", "folders", gmNotebook.folders || []);
    await putRecordsToStore("ChronicleNotebook", "noteMetadata", gmNotebook.noteMetadata || []);
    await putRecordsToStore("ChronicleNotebook", "noteBodies", gmNotebook.noteBodies || []);

    var refreshedCharacters = characters ? await characters.getAll() : characterRecords;
    var refreshedRelationships = relationships ? await relationships.getAll() : atlas.relationships;
    notifyCharactersChanged(refreshedCharacters, refreshedRelationships);
    notifyLocationsChanged("import");
  }

  window.ChronicleCampaignDataTools = {
    clearRelationshipMapData: clearRelationshipMapData,
    clearTimelineData: clearTimelineData,
    clearLocationsData: clearLocationsData,
    clearSessionsData: clearSessionsData,
    clearGmNotesData: clearGmNotesData,
    clearAllCampaignData: clearAllCampaignData,
    exportCampaignData: exportCampaignData,
    exportCampaignToFile: exportCampaignToFile,
    parseCampaignFile: parseCampaignFile,
    validateCampaignExport: validateCampaignExport,
    importCampaignData: importCampaignData
  };
})();
