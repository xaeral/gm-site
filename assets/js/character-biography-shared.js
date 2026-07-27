(function () {
  var ReactRef = window.React;
  if (!ReactRef) {
    return;
  }

  var useEffect = ReactRef.useEffect;
  var useLayoutEffect = ReactRef.useLayoutEffect;
  var useMemo = ReactRef.useMemo;
  var useRef = ReactRef.useRef;
  var useState = ReactRef.useState;
  var html = window.htm ? window.htm.bind(ReactRef.createElement) : null;

  var DB_NAME = "CampaignAtlas";
  var DB_VERSION = 5;
  var STORE_CHARACTERS = "characters";
  var STORE_RELATIONSHIPS = "relationships";
  var STORE_LOCATIONS = "locations";
  var STORE_TIMELINE = "timeline";
  var STORE_ZONES = "zones";
  var STORE_SESSIONS = "sessions";
  var STORE_SETTINGS = "settings";
  var STORE_NODE_LAYOUT = "nodeLayout";
  var LOCATION_SYNC_CHANNEL = "campaign-atlas-locations";
  var locationSanitizePromise = null;
  var PORTRAIT_BLOB_MARKER = "__campaignAtlasPortraitBlob__";
  var DEFAULT_PORTRAIT = "Default.png";
  var PORTRAIT_EDITOR_SIZE = 320;

  // Canonical VTM V5 option lists used by the character editor's dropdowns.
  var SECT_OPTIONS = ["None", "Anarch", "Ashirra", "Camarilla", "Sabbat"];
  var CLAN_OPTIONS = [
    "None",
    "Banu Haqim",
    "Brujah",
    "Gangrel",
    "Hecata",
    "Lasombra",
    "Malkavian",
    "Ministry",
    "Nosferatu",
    "Ravnos",
    "Salubri",
    "Toreador",
    "Tremere",
    "Tzimisce",
    "Ventrue",
    "Caitiff",
    "Thin-Blood"
  ];
  var STATUS_OPTIONS = ["Unknown", "Alive", "Embraced", "In Torpor", "Missing", "Destroyed"];
  var ORIGIN_OPTIONS = ["Vampire", "Mortal", "Werewolf", "Changeling", "Mage"];
  var DEFAULT_ORIGIN = "Vampire";

  // The single source of truth for the Tag Manager's starter tags, shared
  // between relationship-map-react.js (seeds a brand-new chronicle's
  // data.tagGroups) and campaign-data-tools.js (Danger Zone's "Reset Tags
  // to Default", which is reachable from settings.html where the
  // relationship map script never loads at all) -- both read this same
  // array via
  // window.CampaignAtlasCharactersShared.DEFAULT_TAG_GROUPS so the two
  // never drift apart.
  var DEFAULT_TAG_GROUPS = [
    {
      id: "tag-group-camarilla",
      name: "The Camarilla",
      tags: [
        { id: "tag-camarilla-prince", name: "Prince", color: "#d10d40" },
        { id: "tag-camarilla-seneschal", name: "Seneschal", color: "#d10d40" },
        { id: "tag-camarilla-primogen", name: "Primogen", color: "#d10d40" },
        { id: "tag-camarilla-sheriff", name: "Sheriff", color: "#d10d40" },
        { id: "tag-camarilla-scourge", name: "Scourge", color: "#d10d40" },
        { id: "tag-camarilla-keeper-of-elysium", name: "Keeper of Elysium", color: "#d10d40" },
        { id: "tag-camarilla-harpy", name: "Harpy", color: "#d10d40" },
        { id: "tag-camarilla-justicar", name: "Justicar", color: "#d10d40" },
        { id: "tag-camarilla-archon", name: "Archon", color: "#d10d40" },
        { id: "tag-camarilla-alastor", name: "Alastor", color: "#d10d40" }
      ]
    },
    {
      id: "tag-group-anarch",
      name: "The Anarch Movement",
      tags: [
        { id: "tag-anarch-baron", name: "Baron", color: "#c97a1c" },
        { id: "tag-anarch-reeve", name: "Reeve", color: "#c97a1c" },
        { id: "tag-anarch-warlord", name: "Warlord", color: "#c97a1c" },
        { id: "tag-anarch-sweeper", name: "Sweeper", color: "#c97a1c" },
        { id: "tag-anarch-scout", name: "Scout", color: "#c97a1c" },
        { id: "tag-anarch-emissary", name: "Emissary", color: "#c97a1c" }
      ]
    },
    {
      id: "tag-group-ashirra",
      name: "The Ashirra",
      tags: [
        { id: "tag-ashirra-sultan", name: "Sultan", color: "#1c9c74" },
        { id: "tag-ashirra-malik", name: "Malik", color: "#1c9c74" },
        { id: "tag-ashirra-imam", name: "Imam", color: "#1c9c74" },
        { id: "tag-ashirra-kadai", name: "Kadai", color: "#1c9c74" },
        { id: "tag-ashirra-mufti", name: "Mufti", color: "#1c9c74" }
      ]
    },
    {
      id: "tag-group-second-inquisition",
      name: "The Second Inquisition",
      tags: [
        { id: "tag-inquisition-operational-director", name: "Operational Director", color: "#5a6472" },
        { id: "tag-inquisition-controller", name: "Controller", color: "#5a6472" },
        { id: "tag-inquisition-inquisitor", name: "Inquisitor", color: "#5a6472" },
        { id: "tag-inquisition-field-agent", name: "Field Agent", color: "#5a6472" }
      ]
    }
  ];

  function optionsWithCurrentValue(options, currentValue) {
    var value = String(currentValue || "").trim();
    if (!value || options.indexOf(value) >= 0) {
      return options;
    }
    return options.concat([value]);
  }

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
    var prefix = /\/pages\//.test(window.location.pathname) ? "../Relationship map/" : "Relationship map/";
    return prefix + encodeURIComponent(fileName);
  }

  var SECT_ICON_FILES = {
    "Anarch": "Anarch.svg",
    "Ashirra": "Ashirra.svg",
    "Camarilla": "Camarilla.svg",
    "Sabbat": "Sabbat.svg"
  };

  var CLAN_ICON_FILES = {
    "Banu Haqim": "Banu-Haqim.svg",
    "Brujah": "Brujah.svg",
    "Gangrel": "Gangrel.svg",
    "Hecata": "Hecata.svg",
    "Lasombra": "Lasombra.svg",
    "Malkavian": "Malkavian.svg",
    "Ministry": "Ministry.svg",
    "Nosferatu": "Nosferatu.svg",
    "Ravnos": "Ravnos.svg",
    "Salubri": "Salubri.svg",
    "Toreador": "Toreador.svg",
    "Tremere": "Tremere.svg",
    "Tzimisce": "Tzimisce.svg",
    "Ventrue": "Ventrue.svg",
    "Caitiff": "Caitiff.svg",
    "Thin-Blood": "Thin-blood.svg"
  };

  function buildIconLookup(filesByValue) {
    var lookup = {};
    Object.keys(filesByValue).forEach(function (key) {
      lookup[key] = imgPath(filesByValue[key]);
    });
    return lookup;
  }

  var SECT_ICON_LOOKUP = buildIconLookup(SECT_ICON_FILES);
  var CLAN_ICON_LOOKUP = buildIconLookup(CLAN_ICON_FILES);

  function resolveSectIcon(value) {
    var sect = String(value || "").trim();
    return sect && sect !== "None" ? (SECT_ICON_LOOKUP[sect] || "") : "";
  }

  function resolveClanIcon(value) {
    var clan = String(value || "").trim();
    return clan && clan !== "None" ? (CLAN_ICON_LOOKUP[clan] || "") : "";
  }

  // Circular red icon badge (existing Clan/Sect treatment reused from the
  // Relationship Map's character profile view) -- built on the shared
  // Icon() mask-image renderer, same as everywhere else Icon() is used.
  function IconBadge(config) {
    if (!config || !config.icon) {
      return null;
    }
    var size = Math.max(24, Number(config.size) || 44);
    var backgroundColor = config.backgroundColor || "#6d132a";
    var tooltip = config.tooltip || "";
    var className = "icon-badge" + (config.className ? " " + config.className : "");
    var imageClassName = "icon-badge-image" + (config.imageClassName ? " " + config.imageClassName : "");
    var badgeStyle = { width: size + "px", height: size + "px", background: backgroundColor };
    return html`<span className=${className} style=${badgeStyle} title=${tooltip} aria-label=${tooltip}>
      ${Icon({ icon: config.icon, color: config.iconColor || "#ffffff", className: imageClassName })}
    </span>`;
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

  function isLegacyZoneRecord(record) {
    if (!record || typeof record !== "object") {
      return false;
    }
    var id = String(record.id || "").trim().toLowerCase();
    var name = String(record.name || record.title || "").trim().toLowerCase();
    if (id.indexOf("zone-") === 0 || name === "new zone") {
      return true;
    }
    return Number.isFinite(Number(record.x)) && Number.isFinite(Number(record.y)) && Number.isFinite(Number(record.width)) && Number.isFinite(Number(record.height));
  }

  function openCampaignAtlasDb() {
    return new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        var transaction = event.target.transaction;
        if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
          db.createObjectStore(STORE_CHARACTERS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_RELATIONSHIPS)) {
          db.createObjectStore(STORE_RELATIONSHIPS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_LOCATIONS)) {
          db.createObjectStore(STORE_LOCATIONS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_TIMELINE)) {
          db.createObjectStore(STORE_TIMELINE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_ZONES)) {
          db.createObjectStore(STORE_ZONES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NODE_LAYOUT)) {
          db.createObjectStore(STORE_NODE_LAYOUT, { keyPath: "id" });
        }

        if (event.oldVersion < 3 && db.objectStoreNames.contains("locations") && transaction) {
          var legacyLocationStore = transaction.objectStore("locations");
          var zoneStore = transaction.objectStore(STORE_ZONES);
          var cursorReq = legacyLocationStore.openCursor();
          cursorReq.onsuccess = function () {
            var cursor = cursorReq.result;
            if (!cursor) {
              return;
            }
            var record = cursor.value;
            if (isLegacyZoneRecord(record)) {
              zoneStore.put(clone(record));
              legacyLocationStore.delete(cursor.primaryKey);
            }
            cursor.continue();
          };
        }
      };
      request.onsuccess = function () {
        var db = request.result;
        db.onversionchange = function () { db.close(); };
        resolve(db);
      };
      request.onerror = function () { reject(request.error || new Error("Unable to open CampaignAtlas IndexedDB.")); };
    });
  }

  // Upgrades every `.bio-checklist > li` inside `root` to the interactive
  // checkbox shape (a real, focusable `.bio-checklist-box` child + a
  // `.bio-checklist-text` wrapper around the item's existing content) if it
  // doesn't already have one. Idempotent and safe to call on every render --
  // items already in the new shape are left untouched -- so checklist items
  // saved before this feature existed (plain `<li>text</li>`) upgrade
  // transparently the moment they're displayed, with no data migration
  // step required. `data-checked` defaults to "false" (unchecked) for any
  // li that doesn't already carry it, which is exactly what old items lack.
  function normalizeChecklistItems(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }
    var items = root.querySelectorAll(".bio-checklist > li");
    for (var i = 0; i < items.length; i += 1) {
      var li = items[i];
      if (li.querySelector(".bio-checklist-box")) {
        continue;
      }
      var checked = li.getAttribute("data-checked") === "true";
      var textSpan = document.createElement("span");
      textSpan.className = "bio-checklist-text";
      while (li.firstChild) {
        textSpan.appendChild(li.firstChild);
      }
      var box = document.createElement("span");
      box.className = "bio-checklist-box";
      box.setAttribute("contenteditable", "false");
      box.setAttribute("role", "checkbox");
      box.setAttribute("tabindex", "0");
      box.setAttribute("aria-checked", checked ? "true" : "false");
      li.setAttribute("data-checked", checked ? "true" : "false");
      li.appendChild(box);
      li.appendChild(textSpan);
    }
  }

  // String-in-string-out wrapper around normalizeChecklistItems for the
  // read-only viewer path, which renders via dangerouslySetInnerHTML rather
  // than a live DOM node -- builds a detached container, normalizes it, and
  // serializes the result back out. Skipped entirely (common case) when the
  // content has no checklist at all.
  function normalizeChecklistHtmlString(htmlString) {
    if (!htmlString || htmlString.indexOf("bio-checklist") === -1) {
      return htmlString;
    }
    var container = document.createElement("div");
    container.innerHTML = htmlString;
    normalizeChecklistItems(container);
    return container.innerHTML;
  }

  // Flips a single checklist item's checked state in place (DOM mutation
  // only -- callers are responsible for propagating the change via
  // onChange/syncEditorToChange). No-op if `li` isn't actually a checklist
  // item, so callers can pass the result of a loose `closest()` lookup
  // without extra guards.
  function toggleChecklistItem(li) {
    if (!li || !li.classList || !li.classList.contains) {
      return;
    }
    var box = li.querySelector(".bio-checklist-box");
    if (!box) {
      return;
    }
    var nextChecked = li.getAttribute("data-checked") !== "true";
    li.setAttribute("data-checked", nextChecked ? "true" : "false");
    box.setAttribute("aria-checked", nextChecked ? "true" : "false");
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

  function previewFromHtml(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }

  function normalizeLocationRecord(location) {
    var source = location && typeof location === "object" ? location : {};
    var tags = Array.isArray(source.tags) ? source.tags.map(function (tag) { return String(tag || "").trim(); }).filter(Boolean) : [];
    var images = Array.isArray(source.images) ? clone(source.images) : [];
    var floorPlans = Array.isArray(source.floorPlans) ? clone(source.floorPlans) : [];
    var handouts = Array.isArray(source.handouts) ? clone(source.handouts) : [];
    var travelRoutes = Array.isArray(source.travelRoutes) ? clone(source.travelRoutes) : [];
    var encounterNotes = Array.isArray(source.encounterNotes) ? clone(source.encounterNotes) : [];
    var relatedCharacterIds = Array.isArray(source.relatedCharacterIds) ? source.relatedCharacterIds.map(String) : [];
    // Multi-owner support: ownerIds is the source of truth. A record saved
    // before this existed only has the legacy singular `ownerId` -- migrate
    // it into a one-item ownerIds array the first time the record is
    // normalized (read OR write), so old data keeps working with no
    // separate migration step required. The legacy ownerId/ownerName
    // fields are kept (derived from ownerIds) only for any code that might
    // still read them directly; nothing in this app writes them anymore.
    var ownerIdsSource = Array.isArray(source.ownerIds)
      ? source.ownerIds
      : (source.ownerId ? [source.ownerId] : []);
    var seenOwnerIds = {};
    var ownerIds = ownerIdsSource.map(function (ownerId) { return String(ownerId || "").trim(); }).filter(function (ownerId) {
      if (!ownerId || seenOwnerIds[ownerId]) {
        return false;
      }
      seenOwnerIds[ownerId] = true;
      return true;
    });
    var now = new Date().toISOString();
    return {
      id: String(source.id || source.name || "location-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
      name: String(source.name || source.title || "Unnamed Location"),
      type: String(source.type || "Notable Place"),
      ownerIds: ownerIds,
      ownerId: ownerIds[0] || "",
      ownerName: String(source.ownerName || ""),
      description: String(source.description || source.details || ""),
      detailsHtml: String(source.detailsHtml || source.descriptionHtml || source.details || source.description || "<p></p>"),
      tags: tags,
      images: images,
      floorPlans: floorPlans,
      handouts: handouts,
      travelRoutes: travelRoutes,
      encounterNotes: encounterNotes,
      relatedCharacterIds: relatedCharacterIds,
      locationLinks: Array.isArray(source.locationLinks) ? clone(source.locationLinks) : [],
      mapLinks: Array.isArray(source.mapLinks) ? clone(source.mapLinks) : [],
      color: String(source.color || ""),
      borderColor: String(source.borderColor || ""),
      opacity: source.opacity,
      borderThickness: source.borderThickness,
      borderStyle: String(source.borderStyle || ""),
      lock: Boolean(source.lock),
      layer: Number.isFinite(Number(source.layer)) ? Number(source.layer) : 0,
      previewText: previewFromHtml(source.detailsHtml || source.description || ""),
      searchText: [
        String(source.name || ""),
        String(source.type || ""),
        String(source.ownerName || ""),
        ownerIds.join(" "),
        String(source.description || ""),
        String(source.detailsHtml || ""),
        tags.join(" "),
        relatedCharacterIds.join(" ")
      ].join(" ").toLowerCase(),
      createdAt: String(source.createdAt || now),
      updatedAt: String(source.updatedAt || now)
    };
  }

  function locationHasZoneGeometry(record) {
    if (!record || typeof record !== "object") {
      return false;
    }
    return Number.isFinite(Number(record.x)) && Number.isFinite(Number(record.y)) && Number.isFinite(Number(record.width)) && Number.isFinite(Number(record.height));
  }

  function isInvalidLocationRecord(record) {
    if (!record || typeof record !== "object") {
      return true;
    }
    var id = String(record.id || "").trim().toLowerCase();
    var name = String(record.name || record.title || "").trim().toLowerCase();
    if (!id) {
      return true;
    }
    if (id.indexOf("zone-") === 0) {
      return true;
    }
    if (id.indexOf("location-seed-") === 0) {
      return true;
    }
    if (name === "new zone") {
      return true;
    }
    if (locationHasZoneGeometry(record)) {
      return true;
    }
    return false;
  }

  async function sanitizeLocationStore(options) {
    var force = Boolean(options && options.force);
    if (!force && locationSanitizePromise) {
      return locationSanitizePromise;
    }
    locationSanitizePromise = (async function () {
      var db = await openCampaignAtlasDb();
      var transaction = db.transaction([STORE_LOCATIONS], "readwrite");
      var store = transaction.objectStore(STORE_LOCATIONS);
      var allReq = store.getAll();
      var allPromise = requestToPromise(allReq);
      var allRecords = await allPromise;
      (allRecords || []).forEach(function (record) {
        if (isInvalidLocationRecord(record)) {
          store.delete(String(record.id || ""));
        }
      });
      await transactionToPromise(transaction);
    })().catch(function () {
      locationSanitizePromise = null;
    });
    return locationSanitizePromise;
  }

  function notifyLocationRecordsChanged(reason) {
    var payload = { reason: String(reason || "updated"), timestamp: Date.now() };
    try {
      if (typeof window.BroadcastChannel === "function") {
        var channel = new window.BroadcastChannel(LOCATION_SYNC_CHANNEL);
        channel.postMessage(payload);
        channel.close();
      }
    } catch (_error) {
      // BroadcastChannel is optional.
    }
    try {
      window.dispatchEvent(new CustomEvent("campaign-atlas:locations-updated", { detail: payload }));
    } catch (_error2) {
      // Event dispatch best effort.
    }
  }

  function subscribeLocationRecordChanges(listener) {
    if (typeof listener !== "function") {
      return function () {};
    }
    var channel = null;
    var onWindowEvent = function () { listener(); };
    window.addEventListener("campaign-atlas:locations-updated", onWindowEvent);
    try {
      if (typeof window.BroadcastChannel === "function") {
        channel = new window.BroadcastChannel(LOCATION_SYNC_CHANNEL);
        channel.onmessage = function () { listener(); };
      }
    } catch (_error) {
      channel = null;
    }
    return function () {
      window.removeEventListener("campaign-atlas:locations-updated", onWindowEvent);
      if (channel) {
        channel.close();
      }
    };
  }

  async function readCampaignAtlasState() {
    await sanitizeLocationStore();
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_CHARACTERS, STORE_RELATIONSHIPS, STORE_LOCATIONS, STORE_TIMELINE], "readonly");
    var charactersReq = transaction.objectStore(STORE_CHARACTERS).getAll();
    var relationshipsReq = transaction.objectStore(STORE_RELATIONSHIPS).getAll();
    var locationsReq = transaction.objectStore(STORE_LOCATIONS).getAll();
    var timelineReq = transaction.objectStore(STORE_TIMELINE).getAll();

    var charactersPromise = requestToPromise(charactersReq);
    var relationshipsPromise = requestToPromise(relationshipsReq);
    var locationsPromise = requestToPromise(locationsReq);
    var timelinePromise = requestToPromise(timelineReq);

    await transactionToPromise(transaction);

    var charactersRaw = await charactersPromise;
    var relationships = await relationshipsPromise;
    var locations = await locationsPromise;
    var timelineEntries = await timelinePromise;

    var characters = await Promise.all((charactersRaw || []).map(deserializeCharacterFromStorage));

    return {
      characters: applyCharacterTimeline(characters || [], timelineEntries || []),
      relationships: clone(relationships || []),
      locations: (locations || []).map(normalizeLocationRecord)
    };
  }

  async function readLocationRecords() {
    await sanitizeLocationStore();
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_LOCATIONS], "readonly");
    var locationsReq = transaction.objectStore(STORE_LOCATIONS).getAll();
    var locationsPromise = requestToPromise(locationsReq);
    await transactionToPromise(transaction);
    return (await locationsPromise || []).map(normalizeLocationRecord);
  }

  async function readLocationRecordById(locationId) {
    if (!locationId) {
      return null;
    }
    await sanitizeLocationStore();
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_LOCATIONS], "readonly");
    var locationReq = transaction.objectStore(STORE_LOCATIONS).get(String(locationId));
    var locationPromise = requestToPromise(locationReq);
    await transactionToPromise(transaction);
    var location = await locationPromise;
    return location ? normalizeLocationRecord(location) : null;
  }

  async function saveLocationRecord(location) {
    if (!location || !location.id) {
      return;
    }
    await sanitizeLocationStore();
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_LOCATIONS], "readwrite");
    var store = transaction.objectStore(STORE_LOCATIONS);
    var existingPromise = requestToPromise(store.get(location.id));
    var existing = await existingPromise;
    var merged = Object.assign({}, clone(existing || {}), clone(location || {}));
    var normalized = normalizeLocationRecord(merged);
    if (isInvalidLocationRecord(normalized)) {
      return null;
    }
    normalized.updatedAt = new Date().toISOString();
    if (!normalized.createdAt) {
      normalized.createdAt = normalized.updatedAt;
    }
    store.put(normalized);
    await transactionToPromise(transaction);
    notifyLocationRecordsChanged("save");
    return normalized;
  }

  async function deleteLocationRecord(locationId) {
    if (!locationId) {
      return;
    }
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_LOCATIONS], "readwrite");
    transaction.objectStore(STORE_LOCATIONS).delete(String(locationId));
    await transactionToPromise(transaction);
    notifyLocationRecordsChanged("delete");
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

    var savedNow = new Date().toISOString();
    nextCharacter.updatedAt = savedNow;
    if (!nextCharacter.createdAt) {
      nextCharacter.createdAt = (existingCharacter && existingCharacter.createdAt) || savedNow;
    }

    characterStore.put(nextCharacter);
    timelineStore.put({ id: nextCharacter.id, events: timelineEvents });

    await transactionToPromise(transaction);
  }

  async function deleteCharacterFromCampaignAtlas(characterId) {
    if (!characterId) {
      return;
    }
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_CHARACTERS, STORE_TIMELINE], "readwrite");
    transaction.objectStore(STORE_CHARACTERS).delete(String(characterId));
    transaction.objectStore(STORE_TIMELINE).delete(String(characterId));
    await transactionToPromise(transaction);
  }

  async function clearAllCharacters() {
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_CHARACTERS, STORE_TIMELINE], "readwrite");
    transaction.objectStore(STORE_CHARACTERS).clear();
    transaction.objectStore(STORE_TIMELINE).clear();
    await transactionToPromise(transaction);
  }

  async function clearAllCharacterTimelines() {
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_TIMELINE], "readwrite");
    transaction.objectStore(STORE_TIMELINE).clear();
    await transactionToPromise(transaction);
  }

  async function saveRelationships(relationships) {
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_RELATIONSHIPS], "readwrite");
    var store = transaction.objectStore(STORE_RELATIONSHIPS);
    var existingPromise = requestToPromise(store.getAll());
    var existing = await existingPromise;
    var existingById = {};
    (existing || []).forEach(function (item) {
      if (item && item.id) {
        existingById[item.id] = item;
      }
    });
    var now = new Date().toISOString();

    store.clear();
    (Array.isArray(relationships) ? relationships : []).forEach(function (relationship) {
      if (!relationship || !relationship.id) {
        return;
      }
      var next = clone(relationship);
      var prior = existingById[relationship.id];
      var isUnchanged = prior && JSON.stringify(Object.assign({}, prior, { updatedAt: undefined, createdAt: undefined })) === JSON.stringify(Object.assign({}, next, { updatedAt: undefined, createdAt: undefined }));
      next.createdAt = (prior && prior.createdAt) || next.createdAt || now;
      next.updatedAt = isUnchanged ? ((prior && prior.updatedAt) || now) : now;
      store.put(next);
    });
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
    // Fired (in addition to onChange) specifically when a checklist checkbox
    // is toggled, with the fully updated HTML. onChange alone only ever
    // reaches a page's local draft state, which on every page that hosts
    // this editor requires a separate explicit Save to actually persist --
    // checklist toggles are meant to save immediately, the same way a Pin
    // toggle does, regardless of whether the page is even in edit mode.
    // Consumers that want that behaviour pass onChecklistToggle to write the
    // change straight to storage; it's optional so existing callers that
    // don't need immediate persistence are unaffected.
    var onChecklistToggle = typeof settings.onChecklistToggle === "function" ? settings.onChecklistToggle : null;

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
      normalizeChecklistItems(editor);
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
      // Native contentEditable list-splitting (pressing Enter inside a
      // checklist item) or pasting can produce a plain `<li>` without the
      // interactive box -- catch that here so it upgrades on the very next
      // input event rather than staying inert until the page reloads.
      normalizeChecklistItems(editor);
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
      var item = '<li data-checked="false"><span class="bio-checklist-box" contenteditable="false" role="checkbox" tabindex="0" aria-checked="false"></span><span class="bio-checklist-text">Checklist item</span></li>';
      insertHtml('<ul class="bio-checklist">' + item + item + '</ul>');
    }

    // Shared by both the read-only viewer and the contentEditable editor:
    // finds the checklist box (if any) a click/keydown landed on, flips its
    // li's data-checked in place, and returns the li so the caller can
    // propagate the change (each render path has its own way to do that).
    function findChecklistBoxTarget(eventTarget) {
      if (!eventTarget || typeof eventTarget.closest !== "function") {
        return null;
      }
      var box = eventTarget.closest(".bio-checklist-box");
      return box ? box.closest("li") : null;
    }

    function isSpaceKey(event) {
      return event.key === " " || event.key === "Spacebar" || event.code === "Space";
    }

    function emitChecklistChange(nextHtml) {
      onChange(nextHtml);
      if (onChecklistToggle) {
        onChecklistToggle(nextHtml);
      }
    }

    if (!editable) {
      return ReactRef.createElement("div", {
        className: viewerClassName,
        onClick: function (event) {
          var li = findChecklistBoxTarget(event.target);
          if (!li) {
            return;
          }
          toggleChecklistItem(li);
          emitChecklistChange(event.currentTarget.innerHTML);
        },
        onKeyDown: function (event) {
          if (!isSpaceKey(event)) {
            return;
          }
          var li = findChecklistBoxTarget(event.target);
          if (!li) {
            return;
          }
          event.preventDefault();
          toggleChecklistItem(li);
          emitChecklistChange(event.currentTarget.innerHTML);
        },
        dangerouslySetInnerHTML: { __html: normalizeChecklistHtmlString(characterBiographyHtml({ bioHtml: htmlValue })) }
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
          createBiographyToolbarButton({ key: "callout", className: "toolbar-icon-callout", title: "Callout block", label: Icon({ icon: "../assets/Icons/callout.svg", size: 15 }), active: toolbarState.callout, onClick: function () { runCommand("formatBlock", "<blockquote>"); } }),
          createBiographyToolbarButton({ key: "rule", className: "toolbar-icon-rule", title: "Horizontal rule", label: "―", active: false, onClick: function () { runCommand("insertHorizontalRule"); } })
        ),
        ReactRef.createElement("div", { className: "rich-toolbar-divider", "aria-hidden": "true" }),
        ReactRef.createElement("div", { className: "rich-toolbar-group" },
          createBiographyToolbarButton({ key: "spoiler", className: "toolbar-icon-spoiler", title: "Insert spoiler block", label: Icon({ icon: "../assets/Icons/spoiler.svg", size: 16 }), active: false, onClick: insertSpoiler }),
          createBiographyToolbarButton({ key: "image", className: "toolbar-icon-image", title: "Insert image", label: Icon({ icon: "../assets/Icons/image.svg", size: 16 }), active: false, onClick: insertImage }),
          createBiographyToolbarButton({ key: "table", className: "toolbar-icon-table", title: "Insert table", label: Icon({ icon: "../assets/Icons/table.svg", size: 16 }), active: false, onClick: insertTable }),
          createBiographyToolbarButton({ key: "checklist", className: "toolbar-icon-checklist", title: "Insert checklist", label: Icon({ icon: "../assets/Icons/checklist.svg", size: 16 }), active: false, onClick: insertChecklist })
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
          if (isSpaceKey(event)) {
            var li = findChecklistBoxTarget(event.target);
            if (li) {
              event.preventDefault();
              toggleChecklistItem(li);
              syncEditorToChange();
              if (onChecklistToggle && editorRef.current) {
                onChecklistToggle(editorRef.current.innerHTML);
              }
              return;
            }
          }
          onEditorKeyDown(event, editorRef.current);
        },
        onMouseDown: function (event) {
          var li = findChecklistBoxTarget(event.target);
          if (!li) {
            return;
          }
          // preventDefault keeps contentEditable from placing the text
          // caret at the click point (the default mousedown behaviour) --
          // the checkbox toggles as an atomic action, never engaging text
          // editing. Focusing it manually afterward (rather than relying on
          // the now-prevented default focus behaviour) keeps Space working
          // immediately after a mouse click.
          event.preventDefault();
          toggleChecklistItem(li);
          syncEditorToChange();
          if (onChecklistToggle && editorRef.current) {
            onChecklistToggle(editorRef.current.innerHTML);
          }
          var box = li.querySelector(".bio-checklist-box");
          if (box) {
            box.focus();
          }
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

  // Historically "Date of Death" stored what is now "Date of Embrace" --
  // resolves the effective birth/embrace/death dates for any consumer that
  // just needs to DISPLAY them correctly, whether or not the character has
  // already been through the one-time migration (which additionally clears
  // the old field and persists `dateFieldsMigrated` -- see
  // normalizeCharacterForProfile). Safe to call repeatedly since it never
  // mutates its input.
  function resolveCharacterLifecycleDates(character) {
    var source = character && typeof character === "object" ? character : {};
    var dateOfBirth = normalizeIsoDate(source.dateOfBirth);
    if (source.dateFieldsMigrated) {
      return {
        dateOfBirth: dateOfBirth,
        dateOfEmbrace: normalizeIsoDate(source.dateOfEmbrace),
        dateOfDeath: normalizeIsoDate(source.dateOfDeath)
      };
    }
    return {
      dateOfBirth: dateOfBirth,
      dateOfEmbrace: normalizeIsoDate(source.dateOfEmbrace) || normalizeIsoDate(source.dateOfDeath),
      dateOfDeath: ""
    };
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
    var normalized = {
      date: normalizeIsoDate(input.date),
      title: String(input.title || ""),
      description: String(input.description || ""),
      gmNotes: String(input.gmNotes || "")
    };
    // This page's own timeline UI only reads/writes the fields above, but
    // events may also carry fields owned by the Timeline Chronicle page
    // (id, characterIds, storyArc, ...) -- preserve them losslessly on
    // round-trip instead of silently dropping them on every character save.
    if (input.id !== undefined) {
      normalized.id = input.id;
    }
    if (Array.isArray(input.characterIds)) {
      normalized.characterIds = input.characterIds.slice();
    }
    if (input.storyArc !== undefined) {
      normalized.storyArc = input.storyArc;
    }
    if (input.relatedSession !== undefined) {
      normalized.relatedSession = input.relatedSession;
    }
    if (input.location !== undefined) {
      normalized.location = input.location;
    }
    if (input.locationId !== undefined) {
      normalized.locationId = input.locationId;
    }
    if (Array.isArray(input.tags)) {
      normalized.tags = input.tags.slice();
    }
    if (input.extraMeta && typeof input.extraMeta === "object") {
      normalized.extraMeta = Object.assign({}, input.extraMeta);
    }
    if (input.createdAt !== undefined) {
      normalized.createdAt = input.createdAt;
    }
    if (input.eventType !== undefined) {
      normalized.eventType = input.eventType;
    }
    return normalized;
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

  function timelineEventsForDisplay(events, dateOfBirth, dateOfEmbrace, dateOfDeath) {
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
      { id: "birth", title: "Born", date: normalizeIsoDate(dateOfBirth), priority: 0 },
      { id: "embrace", title: "Embraced", date: normalizeIsoDate(dateOfEmbrace), priority: 1 },
      { id: "death", title: "Died", date: normalizeIsoDate(dateOfDeath), priority: 3 }
    ].forEach(function (systemEvent, systemIndex) {
      if (!systemEvent.date || manualTitles[systemEvent.title.toLowerCase()]) {
        return;
      }
      merged.push({
        sourceIndex: "system-" + systemEvent.id,
        event: { date: systemEvent.date, title: systemEvent.title, description: "", gmNotes: "" },
        isSystem: true,
        sequence: (events || []).length + systemIndex,
        sortPriority: systemEvent.priority,
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
    var lifecycleDates = resolveCharacterLifecycleDates(source);
    source.dateOfBirth = lifecycleDates.dateOfBirth;
    source.dateOfEmbrace = lifecycleDates.dateOfEmbrace;
    source.dateOfDeath = lifecycleDates.dateOfDeath;
    source.dateFieldsMigrated = true;
    source.origin = ORIGIN_OPTIONS.indexOf(source.origin) !== -1 ? source.origin : DEFAULT_ORIGIN;
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

  // Searchable multi-select tag input, replacing the old comma-separated
  // free-text field. `props.tags` stays exactly what it always was --
  // draft.tags, a plain array of tag name strings -- so nothing about how
  // a character's assigned tags are stored or read elsewhere changes; only
  // the widget used to edit that array changes. Tag DEFINITIONS (name,
  // colour, id) come from data.tagGroups, read and written directly via
  // MapLayoutService.getPreferences()/savePreferences() -- the exact same
  // path the Relationship Map's Tag Manager and the Danger Zone's Reset
  // Tags action already use -- so a tag created from this field shows up
  // in the Tag Manager immediately, and vice versa.
  function TagPickerField(props) {
    var assignedNames = Array.isArray(props.tags) ? props.tags : [];
    var onChange = typeof props.onChange === "function" ? props.onChange : function () {};
    var inputId = props.inputId || null;

    var _allTags = useState([]);
    var allTags = _allTags[0];
    var setAllTags = _allTags[1];

    var _query = useState("");
    var query = _query[0];
    var setQuery = _query[1];

    var _isOpen = useState(false);
    var isOpen = _isOpen[0];
    var setIsOpen = _isOpen[1];

    var _activeIndex = useState(0);
    var activeIndex = _activeIndex[0];
    var setActiveIndex = _activeIndex[1];

    var inputRef = useRef(null);
    var rootRef = useRef(null);

    function flattenTagGroups(tagGroups) {
      var flat = [];
      (Array.isArray(tagGroups) ? tagGroups : []).forEach(function (group) {
        (Array.isArray(group.tags) ? group.tags : []).forEach(function (tag) {
          if (tag && tag.name) {
            flat.push({ id: tag.id, name: tag.name, color: tag.color || "#d10d40", groupId: group.id });
          }
        });
      });
      return flat;
    }

    useEffect(function () {
      var cancelled = false;
      var mapLayout = window.MapLayoutService;
      if (!mapLayout || typeof mapLayout.getPreferences !== "function") {
        return;
      }
      mapLayout.getPreferences().then(function (prefs) {
        if (!cancelled) {
          setAllTags(flattenTagGroups(prefs.tagGroups));
        }
      }).catch(function () {});
      return function () { cancelled = true; };
    }, []);

    useEffect(function () {
      function onDocumentMouseDown(event) {
        if (rootRef.current && event.target && !rootRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", onDocumentMouseDown);
      return function () { document.removeEventListener("mousedown", onDocumentMouseDown); };
    }, []);

    var assignedLower = assignedNames.map(function (name) { return String(name).toLowerCase(); });
    var trimmedQuery = query.trim();
    var queryLower = trimmedQuery.toLowerCase();

    var matches = allTags.filter(function (tag) {
      if (assignedLower.indexOf(tag.name.toLowerCase()) >= 0) {
        return false;
      }
      return !trimmedQuery || tag.name.toLowerCase().indexOf(queryLower) >= 0;
    }).sort(function (a, b) {
      if (trimmedQuery) {
        var aStarts = a.name.toLowerCase().indexOf(queryLower) === 0 ? 0 : 1;
        var bStarts = b.name.toLowerCase().indexOf(queryLower) === 0 ? 0 : 1;
        if (aStarts !== bStarts) {
          return aStarts - bStarts;
        }
      }
      return a.name.localeCompare(b.name);
    });

    var exactExisting = trimmedQuery ? allTags.some(function (tag) { return tag.name.toLowerCase() === queryLower; }) : true;
    var canCreate = Boolean(trimmedQuery) && !exactExisting;
    var optionCount = matches.length + (canCreate ? 1 : 0);

    function openDropdown() {
      setIsOpen(true);
      setActiveIndex(0);
    }

    function assignTag(name) {
      var trimmedName = String(name || "").trim();
      if (!trimmedName || assignedLower.indexOf(trimmedName.toLowerCase()) >= 0) {
        return;
      }
      onChange(assignedNames.concat([trimmedName]));
      setQuery("");
      setActiveIndex(0);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }

    function removeTag(name) {
      var lower = String(name).toLowerCase();
      onChange(assignedNames.filter(function (existing) { return existing.toLowerCase() !== lower; }));
    }

    function createAndAssignTag(name) {
      var trimmedName = String(name || "").trim();
      if (!trimmedName) {
        return;
      }
      var mapLayout = window.MapLayoutService;
      if (!mapLayout) {
        return;
      }
      mapLayout.getPreferences().then(function (prefs) {
        var groups = (Array.isArray(prefs.tagGroups) ? prefs.tagGroups : []).slice();
        // Re-check against the freshest saved data (not just this field's
        // last-fetched `allTags`) so two tags created moments apart can
        // never end up as case-insensitive duplicates.
        var existingTag = null;
        groups.forEach(function (group) {
          (group.tags || []).forEach(function (tag) {
            if (tag && tag.name && tag.name.toLowerCase() === trimmedName.toLowerCase()) {
              existingTag = tag;
            }
          });
        });
        if (existingTag) {
          setAllTags(flattenTagGroups(groups));
          assignTag(existingTag.name);
          return null;
        }
        var newTag = {
          id: "tag-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
          name: trimmedName,
          color: "#d10d40",
          icon: "",
          description: "",
          visible: true
        };
        var uncategorized = groups.find(function (group) { return group.id === "tag-group-uncategorized"; });
        if (!uncategorized) {
          uncategorized = { id: "tag-group-uncategorized", name: "Uncategorized", tags: [] };
          groups.push(uncategorized);
        }
        uncategorized.tags = (uncategorized.tags || []).concat([newTag]);
        prefs.tagGroups = groups;
        return mapLayout.savePreferences(prefs).then(function () {
          setAllTags(flattenTagGroups(groups));
          assignTag(newTag.name);
        });
      }).catch(function () {});
    }

    function commitActive() {
      if (activeIndex < matches.length) {
        if (matches[activeIndex]) {
          assignTag(matches[activeIndex].name);
        }
        return;
      }
      if (canCreate) {
        createAndAssignTag(trimmedQuery);
      }
    }

    function onInputKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (event.key === "Backspace" && !query && assignedNames.length) {
        event.preventDefault();
        removeTag(assignedNames[assignedNames.length - 1]);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
          return;
        }
        setActiveIndex(function (index) { return optionCount ? (index + 1) % optionCount : 0; });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
          return;
        }
        setActiveIndex(function (index) { return optionCount ? (index - 1 + optionCount) % optionCount : 0; });
        return;
      }
      if (event.key === "Enter") {
        if (!trimmedQuery) {
          return;
        }
        event.preventDefault();
        commitActive();
        return;
      }
      if (event.key === "Tab" && trimmedQuery) {
        event.preventDefault();
        commitActive();
      }
    }

    return html`<div className="tag-picker" ref=${rootRef}>
      <div className="tag-picker-chips">
        ${assignedNames.map(function (name, index) {
          var meta = allTags.find(function (tag) { return tag.name.toLowerCase() === name.toLowerCase(); });
          return html`<span className="tag-chip tag-picker-chip" key=${"tag-chip-" + index + "-" + name}>
            <span className="tag-color-square tag-picker-chip-swatch" style=${{ background: meta ? meta.color : "#d10d40" }} aria-hidden="true"></span>
            <span className="tag-picker-chip-name">${name}</span>
            <button type="button" className="tag-picker-chip-remove" aria-label=${"Remove " + name} onClick=${function () { removeTag(name); }}>×</button>
          </span>`;
        })}
        <input
          id=${inputId}
          ref=${inputRef}
          type="text"
          className="tag-picker-input"
          value=${query}
          placeholder=${assignedNames.length ? "" : "Type to search or create a tag..."}
          role="combobox"
          aria-expanded=${isOpen}
          aria-autocomplete="list"
          aria-controls="tag-picker-listbox"
          onFocus=${openDropdown}
          onInput=${function (event) { setQuery(event.target.value); setIsOpen(true); setActiveIndex(0); }}
          onKeyDown=${onInputKeyDown}
        />
      </div>
      ${isOpen ? html`<div className="tag-picker-dropdown" role="listbox" id="tag-picker-listbox">
        ${matches.length
          ? matches.map(function (tag, index) {
              return html`<button
                type="button"
                role="option"
                aria-selected=${index === activeIndex}
                key=${"tag-option-" + tag.id}
                className=${"tag-picker-option" + (index === activeIndex ? " active" : "")}
                onMouseEnter=${function () { setActiveIndex(index); }}
                onClick=${function () { assignTag(tag.name); }}
              >
                <span className="tag-color-square" style=${{ background: tag.color }} aria-hidden="true"></span>
                <span>${tag.name}</span>
              </button>`;
            })
          : html`<div className="tag-picker-empty">No matching tags</div>`}
        ${canCreate ? html`<button
          type="button"
          className=${"tag-picker-option tag-picker-create" + (matches.length === activeIndex ? " active" : "")}
          onMouseEnter=${function () { setActiveIndex(matches.length); }}
          onClick=${function () { createAndAssignTag(trimmedQuery); }}
        >Create "${trimmedQuery}"</button>` : null}
      </div>` : null}
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
    // Callers with their own entry point into edit mode (e.g. the
    // Character List's pencil icon, via startInEdit) can suppress this
    // component's own "Edit" button so there's exactly one way in. Defaults
    // to shown, since not every consumer (e.g. the Relationship Map's
    // character panel) has an equivalent external entry point.
    var showEditButton = settings.showEditButton !== false;

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

    var _portraitWorkflow = useState({
      open: false,
      step: "replace",
      source: "",
      zoom: 1,
      minZoom: 1,
      cropCenterX: 0.5,
      cropCenterY: 0.5,
      imageWidth: 0,
      imageHeight: 0,
      urlInput: "",
      error: ""
    });
    var portraitWorkflow = _portraitWorkflow[0];
    var setPortraitWorkflow = _portraitWorkflow[1];

    var portraitInputRef = useRef(null);
    var portraitDragRef = useRef({ active: false, pointerId: null, lastX: 0, lastY: 0 });
    var portraitStageSizeRef = useRef(PORTRAIT_EDITOR_SIZE);

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

    // Checklist checkboxes save immediately (like a Pin toggle) regardless
    // of edit mode, rather than waiting on the explicit Save button --
    // unlike commitSave, this deliberately leaves editMode/timeline/
    // portrait/tags untouched, since a checklist toggle should never kick
    // an in-progress edit session back to view mode.
    function persistChecklistToggle(nextBioHtml) {
      if (!character) {
        return;
      }
      var next = clone(character);
      next.bioHtml = String(nextBioHtml || "");
      next.bio = next.bioHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      onSave(next);
      setDraft(function (current) {
        return current ? Object.assign({}, current, { bioHtml: next.bioHtml, bio: next.bio }) : current;
      });
    }

    if (!character || !draft) {
      return html`<section className="character-profile-page"><div className="profile-empty">No character selected.</div></section>`;
    }

    var linked = relationships.filter(function (rel) {
      return rel && (rel.from === character.id || rel.to === character.id);
    });
    var timelineDisplayEvents = timelineEventsForDisplay(draft.timeline || [], draft.dateOfBirth, draft.dateOfEmbrace, draft.dateOfDeath);
    var timelineCanEdit = editMode && editable;
    var portraitEditable = timelineCanEdit && Boolean(settings.allowPortraitEdit);
    var hasCustomPortrait = Boolean(draft.portrait && (typeof draft.portrait === "object" ? draft.portrait.image : draft.portrait));

    function triggerPortraitFileUpload() {
      if (portraitInputRef.current) {
        portraitInputRef.current.click();
      }
    }

    function closePortraitWorkflow() {
      setPortraitWorkflow(function (prev) { return Object.assign({}, prev, { open: false }); });
    }

    function openPortraitWorkflow() {
      setPortraitWorkflow({
        open: true,
        step: "replace",
        source: "",
        zoom: 1,
        minZoom: 1,
        cropCenterX: 0.5,
        cropCenterY: 0.5,
        imageWidth: 0,
        imageHeight: 0,
        urlInput: "",
        error: ""
      });
    }

    function loadPortraitForAdjust(source, isExisting) {
      if (!source) {
        return;
      }
      var image = new Image();
      image.onload = function () {
        var canonical = isExisting ? canonicalPortraitFromRecord(draft) : null;
        setPortraitWorkflow(function (prev) {
          return Object.assign({}, prev, {
            step: "adjust",
            source: source,
            imageWidth: image.naturalWidth || 1,
            imageHeight: image.naturalHeight || 1,
            zoom: canonical ? canonical.zoom : 1,
            minZoom: 1,
            cropCenterX: canonical ? canonical.cropCenterX : 0.5,
            cropCenterY: canonical ? canonical.cropCenterY : 0.5,
            error: ""
          });
        });
      };
      image.onerror = function () {
        setPortraitWorkflow(function (prev) { return Object.assign({}, prev, { error: "Couldn't load that image." }); });
      };
      image.src = source;
    }

    function onPortraitFileSelected(event) {
      var file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (dataUrl) {
          loadPortraitForAdjust(dataUrl, false);
        }
      };
      reader.onerror = function () {
        setPortraitWorkflow(function (prev) { return Object.assign({}, prev, { error: "Couldn't read that file." }); });
      };
      reader.readAsDataURL(file);
    }

    function applyPortraitFromUrl() {
      var url = String(portraitWorkflow.urlInput || "").trim();
      if (!url) {
        return;
      }
      loadPortraitForAdjust(url, false);
    }

    function updatePortraitZoom(nextZoom) {
      setPortraitWorkflow(function (prev) {
        var zoom = clamp(toNumber(nextZoom, prev.zoom), prev.minZoom || 1, 4);
        var clamped = clampCropCenter(prev.cropCenterX, prev.cropCenterY, zoom, prev.imageWidth, prev.imageHeight);
        return Object.assign({}, prev, { zoom: zoom, cropCenterX: clamped.x, cropCenterY: clamped.y });
      });
    }

    function nudgePortraitOffset(dxPixels, dyPixels) {
      setPortraitWorkflow(function (prev) {
        var stageSize = portraitStageSizeRef.current || PORTRAIT_EDITOR_SIZE;
        var factors = portraitScaleFactors(prev.imageWidth, prev.imageHeight);
        var nextX = prev.cropCenterX - (dxPixels / (stageSize * factors.width * prev.zoom));
        var nextY = prev.cropCenterY - (dyPixels / (stageSize * factors.height * prev.zoom));
        var clamped = clampCropCenter(nextX, nextY, prev.zoom, prev.imageWidth, prev.imageHeight);
        return Object.assign({}, prev, { cropCenterX: clamped.x, cropCenterY: clamped.y });
      });
    }

    function onPortraitAdjustPointerDown(event) {
      event.preventDefault();
      var stage = event.currentTarget;
      portraitStageSizeRef.current = stage.getBoundingClientRect().width;
      portraitDragRef.current = { active: true, pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(event.pointerId); } catch (_error) { /* best effort */ }
      }
    }

    function onPortraitAdjustPointerMove(event) {
      var drag = portraitDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }
      var dx = event.clientX - drag.lastX;
      var dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      nudgePortraitOffset(dx, dy);
    }

    function onPortraitAdjustPointerUp(event) {
      var drag = portraitDragRef.current;
      if (drag.pointerId === event.pointerId) {
        drag.active = false;
        drag.pointerId = null;
      }
    }

    function onPortraitAdjustWheel(event) {
      event.preventDefault();
      // Read/compute the zoom delta from `prev` inside the updater (not from
      // the closed-over `portraitWorkflow.zoom`) so rapid-fire wheel ticks --
      // which can queue several updates before a re-render lands -- each
      // build on the latest zoom instead of a stale snapshot. This is what
      // keeps the slider, wheel and stored zoom value in sync.
      var delta = event.deltaY > 0 ? -0.08 : 0.08;
      setPortraitWorkflow(function (prev) {
        var zoom = clamp(toNumber(prev.zoom, 1) + delta, prev.minZoom || 1, 4);
        var clamped = clampCropCenter(prev.cropCenterX, prev.cropCenterY, zoom, prev.imageWidth, prev.imageHeight);
        return Object.assign({}, prev, { zoom: zoom, cropCenterX: clamped.x, cropCenterY: clamped.y });
      });
    }

    function savePortraitWorkflow() {
      updateDraftField("portrait", {
        image: portraitWorkflow.source,
        imageWidth: portraitWorkflow.imageWidth,
        imageHeight: portraitWorkflow.imageHeight,
        cropCenterX: portraitWorkflow.cropCenterX,
        cropCenterY: portraitWorkflow.cropCenterY,
        zoom: portraitWorkflow.zoom
      });
      closePortraitWorkflow();
    }

    function removePortrait() {
      updateDraftField("portrait", null);
    }

    function renderPortraitWorkflowModal() {
      if (!portraitWorkflow.open) {
        return null;
      }
      var model = portraitRenderModel({
        imageWidth: portraitWorkflow.imageWidth,
        imageHeight: portraitWorkflow.imageHeight,
        cropCenterX: portraitWorkflow.cropCenterX,
        cropCenterY: portraitWorkflow.cropCenterY,
        zoom: portraitWorkflow.zoom
      });
      var adjustImageStyle = {
        width: (model.widthScale * 100) + "%",
        height: (model.heightScale * 100) + "%",
        left: ((0.5 - (model.cropCenterX * model.widthScale)) * 100) + "%",
        top: ((0.5 - (model.cropCenterY * model.heightScale)) * 100) + "%",
        transform: "none"
      };
      var zoomMin = portraitWorkflow.minZoom || 1;
      var zoomMax = 4;
      var zoomFillPercent = zoomMax > zoomMin
        ? clamp(((portraitWorkflow.zoom - zoomMin) / (zoomMax - zoomMin)) * 100, 0, 100)
        : 0;
      var zoomSliderStyle = { "--fill": zoomFillPercent + "%" };

      return html`<div className="portrait-workflow-backdrop" onClick=${closePortraitWorkflow}>
        <div className="portrait-workflow-modal" onClick=${function (event) { event.stopPropagation(); }}>
          ${portraitWorkflow.step === "replace" ? html`<div className="portrait-workflow-step">
            <header className="portrait-workflow-header">
              <h3>REPLACE PORTRAIT</h3>
            </header>
            <div className="portrait-replace-grid">
              <button type="button" className="portrait-replace-action" onClick=${triggerPortraitFileUpload}>
                <strong>Upload from Computer</strong>
                <span>JPEG, PNG, WebP, GIF</span>
              </button>
              <div className="portrait-replace-action url-action">
                <strong>Import from URL</strong>
                <span>Paste a public image URL</span>
                <input
                  type="url"
                  value=${portraitWorkflow.urlInput}
                  placeholder="https://example.com/portrait.jpg"
                  onInput=${function (event) {
                    var value = event.target.value;
                    setPortraitWorkflow(function (prev) { return Object.assign({}, prev, { urlInput: value, error: "" }); });
                  }}
                />
                <button type="button" onClick=${applyPortraitFromUrl}>Load URL</button>
              </div>
            </div>
            ${hasCustomPortrait ? html`<button type="button" className="portrait-adjust-current" onClick=${function () { loadPortraitForAdjust(portraitState(draft).src, true); }}>Adjust Current Portrait</button>` : null}
            ${portraitWorkflow.error ? html`<p className="portrait-workflow-error">${portraitWorkflow.error}</p>` : null}
            <footer className="portrait-workflow-actions">
              <button type="button" onClick=${closePortraitWorkflow}>Cancel</button>
            </footer>
          </div>` : html`<div className="portrait-workflow-step">
            <header className="portrait-workflow-header">
              <h3>ADJUST PORTRAIT</h3>
            </header>
            <div
              className="portrait-adjust-stage"
              onPointerDown=${onPortraitAdjustPointerDown}
              onPointerMove=${onPortraitAdjustPointerMove}
              onPointerUp=${onPortraitAdjustPointerUp}
              onPointerCancel=${onPortraitAdjustPointerUp}
              onWheel=${onPortraitAdjustWheel}
            >
              ${portraitWorkflow.source ? html`<img className="portrait-adjust-image" src=${portraitWorkflow.source} alt="Portrait adjustment" style=${adjustImageStyle} draggable="false" />` : null}
              <div className="portrait-adjust-mask"></div>
            </div>
            <div className="portrait-adjust-zoom-row">
              <span aria-hidden="true">-</span>
              <input
                type="range"
                min=${zoomMin}
                max=${zoomMax}
                step="0.01"
                value=${portraitWorkflow.zoom}
                style=${zoomSliderStyle}
                onInput=${function (event) { updatePortraitZoom(Number(event.target.value)); }}
              />
              <span aria-hidden="true">+</span>
            </div>
            ${portraitWorkflow.error ? html`<p className="portrait-workflow-error">${portraitWorkflow.error}</p>` : null}
            <footer className="portrait-workflow-actions">
              <button type="button" onClick=${function () { setPortraitWorkflow(function (prev) { return Object.assign({}, prev, { step: "replace", error: "" }); }); }}>Back</button>
              <button type="button" onClick=${savePortraitWorkflow}>Save Portrait</button>
            </footer>
          </div>`}
        </div>
      </div>`;
    }

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

    var isVampireOrigin = (draft.origin || DEFAULT_ORIGIN) === "Vampire";
    var headerClanIcon = resolveClanIcon(draft.clan);
    var headerSectIcon = resolveSectIcon(draft.sect);

    return html`<section className="character-profile-page">
      <div className="profile-dossier-shell">
        <div className="profile-content-container">
          <header className="profile-header">
            <div className="profile-header-main">
              <div className="profile-portrait-column">
                <${CharacterProfilePortrait}
                  record=${draft}
                  className="profile-header-portrait"
                  editable=${portraitEditable}
                  onClick=${portraitEditable ? openPortraitWorkflow : null}
                />
                ${portraitEditable ? html`<input ref=${portraitInputRef} type="file" accept="image/*" style=${{ display: "none" }} onChange=${onPortraitFileSelected} />` : null}
                ${portraitEditable && hasCustomPortrait ? html`<button type="button" className="profile-portrait-remove-button" onClick=${removePortrait}>Remove Portrait</button>` : null}
              </div>
              <div className="profile-title-block">
                ${timelineCanEdit
                  ? html`<input className="profile-name-input" value=${draft.name || ""} placeholder="Character Name" onInput=${function (event) { updateDraftField("name", event.target.value); }} />`
                  : html`<h1>${draft.name || "Unnamed Character"}</h1>`}
                ${!timelineCanEdit ? html`<div key="profile-identity-grid" className="profile-identity-grid">
                  <div className="profile-identity-field">
                    <span className="profile-identity-label">Origin</span>
                    <p className="profile-identity-value">${draft.origin || DEFAULT_ORIGIN}</p>
                  </div>
                  ${isVampireOrigin ? html`<div className="profile-identity-field">
                    <span className="profile-identity-label">Clan</span>
                    <p className="profile-identity-value">
                      ${headerClanIcon ? IconBadge({ icon: headerClanIcon, size: 26, tooltip: draft.clan }) : null}
                      <span>${draft.clan || "None"}</span>
                    </p>
                  </div>` : null}
                  ${isVampireOrigin ? html`<div className="profile-identity-field">
                    <span className="profile-identity-label">Sect</span>
                    <p className="profile-identity-value">
                      ${headerSectIcon ? IconBadge({ icon: headerSectIcon, size: 26, tooltip: draft.sect }) : null}
                      <span>${draft.sect || "None"}</span>
                    </p>
                  </div>` : null}
                  <div className="profile-identity-field">
                    <span className="profile-identity-label">Status</span>
                    <p className="profile-identity-value">${draft.status || "Unknown"}</p>
                  </div>
                </div>
                <div key="profile-tags-row" className="profile-identity-field profile-tags-row">
                  <span className="profile-identity-label">Tags</span>
                  ${TagChips({ items: draft.tags || [], empty: "No tags." })}
                </div>` : null}
                ${timelineCanEdit ? html`<div key="profile-identity-grid" className="profile-identity-grid">
                  <div className="profile-identity-field">
                    <label className="profile-identity-label" htmlFor="profile-origin-select">Origin</label>
                    <select id="profile-origin-select" value=${draft.origin || DEFAULT_ORIGIN} onChange=${function (event) { updateDraftField("origin", event.target.value); }}>
                      ${ORIGIN_OPTIONS.map(function (option) {
                        return html`<option key=${"origin-opt-" + option} value=${option}>${option}</option>`;
                      })}
                    </select>
                  </div>
                  ${isVampireOrigin ? html`<div className="profile-identity-field">
                    <label className="profile-identity-label" htmlFor="profile-header-clan-select">Clan</label>
                    <select id="profile-header-clan-select" value=${draft.clan || "None"} onChange=${function (event) { updateDraftField("clan", event.target.value); }}>
                      ${optionsWithCurrentValue(CLAN_OPTIONS, draft.clan).map(function (option) {
                        return html`<option key=${"clan-opt-" + option} value=${option}>${option}</option>`;
                      })}
                    </select>
                  </div>` : null}
                  ${isVampireOrigin ? html`<div className="profile-identity-field">
                    <label className="profile-identity-label" htmlFor="profile-header-sect-select">Sect</label>
                    <select id="profile-header-sect-select" value=${draft.sect || "None"} onChange=${function (event) { updateDraftField("sect", event.target.value); }}>
                      ${optionsWithCurrentValue(SECT_OPTIONS, draft.sect).map(function (option) {
                        return html`<option key=${"sect-opt-" + option} value=${option}>${option}</option>`;
                      })}
                    </select>
                  </div>` : null}
                  <div className="profile-identity-field">
                    <label className="profile-identity-label" htmlFor="profile-header-status-select">Status</label>
                    <select id="profile-header-status-select" value=${draft.status || "Unknown"} onChange=${function (event) { updateDraftField("status", event.target.value); }}>
                      ${optionsWithCurrentValue(STATUS_OPTIONS, draft.status).map(function (option) {
                        return html`<option key=${"status-opt-" + option} value=${option}>${option}</option>`;
                      })}
                    </select>
                  </div>
                </div>
                <div key="profile-tags-row" className="profile-identity-field profile-tags-row">
                  <label className="profile-identity-label" htmlFor="profile-header-tags-input">Tags</label>
                  <${TagPickerField} inputId="profile-header-tags-input" tags=${draft.tags} onChange=${function (nextTags) { updateDraftField("tags", nextTags); }} />
                </div>` : null}
              </div>
            </div>
            <div className="profile-header-controls">
              ${editable ? (timelineCanEdit
                ? html`<div className="profile-edit-actions-row">
                    <button type="button" className="profile-save-button" onClick=${commitSave}>Save</button>
                    <button type="button" className="profile-cancel-button secondary" onClick=${function () { setDraft(normalizeCharacterForProfile(character)); setEditMode(false); }}>Cancel</button>
                  </div>`
                : (showEditButton ? html`<button type="button" className="profile-biography-edit-button" onClick=${function () { setEditMode(true); }}>Edit</button>` : null)) : null}
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
                </div>

                <div className="profile-tab-panels">
                  <section className="profile-tab-panel" role="tabpanel" aria-hidden=${activeTab === "biography" ? "false" : "true"} hidden=${activeTab !== "biography"}>
                    <${CharacterBiographyWorkspace}
                      editable=${timelineCanEdit}
                      value=${String(draft.bioHtml || "")}
                      onChange=${function (htmlValue) { updateDraftField("bioHtml", htmlValue); }}
                      onChecklistToggle=${persistChecklistToggle}
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
                          <div className="timeline-log-content">
                            <p className="timeline-log-title-row">
                              <strong>${item.title || "Untitled Event"}</strong>
                              <span className="timeline-log-tags">${isSystem ? html`<span className="timeline-system-badge">System Event</span>` : null}</span>
                            </p>
                            ${isExpanded ? html`<p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>` : null}
                          </div>
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
                  ${isVampireOrigin ? html`<div key="profile-details-vampire-heading" className="profile-details-group-label">Identity</div>
                  ${detailTableRow("Clan", "clan")}
                  ${detailTableRow("Sect", "sect")}
                  ${detailTableRow("Generation", "generation")}
                  ${detailTableRow("Predator Type", "predatorType")}` : null}
                  <div className="profile-details-group-label">Roleplay Hooks</div>
                  ${detailTableRow("Concept", "concept", { multiline: true })}
                  ${detailTableRow("Ambition", "ambition", { multiline: true })}
                  ${detailTableRow("Desire", "desire", { multiline: true })}
                  ${timelineCanEdit ? detailTableRow("Convictions", "convictions", { multiline: true }) : null}
                  ${timelineCanEdit ? detailTableRow("Touchstones", "touchstones", { multiline: true }) : null}
                  <div className="profile-details-group-label">Vitals</div>
                  ${detailTableRow("True Age", "trueAge")}
                  ${detailTableRow("Apparent Age", "apparentAge")}
                  ${detailTableRow("Date of Birth", "dateOfBirth", { type: "date" })}
                  ${detailTableRow("Date of Embrace", "dateOfEmbrace", { type: "date" })}
                  ${detailTableRow("Date of Death", "dateOfDeath", { type: "date" })}
                  ${isVampireOrigin ? detailTableRow("Sire", "sire") : null}
                </dl>
                ${!timelineCanEdit ? dossierEntryGroup({ key: "profile-convictions-" + character.id, title: "Convictions", entryText: draft.convictions, accentColor: "#d10d40", emptyText: "Not set" }) : null}
                ${!timelineCanEdit ? dossierEntryGroup({ key: "profile-touchstones-" + character.id, title: "Touchstones", entryText: draft.touchstones, accentColor: "#d10d40", emptyText: "Not set" }) : null}
              </article>
            </aside>
          </div>
        </div>
      </div>
      ${portraitEditable ? renderPortraitWorkflowModal() : null}
    </section>`;
  }

  // Renders an SVG asset (from assets/Icons/) as a recolorable glyph via
  // mask-image + currentColor, rather than an <img> -- since a plain <img>
  // bakes in whatever colors the source file has, while a CSS mask lets any
  // consumer (Timeline Event accent colors, Clan/Sect badges, ...) tint the
  // same source asset differently just by passing a different `color`,
  // with zero per-consumer copies of the asset. `config`: `icon` (path,
  // required), `color` (defaults to currentColor), `size` (square) or
  // `width`/`height` (for non-square source assets), `className`.
  function Icon(config) {
    if (!config || !config.icon) {
      return null;
    }
    var iconSize = Number(config.size) || null;
    var iconWidth = Number(config.width) || iconSize;
    var iconHeight = Number(config.height) || iconSize;
    var className = "atlas-icon" + (config.className ? " " + config.className : "");
    var maskSource = "url('" + config.icon + "')";
    var style = {
      color: config.color || "currentColor",
      backgroundColor: "currentColor",
      maskImage: maskSource,
      maskRepeat: "no-repeat",
      maskPosition: "center",
      maskSize: "contain",
      maskMode: "alpha",
      WebkitMaskImage: maskSource,
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      WebkitMaskSize: "contain",
      WebkitMaskMode: "alpha"
    };
    if (iconWidth) {
      style.width = iconWidth + "px";
    }
    if (iconHeight) {
      style.height = iconHeight + "px";
    }
    return html`<span className=${className} style=${style} aria-hidden="true"></span>`;
  }

  // Reusable read-only chip list -- used for "Tags", "Owners", and similar
  // multi-value fields wherever a page's read-only view needs the same
  // pill styling as its own editable chip UI (or another page's). Passive
  // display only unless `onRemove` is given, in which case each chip gets
  // a removable × (still safe to click inside a clickable parent card,
  // since it stops propagation itself).
  function TagChips(props) {
    var items = (props && props.items) || [];
    var empty = (props && props.empty) || "None";
    var onRemove = props && props.onRemove;

    if (!items.length) {
      return html`<p className="hint">${empty}</p>`;
    }

    return html`<div className="notebook-chip-list">
      ${items.map(function (item) {
        return html`<button type="button" key=${item} className="notebook-chip">
          <span>${item}</span>
          ${onRemove ? html`<strong aria-hidden="true" onClick=${function (event) { event.stopPropagation(); onRemove(item); }}>×</strong>` : null}
        </button>`;
      })}
    </div>`;
  }

  // Reusable list-card action row -- a small overlay of icon buttons
  // pinned to the top-right corner of a list card (favorite/edit/delete,
  // or any subset thereof), shown on hover (always visible on touch
  // devices, via the `@media (hover: none)` rule in styles.css since CSS
  // can't otherwise detect "no mouse"). One shared component/stylesheet so
  // every entity list (Characters, Locations, ...) gets the exact same
  // sizing, spacing, and interaction behavior instead of each page
  // reimplementing its own hover-icon row.
  //
  // Usage: render as a child of a `position: relative` list-item button,
  // e.g. `<${ListCardActions} actions=${[
  //   { key: "favorite", icon: "../assets/Icons/pin.svg", label: "Favorite", active: entry.pinned, onClick: () => toggle(entry) },
  //   { key: "edit", icon: "../assets/Icons/edit.svg", label: "Edit", onClick: () => edit(entry) },
  //   { key: "delete", icon: "../assets/Icons/delete.svg", label: "Delete", destructive: true, onClick: () => remove(entry) }
  // ]} />`. `icon` is an SVG asset path rendered via the Icon() helper above
  // (mask-image + currentColor), so hover/active/destructive theming keeps
  // working automatically -- never a raw glyph/emoji. Every action's click
  // (mouse or keyboard) stops propagation so it never also triggers the
  // card's own onClick.
  function ListCardActions(props) {
    var actions = (Array.isArray(props && props.actions) ? props.actions : []).filter(function (action) {
      return action && typeof action.onClick === "function";
    });
    if (!actions.length) {
      return null;
    }
    return html`<span className="list-card-actions" onClick=${function (event) { event.stopPropagation(); }}>
      ${actions.map(function (action, index) {
        return html`<span
          key=${action.key || index}
          role="button"
          tabIndex="0"
          className=${"list-card-action" + (action.active ? " active" : "") + (action.destructive ? " destructive" : "")}
          aria-label=${action.label || ""}
          title=${action.label || ""}
          onClick=${function (event) { event.stopPropagation(); action.onClick(event); }}
          onKeyDown=${function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              action.onClick(event);
            }
          }}
        >${Icon({ icon: action.icon, size: 15 })}</span>`;
      })}
    </span>`;
  }

  // Reusable searchable multi-select-with-chips dropdown (originally built
  // for Locations' Owner field). Dropdown stays open across selections;
  // "None" is a distinct clear-all row, not a togglable option; closes via
  // outside click, Escape, or re-clicking the trigger.
  //
  // Usage: `<${OwnerDropdown} id="..." label="Characters" characters=${characters}
  //   values=${draft.characterIds} onChange=${(nextIds) => ...}
  //   noneLabel="No characters" itemLabelPlural="Characters" />`
  function OwnerDropdown(props) {
    var id = props.id;
    var label = props.label || "Owner";
    var noneLabel = props.noneLabel || "None";
    var itemLabelPlural = props.itemLabelPlural || "Owners";
    var characters = Array.isArray(props.characters) ? props.characters : [];
    var values = Array.isArray(props.values) ? props.values.map(String) : [];
    var onChange = typeof props.onChange === "function" ? props.onChange : function () {};
    var _open = useState(false);
    var open = _open[0];
    var setOpen = _open[1];
    var _searchTerm = useState("");
    var searchTerm = _searchTerm[0];
    var setSearchTerm = _searchTerm[1];
    var rootRef = useRef(null);

    var ownerOptions = useMemo(function () {
      var seen = {};
      return characters.map(function (character) {
        return {
          value: String(character && character.id ? character.id : ""),
          label: String((character && character.name) || (character && character.id) || "")
        };
      }).filter(function (option) {
        return option.value && option.label;
      }).sort(function (a, b) {
        return a.label.localeCompare(b.label);
      }).filter(function (option) {
        if (seen[option.value]) {
          return false;
        }
        seen[option.value] = true;
        return true;
      });
    }, [characters]);

    var ownerLabelById = useMemo(function () {
      var map = {};
      ownerOptions.forEach(function (option) { map[option.value] = option.label; });
      return map;
    }, [ownerOptions]);

    var selectedChips = values.map(function (ownerId) {
      return { value: ownerId, label: ownerLabelById[ownerId] || ownerId };
    });

    var summaryLabel = !selectedChips.length
      ? noneLabel
      : (selectedChips.length === 1 ? selectedChips[0].label : (selectedChips.length + " " + itemLabelPlural));

    var filteredOptions = useMemo(function () {
      var term = String(searchTerm || "").trim().toLowerCase();
      if (!term) {
        return ownerOptions;
      }
      return ownerOptions.filter(function (option) {
        return option.label.toLowerCase().indexOf(term) >= 0;
      });
    }, [ownerOptions, searchTerm]);

    useEffect(function () {
      if (!open) {
        setSearchTerm("");
        return;
      }
      function onPointerDown(event) {
        if (rootRef.current && !rootRef.current.contains(event.target)) {
          setOpen(false);
        }
      }
      function onEscape(event) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [open]);

    function toggleOwner(ownerId) {
      if (values.indexOf(ownerId) !== -1) {
        onChange(values.filter(function (id) { return id !== ownerId; }));
      } else {
        onChange(values.concat([ownerId]));
      }
    }

    function removeChip(ownerId) {
      onChange(values.filter(function (id) { return id !== ownerId; }));
    }

    return html`<div className="character-filter-dropdown entity-multiselect-dropdown" ref=${rootRef}>
      <span className="character-filter-label">${label}</span>
      <button
        type="button"
        className=${"character-filter-trigger" + (open ? " open" : "")}
        aria-haspopup="listbox"
        aria-expanded=${open ? "true" : "false"}
        aria-controls=${id}
        onClick=${function () { setOpen(!open); }}
      >
        <span className="character-filter-trigger-text">${summaryLabel}</span>
        <span className="character-filter-trigger-caret" aria-hidden="true">v</span>
      </button>
      ${selectedChips.length ? html`<div className="notebook-chip-list">
        ${selectedChips.map(function (chip) {
          return html`<button type="button" key=${"owner-chip-" + chip.value} className="notebook-chip">
            <span>${chip.label}</span>
            <strong aria-hidden="true" onClick=${function (event) { event.stopPropagation(); removeChip(chip.value); }}>×</strong>
          </button>`;
        })}
      </div>` : null}
      ${open ? html`<div id=${id} className="character-filter-menu entity-multiselect-menu" role="listbox" aria-multiselectable="true">
        <div className="entity-multiselect-search-row">
          <input
            type="search"
            placeholder="Search..."
            value=${searchTerm}
            autoFocus=${true}
            onInput=${function (event) { setSearchTerm(event.target.value); }}
          />
        </div>
        <button
          type="button"
          className=${"character-filter-option" + (!values.length ? " checked" : "")}
          role="option"
          aria-selected=${!values.length ? "true" : "false"}
          onClick=${function () { onChange([]); }}
        >
          <span className="character-filter-check" aria-hidden="true"></span>
          <span>${noneLabel}</span>
        </button>
        ${filteredOptions.length ? filteredOptions.map(function (option) {
          var checked = values.indexOf(option.value) !== -1;
          return html`<button
            key=${"owner-option-" + option.value}
            type="button"
            className=${"character-filter-option" + (checked ? " checked" : "")}
            role="option"
            aria-selected=${checked ? "true" : "false"}
            onClick=${function () { toggleOwner(option.value); }}
          >
            <span className="character-filter-check" aria-hidden="true"></span>
            <span>${option.label}</span>
          </button>`;
        }) : html`<div className="character-filter-option notebook-filter-empty"><span></span><span>No results found.</span></div>`}
      </div>` : null}
    </div>`;
  }

  // Single-select searchable entity picker with inline "create new" support
  // -- reuses the Mention Editor's own search (searchMentionCandidates) and
  // creation (createLocationEntity, ...) so a location created here is
  // indistinguishable from one created anywhere else in the app. Currently
  // wired up for Locations only (Timeline Events' Location field); the
  // `entityType` prop is there so a future field can reuse this instead of
  // adding another bespoke picker.
  //
  // Usage: `<${EntityPickerField} entityType="location" value=${draft.locationId}
  //   options=${locations} onChange=${(id) => ...} onCreated=${(created) => ...} />`
  function EntityPickerField(props) {
    var entityType = (props && props.entityType) || "location";
    var value = (props && props.value) || "";
    var options = Array.isArray(props && props.options) ? props.options : [];
    var onChange = typeof (props && props.onChange) === "function" ? props.onChange : function () {};
    var onCreated = typeof (props && props.onCreated) === "function" ? props.onCreated : function () {};
    var placeholder = (props && props.placeholder) || "Search...";
    var createLabelNoun = (props && props.createLabelNoun) || "Location";
    var label = props && props.label;

    var _open = useState(false);
    var open = _open[0];
    var setOpen = _open[1];
    var _query = useState("");
    var query = _query[0];
    var setQuery = _query[1];
    var _creating = useState(false);
    var creating = _creating[0];
    var setCreating = _creating[1];
    var rootRef = useRef(null);

    var selected = options.find(function (option) { return option.id === value; }) || null;

    var filteredOptions = useMemo(function () {
      var term = String(query || "").trim().toLowerCase();
      var list = !term ? options : options.filter(function (option) {
        return String(option.label || "").toLowerCase().indexOf(term) !== -1;
      });
      return list.slice(0, 50);
    }, [options, query]);

    useEffect(function () {
      if (!open) {
        return;
      }
      function onPointerDown(event) {
        if (rootRef.current && !rootRef.current.contains(event.target)) {
          setOpen(false);
        }
      }
      function onEscape(event) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [open]);

    function selectOption(id) {
      onChange(id);
      setQuery("");
      setOpen(false);
    }

    function clearSelection() {
      onChange("");
      setQuery("");
    }

    async function handleCreate() {
      var name = String(query || "").trim();
      var mentionEditor = window.MentionEditor;
      if (!name || creating || !mentionEditor || typeof mentionEditor.createLocationEntity !== "function") {
        return;
      }
      setCreating(true);
      var created = entityType === "location" ? await mentionEditor.createLocationEntity(name) : null;
      setCreating(false);
      if (created && created.id) {
        onCreated(created);
        onChange(created.id);
        setQuery("");
        setOpen(false);
      }
    }

    var trimmedQuery = String(query || "").trim();
    var showCreatePrompt = trimmedQuery && !filteredOptions.length;

    return html`<div className="character-filter-dropdown entity-multiselect-dropdown entity-picker-field" ref=${rootRef}>
      ${label ? html`<span className="character-filter-label">${label}</span>` : null}
      ${selected ? html`<div className="notebook-chip-list">
        <button type="button" className="notebook-chip">
          <span>${selected.label}</span>
          <strong aria-hidden="true" onClick=${function (event) { event.stopPropagation(); clearSelection(); }}>×</strong>
        </button>
      </div>` : html`<input
        type="text"
        className="entity-picker-input"
        value=${query}
        placeholder=${placeholder}
        onFocus=${function () { setOpen(true); }}
        onInput=${function (event) { setQuery(event.target.value); setOpen(true); }}
      />`}
      ${open && !selected ? html`<div className="character-filter-menu entity-multiselect-menu">
        ${filteredOptions.length ? filteredOptions.map(function (option) {
          return html`<button
            key=${"entity-picker-opt-" + option.id}
            type="button"
            className="character-filter-option"
            onClick=${function () { selectOption(option.id); }}
          >
            <span>${option.label}</span>
          </button>`;
        }) : null}
        ${showCreatePrompt ? html`<button type="button" className="character-filter-option entity-picker-create-option" disabled=${creating} onClick=${handleCreate}>
          ${Icon({ icon: "../assets/Icons/plus.svg", size: 14 })}
          <span>Create "${trimmedQuery}" as a ${createLabelNoun}</span>
        </button>` : null}
        ${!filteredOptions.length && !trimmedQuery ? html`<div className="character-filter-option notebook-filter-empty"><span></span><span>Type to search...</span></div>` : null}
      </div>` : null}
    </div>`;
  }

  // Reusable "?" help icon that reveals a section's description in a
  // tooltip on hover/focus/tap, instead of that description sitting in the
  // section heading permanently. Positioning is measured (not pure CSS):
  // once the bubble is in the DOM, a layout effect checks its own rect
  // against the viewport and flips to whichever vertical/horizontal side
  // still fits, so it never renders off-screen regardless of where the
  // triggering "?" happens to sit on the page.
  //
  // Usage: `<${HelpTooltip} text="Events referencing this location" />`
  function HelpTooltip(props) {
    var text = String((props && props.text) || "").trim();
    var extraClassName = (props && props.className) || "";
    if (!text) {
      return null;
    }

    var idRef = useRef(null);
    if (!idRef.current) {
      idRef.current = "help-tooltip-" + Math.random().toString(36).slice(2, 9);
    }
    var _open = useState(false);
    var open = _open[0];
    var setOpen = _open[1];
    var rootRef = useRef(null);
    var bubbleRef = useRef(null);
    var _placement = useState({ vertical: "bottom", horizontal: "left" });
    var placement = _placement[0];
    var setPlacement = _placement[1];

    useLayoutEffect(function () {
      if (!open || !bubbleRef.current) {
        return;
      }
      var margin = 8;
      var rect = bubbleRef.current.getBoundingClientRect();
      var vertical = rect.bottom > window.innerHeight - margin ? "top" : "bottom";
      var horizontal = rect.right > window.innerWidth - margin ? "right" : "left";
      setPlacement(function (prev) {
        return (prev.vertical === vertical && prev.horizontal === horizontal) ? prev : { vertical: vertical, horizontal: horizontal };
      });
    }, [open, text]);

    useEffect(function () {
      if (!open) {
        return;
      }
      function onPointerDown(event) {
        if (rootRef.current && !rootRef.current.contains(event.target)) {
          setOpen(false);
        }
      }
      function onEscape(event) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [open]);

    return html`<span className=${"help-tooltip" + (extraClassName ? " " + extraClassName : "")} ref=${rootRef}>
      <button
        type="button"
        className="help-tooltip-trigger"
        aria-describedby=${open ? idRef.current : undefined}
        aria-label="Help"
        onMouseEnter=${function () { setOpen(true); }}
        onMouseLeave=${function () { setOpen(false); }}
        onFocus=${function () { setOpen(true); }}
        onBlur=${function () { setOpen(false); }}
        onClick=${function (event) { event.stopPropagation(); setOpen(function (prev) { return !prev; }); }}
      >?</button>
      ${open ? html`<span
        ref=${bubbleRef}
        role="tooltip"
        id=${idRef.current}
        className=${"help-tooltip-bubble help-tooltip-" + placement.vertical + " help-tooltip-" + placement.horizontal}
      >${text}</span>` : null}
    </span>`;
  }

  window.CampaignAtlasCharactersShared = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    DEFAULT_TAG_GROUPS: DEFAULT_TAG_GROUPS,
    CLAN_OPTIONS: CLAN_OPTIONS,
    SECT_OPTIONS: SECT_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    ORIGIN_OPTIONS: ORIGIN_OPTIONS,
    DEFAULT_ORIGIN: DEFAULT_ORIGIN,
    clone: clone,
    openCampaignAtlasDb: openCampaignAtlasDb,
    characterBiographyHtml: characterBiographyHtml,
    normalizeIsoDate: normalizeIsoDate,
    resolveCharacterLifecycleDates: resolveCharacterLifecycleDates,
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
    readLocationRecords: readLocationRecords,
    readLocationRecordById: readLocationRecordById,
    saveLocationRecord: saveLocationRecord,
    deleteLocationRecord: deleteLocationRecord,
    subscribeLocationRecordChanges: subscribeLocationRecordChanges,
    notifyLocationRecordsChanged: notifyLocationRecordsChanged,
    saveCharacterToCampaignAtlas: saveCharacterToCampaignAtlas,
    deleteCharacterFromCampaignAtlas: deleteCharacterFromCampaignAtlas,
    clearAllCharacters: clearAllCharacters,
    clearAllCharacterTimelines: clearAllCharacterTimelines,
    saveRelationships: saveRelationships,
    CharacterBiographyWorkspace: CharacterBiographyWorkspace,
    CharacterProfilePortrait: CharacterProfilePortrait,
    CharacterProfileWorkspace: CharacterProfileWorkspace,
    ListCardActions: ListCardActions,
    TagChips: TagChips,
    OwnerDropdown: OwnerDropdown,
    Icon: Icon,
    EntityPickerField: EntityPickerField,
    HelpTooltip: HelpTooltip
  };
})();
