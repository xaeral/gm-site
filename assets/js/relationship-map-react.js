(function () {
  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  var STORAGE_KEY = "relationship-map-desktop-v1";
  var DB_NAME = "CampaignAtlas";
  var DB_VERSION = 1;
  var STORE_CHARACTERS = "characters";
  var STORE_RELATIONSHIPS = "relationships";
  var STORE_LOCATIONS = "locations";
  var STORE_TIMELINE = "timeline";
  var STORE_SESSIONS = "sessions";
  var STORE_SETTINGS = "settings";
  var PORTRAIT_BLOB_MARKER = "__campaignAtlasPortraitBlob__";
  var dbPromise = null;
  var persistenceQueue = Promise.resolve();

  var TOOL_NAV = [
    { key: "characters", label: "Characters", icon: "◉" },
    { key: "zones", label: "Zones", icon: "▭" },
    { key: "relationships", label: "Relationships", icon: "↔" },
    { key: "tags", label: "Tags", icon: "#" },
    { key: "badges", label: "Badges", icon: "◎" },
    { key: "overlays", label: "Overlays", icon: "◍" }
  ];

  var SECT_OPTIONS = ["None", "Anarch", "Ashirra", "Camarilla", "Sabbat"];

  var DEFAULT_PORTRAIT = "Default.png";

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

  var SECT_ICON_FILES = {
    "Anarch": "Anarch.png",
    "Ashirra": "Ashirra.png",
    "Camarilla": "Camarilla.png",
    "Sabbat": "Sabbat.png"
  };

  var CLAN_ICON_FILES = {
    "Banu Haqim": "Banu Haqim.png",
    "Brujah": "Brujah.png",
    "Gangrel": "Gangrel.png",
    "Hecata": "Hecata.png",
    "Lasombra": "Lasombra.png",
    "Malkavian": "Malkavian.png",
    "Ministry": "Ministry.png",
    "Nosferatu": "Nosferatu.png",
    "Ravnos": "Ravnos.png",
    "Salubri": "Salubri.png",
    "Toreador": "Toreador.png",
    "Tremere": "Tremere.png",
    "Tzimisce": "Tzimisce.png",
    "Ventrue": "Ventrue.jpg",
    "Caitiff": "Caitiff.png",
    "Thin-Blood": "Thin-blood.png"
  };

  var PORTRAITS = [
    "Default.png",
    "1780709100325-54052ee (1).png",
    "1780709267968-5aax98r (1).png",
    "1780754470878-s7n7jsu (1).png",
    "1780754503028-h6q4gws (1).png",
    "1780754562384-hxr6tn0 (1).png",
    "1780754760055-mat9tpj (1).png",
    "1780754785859-pu527z7 (1).png",
    "1780754801988-fzprr7b (1).png",
    "1780754816552-arbc9jq (1).png",
    "1780754831038-vvlzr12 (1).png",
    "1780754845739-ljgbg80 (1).png",
    "1780754861548-qefj4o6 (1).png",
    "1780754883935-gvf9kvw (1).png",
    "1780754903809-mwu505a (1).png",
    "1780754917541-b280c8m (1).png",
    "1780754931273-rt4bjj8 (1).png",
    "1780754949457-qlc2y8o (1).png",
    "1780754964069-hu4ckuu (1).png",
    "1781360687819-4zdtrbu (1).jpg",
    "1781360688508-m6a94gv (1).jpg",
    "1781360689686-pn1xijl (1).jpg",
    "1781988264167-6mujx9h (1).png",
    "1784677430587-k4v44gh (1).jpg"
  ];

  var PORTRAIT_EDITOR_SIZE = 320;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function imgPath(fileName) {
    return "../Relationship map/" + encodeURIComponent(fileName);
  }

  function enumValue(value, options, fallback) {
    var input = String(value || "").trim();
    return options.indexOf(input) >= 0 ? input : fallback;
  }

  function normalizeSectValue(value) {
    return enumValue(value, SECT_OPTIONS, "None");
  }

  function normalizeClanValue(value) {
    return enumValue(value, CLAN_OPTIONS, "None");
  }

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
    var sect = normalizeSectValue(value);
    return sect === "None" ? "" : (SECT_ICON_LOOKUP[sect] || "");
  }

  function resolveClanIcon(value) {
    var clan = normalizeClanValue(value);
    return clan === "None" ? "" : (CLAN_ICON_LOOKUP[clan] || "");
  }

  function IconBadge(config) {
    if (!config || !config.icon) {
      return null;
    }
    var size = Math.max(24, Number(config.size) || 44);
    var backgroundColor = config.backgroundColor || "#6d132a";
    var tooltip = config.tooltip || "";
    return html`<span className="icon-badge" style=${{ width: size + "px", height: size + "px", background: backgroundColor }} title=${tooltip} aria-label=${tooltip}>
      <img className="icon-badge-image" src=${config.icon} alt=${tooltip || "Icon badge"} />
    </span>`;
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

  function portraitMediaStyle(record, frameSize) {
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

  function coverScale(imageWidth, imageHeight, viewportSize) {
    var width = Math.max(1, Number(imageWidth) || 1);
    var height = Math.max(1, Number(imageHeight) || 1);
    var size = Math.max(1, Number(viewportSize) || PORTRAIT_EDITOR_SIZE);
    return Math.max(size / width, size / height);
  }

  function minimumPortraitZoom(imageWidth, imageHeight, viewportSize) {
    return 1;
  }

  function clampPortraitOffsets(offsetX, offsetY, zoom, imageWidth, imageHeight, viewportSize) {
    var size = Math.max(1, Number(viewportSize) || PORTRAIT_EDITOR_SIZE);
    var model = portraitRenderModel({
      imageWidth: imageWidth,
      imageHeight: imageHeight,
      cropCenterX: 0.5,
      cropCenterY: 0.5,
      zoom: zoom
    });
    var maxX = Math.max(0, ((model.widthScale - 1) * size) / 2);
    var maxY = Math.max(0, ((model.heightScale - 1) * size) / 2);
    return {
      x: clamp(offsetX, -maxX, maxX),
      y: clamp(offsetY, -maxY, maxY)
    };
  }

  function characterBiographyHtml(character) {
    if (!character) {
      return "";
    }
    if (character.bioHtml && String(character.bioHtml).trim()) {
      return character.bioHtml;
    }
    var plainText = String(character.bio || "").trim();
    if (!plainText) {
      return "<p>No biography added yet.</p>";
    }
    return "<p>" + plainText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") + "</p>";
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
    var title = opts.title || "";
    var entryText = opts.entryText || "";
    var accentColor = opts.accentColor || "var(--accent-red)";
    var emptyText = opts.emptyText || "Not set";
    var entries = parseDossierEntries(entryText);

    return html`<article className="profile-info-card dossier-field-card">
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

  function richHtmlToText(htmlContent) {
    var wrapper = document.createElement("div");
    wrapper.innerHTML = String(htmlContent || "");
    return wrapper.textContent || wrapper.innerText || "";
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
      description: String(input.description || "")
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

  function timelineEventsForDisplay(events) {
    var mapped = (events || []).map(function (event, sourceIndex) {
      var normalized = normalizeTimelineEvent(event);
      return {
        sourceIndex: sourceIndex,
        event: normalized,
        hasDate: Boolean(normalized.date),
        dateValue: normalized.date ? Date.parse(normalized.date + "T00:00:00") : Number.POSITIVE_INFINITY
      };
    });

    mapped.sort(function (a, b) {
      if (a.hasDate && b.hasDate) {
        if (a.dateValue !== b.dateValue) {
          return a.dateValue - b.dateValue;
        }
        return a.sourceIndex - b.sourceIndex;
      }
      if (a.hasDate && !b.hasDate) {
        return -1;
      }
      if (!a.hasDate && b.hasDate) {
        return 1;
      }
      return a.sourceIndex - b.sourceIndex;
    });

    return mapped;
  }

  function normalizeCharacterRecord(character) {
    var source = character && typeof character === "object" ? character : {};
    var normalized = Object.assign({}, source);
    normalized.portrait = canonicalPortraitFromRecord(source);
    delete normalized.portraitUploadSource;
    delete normalized.portraitScale;
    delete normalized.portraitOffsetX;
    delete normalized.portraitOffsetY;
    normalized.clan = normalizeClanValue(source.clan);
    normalized.sect = normalizeSectValue(source.sect);
    normalized.timeline = sortTimelineEvents(timelineEventsFromAny(source.timeline));
    normalized.storytellerNotes = source.storytellerNotes !== undefined
      ? String(source.storytellerNotes || "")
      : String(source.gmNotes || "");
    normalized.gmOnlyInformation = source.gmOnlyInformation !== undefined
      ? String(source.gmOnlyInformation || "")
      : String(source.gmNotes || "");
    normalized.dateOfBirth = normalizeIsoDate(source.dateOfBirth);
    normalized.dateOfDeath = normalizeIsoDate(source.dateOfDeath);
    return normalized;
  }

  function characterToDraft(character) {
    var currentPortrait = portraitState(character);
    var timelineEvents = sortTimelineEvents(timelineEventsFromAny(character.timeline));
    return {
      id: character.id,
      name: character.name || "",
      portrait: {
        image: currentPortrait.source || DEFAULT_PORTRAIT,
        imageWidth: currentPortrait.imageWidth,
        imageHeight: currentPortrait.imageHeight,
        cropCenterX: currentPortrait.cropCenterX,
        cropCenterY: currentPortrait.cropCenterY,
        zoom: currentPortrait.zoom,
        cropX: currentPortrait.cropCenterX,
        cropY: currentPortrait.cropCenterY
      },
      clan: normalizeClanValue(character.clan),
      sect: normalizeSectValue(character.sect),
      status: character.status || "",
      tagsText: (character.tags || []).join(", "),
      concept: character.concept || "",
      ambition: character.ambition || "",
      desire: character.desire || "",
      convictions: character.convictions || "",
      touchstones: character.touchstones || "",
      predatorType: character.predatorType || "",
      generation: character.generation || "",
      sire: character.sire || "",
      outlineColor: character.outlineColor || "#d10d40",
      nodeSize: typeof character.nodeSize === "number" ? character.nodeSize : 1,
      nodeShape: character.nodeShape || "circle",
      hidden: Boolean(character.hidden),
      trueAge: character.trueAge || "",
      apparentAge: character.apparentAge || "",
      dateOfBirth: normalizeIsoDate(character.dateOfBirth),
      dateOfDeath: normalizeIsoDate(character.dateOfDeath),
      storytellerNotes: character.storytellerNotes !== undefined ? String(character.storytellerNotes || "") : String(character.gmNotes || ""),
      gmOnlyInformation: character.gmOnlyInformation !== undefined ? String(character.gmOnlyInformation || "") : String(character.gmNotes || ""),
      timelineEvents: timelineEvents,
      bioHtml: characterBiographyHtml(character)
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function indexedDbAvailable() {
    return typeof window !== "undefined" && !!window.indexedDB;
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
    if (!indexedDbAvailable()) {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }

    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function () {
          var db = request.result;
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
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
          }
        };

        request.onsuccess = function () {
          var db = request.result;
          db.onversionchange = function () {
            db.close();
          };
          resolve(db);
        };

        request.onerror = function () {
          reject(request.error || new Error("Unable to open CampaignAtlas IndexedDB."));
        };
      });
    }

    return dbPromise;
  }

  function isDataImageUrl(value) {
    return typeof value === "string" && /^data:image\//i.test(value);
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl || "").split(",");
    if (parts.length < 2) {
      return null;
    }
    var mimeMatch = parts[0].match(/^data:([^;]+);base64$/i);
    if (!mimeMatch) {
      return null;
    }
    try {
      var binary = window.atob(parts[1]);
      var length = binary.length;
      var bytes = new Uint8Array(length);
      for (var i = 0; i < length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeMatch[1] || "application/octet-stream" });
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
      reader.onload = function (event) {
        resolve(String(event && event.target && event.target.result ? event.target.result : ""));
      };
      reader.onerror = function () {
        reject(reader.error || new Error("Failed to read portrait blob."));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function serializeCharacterForStorage(character) {
    var record = clone(character || {});
    var portraitObject = record && record.portrait && typeof record.portrait === "object" ? clone(record.portrait) : null;
    var portraitImage = portraitObject && typeof portraitObject.image === "string"
      ? portraitObject.image
      : (typeof record.portrait === "string" ? record.portrait : "");

    if (isDataImageUrl(portraitImage)) {
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
        record.portrait.image = dataUrl;
      } else if (record.portrait === PORTRAIT_BLOB_MARKER) {
        record.portrait = dataUrl;
      }
    } else if (record.portrait && typeof record.portrait === "object" && record.portrait.image === PORTRAIT_BLOB_MARKER) {
      record.portrait.image = DEFAULT_PORTRAIT;
    } else if (record.portrait === PORTRAIT_BLOB_MARKER) {
      record.portrait = DEFAULT_PORTRAIT;
    }

    return record;
  }

  async function stateToDbPayload(state) {
    var source = state && typeof state === "object" ? state : initialState();
    var characters = await Promise.all((source.characters || []).map(serializeCharacterForStorage));

    var timelines = characters.map(function (character) {
      return {
        id: character.id,
        events: clone(character.timeline || [])
      };
    });

    characters.forEach(function (character) {
      delete character.timeline;
    });

    var settings = {
      id: "app",
      title: source.title,
      relationshipCategories: clone(source.relationshipCategories || []),
      tagGroups: clone(source.tagGroups || []),
      badges: clone(source.badges || []),
      overlays: clone(source.overlays || [])
    };

    var sessions = {
      id: "current",
      session: source.session,
      notes: clone(source.notes || [])
    };

    var extra = {};
    Object.keys(source).forEach(function (key) {
      if (["title", "session", "notes", "characters", "relationships", "zones", "relationshipCategories", "tagGroups", "badges", "overlays"].indexOf(key) >= 0) {
        return;
      }
      extra[key] = clone(source[key]);
    });

    return {
      characters: characters,
      relationships: clone(source.relationships || []),
      locations: clone(source.zones || []),
      timeline: timelines,
      sessions: sessions,
      settings: settings,
      extra: { id: "extra", data: extra }
    };
  }

  async function persistStateToIndexedDb(state) {
    var db = await openCampaignAtlasDb();
    var payload = await stateToDbPayload(state);
    var transaction = db.transaction(
      [STORE_CHARACTERS, STORE_RELATIONSHIPS, STORE_LOCATIONS, STORE_TIMELINE, STORE_SESSIONS, STORE_SETTINGS],
      "readwrite"
    );

    var characterStore = transaction.objectStore(STORE_CHARACTERS);
    var relationshipStore = transaction.objectStore(STORE_RELATIONSHIPS);
    var locationStore = transaction.objectStore(STORE_LOCATIONS);
    var timelineStore = transaction.objectStore(STORE_TIMELINE);
    var sessionsStore = transaction.objectStore(STORE_SESSIONS);
    var settingsStore = transaction.objectStore(STORE_SETTINGS);

    characterStore.clear();
    relationshipStore.clear();
    locationStore.clear();
    timelineStore.clear();
    sessionsStore.clear();
    settingsStore.clear();

    payload.characters.forEach(function (item) { characterStore.put(item); });
    payload.relationships.forEach(function (item) { relationshipStore.put(item); });
    payload.locations.forEach(function (item) { locationStore.put(item); });
    payload.timeline.forEach(function (item) { timelineStore.put(item); });
    sessionsStore.put(payload.sessions);
    settingsStore.put(payload.settings);
    settingsStore.put(payload.extra);

    await transactionToPromise(transaction);
  }

  async function readStateFromIndexedDb() {
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction(
      [STORE_CHARACTERS, STORE_RELATIONSHIPS, STORE_LOCATIONS, STORE_TIMELINE, STORE_SESSIONS, STORE_SETTINGS],
      "readonly"
    );

    var charactersReq = transaction.objectStore(STORE_CHARACTERS).getAll();
    var relationshipsReq = transaction.objectStore(STORE_RELATIONSHIPS).getAll();
    var locationsReq = transaction.objectStore(STORE_LOCATIONS).getAll();
    var timelineReq = transaction.objectStore(STORE_TIMELINE).getAll();
    var sessionsReq = transaction.objectStore(STORE_SESSIONS).get("current");
    var settingsReq = transaction.objectStore(STORE_SETTINGS).get("app");
    var extraReq = transaction.objectStore(STORE_SETTINGS).get("extra");

    var storedCharactersRawPromise = requestToPromise(charactersReq);
    var storedRelationshipsPromise = requestToPromise(relationshipsReq);
    var storedLocationsPromise = requestToPromise(locationsReq);
    var storedTimelinePromise = requestToPromise(timelineReq);
    var storedSessionPromise = requestToPromise(sessionsReq);
    var storedSettingsPromise = requestToPromise(settingsReq);
    var storedExtraPromise = requestToPromise(extraReq);

    await transactionToPromise(transaction);

    var storedCharactersRaw = await storedCharactersRawPromise;
    var storedRelationships = await storedRelationshipsPromise;
    var storedLocations = await storedLocationsPromise;
    var storedTimeline = await storedTimelinePromise;
    var storedSession = await storedSessionPromise;
    var storedSettings = await storedSettingsPromise;
    var storedExtra = await storedExtraPromise;

    var state = initialState();
    var timelineByCharacter = {};
    (storedTimeline || []).forEach(function (entry) {
      timelineByCharacter[entry.id] = clone(entry.events || []);
    });

    var storedCharacters = await Promise.all((storedCharactersRaw || []).map(deserializeCharacterFromStorage));
    state.characters = storedCharacters.map(function (character) {
      var next = Object.assign({}, character);
      if (timelineByCharacter[next.id] !== undefined) {
        next.timeline = clone(timelineByCharacter[next.id]);
      }
      return normalizeCharacterRecord(next);
    });

    if (storedRelationships && storedRelationships.length) {
      state.relationships = clone(storedRelationships);
    }
    if (storedLocations && storedLocations.length) {
      state.zones = clone(storedLocations);
    }
    if (storedSession) {
      state.session = storedSession.session !== undefined ? storedSession.session : state.session;
      state.notes = clone(storedSession.notes || []);
    }
    if (storedSettings) {
      state.title = storedSettings.title !== undefined ? storedSettings.title : state.title;
      state.relationshipCategories = clone(storedSettings.relationshipCategories || []);
      state.tagGroups = clone(storedSettings.tagGroups || []);
      state.badges = clone(storedSettings.badges || []);
      state.overlays = clone(storedSettings.overlays || []);
    }
    if (storedExtra && storedExtra.data && typeof storedExtra.data === "object") {
      state = Object.assign(state, clone(storedExtra.data));
    }

    return state;
  }

  async function indexedDbHasData() {
    var db = await openCampaignAtlasDb();
    var transaction = db.transaction([STORE_CHARACTERS, STORE_RELATIONSHIPS, STORE_LOCATIONS, STORE_SETTINGS], "readonly");
    var charsCountReq = transaction.objectStore(STORE_CHARACTERS).count();
    var relCountReq = transaction.objectStore(STORE_RELATIONSHIPS).count();
    var locCountReq = transaction.objectStore(STORE_LOCATIONS).count();
    var settingsReq = transaction.objectStore(STORE_SETTINGS).get("app");
    var charsCountPromise = requestToPromise(charsCountReq);
    var relCountPromise = requestToPromise(relCountReq);
    var locCountPromise = requestToPromise(locCountReq);
    var settingsPromise = requestToPromise(settingsReq);
    await transactionToPromise(transaction);
    var charsCount = await charsCountPromise;
    var relCount = await relCountPromise;
    var locCount = await locCountPromise;
    var settings = await settingsPromise;
    return Boolean(charsCount || relCount || locCount || settings);
  }

  function loadStateFromLocalStorage() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var merged = Object.assign(initialState(), JSON.parse(raw));
      merged.characters = (merged.characters || []).map(normalizeCharacterRecord);
      return merged;
    } catch (_error) {
      return null;
    }
  }

  async function migrateLocalStorageToIndexedDbIfNeeded() {
    var legacyState = loadStateFromLocalStorage();
    if (!legacyState) {
      return;
    }

    var hasIndexedData = await indexedDbHasData();
    if (hasIndexedData) {
      return;
    }

    await persistStateToIndexedDb(legacyState);
    var migrated = await readStateFromIndexedDb();
    var verified =
      (migrated.characters || []).length === (legacyState.characters || []).length &&
      (migrated.relationships || []).length === (legacyState.relationships || []).length &&
      (migrated.zones || []).length === (legacyState.zones || []).length &&
      migrated.title === legacyState.title &&
      migrated.session === legacyState.session;

    if (!verified) {
      throw new Error("LocalStorage to IndexedDB migration verification failed.");
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }

  async function loadInitialState() {
    var localFallback = loadStateFromLocalStorage();
    if (!indexedDbAvailable()) {
      return localFallback || initialState();
    }

    try {
      await migrateLocalStorageToIndexedDbIfNeeded();
      var dbState = await readStateFromIndexedDb();
      var hasUsefulData = (dbState.characters && dbState.characters.length) || (dbState.relationships && dbState.relationships.length);
      if (hasUsefulData) {
        return dbState;
      }
      return localFallback || initialState();
    } catch (error) {
      console.warn("IndexedDB load failed; using local fallback.", error);
      return localFallback || initialState();
    }
  }

  function initialState() {
    return {
      title: "Melbourne by Night",
      session: "Session 18 - Red Ledger",
      notes: ["Prep Elysium confrontation", "Track coterie influence"],
      characters: [
        { id: "prince", name: "Prince Taylor", clan: "Brujah", sect: "Camarilla", status: "Active", concept: "Domain monarch", generation: "9", sire: "Helena Arkwright", predatorType: "Extortionist", ambition: "Keep Melbourne stable", desire: "Expose conspirators", convictions: "Order before mercy", touchstones: "Old Parliament House keeper", bio: "A feared prince balancing authority and survival.", timeline: "1882 born\n1921 embraced", gmNotes: "Never make him one-note.", tags: ["Prince", "Power"], x: 760, y: 150, portrait: PORTRAITS[13] },
        { id: "alexandra", name: "Seneschal Alexandra", clan: "Toreador", sect: "Camarilla", status: "Active", concept: "Court architect", generation: "10", sire: "Armand de Vries", predatorType: "Siren", ambition: "Preserve influence", desire: "Control court narratives", convictions: "Beauty is leverage", touchstones: "Opera house director", bio: "Elegant strategist and social engineer.", timeline: "1898 embraced", gmNotes: "Information broker.", tags: ["Court"], x: 320, y: 160, portrait: PORTRAITS[19] },
        { id: "whitlock", name: "Primogen James Whitlock", clan: "Ventrue", sect: "Camarilla", status: "Active", concept: "Industrial baron", generation: "8", sire: "Edmund Vale", predatorType: "Scene Queen", ambition: "Expand authority", desire: "Contain rivals", convictions: "Power rewards discipline", touchstones: "Family legal counsel", bio: "Old money, older loyalties.", timeline: "1864 embraced", gmNotes: "Political pressure point.", tags: ["Primogen"], x: 760, y: 360, portrait: PORTRAITS[20] },
        { id: "amelia", name: "Dr Amelia Rhodes", clan: "Malkavian", sect: "Anarch", status: "Missing", concept: "Prophetic surgeon", generation: "11", sire: "Nico Bell", predatorType: "Bagger", ambition: "Decode prophecy", desire: "Find witness", convictions: "Truth over comfort", touchstones: "Emergency ward mentor", bio: "Brilliant mind haunted by visions.", timeline: "1999 embraced", gmNotes: "Use as mystery anchor.", tags: ["Mystic"], x: 760, y: 610, portrait: PORTRAITS[22] }
      ],
      zones: [
        { id: "zone-council", name: "Primogen Council", x: 480, y: 230, width: 1000, height: 220, color: "#d10d40", opacity: 0.16, borderThickness: 2, description: "Inner political ring", lock: false, hidden: false },
        { id: "zone-coterie", name: "Player Coterie", x: 520, y: 770, width: 860, height: 250, color: "#8b1e46", opacity: 0.2, borderThickness: 2, description: "Player operations", lock: false, hidden: false }
      ],
      relationships: [
        { id: "r1", from: "alexandra", to: "prince", category: "Romantic", type: "Partner", color: "#d14b7f", thickness: 2, style: "dashed", arrow: "none", labelColor: "#ffffff", opacity: 1, visible: true },
        { id: "r2", from: "whitlock", to: "prince", category: "Vampire Relations", type: "Sire", color: "#d10d40", thickness: 2, style: "solid", arrow: "end", labelColor: "#ffffff", opacity: 1, visible: true },
        { id: "r3", from: "amelia", to: "whitlock", category: "Vampire Relations", type: "Sire", color: "#d10d40", thickness: 2, style: "solid", arrow: "end", labelColor: "#ffffff", opacity: 1, visible: true }
      ],
      relationshipCategories: [
        { id: "cat-vamp", name: "Vampire Relations", color: "#d10d40", types: ["Sire", "Childe"] },
        { id: "cat-rom", name: "Romantic", color: "#d14b7f", types: ["Partner", "Former Lover"] }
      ],
      tagGroups: [
        { id: "tg1", name: "Politics", tags: [{ id: "t1", name: "Prince", color: "#d10d40", icon: "♛", description: "Ruling authority", visible: true }, { id: "t2", name: "Council", color: "#8b1e46", icon: "◎", description: "Council aligned", visible: true }] }
      ],
      badges: [
        { id: "b1", name: "Crown", position: "Top", icon: "♛", color: "#d10d40", priority: 1, tooltip: "Domain authority", visible: true }
      ],
      overlays: [
        { id: "o1", name: "Missing", icon: "◌", text: "MISSING", position: "Centre", size: 1, color: "#ff335f", opacity: 0.85, animation: "Pulse", visibleWhen: "status=Missing", enabled: true }
      ]
    };
  }

  function App(props) {
    var loaded = useMemo(function () {
      var source = props && props.initialData ? props.initialData : initialState();
      var merged = Object.assign(initialState(), source);
      merged.characters = (merged.characters || []).map(normalizeCharacterRecord);
      return merged;
    }, [props && props.initialData]);

    var _state = useState(loaded);
    var data = _state[0];
    var setData = _state[1];

    var _panel = useState(null);
    var activePanel = _panel[0];
    var setActivePanel = _panel[1];

    var _selected = useState([]);
    var selected = _selected[0];
    var setSelected = _selected[1];

    var _focused = useState(data.characters[0] ? data.characters[0].id : null);
    var focusedId = _focused[0];
    var setFocusedId = _focused[1];

    var _view = useState({ x: 80, y: 60, scale: 0.58 });
    var view = _view[0];
    var setView = _view[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

    var _sort = useState("name");
    var sortMode = _sort[0];
    var setSortMode = _sort[1];

    var _characterView = useState("directory");
    var characterView = _characterView[0];
    var setCharacterView = _characterView[1];

    var _characterEditMode = useState(false);
    var characterEditMode = _characterEditMode[0];
    var setCharacterEditMode = _characterEditMode[1];

    var _characterEditOrigin = useState("directory");
    var characterEditOrigin = _characterEditOrigin[0];
    var setCharacterEditOrigin = _characterEditOrigin[1];

    var _characterDraft = useState(null);
    var characterDraft = _characterDraft[0];
    var setCharacterDraft = _characterDraft[1];

    var _workspaceMode = useState("map");
    var workspaceMode = _workspaceMode[0];
    var setWorkspaceMode = _workspaceMode[1];

    var _profileEditMode = useState(false);
    var profileEditMode = _profileEditMode[0];
    var setProfileEditMode = _profileEditMode[1];

    var _timelineExpandedIndex = useState(null);
    var timelineExpandedIndex = _timelineExpandedIndex[0];
    var setTimelineExpandedIndex = _timelineExpandedIndex[1];

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
      loading: false,
      error: ""
    });
    var portraitWorkflow = _portraitWorkflow[0];
    var setPortraitWorkflow = _portraitWorkflow[1];

    var _panning = useState(false);
    var isPanning = _panning[0];
    var setIsPanning = _panning[1];

    var _draggingId = useState(null);
    var draggingId = _draggingId[0];
    var setDraggingId = _draggingId[1];

    var _drawingZone = useState(false);
    var drawingZone = _drawingZone[0];
    var setDrawingZone = _drawingZone[1];

    var _zoneDraft = useState(null);
    var zoneDraft = _zoneDraft[0];
    var setZoneDraft = _zoneDraft[1];

    var _contextMenu = useState(null);
    var contextMenu = _contextMenu[0];
    var setContextMenu = _contextMenu[1];

    var _undo = useState([]);
    var undoStack = _undo[0];
    var setUndoStack = _undo[1];

    var _redo = useState([]);
    var redoStack = _redo[0];
    var setRedoStack = _redo[1];

    var viewportRef = useRef(null);
    var directoryListRef = useRef(null);
    var directoryScrollRef = useRef(0);
    var previousPanelRef = useRef(activePanel);
    var profileReturnRef = useRef({ panel: "characters", characterView: "details" });
    var profilePortraitInputRef = useRef(null);
    var storageWriteErrorRef = useRef(false);
    var portraitDragRef = useRef({ active: false, pointerId: null, lastX: 0, lastY: 0 });
    var portraitPinchRef = useRef({ active: false, startDistance: 0, startZoom: 1 });
    var portraitStageSizeRef = useRef(PORTRAIT_EDITOR_SIZE);
    var panRef = useRef({ x: 0, y: 0 });
    var dragOffsetRef = useRef({ x: 0, y: 0 });
    var nodeDragRef = useRef({
      active: false,
      pointerId: null,
      nodeId: null,
      startPointerX: 0,
      startPointerY: 0,
      startNodeX: 0,
      startNodeY: 0,
      captureElement: null,
      cleanup: null,
      priorBodyUserSelect: "",
      priorBodyWebkitUserSelect: ""
    });

    function isEditableElement(element) {
      if (!element || element === document.body || element === document.documentElement) {
        return false;
      }
      if (element.isContentEditable) {
        return true;
      }
      var tagName = element.tagName ? String(element.tagName).toUpperCase() : "";
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
        return true;
      }
      if (element.getAttribute && element.getAttribute("role") === "textbox") {
        return true;
      }
      if (element.getAttribute) {
        var contentEditable = element.getAttribute("contenteditable");
        if (contentEditable && contentEditable !== "false") {
          return true;
        }
      }
      if (element.closest && (element.closest('[contenteditable="true"]') || element.closest('[role="textbox"]'))) {
        return true;
      }
      return false;
    }

    function commit(mutator) {
      setData(function (prev) {
        var snapshot = clone(prev);
        var next = clone(prev);
        mutator(next);
        setUndoStack(function (s) { return s.concat([snapshot]).slice(-50); });
        setRedoStack([]);
        return next;
      });
    }

    function undo() {
      if (!undoStack.length) {
        return;
      }
      var prior = undoStack[undoStack.length - 1];
      setUndoStack(undoStack.slice(0, -1));
      setRedoStack(redoStack.concat([clone(data)]).slice(-50));
      setData(prior);
    }

    function redo() {
      if (!redoStack.length) {
        return;
      }
      var next = redoStack[redoStack.length - 1];
      setRedoStack(redoStack.slice(0, -1));
      setUndoStack(undoStack.concat([clone(data)]).slice(-50));
      setData(next);
    }

    function togglePanel(panelKey) {
      setActivePanel(function (current) {
        return current === panelKey ? null : panelKey;
      });
    }

    function finishZoneDraft() {
      if (!zoneDraft) {
        return;
      }
      var x = Math.min(zoneDraft.x, zoneDraft.x + zoneDraft.width);
      var y = Math.min(zoneDraft.y, zoneDraft.y + zoneDraft.height);
      var width = Math.abs(zoneDraft.width);
      var height = Math.abs(zoneDraft.height);
      if (width > 20 && height > 20) {
        commit(function (next) {
          next.zones.push({
            id: "zone-" + Date.now(),
            name: "New Zone",
            x: x,
            y: y,
            width: width,
            height: height,
            color: "#d10d40",
            opacity: 0.18,
            borderThickness: 2,
            description: "",
            lock: false,
            hidden: false
          });
        });
      }
      setZoneDraft(null);
      setDrawingZone(false);
    }

    function cancelZoneDraft() {
      setZoneDraft(null);
      setDrawingZone(false);
    }

    function completeConnection() {
      if (selected.length !== 2) {
        return;
      }
      var from = selected[0];
      var to = selected[1];
      if (from === to) {
        return;
      }
      var existing = data.relationships.find(function (r) {
        return (r.from === from && r.to === to) || (r.from === to && r.to === from);
      });
      if (existing) {
        setActivePanel("relationships");
        return;
      }

      var defaultCategory = data.relationshipCategories[0] || { name: "General", color: "#d10d40" };
      var defaultType = defaultCategory.types && defaultCategory.types[0] ? defaultCategory.types[0] : "Connection";
      commit(function (next) {
        next.relationships.push({
          id: "r-" + Date.now(),
          from: from,
          to: to,
          category: defaultCategory.name,
          type: defaultType,
          color: defaultCategory.color,
          thickness: 2,
          style: "solid",
          arrow: "none",
          labelColor: "#ffffff",
          opacity: 1,
          visible: true
        });
      });
      setActivePanel("relationships");
    }

    useEffect(function () {
      if (!indexedDbAvailable()) {
        return;
      }

      var snapshot = clone(data);
      persistenceQueue = persistenceQueue
        .catch(function () { return null; })
        .then(function () {
          return persistStateToIndexedDb(snapshot);
        });

      persistenceQueue
        .then(function () {
          storageWriteErrorRef.current = false;
        })
        .catch(function (error) {
          if (!storageWriteErrorRef.current) {
            storageWriteErrorRef.current = true;
            console.warn("Relationship map state could not be persisted to IndexedDB.", error);
          }
        });
    }, [data]);

    useEffect(function () {
      if (activePanel === "characters" && previousPanelRef.current !== "characters") {
        setCharacterView("directory");
        setCharacterEditMode(false);
        setCharacterDraft(null);
      }
      previousPanelRef.current = activePanel;
    }, [activePanel]);

    useEffect(function () {
      function onKey(event) {
        if (isEditableElement(document.activeElement)) {
          return;
        }

        if (event.key === "Escape" && nodeDragRef.current.active) {
          endNodeDrag();
        }
        if (event.key === "Escape") {
          setActivePanel(null);
          setContextMenu(null);
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
          event.preventDefault();
          redo();
        }

        if (event.key === "Delete") {
          if (workspaceMode !== "map" || profileEditMode || characterEditMode || portraitWorkflow.open || !selected.length) {
            return;
          }
          event.preventDefault();
          commit(function (next) {
            next.characters = next.characters.filter(function (c) { return selected.indexOf(c.id) < 0; });
            next.relationships = next.relationships.filter(function (r) { return selected.indexOf(r.from) < 0 && selected.indexOf(r.to) < 0; });
          });
          setSelected([]);
        }
      }
      document.addEventListener("keydown", onKey);
      return function () { document.removeEventListener("keydown", onKey); };
    }, [selected, undoStack, redoStack, data, workspaceMode, profileEditMode, characterEditMode, portraitWorkflow.open]);

    useEffect(function () {
      return function () {
        endNodeDrag();
      };
    }, []);

    var focused = data.characters.find(function (c) { return c.id === focusedId; }) || null;

    function pointOnCanvas(clientX, clientY) {
      var rect = viewportRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.x) / view.scale,
        y: (clientY - rect.top - view.y) / view.scale
      };
    }

    function onCanvasMouseDown(event) {
      if (event.button !== 0) {
        return;
      }
      if (drawingZone) {
        var pz = pointOnCanvas(event.clientX, event.clientY);
        setZoneDraft({ x: pz.x, y: pz.y, width: 0, height: 0 });
        return;
      }
      setContextMenu(null);
      setIsPanning(true);
      panRef.current = { x: event.clientX - view.x, y: event.clientY - view.y };
    }

    function onCanvasMouseMove(event) {
      if (zoneDraft) {
        var p = pointOnCanvas(event.clientX, event.clientY);
        setZoneDraft({ x: zoneDraft.x, y: zoneDraft.y, width: p.x - zoneDraft.x, height: p.y - zoneDraft.y });
        return;
      }

      if (isPanning) {
        setView({ x: event.clientX - panRef.current.x, y: event.clientY - panRef.current.y, scale: view.scale });
      }
    }

    function endNodeDrag() {
      var drag = nodeDragRef.current;
      if (!drag.active && !drag.cleanup) {
        return;
      }

      nodeDragRef.current.active = false;

      if (typeof drag.cleanup === "function") {
        drag.cleanup();
      }

      if (document && document.body) {
        document.body.style.userSelect = drag.priorBodyUserSelect || "";
        document.body.style.webkitUserSelect = drag.priorBodyWebkitUserSelect || "";
      }

      if (drag.captureElement && drag.pointerId !== null && drag.captureElement.releasePointerCapture) {
        try {
          drag.captureElement.releasePointerCapture(drag.pointerId);
        } catch (_error) {
          // Pointer capture may already be released; ignore.
        }
      }

      nodeDragRef.current = {
        active: false,
        pointerId: null,
        nodeId: null,
        startPointerX: 0,
        startPointerY: 0,
        startNodeX: 0,
        startNodeY: 0,
        captureElement: null,
        cleanup: null,
        priorBodyUserSelect: "",
        priorBodyWebkitUserSelect: ""
      };

      setDraggingId(null);
    }

    function onCanvasMouseUp() {
      endNodeDrag();
      setIsPanning(false);
      if (zoneDraft) {
        finishZoneDraft();
      }
    }

    function onWheel(event) {
      event.preventDefault();
      var rect = viewportRef.current.getBoundingClientRect();
      var ox = event.clientX - rect.left;
      var oy = event.clientY - rect.top;
      var zoom = event.deltaY < 0 ? 1.08 : 0.92;
      var nextScale = Math.min(2.4, Math.max(0.2, view.scale * zoom));
      var ratio = nextScale / view.scale;
      setView({
        scale: nextScale,
        x: ox - (ox - view.x) * ratio,
        y: oy - (oy - view.y) * ratio
      });
    }

    function onNodePointerDown(event, character) {
      if (event.button !== 0 || !event.isPrimary) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      if (nodeDragRef.current.active) {
        endNodeDrag();
      }

      var startPoint = pointOnCanvas(event.clientX, event.clientY);

      if (document && document.body) {
        nodeDragRef.current.priorBodyUserSelect = document.body.style.userSelect || "";
        nodeDragRef.current.priorBodyWebkitUserSelect = document.body.style.webkitUserSelect || "";
        document.body.style.userSelect = "none";
        document.body.style.webkitUserSelect = "none";
      }

      var onWindowPointerMove = function (moveEvent) {
        var drag = nodeDragRef.current;
        if (!drag.active || moveEvent.pointerId !== drag.pointerId) {
          return;
        }
        if ((moveEvent.buttons & 1) !== 1) {
          endNodeDrag();
          return;
        }
        moveEvent.preventDefault();

        var current = pointOnCanvas(moveEvent.clientX, moveEvent.clientY);
        var nextX = Math.round(drag.startNodeX + (current.x - drag.startPointerX));
        var nextY = Math.round(drag.startNodeY + (current.y - drag.startPointerY));

        commit(function (next) {
          var target = next.characters.find(function (c) { return c.id === drag.nodeId; });
          if (target) {
            target.x = nextX;
            target.y = nextY;
          }
        });
      };

      var onWindowPointerUp = function (upEvent) {
        var drag = nodeDragRef.current;
        if (drag.active && upEvent.pointerId === drag.pointerId) {
          endNodeDrag();
        }
      };

      var onWindowMouseUp = function () {
        if (nodeDragRef.current.active) {
          endNodeDrag();
        }
      };

      var onWindowPointerCancel = function (cancelEvent) {
        var drag = nodeDragRef.current;
        if (drag.active && cancelEvent.pointerId === drag.pointerId) {
          endNodeDrag();
        }
      };

      var onWindowMouseOut = function (outEvent) {
        if (!outEvent.relatedTarget && nodeDragRef.current.active) {
          endNodeDrag();
        }
      };

      var onWindowBlur = function () {
        if (nodeDragRef.current.active) {
          endNodeDrag();
        }
      };

      var cleanup = function () {
        window.removeEventListener("pointermove", onWindowPointerMove, true);
        window.removeEventListener("pointerup", onWindowPointerUp, true);
        window.removeEventListener("mouseup", onWindowMouseUp, true);
        window.removeEventListener("pointercancel", onWindowPointerCancel, true);
        window.removeEventListener("mouseout", onWindowMouseOut, true);
        window.removeEventListener("blur", onWindowBlur, true);
      };

      window.addEventListener("pointermove", onWindowPointerMove, true);
      window.addEventListener("pointerup", onWindowPointerUp, true);
      window.addEventListener("mouseup", onWindowMouseUp, true);
      window.addEventListener("pointercancel", onWindowPointerCancel, true);
      window.addEventListener("mouseout", onWindowMouseOut, true);
      window.addEventListener("blur", onWindowBlur, true);

      nodeDragRef.current.active = true;
      nodeDragRef.current.pointerId = event.pointerId;
      nodeDragRef.current.nodeId = character.id;
      nodeDragRef.current.startPointerX = startPoint.x;
      nodeDragRef.current.startPointerY = startPoint.y;
      nodeDragRef.current.startNodeX = character.x;
      nodeDragRef.current.startNodeY = character.y;
      nodeDragRef.current.captureElement = event.currentTarget;
      nodeDragRef.current.cleanup = cleanup;

      if (event.currentTarget && event.currentTarget.setPointerCapture) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch (_error) {
          // Continue with global listeners when pointer capture is unavailable.
        }
      }

      setDraggingId(character.id);
      if (event.shiftKey) {
        setSelected(selected.indexOf(character.id) >= 0 ? selected.filter(function (id) { return id !== character.id; }) : selected.concat([character.id]));
      } else {
        setSelected([character.id]);
      }
    }

    function onNodeLostPointerCapture(event) {
      var drag = nodeDragRef.current;
      if (drag.active && event.pointerId === drag.pointerId) {
        endNodeDrag();
      }
    }

    function updateCharacter(id, field, value) {
      commit(function (next) {
        var target = next.characters.find(function (c) { return c.id === id; });
        if (target) {
          target[field] = value;
        }
      });
    }

    function createCharacter() {
      var id = "char-" + Date.now();
      commit(function (next) {
        next.characters.push({ id: id, name: "New Character", clan: "None", sect: "None", status: "Active", concept: "", generation: "", sire: "", predatorType: "", ambition: "", desire: "", convictions: "", touchstones: "", bio: "", timeline: [], gmNotes: "", storytellerNotes: "", gmOnlyInformation: "", dateOfBirth: "", dateOfDeath: "", tags: [], x: 960, y: 700, portrait: DEFAULT_PORTRAIT, outlineColor: "#d10d40", nodeSize: 1, nodeShape: "circle", hidden: false });
      });
      setFocusedId(id);
      setSelected([id]);
      setActivePanel("characters");
      setCharacterView("details");
      setCharacterEditMode(false);
    }

    function exportJson() {
      return JSON.stringify(data, null, 2);
    }

    function importJson(raw) {
      try {
        var parsed = JSON.parse(raw);
        var merged = Object.assign(initialState(), parsed);
        merged.characters = (merged.characters || []).map(normalizeCharacterRecord);
        setData(merged);
        setUndoStack([]);
        setRedoStack([]);
      } catch (_e) {
        window.alert("Invalid JSON");
      }
    }

    function characterList() {
      var q = search.trim().toLowerCase();
      var result = data.characters.filter(function (c) {
        var text = [c.name, c.clan, c.sect, (c.tags || []).join(" ")].join(" ").toLowerCase();
        return !q || text.indexOf(q) >= 0;
      });

      result.sort(function (a, b) {
        if (sortMode === "clan") {
          return a.clan.localeCompare(b.clan);
        }
        if (sortMode === "sect") {
          return a.sect.localeCompare(b.sect);
        }
        return a.name.localeCompare(b.name);
      });

      return result;
    }

    function panelHeader(title) {
      return html`<div className="panel-header">
        <h2>${title}</h2>
        <button onClick=${function () { setActivePanel(null); }} aria-label="Close panel">×</button>
      </div>`;
    }

    function openCharacterProfile(openInEdit) {
      if (!focused) {
        return;
      }
      profileReturnRef.current = {
        panel: activePanel || "characters",
        characterView: characterView || "details"
      };
      setCharacterEditMode(false);
      if (openInEdit) {
        setCharacterDraft(characterToDraft(focused));
        setProfileEditMode(true);
      } else {
        setCharacterDraft(null);
        setProfileEditMode(false);
      }
      setTimelineExpandedIndex(null);
      setWorkspaceMode("profile");
    }

    function returnFromCharacterProfile() {
      var restore = profileReturnRef.current || { panel: "characters", characterView: "details" };
      setWorkspaceMode("map");
      setActivePanel(restore.panel || "characters");
      setCharacterView(restore.characterView || "details");
      setCharacterEditMode(false);
      setProfileEditMode(false);
      setCharacterDraft(null);
      setTimelineExpandedIndex(null);
    }

    function updateDraftField(field, value) {
      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var next = Object.assign({}, prev);
        next[field] = value;
        return next;
      });
    }

    function updateTimelineEvent(index, field, value) {
      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var events = (prev.timelineEvents || []).slice();
        if (index < 0 || index >= events.length) {
          return prev;
        }
        var updated = normalizeTimelineEvent(events[index]);
        updated[field] = field === "date" ? normalizeIsoDate(value) : String(value || "");
        events[index] = updated;
        return Object.assign({}, prev, { timelineEvents: events });
      });
    }

    function addTimelineEvent() {
      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var events = (prev.timelineEvents || []).slice();
        events.push({ date: "", title: "", description: "" });
        setTimelineExpandedIndex(events.length - 1);
        return Object.assign({}, prev, { timelineEvents: events });
      });
    }

    function removeTimelineEvent(index) {
      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var events = (prev.timelineEvents || []).slice();
        if (index < 0 || index >= events.length) {
          return prev;
        }
        events.splice(index, 1);
        setTimelineExpandedIndex(function (current) {
          if (current === null || current === undefined) {
            return null;
          }
          if (current === index) {
            return null;
          }
          if (current > index) {
            return current - 1;
          }
          return current;
        });
        return Object.assign({}, prev, { timelineEvents: events });
      });
    }

    function moveTimelineEvent(index, direction) {
      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        var events = (prev.timelineEvents || []).slice();
        var nextIndex = index + direction;
        if (index < 0 || index >= events.length || nextIndex < 0 || nextIndex >= events.length) {
          return prev;
        }
        var temp = events[index];
        events[index] = events[nextIndex];
        events[nextIndex] = temp;
        return Object.assign({}, prev, { timelineEvents: events });
      });
    }

    function sortDraftTimelineChronologically() {
      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        return Object.assign({}, prev, {
          timelineEvents: sortTimelineEvents(prev.timelineEvents || [])
        });
      });
    }

    function startProfileEdit() {
      if (!focused) {
        return;
      }
      setCharacterDraft(characterToDraft(focused));
      setProfileEditMode(true);
      var focusedTimeline = timelineEventsFromAny(focused.timeline);
      setTimelineExpandedIndex(focusedTimeline.length ? 0 : null);
    }

    function cancelProfileEdit() {
      setProfileEditMode(false);
      setCharacterDraft(null);
      setTimelineExpandedIndex(null);
    }

    function saveProfileEdit() {
      if (!focused || !characterDraft) {
        return;
      }
      commit(function (next) {
        var target = next.characters.find(function (c) { return c.id === focused.id; });
        if (!target) {
          return;
        }
        target.name = characterDraft.name.trim() || "Unnamed Character";
        var portraitCurrent = portraitState(characterDraft);
        var portraitSource = portraitCurrent.source || DEFAULT_PORTRAIT;
        var portraitZoom = portraitCurrent.zoom;
        var portraitCropCenterX = portraitCurrent.cropCenterX;
        var portraitCropCenterY = portraitCurrent.cropCenterY;
        target.portrait = {
          image: portraitSource,
          imageWidth: portraitCurrent.imageWidth,
          imageHeight: portraitCurrent.imageHeight,
          cropCenterX: portraitCropCenterX,
          cropCenterY: portraitCropCenterY,
          zoom: portraitZoom,
          // Backward compatible aliases.
          cropX: portraitCropCenterX,
          cropY: portraitCropCenterY
        };
        target.clan = normalizeClanValue(characterDraft.clan);
        target.sect = normalizeSectValue(characterDraft.sect);
        target.status = characterDraft.status;
        target.concept = characterDraft.concept;
        target.ambition = characterDraft.ambition;
        target.desire = characterDraft.desire;
        target.convictions = characterDraft.convictions;
        target.touchstones = characterDraft.touchstones;
        target.predatorType = characterDraft.predatorType;
        target.generation = characterDraft.generation;
        target.sire = characterDraft.sire;
        target.trueAge = characterDraft.trueAge;
        target.apparentAge = characterDraft.apparentAge;
        target.dateOfBirth = normalizeIsoDate(characterDraft.dateOfBirth);
        target.dateOfDeath = normalizeIsoDate(characterDraft.dateOfDeath);
        target.storytellerNotes = String(characterDraft.storytellerNotes || "");
        target.gmOnlyInformation = String(characterDraft.gmOnlyInformation || "");
        target.gmNotes = String(characterDraft.storytellerNotes || "");
        target.timeline = sortTimelineEvents((characterDraft.timelineEvents || []).map(normalizeTimelineEvent));
        target.bioHtml = characterDraft.bioHtml;
        target.bio = richHtmlToText(characterDraft.bioHtml);
        target.tags = String(characterDraft.tagsText || "")
          .split(",")
          .map(function (t) { return t.trim(); })
          .filter(function (t) { return t.length > 0; });
      });
      setProfileEditMode(false);
      setCharacterDraft(null);
      setTimelineExpandedIndex(null);
    }

    function closePortraitWorkflow() {
      portraitDragRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0 };
      portraitPinchRef.current = { active: false, startDistance: 0, startZoom: 1 };
      setPortraitWorkflow(function (prev) {
        return Object.assign({}, prev, {
          open: false,
          step: "replace",
          loading: false,
          error: "",
          urlInput: ""
        });
      });
    }

    function openPortraitWorkflow() {
      if (!characterDraft) {
        return;
      }
      var state = portraitState(characterDraft);
      setPortraitWorkflow({
        open: true,
        step: "replace",
        source: state.source,
        zoom: state.zoom,
        minZoom: 1,
        cropCenterX: state.cropCenterX,
        cropCenterY: state.cropCenterY,
        imageWidth: state.imageWidth,
        imageHeight: state.imageHeight,
        urlInput: "",
        loading: false,
        error: ""
      });
    }

    function loadPortraitForAdjust(source, keepExistingCrop) {
      if (!source) {
        return;
      }
      var current = keepExistingCrop ? portraitState(characterDraft || focused) : { zoom: 1, cropCenterX: 0.5, cropCenterY: 0.5 };
      setPortraitWorkflow(function (prev) {
        return Object.assign({}, prev, {
          loading: true,
          error: ""
        });
      });

      var image = new Image();
      image.onload = function () {
        var minZoom = minimumPortraitZoom(image.width, image.height, PORTRAIT_EDITOR_SIZE);
        var zoom = Math.max(minZoom, Number(current.zoom) || minZoom);
        var clampedCenter = clampCropCenter(current.cropCenterX, current.cropCenterY, zoom, image.width, image.height);
        setPortraitWorkflow(function (prev) {
          return Object.assign({}, prev, {
            open: true,
            step: "adjust",
            source: source,
            zoom: zoom,
            minZoom: minZoom,
            cropCenterX: clampedCenter.x,
            cropCenterY: clampedCenter.y,
            imageWidth: image.width,
            imageHeight: image.height,
            loading: false,
            error: ""
          });
        });
      };
      image.onerror = function () {
        setPortraitWorkflow(function (prev) {
          return Object.assign({}, prev, {
            loading: false,
            error: "Unable to load image. Please choose another file or URL."
          });
        });
      };
      image.crossOrigin = "anonymous";
      image.src = renderPortraitSource(source);
    }

    function triggerPortraitUpload() {
      if (profilePortraitInputRef.current) {
        profilePortraitInputRef.current.click();
      }
    }

    function onProfilePortraitSelected(event) {
      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
        window.alert("Please choose a JPG, JPEG, PNG, WEBP, or GIF image.");
        event.target.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (loadEvent) {
        var source = String(loadEvent.target && loadEvent.target.result ? loadEvent.target.result : "");
        loadPortraitForAdjust(source, false);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    }

    function applyPortraitFromUrl() {
      var url = String(portraitWorkflow.urlInput || "").trim();
      if (!url) {
        setPortraitWorkflow(function (prev) {
          return Object.assign({}, prev, { error: "Enter a public image URL first." });
        });
        return;
      }
      loadPortraitForAdjust(url, false);
    }

    function updatePortraitZoom(nextZoom) {
      setPortraitWorkflow(function (prev) {
        var minZoom = minimumPortraitZoom(prev.imageWidth, prev.imageHeight, PORTRAIT_EDITOR_SIZE);
        var zoom = Math.max(minZoom, Math.min(4, Number(nextZoom) || minZoom));
        var clampedCenter = clampCropCenter(prev.cropCenterX, prev.cropCenterY, zoom, prev.imageWidth, prev.imageHeight);
        return Object.assign({}, prev, {
          zoom: zoom,
          cropCenterX: clampedCenter.x,
          cropCenterY: clampedCenter.y
        });
      });
    }

    function nudgePortraitOffset(dx, dy) {
      setPortraitWorkflow(function (prev) {
        var model = portraitRenderModel({
          imageWidth: prev.imageWidth,
          imageHeight: prev.imageHeight,
          cropCenterX: prev.cropCenterX,
          cropCenterY: prev.cropCenterY,
          zoom: prev.zoom
        });
        var stageSize = Math.max(1, portraitStageSizeRef.current || PORTRAIT_EDITOR_SIZE);
        var deltaX = dx / (stageSize * model.widthScale);
        var deltaY = dy / (stageSize * model.heightScale);
        var clampedCenter = clampCropCenter(prev.cropCenterX - deltaX, prev.cropCenterY - deltaY, prev.zoom, prev.imageWidth, prev.imageHeight);
        return Object.assign({}, prev, {
          cropCenterX: clampedCenter.x,
          cropCenterY: clampedCenter.y
        });
      });
    }

    function onPortraitAdjustPointerDown(event) {
      if (event.pointerType === "touch") {
        return;
      }
      portraitDragRef.current = {
        active: true,
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      };
      portraitStageSizeRef.current = Math.max(1, event.currentTarget.clientWidth || PORTRAIT_EDITOR_SIZE);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function onPortraitAdjustPointerMove(event) {
      var drag = portraitDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }
      var dx = event.clientX - drag.lastX;
      var dy = event.clientY - drag.lastY;
      portraitDragRef.current.lastX = event.clientX;
      portraitDragRef.current.lastY = event.clientY;
      nudgePortraitOffset(dx, dy);
      event.preventDefault();
    }

    function onPortraitAdjustPointerUp(event) {
      var drag = portraitDragRef.current;
      if (drag.pointerId === event.pointerId) {
        portraitDragRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0 };
      }
    }

    function onPortraitAdjustWheel(event) {
      event.preventDefault();
      var factor = event.deltaY < 0 ? 1.06 : 0.94;
      updatePortraitZoom(portraitWorkflow.zoom * factor);
    }

    function touchDistance(t1, t2) {
      var dx = t2.clientX - t1.clientX;
      var dy = t2.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function touchCenter(t1, t2) {
      return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    }

    function onPortraitAdjustTouchStart(event) {
      if (event.touches.length === 1) {
        portraitDragRef.current = {
          active: true,
          pointerId: null,
          lastX: event.touches[0].clientX,
          lastY: event.touches[0].clientY
        };
        portraitStageSizeRef.current = Math.max(1, event.currentTarget.clientWidth || PORTRAIT_EDITOR_SIZE);
      }
      if (event.touches.length === 2) {
        portraitPinchRef.current = {
          active: true,
          startDistance: touchDistance(event.touches[0], event.touches[1]),
          startZoom: portraitWorkflow.zoom
        };
        portraitStageSizeRef.current = Math.max(1, event.currentTarget.clientWidth || PORTRAIT_EDITOR_SIZE);
        var center = touchCenter(event.touches[0], event.touches[1]);
        portraitDragRef.current.lastX = center.x;
        portraitDragRef.current.lastY = center.y;
      }
      event.preventDefault();
    }

    function onPortraitAdjustTouchMove(event) {
      if (event.touches.length === 2 && portraitPinchRef.current.active) {
        var nextDistance = touchDistance(event.touches[0], event.touches[1]);
        var ratio = nextDistance / Math.max(1, portraitPinchRef.current.startDistance);
        updatePortraitZoom(portraitPinchRef.current.startZoom * ratio);
      } else if (event.touches.length === 1 && portraitDragRef.current.active) {
        var touch = event.touches[0];
        var dx = touch.clientX - portraitDragRef.current.lastX;
        var dy = touch.clientY - portraitDragRef.current.lastY;
        portraitDragRef.current.lastX = touch.clientX;
        portraitDragRef.current.lastY = touch.clientY;
        nudgePortraitOffset(dx, dy);
      }
      event.preventDefault();
    }

    function onPortraitAdjustTouchEnd() {
      if (!portraitWorkflow.open) {
        return;
      }
      portraitPinchRef.current = { active: false, startDistance: 0, startZoom: portraitWorkflow.zoom };
      if (portraitDragRef.current.active) {
        portraitDragRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0 };
      }
    }

    function savePortraitWorkflow() {
      if (!characterDraft || !portraitWorkflow.source) {
        return;
      }
      var source = portraitWorkflow.source;
      var scale = Math.max(1, Number(portraitWorkflow.zoom) || 1);
      var center = clampCropCenter(
        portraitWorkflow.cropCenterX,
        portraitWorkflow.cropCenterY,
        scale,
        portraitWorkflow.imageWidth,
        portraitWorkflow.imageHeight
      );
      var centerX = center.x;
      var centerY = center.y;

      setCharacterDraft(function (prev) {
        if (!prev) {
          return prev;
        }
        return Object.assign({}, prev, {
          portrait: {
            image: source,
            imageWidth: portraitWorkflow.imageWidth,
            imageHeight: portraitWorkflow.imageHeight,
            cropCenterX: centerX,
            cropCenterY: centerY,
            zoom: scale,
            cropX: centerX,
            cropY: centerY
          }
        });
      });
      closePortraitWorkflow();
    }

    function charactersPanel() {
      var list = characterList();

      function openCharacterDetails(characterId) {
        if (directoryListRef.current) {
          directoryScrollRef.current = directoryListRef.current.scrollTop;
        }
        setFocusedId(characterId);
        setCharacterView("details");
        setCharacterEditMode(false);
        setCharacterDraft(null);
      }

      function backToDirectory() {
        setCharacterEditMode(false);
        setCharacterDraft(null);
        setCharacterEditOrigin("directory");
        setCharacterView("directory");
        window.requestAnimationFrame(function () {
          if (directoryListRef.current) {
            directoryListRef.current.scrollTop = directoryScrollRef.current;
          }
        });
      }

      function updateDraft(field, value) {
        setCharacterDraft(function (prev) {
          return Object.assign({}, prev, (function () { var o = {}; o[field] = value; return o; })());
        });
      }

      function enterEditMode(origin, fromBioAction) {
        if (!focused) {
          return;
        }
        setCharacterEditOrigin(origin || "directory");
        setCharacterDraft(characterToDraft(focused));
        setCharacterEditMode(true);
        setCharacterView("edit");
        if (fromBioAction) {
          window.requestAnimationFrame(function () {
            var bioEditor = document.getElementById("characterBioEditor");
            if (bioEditor) {
              bioEditor.focus();
            }
          });
        }
      }

      function cancelEditMode() {
        setCharacterEditMode(false);
        setCharacterDraft(null);
        if (characterEditOrigin === "details") {
          setCharacterView("details");
        } else {
          setCharacterView("directory");
          window.requestAnimationFrame(function () {
            if (directoryListRef.current) {
              directoryListRef.current.scrollTop = directoryScrollRef.current;
            }
          });
        }
      }

      function saveEditMode() {
        if (!characterDraft || !focused) {
          return;
        }
        var savedCharacterId = focused.id;
        commit(function (next) {
          var target = next.characters.find(function (c) { return c.id === savedCharacterId; });
          if (!target) {
            return;
          }
          target.name = characterDraft.name.trim() || "Unnamed Character";
          target.portrait = characterDraft.portrait || target.portrait;
          target.clan = normalizeClanValue(characterDraft.clan);
          target.sect = normalizeSectValue(characterDraft.sect);
          target.outlineColor = characterDraft.outlineColor || "#d10d40";
          target.nodeSize = Math.max(0.7, Math.min(1.8, Number(characterDraft.nodeSize) || 1));
          target.nodeShape = characterDraft.nodeShape || "circle";
          target.hidden = Boolean(characterDraft.hidden);
          target.tags = String(characterDraft.tagsText || "")
            .split(",")
            .map(function (t) { return t.trim(); })
            .filter(function (t) { return t.length > 0; });
        });
        setFocusedId(savedCharacterId);
        setCharacterEditMode(false);
        setCharacterDraft(null);
        setCharacterView("details");
      }

      function deleteCharacterFromEdit() {
        if (!focused) {
          return;
        }
        var deletingId = focused.id;
        commit(function (next) {
          next.characters = next.characters.filter(function (c) { return c.id !== deletingId; });
          next.relationships = next.relationships.filter(function (r) { return r.from !== deletingId && r.to !== deletingId; });
        });
        setSelected(function (prev) { return prev.filter(function (id) { return id !== deletingId; }); });
        var remaining = data.characters.filter(function (c) { return c.id !== deletingId; });
        setFocusedId(remaining[0] ? remaining[0].id : null);
        setCharacterEditMode(false);
        setCharacterDraft(null);
        if (characterEditOrigin === "details") {
          setCharacterView(remaining.length ? "details" : "directory");
        } else {
          setCharacterView("directory");
        }
      }

      function backFromEditPanel() {
        cancelEditMode();
      }

      function renderDirectoryView() {
        return html`<div key="directory" className="character-view character-view-directory">
          <div className="panel-header">
            <h2>Character Directory</h2>
            <button onClick=${function () { setActivePanel(null); }} aria-label="Close panel">×</button>
          </div>
          <div className="panel-body character-directory-body">
            <div className="character-directory-controls">
              <button onClick=${function () { createCharacter(); }}>New Character</button>
              <input placeholder="Search" value=${search} onInput=${function (e) { setSearch(e.target.value); }} />
              <button>Filter</button>
              <button onClick=${function () { if (focused) { enterEditMode("directory", false); } }} disabled=${!focused}>Edit Character</button>
            </div>

            <div className="char-list" ref=${directoryListRef}>
              ${list.map(function (c) {
                var links = data.relationships.filter(function (r) { return r.from === c.id || r.to === c.id; }).length;
                return html`<div className=${"char-card" + (focusedId === c.id ? " active" : "")} key=${c.id} onClick=${function () { openCharacterDetails(c.id); }}>
                  <div className="character-summary-portrait-frame compact">
                    <img className="character-summary-portrait media" src=${portraitState(c).src} alt=${c.name} style=${portraitMediaStyle(c)} />
                  </div>
                  <strong>${c.name}</strong>
                  <div className="tags">
                    <span className="tag">${c.clan || "Unknown Clan"}</span>
                    <span className="tag">${c.sect || "Unknown Sect"}</span>
                    <span className="tag">${c.status || "Unknown"}</span>
                    ${(c.tags || []).slice(0, 3).map(function (t) { return html`<span className="tag" key=${c.id + t}>${t}</span>`; })}
                  </div>
                  <div className="hint">${links} links</div>
                </div>`;
              })}
            </div>
          </div>
        </div>`;
      }

      function renderDetailsReadOnly(character) {
        var biographyHtml = characterBiographyHtml(character);

        function readField(label, value, fullWidth) {
          return html`<article className=${"character-field-card" + (fullWidth ? " field-span-full" : "")} key=${"field-" + label}>
            <h5>${label}</h5>
            <p>${value || "Not set"}</p>
          </article>`;
        }

        var singleTopFields = [
          readField("Concept", character.concept, true),
          readField("Ambition", character.ambition, true),
          readField("Desire", character.desire, true),
          readField("Convictions", character.convictions, true),
          readField("Touchstones", character.touchstones, true)
        ];

        var pairFields = [
          readField("Predator Type", character.predatorType, false),
          readField("Generation", character.generation, false),
          readField("True Age", character.trueAge, false),
          readField("Apparent Age", character.apparentAge, false),
          readField("Date of Birth", formatDisplayDate(character.dateOfBirth), false),
          readField("Date of Death", formatDisplayDate(character.dateOfDeath), false)
        ];

        var trailingFields = [
          readField("Sire", character.sire, true),
          character.additionalLargeFields ? readField("Additional Fields", character.additionalLargeFields, true) : null,
          readField("GM Notes", character.gmNotes, true)
        ].filter(Boolean);

        return html`<div className="character-details-content">
          <section className="details-section">
            <h4 className="details-section-title">Character Summary</h4>
            <div className="character-summary-card">
              <div className="character-summary-portrait-frame">
                <img className="character-summary-portrait media" src=${portraitState(character).src} alt=${character.name} style=${portraitMediaStyle(character)} />
              </div>
              <div className="character-summary-main">
                <h3>${character.name}</h3>
                <div className="tags">
                  <span className="tag">${character.clan || "Unknown Clan"}</span>
                  <span className="tag">${character.sect || "Unknown Sect"}</span>
                  <span className="tag">${character.status || "Unknown"}</span>
                  ${(character.tags || []).map(function (tag) { return html`<span className="tag" key=${"summary-" + character.id + tag}>${tag}</span>`; })}
                </div>
              </div>
              <button className="character-summary-edit" onClick=${function () { enterEditMode("details", false); }}>Edit</button>
            </div>
          </section>

          <section className="details-section">
            <h4 className="details-section-title">Biography Preview</h4>
            <div className="character-bio-card">
              <div className="bio-preview-scroll">
                <div className="character-rich-text" dangerouslySetInnerHTML=${{ __html: biographyHtml }}></div>
              </div>
              <button className="bio-preview-action" onClick=${function () { openCharacterProfile(false); }}>Read Full Biography</button>
            </div>
          </section>

          <section className="details-section">
            <h4 className="details-section-title">Custom Fields</h4>
            <div className="character-fields-layout">
              <div className="character-fields-single">${singleTopFields}</div>
              <div className="character-field-pairs">${pairFields}</div>
              <div className="character-fields-single">${trailingFields}</div>
            </div>
          </section>
        </div>`;
      }

      function renderDetailsEdit(character) {
        if (!characterDraft) {
          return renderDetailsView();
        }
        var currentPortrait = portraitState(characterDraft);
        var nodeSizeValue = Math.max(0.7, Math.min(1.8, Number(characterDraft.nodeSize) || 1));
        var isLargeNode = nodeSizeValue > 1.08;
        var nodeShapeValue = characterDraft.nodeShape === "rounded" ? "square" : (characterDraft.nodeShape || "circle");
        var previewSize = isLargeNode ? 116 : 96;

        var outlineColor = String(characterDraft.outlineColor || "#d10d40").trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(outlineColor)) {
          outlineColor = "#d10d40";
        }

        var previewFrameStyle = {
          width: previewSize,
          height: previewSize,
          borderColor: outlineColor,
          borderRadius: nodeShapeValue === "circle" ? "50%" : "10px",
          clipPath: nodeShapeValue === "hexagon" ? "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)" : "none"
        };

        var draftTags = String(characterDraft.tagsText || "")
          .split(",")
          .map(function (t) { return t.trim(); })
          .filter(function (t) { return t.length > 0; });

        var knownTags = [];
        (data.tagGroups || []).forEach(function (group) {
          (group.tags || []).forEach(function (tag) {
            if (tag && tag.name && knownTags.indexOf(tag.name) < 0) {
              knownTags.push(tag.name);
            }
          });
        });
        draftTags.forEach(function (tag) {
          if (knownTags.indexOf(tag) < 0) {
            knownTags.push(tag);
          }
        });

        function toggleDraftTag(tagName) {
          var currentTags = String(characterDraft.tagsText || "")
            .split(",")
            .map(function (t) { return t.trim(); })
            .filter(function (t) { return t.length > 0; });
          var nextTags = currentTags.indexOf(tagName) >= 0
            ? currentTags.filter(function (t) { return t !== tagName; })
            : currentTags.concat([tagName]);
          updateDraft("tagsText", nextTags.join(", "));
        }

        function onOutlineHexInput(event) {
          var value = String(event.target.value || "").trim();
          if (value && value.charAt(0) !== "#") {
            value = "#" + value;
          }
          if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
            updateDraft("outlineColor", value.toUpperCase());
          }
        }

        function clearPortrait() {
          var defaultSource = DEFAULT_PORTRAIT;
          var baseZoom = Math.max(1, Number(currentPortrait.zoom) || 1);
          var baseX = Number(currentPortrait.cropCenterX);
          var baseY = Number(currentPortrait.cropCenterY);
          var nextX = Number.isFinite(baseX) ? baseX : 0.5;
          var nextY = Number.isFinite(baseY) ? baseY : 0.5;
          setCharacterDraft(function (prev) {
            if (!prev) {
              return prev;
            }
            return Object.assign({}, prev, {
              portrait: {
                image: defaultSource,
                imageWidth: 1,
                imageHeight: 1,
                cropCenterX: nextX,
                cropCenterY: nextY,
                zoom: baseZoom,
                cropX: nextX,
                cropY: nextY
              }
            });
          });
        }

        return html`<div key=${"edit-" + character.id} className="character-view character-view-details mode-edit edit-character-shell">
          <div className="panel-header edit-character-header">
            <h2>EDIT CHARACTER</h2>
            <button onClick=${function () { setActivePanel(null); }} aria-label="Close panel">×</button>
          </div>
          <div className="edit-character-content">
            <section className="edit-character-section">
              <label>Name</label>
              <input value=${characterDraft.name} onInput=${function (e) { updateDraft("name", e.target.value); }} />
            </section>

            <section className="edit-character-section">
              <label>Portrait</label>
              <div className="edit-portrait-row">
                <button className="edit-portrait-button" onClick=${openPortraitWorkflow}>
                  <div className="edit-portrait-thumb">
                    <img className="media" src=${currentPortrait.src} alt=${characterDraft.name || "Character portrait"} style=${portraitMediaStyle(characterDraft)} />
                  </div>
                  <span className="edit-portrait-text">
                    <strong>Edit Image</strong>
                    <small>Click to replace portrait</small>
                  </span>
                </button>
                <button className="edit-portrait-delete" onClick=${clearPortrait} aria-label="Delete portrait">⌫</button>
              </div>
            </section>

            <section className="edit-character-section">
              <label>Outline Colour</label>
              <div className="edit-outline-row">
                <input className="edit-outline-swatch" type="color" value=${outlineColor} onInput=${function (e) { updateDraft("outlineColor", e.target.value.toUpperCase()); }} />
                <input className="edit-outline-text" value=${String(characterDraft.outlineColor || "").toUpperCase()} onInput=${onOutlineHexInput} />
                <div className="edit-outline-preview" style=${{ background: outlineColor }} aria-label="Current outline preview"></div>
              </div>
            </section>

            <section className="edit-character-section">
              <label>Node Size</label>
              <div className="edit-segmented-row size-row">
                <button className=${"segment-button" + (!isLargeNode ? " active" : "")} onClick=${function () { updateDraft("nodeSize", 1); }}>Standard</button>
                <button className=${"segment-button" + (isLargeNode ? " active" : "")} onClick=${function () { updateDraft("nodeSize", 1.35); }}>Large</button>
              </div>
            </section>

            <section className="edit-character-section">
              <label>Node Shape</label>
              <div className="edit-segmented-row shape-row">
                <button className=${"segment-button" + (nodeShapeValue === "circle" ? " active" : "")} onClick=${function () { updateDraft("nodeShape", "circle"); }}>Circle</button>
                <button className=${"segment-button" + (nodeShapeValue === "square" ? " active" : "")} onClick=${function () { updateDraft("nodeShape", "square"); }}>Square</button>
                <button className=${"segment-button" + (nodeShapeValue === "hexagon" ? " active" : "")} onClick=${function () { updateDraft("nodeShape", "hexagon"); }}>Hexagon</button>
              </div>
            </section>

            <section className="edit-character-section">
              <label>Sect</label>
              <select value=${normalizeSectValue(characterDraft.sect)} onChange=${function (e) { updateDraft("sect", e.target.value); }}>
                ${SECT_OPTIONS.map(function (option) {
                  return html`<option key=${"edit-sect-" + option} value=${option}>${option}</option>`;
                })}
              </select>
            </section>

            <section className="edit-character-section">
              <label>Clan</label>
              <select value=${normalizeClanValue(characterDraft.clan)} onChange=${function (e) { updateDraft("clan", e.target.value); }}>
                ${CLAN_OPTIONS.map(function (option) {
                  return html`<option key=${"edit-clan-" + option} value=${option}>${option}</option>`;
                })}
              </select>
            </section>

            <section className="edit-character-section node-preview-section">
              <div className="edit-node-preview-frame" style=${previewFrameStyle}>
                <img className="media" src=${currentPortrait.src} alt=${characterDraft.name || "Character preview"} style=${portraitMediaStyle(characterDraft)} />
              </div>
              <div className="edit-node-preview-name">${(characterDraft.name || "Unnamed Character").toUpperCase()}</div>
            </section>

            <section className="edit-character-section">
              <label>Tags</label>
              <div className="edit-tags-row">
                ${knownTags.map(function (tag) {
                  var selectedTag = draftTags.indexOf(tag) >= 0;
                  return html`<button className=${"tag-chip" + (selectedTag ? " active" : "")} key=${"draft-tag-" + tag} onClick=${function () { toggleDraftTag(tag); }}>${tag}</button>`;
                })}
              </div>
            </section>

            <section className="edit-character-section hide-character-section">
              <div className="hide-character-row">
                <div>
                  <strong>Hide Character</strong>
                  <small>Hide this character and its relationships from Collaborators.</small>
                </div>
                <button className=${"toggle-switch" + (characterDraft.hidden ? " on" : "")} onClick=${function () { updateDraft("hidden", !characterDraft.hidden); }} aria-label="Toggle hidden character"><span></span></button>
              </div>
            </section>
          </div>

          <div className="edit-character-footer">
            <button type="button" className="primary" onClick=${saveEditMode}>Save</button>
            <button type="button" className="destructive" onClick=${deleteCharacterFromEdit}>Delete Character</button>
            <button type="button" className="secondary" onClick=${backFromEditPanel}>${characterEditOrigin === "details" ? "Back to Details" : "Back to List"}</button>
          </div>
        </div>`;
      }

      function renderDetailsView() {
        if (!focused) {
          return html`<div key="details" className="character-view character-view-details">
            <div className="panel-header details-header">
              <button onClick=${backToDirectory}>Directory</button>
              <h2>Character Details</h2>
              <button onClick=${function () { setActivePanel(null); }} aria-label="Close panel">×</button>
            </div>
            <div className="panel-body"><div className="card">No character selected.</div></div>
          </div>`;
        }
        return html`<div key=${"details-" + (characterEditMode ? "edit" : "read") + "-" + focused.id} className=${"character-view character-view-details" + (characterEditMode ? " mode-edit" : " mode-read")}>
          <div className="panel-header details-header">
            <button onClick=${backToDirectory}>Directory</button>
            <h2>Character Details</h2>
            <button onClick=${function () { setActivePanel(null); }} aria-label="Close panel">×</button>
          </div>
          <div className="panel-body details-body">
            ${renderDetailsReadOnly(focused)}
          </div>
        </div>`;
      }

      return html`${characterView === "directory" ? renderDirectoryView() : (characterView === "edit" ? renderDetailsEdit(focused) : renderDetailsView())}`;
    }

    function renderPortraitWorkflowModal() {
      if (!portraitWorkflow.open) {
        return null;
      }

      var adjustPreviewStyle = portraitMediaStyle({
        portrait: {
          image: portraitWorkflow.source,
          imageWidth: portraitWorkflow.imageWidth,
          imageHeight: portraitWorkflow.imageHeight,
          cropCenterX: portraitWorkflow.cropCenterX,
          cropCenterY: portraitWorkflow.cropCenterY,
          zoom: portraitWorkflow.zoom
        }
      });

      return html`<div className="portrait-workflow-backdrop" onClick=${closePortraitWorkflow}>
        <div className="portrait-workflow-modal" onClick=${function (event) { event.stopPropagation(); }}>
          ${portraitWorkflow.step === "replace" ? html`<div className="portrait-workflow-step">
            <header className="portrait-workflow-header">
              <h3>REPLACE PORTRAIT</h3>
            </header>
            <div className="portrait-replace-grid">
              <button className="portrait-replace-action" onClick=${triggerPortraitUpload}>
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
                    setPortraitWorkflow(function (prev) {
                      return Object.assign({}, prev, { urlInput: value, error: "" });
                    });
                  }}
                />
                <button onClick=${applyPortraitFromUrl}>Load URL</button>
              </div>
            </div>
            ${portraitWorkflow.source ? html`<button className="portrait-adjust-current" onClick=${function () { loadPortraitForAdjust(portraitWorkflow.source, true); }}>Adjust Current Portrait</button>` : null}
            ${portraitWorkflow.error ? html`<p className="portrait-workflow-error">${portraitWorkflow.error}</p>` : null}
            <footer className="portrait-workflow-actions">
              <button onClick=${closePortraitWorkflow}>Cancel</button>
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
              onTouchStart=${onPortraitAdjustTouchStart}
              onTouchMove=${onPortraitAdjustTouchMove}
              onTouchEnd=${onPortraitAdjustTouchEnd}
            >
              ${portraitWorkflow.source ? html`<img className="portrait-adjust-image" src=${renderPortraitSource(portraitWorkflow.source)} alt="Portrait adjustment" style=${adjustPreviewStyle} />` : null}
              <div className="portrait-adjust-mask"></div>
            </div>
            <div className="portrait-adjust-zoom-row">
              <span aria-hidden="true">-</span>
              <input
                type="range"
                min=${portraitWorkflow.minZoom || 1}
                max="4"
                step="0.01"
                value=${portraitWorkflow.zoom}
                onInput=${function (event) { updatePortraitZoom(Number(event.target.value)); }}
              />
              <span aria-hidden="true">+</span>
            </div>
            ${portraitWorkflow.error ? html`<p className="portrait-workflow-error">${portraitWorkflow.error}</p>` : null}
            <footer className="portrait-workflow-actions">
              <button onClick=${function () { setPortraitWorkflow(function (prev) { return Object.assign({}, prev, { step: "replace", error: "" }); }); }}>Back</button>
              <button onClick=${savePortraitWorkflow}>Save Portrait</button>
            </footer>
          </div>`}
        </div>
      </div>`;
    }

    function profileInfoCard(label, value) {
      return html`<article className="profile-info-card" key=${"profile-" + label}>
        <h4>${label}</h4>
        <p>${value || "Not set"}</p>
      </article>`;
    }

    function characterProfileView() {
      if (!focused) {
        return html`<section className="character-profile-page"><div className="profile-empty">No character selected.</div></section>`;
      }

      var linked = data.relationships.filter(function (r) { return r.from === focused.id || r.to === focused.id; });
      var draft = profileEditMode ? characterDraft : null;
      var profileSectIcon = resolveSectIcon(profileEditMode && draft ? draft.sect : focused.sect);
      var profileClanIcon = resolveClanIcon(profileEditMode && draft ? draft.clan : focused.clan);
      var profileRecord = draft ? {
        id: focused.id,
        name: draft.name,
        portrait: draft.portrait,
        clan: draft.clan,
        sect: draft.sect,
        status: draft.status,
        tags: String(draft.tagsText || "").split(",").map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 0; }),
        bioHtml: draft.bioHtml,
        timeline: sortTimelineEvents((draft.timelineEvents || []).map(normalizeTimelineEvent)),
        storytellerNotes: draft.storytellerNotes,
        gmOnlyInformation: draft.gmOnlyInformation,
        gmNotes: draft.storytellerNotes,
        concept: draft.concept,
        ambition: draft.ambition,
        desire: draft.desire,
        convictions: draft.convictions,
        touchstones: draft.touchstones,
        predatorType: draft.predatorType,
        generation: draft.generation,
        sire: draft.sire,
        trueAge: draft.trueAge,
        apparentAge: draft.apparentAge,
        dateOfBirth: normalizeIsoDate(draft.dateOfBirth),
        dateOfDeath: normalizeIsoDate(draft.dateOfDeath)
      } : normalizeCharacterRecord(focused);

      function sidebarField(label, key, multiline, inputType) {
        var value = profileRecord[key] || "";
        var displayValue = (inputType === "date" && !profileEditMode) ? formatDisplayDate(value) : value;
        if (!profileEditMode) {
          if (key === "convictions" || key === "touchstones") {
            return dossierEntryGroup({
              title: label,
              entryText: value,
              accentColor: "#d10d40",
              emptyText: "Not set"
            });
          }
          return profileInfoCard(label, displayValue);
        }
        return html`<article className="profile-info-card" key=${"profile-" + label}>
          <h4>${label}</h4>
          ${multiline
            ? html`<textarea rows="3" value=${value} onInput=${function (e) { updateDraftField(key, e.target.value); }}></textarea>`
            : html`<input type=${inputType || "text"} value=${value} onInput=${function (e) { updateDraftField(key, e.target.value); }} />`}
        </article>`;
      }

      return html`<section className="character-profile-page">
        <div className="profile-dossier-shell">
        <div className="profile-content-container">
        <header className="profile-header">
          <div className="profile-header-main">
            <div className=${"profile-portrait-shell" + (profileEditMode ? " editable" : "") } onClick=${function () { if (profileEditMode) { openPortraitWorkflow(); } }}>
              <img className="profile-portrait-image" src=${portraitState(profileRecord).src} alt=${profileRecord.name} style=${portraitMediaStyle(profileRecord)} />
              ${profileEditMode ? html`<div className="profile-portrait-overlay"><span>Change Portrait</span><span>Upload Image</span></div>` : null}
            </div>
            <div className="profile-title-block">
              ${profileEditMode
                ? html`<input className="profile-name-input" value=${profileRecord.name || ""} onInput=${function (e) { updateDraftField("name", e.target.value); }} />`
                : html`<h1>${profileRecord.name}</h1>`}

              <p className="profile-subtitle">Character Profile</p>

              ${profileEditMode ? html`<div className="profile-badge-editor">
                <select value=${normalizeClanValue(profileRecord.clan)} onChange=${function (e) { updateDraftField("clan", e.target.value); }}>
                  ${CLAN_OPTIONS.map(function (option) {
                    return html`<option key=${"profile-clan-" + option} value=${option}>${option}</option>`;
                  })}
                </select>
                <select value=${normalizeSectValue(profileRecord.sect)} onChange=${function (e) { updateDraftField("sect", e.target.value); }}>
                  ${SECT_OPTIONS.map(function (option) {
                    return html`<option key=${"profile-sect-" + option} value=${option}>${option}</option>`;
                  })}
                </select>
                <input value=${profileRecord.status || ""} onInput=${function (e) { updateDraftField("status", e.target.value); }} placeholder="Status" />
                <input value=${draft ? draft.tagsText : ""} onInput=${function (e) { updateDraftField("tagsText", e.target.value); }} placeholder="Tags (comma separated)" />
              </div>` : null}

            </div>
          </div>
          <div className="profile-header-controls">
            <button className="profile-close-button" onClick=${returnFromCharacterProfile} aria-label="Close biography view">×</button>
            ${profileEditMode
              ? html`<div className="profile-header-actions"><button onClick=${saveProfileEdit}>Save</button><button onClick=${cancelProfileEdit}>Cancel</button></div>`
              : null}
          </div>
        </header>

        <div className="profile-layout">
          <main className="profile-main-column">
            <article className="profile-biography">
              <div className="profile-biography-head">
                <h3>Biography</h3>
                ${!profileEditMode ? html`<button className="profile-biography-edit-button" onClick=${startProfileEdit}>Edit</button>` : null}
              </div>
              ${profileEditMode
                ? html`<div className="profile-biography-editor">
                  <div className="rich-toolbar">
                    <button onClick=${function () { document.execCommand("bold", false); }}>Bold</button>
                    <button onClick=${function () { document.execCommand("italic", false); }}>Italic</button>
                    <button onClick=${function () { document.execCommand("underline", false); }}>Underline</button>
                    <button onClick=${function () { document.execCommand("insertUnorderedList", false); }}>Bullets</button>
                    <button onClick=${function () { document.execCommand("insertOrderedList", false); }}>Numbers</button>
                  </div>
                  <div id="profileBioEditor" className="rich-editor profile-rich-editor" contentEditable="true" suppressContentEditableWarning="true" onInput=${function (e) { updateDraftField("bioHtml", e.currentTarget.innerHTML); }} dangerouslySetInnerHTML=${{ __html: draft.bioHtml }}></div>
                </div>`
                : html`<div className="profile-biography-content character-rich-text" dangerouslySetInnerHTML=${{ __html: characterBiographyHtml(profileRecord) }}></div>`}
            </article>

            <section className="profile-section">
              <h3>Relationships</h3>
              ${linked.length ? html`<ul>
                ${linked.map(function (rel) {
                  var otherId = rel.from === focused.id ? rel.to : rel.from;
                  var other = data.characters.find(function (c) { return c.id === otherId; });
                  return html`<li key=${"rel-" + rel.id}><strong>${rel.type}</strong> with ${other ? other.name : "Unknown"} <span className="hint">(${rel.category})</span></li>`;
                })}
              </ul>` : html`<p className="hint">No tracked relationships.</p>`}
            </section>

            <section className="profile-section">
              <h3>Timeline</h3>
              ${profileEditMode ? html`<div className="timeline-log">
                <div className="timeline-log-toolbar">
                  <button onClick=${addTimelineEvent}>Add Event</button>
                </div>
                ${(draft.timelineEvents || []).length ? timelineEventsForDisplay(draft.timelineEvents || []).map(function (entry) {
                  var sourceIndex = entry.sourceIndex;
                  var item = normalizeTimelineEvent(entry.event);
                  var isExpanded = timelineExpandedIndex === sourceIndex;
                  var label = item.title && item.title.trim() ? item.title.trim() : "Untitled Event";
                  return html`<article className=${"timeline-log-item" + (isExpanded ? " expanded" : "")} key=${"timeline-event-" + sourceIndex}>
                    <div className="timeline-log-head">
                      <div className="timeline-log-main" onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>
                        <p className="timeline-log-title-row"><span className="timeline-log-caret">${isExpanded ? "▼" : "▶"}</span><strong>${label}</strong></p>
                        <p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>
                        ${item.description ? html`<p className="timeline-log-description">${item.description}</p>` : null}
                      </div>
                      <div className="timeline-log-actions">
                        <button className="timeline-action-button" onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>${isExpanded ? "Close" : "Edit"}</button>
                        <button className="timeline-action-button" onClick=${function () { removeTimelineEvent(sourceIndex); }}>Delete</button>
                      </div>
                    </div>
                    ${isExpanded ? html`<div className="timeline-log-editor">
                      <label>Date</label>
                      <input type="date" value=${item.date || ""} onInput=${function (e) { updateTimelineEvent(sourceIndex, "date", e.target.value); }} />
                      <label>Event Title</label>
                      <input value=${item.title || ""} onInput=${function (e) { updateTimelineEvent(sourceIndex, "title", e.target.value); }} placeholder="Event title" />
                      <label>Description</label>
                      <textarea rows="3" value=${item.description || ""} onInput=${function (e) { updateTimelineEvent(sourceIndex, "description", e.target.value); }} placeholder="Event details"></textarea>
                      <div className="timeline-log-editor-actions">
                        <button className="timeline-delete-button" onClick=${function () { removeTimelineEvent(sourceIndex); }}>Delete Event</button>
                      </div>
                    </div>` : null}
                  </article>`;
                }) : html`<p className="hint">No timeline events yet. Add your first event.</p>`}
              </div>` : html`<div className="timeline-log">
                ${(profileRecord.timeline || []).length ? timelineEventsForDisplay(profileRecord.timeline || []).map(function (entry) {
                  var sourceIndex = entry.sourceIndex;
                  var item = normalizeTimelineEvent(entry.event);
                  var isExpanded = timelineExpandedIndex === sourceIndex;
                  var label = item.title && item.title.trim() ? item.title.trim() : "Untitled Event";
                  return html`<article className=${"timeline-log-item timeline-readonly-item expandable" + (isExpanded ? " expanded" : "")} key=${"timeline-readonly-" + sourceIndex}>
                    <div className="timeline-log-head" onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>
                      <div
                        className="timeline-log-main"
                        role="button"
                        tabIndex="0"
                        onKeyDown=${function (e) {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setTimelineExpandedIndex(isExpanded ? null : sourceIndex);
                          }
                        }}
                      >
                        <p className="timeline-log-title-row"><span className="timeline-log-caret">${isExpanded ? "▼" : "▶"}</span><strong>${label}</strong></p>
                        <p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>
                        ${!isExpanded && item.description ? html`<p className="timeline-log-description">${item.description}</p>` : null}
                      </div>
                      <div className="timeline-log-actions">
                        <button className="timeline-action-button" onClick=${function (e) { e.stopPropagation(); setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>${isExpanded ? "Collapse" : "Expand"}</button>
                      </div>
                    </div>
                    ${isExpanded ? html`<div className="timeline-log-details">
                      ${item.description
                        ? html`<p className="timeline-log-detail-value timeline-log-detail-description">${item.description}</p>`
                        : html`<p className="timeline-log-detail-value hint">No description provided.</p>`}
                    </div>` : null}
                  </article>`;
                }) : html`<p className="hint">No timeline entries yet.</p>`}
              </div>`}
            </section>

            <section className="profile-section">
              <h3>Storyteller Notes</h3>
              ${profileEditMode
                ? html`<textarea rows="6" value=${draft.storytellerNotes || ""} onInput=${function (e) { updateDraftField("storytellerNotes", e.target.value); }} placeholder="Storyteller-facing notes"></textarea>`
                : html`<p>${profileRecord.storytellerNotes || "No storyteller notes yet."}</p>`}
            </section>

            <section className="profile-section gm-only">
              <h3>GM-Only Information</h3>
              ${profileEditMode
                ? html`<textarea rows="6" value=${draft.gmOnlyInformation || ""} onInput=${function (e) { updateDraftField("gmOnlyInformation", e.target.value); }} placeholder="Private GM-only information"></textarea>`
                : html`<p>${profileRecord.gmOnlyInformation || "No GM-only notes yet."}</p>`}
            </section>
          </main>

          <aside className="profile-info-column">
            <article className="profile-info-card profile-identity-card">
              <h4>Character Tags</h4>
              <div className="profile-identity-tags">
                <span className="tag">${profileRecord.status || "Unknown"}</span>
                ${(profileRecord.tags || []).map(function (tag) { return html`<span className="tag" key=${"profile-side-tag-" + tag}>${tag}</span>`; })}
              </div>
              <h4>Clan Badge</h4>
              <div className="profile-identity-badge">
                ${IconBadge({ icon: profileClanIcon, size: 42, backgroundColor: "#6d132a", tooltip: normalizeClanValue(profileRecord.clan) })}
                <span>${normalizeClanValue(profileRecord.clan)}</span>
              </div>
              <h4>Sect Badge</h4>
              <div className="profile-identity-badge">
                ${IconBadge({ icon: profileSectIcon, size: 42, backgroundColor: "#6d132a", tooltip: normalizeSectValue(profileRecord.sect) })}
                <span>${normalizeSectValue(profileRecord.sect)}</span>
              </div>
            </article>
            ${sidebarField("Concept", "concept", true)}
            ${sidebarField("Ambition", "ambition", true)}
            ${sidebarField("Desire", "desire", true)}
            ${sidebarField("Convictions", "convictions", true)}
            ${sidebarField("Touchstones", "touchstones", true)}
            ${sidebarField("Predator Type", "predatorType", false)}
            ${sidebarField("Generation", "generation", false)}
            ${sidebarField("True Age", "trueAge", false)}
            ${sidebarField("Apparent Age", "apparentAge", false)}
            ${sidebarField("Date of Birth", "dateOfBirth", false, "date")}
            ${sidebarField("Date of Death", "dateOfDeath", false, "date")}
            ${sidebarField("Sire", "sire", false)}
          </aside>
        </div>
        </div>
        </div>
      </section>`;
    }

    function zonesPanel() {
      return html`${panelHeader("Zone Manager")}
      <div className="panel-body">
        <button onClick=${function () { setDrawingZone(true); }}>Draw New Zone</button>
        ${data.zones.map(function (z) {
          var inside = data.characters.filter(function (c) { return c.x > z.x && c.x < z.x + z.width && c.y > z.y && c.y < z.y + z.height; }).length;
          return html`<div className="card" key=${z.id}>
            <div className="row">
              <div><strong>${z.name}</strong></div>
              <div className="hint">${inside} inside</div>
            </div>
            <div className="split" style=${{ marginTop: 8 }}>
              <div><label>Colour</label><input type="color" value=${z.color} onInput=${function (e) { commit(function (next) { var t = next.zones.find(function (x) { return x.id === z.id; }); if (t) t.color = e.target.value; }); }} /></div>
              <div><label>Opacity</label><input type="range" min="0.05" max="0.65" step="0.01" value=${z.opacity} onInput=${function (e) { commit(function (next) { var t = next.zones.find(function (x) { return x.id === z.id; }); if (t) t.opacity = Number(e.target.value); }); }} /></div>
              <div><label>Border thickness</label><input type="range" min="1" max="6" value=${z.borderThickness} onInput=${function (e) { commit(function (next) { var t = next.zones.find(function (x) { return x.id === z.id; }); if (t) t.borderThickness = Number(e.target.value); }); }} /></div>
              <div><label>Show or hide</label><select value=${String(!z.hidden)} onChange=${function (e) { commit(function (next) { var t = next.zones.find(function (x) { return x.id === z.id; }); if (t) t.hidden = e.target.value !== "true"; }); }}><option value="true">Show</option><option value="false">Hide</option></select></div>
            </div>
            <label>Description</label>
            <textarea rows="2" value=${z.description} onInput=${function (e) { commit(function (next) { var t = next.zones.find(function (x) { return x.id === z.id; }); if (t) t.description = e.target.value; }); }} />
            <div className="row">
              <button onClick=${function () { commit(function (next) { var t = next.zones.find(function (x) { return x.id === z.id; }); if (t) t.lock = !t.lock; }); }}>${z.lock ? "Unlock movement" : "Lock movement"}</button>
              <button onClick=${function () { commit(function (next) { next.zones = next.zones.filter(function (x) { return x.id !== z.id; }); }); }}>Delete</button>
            </div>
          </div>`;
        })}
      </div>`;
    }

    function relationshipsPanel() {
      return html`${panelHeader("Relationship Categories")}
      <div className="panel-body">
        ${data.relationshipCategories.map(function (cat) {
          var rels = data.relationships.filter(function (r) { return r.category === cat.name; });
          return html`<div className="card" key=${cat.id}>
            <div className="row"><strong>${cat.name}</strong><span className="hint">${cat.types.length} types</span></div>
            <div className="row" style=${{ marginTop: 6 }}>
              <input type="color" value=${cat.color} onInput=${function (e) { commit(function (next) { var c = next.relationshipCategories.find(function (x) { return x.id === cat.id; }); if (c) c.color = e.target.value; next.relationships.forEach(function (r) { if (r.category === cat.name) r.color = e.target.value; }); }); }} />
              <button>Edit</button>
              <button>Delete</button>
            </div>
            ${rels.map(function (rel) {
              return html`<div className="card" key=${rel.id} style=${{ marginTop: 8 }}>
                <strong>${rel.type}</strong>
                <div className="split" style=${{ marginTop: 6 }}>
                  <div><label>Line thickness</label><input type="range" min="1" max="6" value=${rel.thickness} onInput=${function (e) { commit(function (next) { var r = next.relationships.find(function (x) { return x.id === rel.id; }); if (r) r.thickness = Number(e.target.value); }); }} /></div>
                  <div><label>Line style</label><select value=${rel.style} onChange=${function (e) { commit(function (next) { var r = next.relationships.find(function (x) { return x.id === rel.id; }); if (r) r.style = e.target.value; }); }}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></div>
                  <div><label>Arrow style</label><select value=${rel.arrow} onChange=${function (e) { commit(function (next) { var r = next.relationships.find(function (x) { return x.id === rel.id; }); if (r) r.arrow = e.target.value; }); }}><option value="none">None</option><option value="start">Start</option><option value="end">End</option><option value="both">Both</option></select></div>
                  <div><label>Label colour</label><input type="color" value=${rel.labelColor} onInput=${function (e) { commit(function (next) { var r = next.relationships.find(function (x) { return x.id === rel.id; }); if (r) r.labelColor = e.target.value; }); }} /></div>
                </div>
              </div>`;
            })}
          </div>`;
        })}
      </div>`;
    }

    function tagsPanel() {
      return html`${panelHeader("Tag Manager")}
      <div className="panel-body">
        ${data.tagGroups.map(function (g) {
          return html`<div className="card" key=${g.id}>
            <div className="row"><strong>${g.name}</strong><span className="hint">${g.tags.length} tags</span></div>
            ${g.tags.map(function (t) {
              var usage = data.characters.filter(function (c) { return (c.tags || []).indexOf(t.name) >= 0; }).length;
              return html`<div className="card" key=${t.id} style=${{ marginTop: 8 }}>
                <div className="row"><strong>${t.name}</strong><span className="hint">${usage} usage</span></div>
                <div className="split" style=${{ marginTop: 6 }}>
                  <div><label>Colour</label><input type="color" value=${t.color} onInput=${function (e) { commit(function (next) { var tg = next.tagGroups.find(function (x) { return x.id === g.id; }); var tt = tg && tg.tags.find(function (x) { return x.id === t.id; }); if (tt) tt.color = e.target.value; }); }} /></div>
                  <div><label>Icon</label><input value=${t.icon} onInput=${function (e) { commit(function (next) { var tg = next.tagGroups.find(function (x) { return x.id === g.id; }); var tt = tg && tg.tags.find(function (x) { return x.id === t.id; }); if (tt) tt.icon = e.target.value; }); }} /></div>
                </div>
                <label>Description</label>
                <input value=${t.description} onInput=${function (e) { commit(function (next) { var tg = next.tagGroups.find(function (x) { return x.id === g.id; }); var tt = tg && tg.tags.find(function (x) { return x.id === t.id; }); if (tt) tt.description = e.target.value; }); }} />
              </div>`;
            })}
          </div>`;
        })}
      </div>`;
    }

    function badgesPanel() {
      return html`${panelHeader("Badge Manager")}
      <div className="panel-body">
        ${data.badges.map(function (b) {
          return html`<div className="card" key=${b.id}>
            <div className="row"><strong>${b.name}</strong><span className="hint">${b.position}</span></div>
            <div className="split" style=${{ marginTop: 6 }}>
              <div><label>Circular icon</label><input value=${b.icon} onInput=${function (e) { commit(function (next) { var t = next.badges.find(function (x) { return x.id === b.id; }); if (t) t.icon = e.target.value; }); }} /></div>
              <div><label>Colour</label><input type="color" value=${b.color} onInput=${function (e) { commit(function (next) { var t = next.badges.find(function (x) { return x.id === b.id; }); if (t) t.color = e.target.value; }); }} /></div>
              <div><label>Display priority</label><input type="number" value=${b.priority} onInput=${function (e) { commit(function (next) { var t = next.badges.find(function (x) { return x.id === b.id; }); if (t) t.priority = Number(e.target.value); }); }} /></div>
              <div><label>Tooltip</label><input value=${b.tooltip} onInput=${function (e) { commit(function (next) { var t = next.badges.find(function (x) { return x.id === b.id; }); if (t) t.tooltip = e.target.value; }); }} /></div>
            </div>
          </div>`;
        })}
      </div>`;
    }

    function overlaysPanel() {
      return html`${panelHeader("Overlay Manager")}
      <div className="panel-body">
        ${data.overlays.map(function (o) {
          return html`<div className="card" key=${o.id}>
            <div className="row"><strong>${o.name}</strong><span className="hint">${o.visibleWhen}</span></div>
            <div className="split" style=${{ marginTop: 6 }}>
              <div><label>Icon</label><input value=${o.icon} onInput=${function (e) { commit(function (next) { var t = next.overlays.find(function (x) { return x.id === o.id; }); if (t) t.icon = e.target.value; }); }} /></div>
              <div><label>Optional text</label><input value=${o.text} onInput=${function (e) { commit(function (next) { var t = next.overlays.find(function (x) { return x.id === o.id; }); if (t) t.text = e.target.value; }); }} /></div>
              <div><label>Position</label><select value=${o.position} onChange=${function (e) { commit(function (next) { var t = next.overlays.find(function (x) { return x.id === o.id; }); if (t) t.position = e.target.value; }); }}><option>Top</option><option>Left</option><option>Right</option><option>Centre</option></select></div>
              <div><label>Animation</label><select value=${o.animation} onChange=${function (e) { commit(function (next) { var t = next.overlays.find(function (x) { return x.id === o.id; }); if (t) t.animation = e.target.value; }); }}><option>None</option><option>Pulse</option><option>Blink</option><option>Float</option></select></div>
            </div>
          </div>`;
        })}
      </div>`;
    }

    function renderPanel() {
      switch (activePanel) {
        case "characters": return charactersPanel();
        case "zones": return zonesPanel();
        case "relationships": return relationshipsPanel();
        case "tags": return tagsPanel();
        case "badges": return badgesPanel();
        case "overlays": return overlaysPanel();
        default: return null;
      }
    }

    if (workspaceMode === "profile") {
      return html`<div className="map-workspace-shell profile-mode" onClick=${function () { setContextMenu(null); }}>
        ${characterProfileView()}
        <input ref=${profilePortraitInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" hidden onChange=${onProfilePortraitSelected} />
        ${renderPortraitWorkflowModal()}
      </div>`;
    }

    return html`<div className="map-workspace-shell" onClick=${function () { setContextMenu(null); }}>
      <section className=${"workspace" + (activePanel ? " panel-open" : "") }>
        <aside className="workspace-rail-slot" aria-label="Relationship map tools">
          <nav className="workspace-tool-rail">
            ${TOOL_NAV.map(function (item) {
              return html`<button key=${"rail-" + item.key} className=${"tool-rail-item" + (activePanel === item.key ? " active" : "")} onClick=${function () { togglePanel(item.key); }}>
                <span className="tool-rail-icon">${item.icon}</span>
                <span className="tool-rail-label">${item.label}</span>
              </button>`;
            })}
          </nav>
        </aside>

        <div className="canvas-wrap">
          <div className="canvas-toolbar">
            <button onClick=${function () { setView({ x: view.x, y: view.y, scale: Math.min(2.4, view.scale * 1.1) }); }}>Zoom In</button>
            <button onClick=${function () { setView({ x: view.x, y: view.y, scale: Math.max(0.2, view.scale * 0.9) }); }}>Zoom Out</button>
            <span className="badge">${Math.round(view.scale * 100)}%</span>
            <span className="badge">Selected ${selected.length}</span>
            <button onClick=${undo} disabled=${undoStack.length === 0}>Undo</button>
            <button onClick=${redo} disabled=${redoStack.length === 0}>Redo</button>
            ${drawingZone ? html`<>
              <button onClick=${finishZoneDraft}>Finish Zone</button>
              <button onClick=${cancelZoneDraft}>Cancel Zone</button>
            </>` : null}
            ${selected.length === 2 && !drawingZone ? html`<>
              <button onClick=${completeConnection}>Complete Connection</button>
              <button onClick=${function () { setSelected([]); }}>Cancel</button>
            </>` : null}
          </div>

          <div className=${"canvas-viewport" + (isPanning ? " panning" : "")} ref=${viewportRef} onMouseDown=${onCanvasMouseDown} onMouseMove=${onCanvasMouseMove} onMouseUp=${onCanvasMouseUp} onMouseLeave=${onCanvasMouseUp} onWheel=${onWheel} onContextMenu=${function (e) { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: "canvas" }); }}>
            <div className="canvas-surface" style=${{ transform: "translate(" + view.x + "px," + view.y + "px) scale(" + view.scale + ")" }}>
              <svg className="link-layer" viewBox="0 0 2000 1400" preserveAspectRatio="none">
                <defs><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d10d40"></path></marker></defs>
                ${data.relationships.filter(function (r) { return r.visible; }).map(function (r) {
                  var from = data.characters.find(function (c) { return c.id === r.from; });
                  var to = data.characters.find(function (c) { return c.id === r.to; });
                  if (!from || !to) {
                    return null;
                  }
                  var mx = (from.x + to.x) / 2;
                  var my = (from.y + to.y) / 2;
                  var dash = r.style === "dashed" ? "7 5" : "";
                  var markerEnd = r.arrow === "end" || r.arrow === "both" ? "url(#arrowHead)" : null;
                  var markerStart = r.arrow === "start" || r.arrow === "both" ? "url(#arrowHead)" : null;
                  return html`<g key=${r.id}>
                    <line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke=${r.color} strokeWidth=${r.thickness} strokeDasharray=${dash} opacity=${r.opacity} markerEnd=${markerEnd} markerStart=${markerStart}></line>
                    <rect x=${mx - 24} y=${my - 11} width="48" height="18" rx="5" fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.15)"></rect>
                    <text x=${mx} y=${my + 2} fill=${r.labelColor} fontSize="11" textAnchor="middle">${r.type}</text>
                  </g>`;
                })}
              </svg>

              <div className="zone-layer">
                ${data.zones.filter(function (z) { return !z.hidden; }).map(function (z) {
                  return html`<div key=${z.id} className=${"zone" + (z.name.toLowerCase().indexOf("coterie") >= 0 ? " coterie" : "")} style=${{ left: z.x, top: z.y, width: z.width, height: z.height, borderWidth: z.borderThickness, borderColor: z.color, background: "rgba(209,13,64," + z.opacity + ")" }}>${z.name}</div>`;
                })}
                ${zoneDraft ? html`<div className="zone" style=${{ left: Math.min(zoneDraft.x, zoneDraft.x + zoneDraft.width), top: Math.min(zoneDraft.y, zoneDraft.y + zoneDraft.height), width: Math.abs(zoneDraft.width), height: Math.abs(zoneDraft.height) }}>Drawing zone</div>` : null}
              </div>

              <div className="node-layer">
                ${characterList().filter(function (c) { return !c.hidden; }).map(function (c) {
                  var nodeSize = Math.max(0.7, Math.min(1.8, Number(c.nodeSize) || 1));
                  var outlineColor = c.outlineColor || "#d10d40";
                  var shape = c.nodeShape === "rounded" ? "square" : (c.nodeShape || "circle");
                  var radius = shape === "circle" ? "50%" : "8px";
                  var clip = shape === "hexagon" ? "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)" : "none";
                  return html`<div key=${c.id} className=${"node" + (selected.indexOf(c.id) >= 0 ? " selected" : "")} style=${{ left: c.x, top: c.y, width: 130 * nodeSize }} onPointerDown=${function (e) { onNodePointerDown(e, c); }} onLostPointerCapture=${onNodeLostPointerCapture} onMouseDown=${function (e) { e.stopPropagation(); }} onClick=${function (e) { e.stopPropagation(); setFocusedId(c.id); if (!e.shiftKey) setSelected([c.id]); }} onDoubleClick=${function (e) { e.stopPropagation(); setFocusedId(c.id); setActivePanel("characters"); }} onContextMenu=${function (e) { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: "node", id: c.id }); }}>
                    <div className="node-portrait-frame" style=${{ width: 74 * nodeSize, height: 74 * nodeSize, borderColor: outlineColor, borderRadius: radius, clipPath: clip }}>
                      <img className="node-portrait media" src=${portraitState(c).src} alt=${c.name} style=${portraitMediaStyle(c)} />
                    </div>
                    <span>${c.name.toUpperCase()}</span>
                  </div>`;
                })}
              </div>
            </div>
          </div>
        </div>

        ${activePanel ? html`<aside className="right-panel">${renderPanel()}</aside>` : null}
      </section>

      ${contextMenu ? html`<div className="context-menu" style=${{ left: contextMenu.x, top: contextMenu.y }} onClick=${function (e) { e.stopPropagation(); }}>
        ${contextMenu.type === "node" ? html`<div className="context-menu-group">
          <button onClick=${function () { setFocusedId(contextMenu.id); setActivePanel("characters"); setContextMenu(null); }}>Edit Character</button>
          <button onClick=${function () { setSelected(selected.concat([contextMenu.id]).filter(function (v, i, a) { return a.indexOf(v) === i; })); setContextMenu(null); }}>Multi-select add</button>
          <button onClick=${function () { commit(function (next) { next.characters = next.characters.filter(function (c) { return c.id !== contextMenu.id; }); next.relationships = next.relationships.filter(function (r) { return r.from !== contextMenu.id && r.to !== contextMenu.id; }); }); setContextMenu(null); }}>Delete Character</button>
        </div>` : html`<div className="context-menu-group">
          <button onClick=${function () { createCharacter(); setContextMenu(null); }}>New Character</button>
          <button onClick=${function () { setDrawingZone(true); setContextMenu(null); }}>Draw Zone</button>
          <button onClick=${function () { setView({ x: 80, y: 60, scale: 0.58 }); setContextMenu(null); }}>Reset View</button>
        </div>`}
      </div>` : null}

      <input ref=${profilePortraitInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" hidden onChange=${onProfilePortraitSelected} />
      ${renderPortraitWorkflowModal()}
    </div>`;
  }

  loadInitialState()
    .then(function (seedState) {
      ReactDOM.createRoot(document.getElementById("app")).render(html`<${App} initialData=${seedState} />`);
    })
    .catch(function (error) {
      console.warn("Failed to bootstrap Campaign Atlas state.", error);
      ReactDOM.createRoot(document.getElementById("app")).render(html`<${App} initialData=${initialState()} />`);
    });
})();

