(function () {
  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);
  var sharedCharacters = window.CampaignAtlasCharactersShared || {};
  var SharedBiographyWorkspace = sharedCharacters.CharacterBiographyWorkspace || null;
  var CHARACTER_SYNC_CHANNEL = "campaign-atlas-characters";

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

  var CAMPAIGN_ATLAS_ICON_ASSETS = {
    characters: "../assets/Icons/Characters.svg",
    zones: "../assets/Icons/zones.svg",
    relationships: "../assets/Icons/Relationships.svg",
    tag: "../assets/Icons/tag.svg",
    settings: "../assets/Icons/settings.svg",
    lock: "../assets/Icons/Lock.svg",
    menu: "../assets/Icons/Menu.svg",
    delete: "../assets/Icons/delete.svg",
    copy: "../assets/Icons/copy.svg",
    export: "../assets/Icons/export.svg",
    dashboard: "../assets/Icons/Dashboard.svg"
  };

  var warnedMissingIcons = {};

  var TOOL_NAV = [
    { key: "characters", label: "Characters", iconId: "characters", icon: "◉" },
    { key: "zones", label: "Zones", iconId: "zones", icon: "▭" },
    { key: "relationships", label: "Relationships", iconId: "relationships", icon: "↔" },
    { key: "tags", label: "Tags", iconId: "tag", icon: "#" }
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

  var RELATIONSHIP_TYPE_STYLE_OPTIONS = ["solid", "dashed", "dotted", "chain", "droplets"];
  var RELATIONSHIP_ROUTING_MODE_OPTIONS = ["auto", "straight", "curved"];
  var CUSTOM_RELATIONSHIP_FALLBACK_LABEL = "Custom Relationship";

  var DEFAULT_RELATIONSHIP_CATEGORIES = [
    {
      id: "cat-vampire-relations",
      name: "Vampire Relations",
      color: "#7a3db8",
      types: [
        { id: "type-sire", name: "Sire", label: "Sire", color: "#7a3db8", width: 2, style: "solid", animated: false, arrow: true },
        { id: "type-touchstone", name: "Touchstone", label: "Touchstone", color: "#d4af37", width: 2, style: "solid", animated: false, arrow: true },
        { id: "type-blood-bond", name: "Blood Bond", label: "Blood Bond", color: "#b80f2a", width: 2, style: "chain", animated: false, arrow: true },
        { id: "type-coterie", name: "Coterie", label: "Coterie", color: "#7a3db8", width: 1, style: "solid", animated: false, arrow: false },
        { id: "type-blood-source-of", name: "Blood Source Of", label: "Blood Source Of", color: "#d10d40", width: 3, style: "droplets", animated: true, arrow: false }
      ]
    },
    {
      id: "cat-blood-relations",
      name: "Blood Relations",
      color: "#f28c28",
      types: [
        { id: "type-parent", name: "Parent", label: "Parent", color: "#f28c28", width: 2, style: "solid", animated: false, arrow: false },
        { id: "type-child", name: "Child", label: "Child", color: "#f28c28", width: 2, style: "solid", animated: false, arrow: true },
        { id: "type-sibling", name: "Sibling", label: "Sibling", color: "#ffbf00", width: 2, style: "solid", animated: false, arrow: false },
        { id: "type-relative", name: "Relative", label: "Relative", color: "#f28c28", width: 1, style: "dotted", animated: false, arrow: false }
      ]
    },
    {
      id: "cat-social-relations",
      name: "Social Relations",
      color: "#2e6ddf",
      types: [
        { id: "type-knows-each-other", name: "Knows each other", label: "Knows each other", color: "#8a8f99", width: 1, style: "solid", animated: false, arrow: false },
        { id: "type-friend", name: "Friend", label: "Friend", color: "#2e6ddf", width: 2, style: "solid", animated: false, arrow: false },
        { id: "type-enemy", name: "Enemy", label: "Enemy", color: "#d10d40", width: 2, style: "dashed", animated: false, arrow: false },
        { id: "type-rival", name: "Rival", label: "Rival", color: "#ff7f50", width: 2, style: "dashed", animated: false, arrow: false }
      ]
    },
    {
      id: "cat-romantic-relations",
      name: "Romantic Relations",
      color: "#ff6fae",
      types: [
        { id: "type-partner", name: "Partner", label: "Partner", color: "#ff6fae", width: 2, style: "solid", animated: true, arrow: false },
        { id: "type-ex", name: "Ex", label: "Ex", color: "#d100b9", width: 2, style: "dashed", animated: false, arrow: false },
        { id: "type-crush-on", name: "Crush On", label: "Crush On", color: "#ffb6d8", width: 2, style: "dotted", animated: true, arrow: true }
      ]
    },
    {
      id: "cat-psychological-leverage",
      name: "Psychological & Leverage",
      color: "#7a3db8",
      types: [
        { id: "type-fears", name: "Fears", label: "Fears", color: "#7a3db8", width: 2, style: "dotted", animated: true, arrow: true },
        { id: "type-suspicious-of", name: "Suspicious Of", label: "Suspicious", color: "#8f5ae6", width: 2, style: "dotted", animated: false, arrow: true },
        { id: "type-knows-secret-of", name: "Knows Secret Of", label: "Knows Secret", color: "#4b0082", width: 2, style: "solid", animated: false, arrow: true },
        { id: "type-manipulates", name: "Manipulates", label: "Manipulates", color: "#d10d40", width: 2, style: "dashed", animated: true, arrow: false },
        { id: "type-owes-debt", name: "Owes Debt", label: "Owes debt", color: "#f28c28", width: 1, style: "solid", animated: false, arrow: true },
        { id: "type-protective-of", name: "Protective Of", label: "Protective", color: "#2e6ddf", width: 2, style: "solid", animated: false, arrow: true },
        { id: "type-obsessed-with", name: "Obsessed With", label: "Obsessed", color: "#ff6fae", width: 2, style: "dashed", animated: true, arrow: false },
        { id: "type-admires", name: "Admires", label: "Admires", color: "#2e6ddf", width: 2, style: "solid", animated: false, arrow: true }
      ]
    },
    {
      id: "cat-political-relations",
      name: "Political Relations",
      color: "#2f9d56",
      types: [
        { id: "type-ally", name: "Ally", label: "Ally", color: "#2f9d56", width: 2, style: "solid", animated: false, arrow: false },
        { id: "type-influence", name: "Influence", label: "Influence", color: "#d4af37", width: 1, style: "dashed", animated: false, arrow: true },
        { id: "type-blackmailing", name: "Blackmailing", label: "Blackmailing", color: "#d10d40", width: 2, style: "dashed", animated: true, arrow: true }
      ]
    }
  ];

  function makeRelationshipUiId(prefix) {
    return String(prefix || "id") + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  function makeRelationshipTypeDecoration() {
    return {
      svgPattern: "",
      animatedFlow: false,
      arrowheads: "single",
      icons: [],
      curved: false,
      strength: 1,
      conditionalColor: "",
      customLabelTemplate: "",
      visibilityFilter: ""
    };
  }

  function normalizeRelationshipType(typeInput, categoryColor) {
    var source = typeInput && typeof typeInput === "object" ? typeInput : { name: String(typeInput || "Connection") };
    var typeName = String(source.name || source.type || "Connection").trim() || "Connection";
    var rawStyle = String(source.style || "solid").toLowerCase();
    var normalizedStyle = RELATIONSHIP_TYPE_STYLE_OPTIONS.indexOf(rawStyle) >= 0 ? rawStyle : "solid";
    var label = String(source.label || source.displayLabel || typeName).trim() || typeName;
    var color = safeHexColor(source.color, safeHexColor(categoryColor, "#d10d40"));
    var width = Math.max(1, Math.min(8, Number(source.width) || Number(source.thickness) || 2));
    var arrow = typeof source.arrow === "boolean" ? source.arrow : (String(source.arrow || "").toLowerCase() === "end");
    var decoration = Object.assign(makeRelationshipTypeDecoration(), source.decoration || {});
    return {
      id: String(source.id || makeRelationshipUiId("rel-type")).trim(),
      name: typeName,
      label: label,
      color: color,
      width: width,
      style: normalizedStyle,
      animated: Boolean(source.animated),
      arrow: Boolean(arrow),
      decoration: decoration
    };
  }

  function normalizeRelationshipCategories(rawCategories) {
    var source = Array.isArray(rawCategories) && rawCategories.length ? rawCategories : DEFAULT_RELATIONSHIP_CATEGORIES;
    return source.map(function (entry, index) {
      var category = entry && typeof entry === "object" ? entry : {};
      var name = String(category.name || "Category " + (index + 1)).trim() || ("Category " + (index + 1));
      var color = safeHexColor(category.color, "#d10d40");
      var types = Array.isArray(category.types) && category.types.length
        ? category.types.map(function (typeItem) { return normalizeRelationshipType(typeItem, color); })
        : [normalizeRelationshipType({ name: "Connection", label: "Connection", color: color }, color)];
      return {
        id: String(category.id || makeRelationshipUiId("rel-cat")).trim(),
        name: name,
        color: color,
        types: types
      };
    });
  }

  function relationshipOppositeAnchor(anchor) {
    switch (String(anchor || "").toLowerCase()) {
      case "top": return "bottom";
      case "right": return "left";
      case "bottom": return "top";
      case "left": return "right";
      default: return "right";
    }
  }

  function relationshipAutoAnchor(fromCharacter, toCharacter) {
    var fromX = Number(fromCharacter && fromCharacter.x) || 0;
    var fromY = Number(fromCharacter && fromCharacter.y) || 0;
    var toX = Number(toCharacter && toCharacter.x) || 0;
    var toY = Number(toCharacter && toCharacter.y) || 0;
    var dx = toX - fromX;
    var dy = toY - fromY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? "right" : "left";
    }
    return dy >= 0 ? "bottom" : "top";
  }

  function relationshipResolvedAnchors(fromCharacter, toCharacter) {
    var source = relationshipAutoAnchor(fromCharacter, toCharacter);
    return {
      sourceAnchor: source,
      destinationAnchor: relationshipOppositeAnchor(source)
    };
  }

  function flattenRelationshipTypes(categories) {
    var map = {};
    (categories || []).forEach(function (category) {
      (category.types || []).forEach(function (typeItem) {
        map[typeItem.id] = { category: category, type: typeItem };
      });
    });
    return map;
  }

  function relationshipTypeDefaultsFromCategory(categories, categoryRef, typeRef) {
    var available = normalizeRelationshipCategories(categories);
    var category = available.find(function (entry) { return entry.id === categoryRef || entry.name === categoryRef; }) || available[0];
    var type = (category.types || []).find(function (entry) {
      return entry.id === typeRef || entry.name === typeRef || entry.label === typeRef;
    }) || category.types[0] || normalizeRelationshipType({ name: "Connection" }, category.color);
    return {
      category: category.name,
      categoryId: category.id,
      type: type.name,
      typeId: type.id,
      displayLabel: type.label,
      color: safeHexColor(type.color, category.color),
      thickness: Math.max(1, Math.min(8, Number(type.width) || 2)),
      style: type.style || "solid",
      animated: Boolean(type.animated),
      arrow: type.arrow ? "end" : "none",
      routingMode: "auto",
      lineMeta: Object.assign(makeRelationshipTypeDecoration(), type.decoration || {})
    };
  }

  function normalizeRelationships(rawRelationships, categories) {
    var list = Array.isArray(rawRelationships) ? rawRelationships : [];
    var availableCategories = normalizeRelationshipCategories(categories);
    var typeLookup = flattenRelationshipTypes(availableCategories);
    return list.map(function (entry, index) {
      var current = entry && typeof entry === "object" ? clone(entry) : {};
      delete current.sourceAnchor;
      delete current.destinationAnchor;
      delete current.fromAnchor;
      delete current.toAnchor;
      var fallback = relationshipTypeDefaultsFromCategory(availableCategories, current.categoryId || current.category, current.typeId || current.type);
      if (current.typeId && typeLookup[current.typeId]) {
        var exact = typeLookup[current.typeId];
        fallback = relationshipTypeDefaultsFromCategory(availableCategories, exact.category.id, exact.type.id);
      }
      return Object.assign({
        id: current.id || ("rel-" + Date.now() + "-" + index),
        from: "",
        to: "",
        description: "",
        gmNotes: "",
        hiddenFromCollaborators: false,
        visible: true,
        opacity: 1
      }, fallback, current, {
        color: safeHexColor(current.color, fallback.color),
        thickness: Math.max(1, Math.min(8, Number(current.thickness) || Number(current.width) || fallback.thickness)),
        style: RELATIONSHIP_TYPE_STYLE_OPTIONS.indexOf(String(current.style || fallback.style).toLowerCase()) >= 0 ? String(current.style || fallback.style).toLowerCase() : "solid",
        arrow: ["start", "end", "both", "none"].indexOf(String(current.arrow || fallback.arrow).toLowerCase()) >= 0 ? String(current.arrow || fallback.arrow).toLowerCase() : "none",
        routingMode: RELATIONSHIP_ROUTING_MODE_OPTIONS.indexOf(String(current.routingMode || fallback.routingMode || "auto").toLowerCase()) >= 0 ? String(current.routingMode || fallback.routingMode || "auto").toLowerCase() : "auto",
        lineMeta: Object.assign(makeRelationshipTypeDecoration(), fallback.lineMeta || {}, current.lineMeta || {})
      });
    });
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

  function Icon(config) {
    if (!config || !config.icon) {
      return null;
    }
    var iconSize = Number(config.size) || null;
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
    if (iconSize) {
      style.width = iconSize + "px";
      style.height = iconSize + "px";
    }
    return html`<span className=${className} style=${style} aria-hidden="true"></span>`;
  }

  function IconBadge(config) {
    if (!config || !config.icon) {
      return null;
    }
    var size = Math.max(24, Number(config.size) || 44);
    var backgroundColor = config.backgroundColor || "#6d132a";
    var tooltip = config.tooltip || "";
    var className = "icon-badge" + (config.className ? " " + config.className : "");
    var imageClassName = "icon-badge-image" + (config.imageClassName ? " " + config.imageClassName : "");
    var borderColor = config.borderColor || null;
    var badgeStyle = { width: size + "px", height: size + "px", background: backgroundColor };
    if (borderColor) {
      badgeStyle.borderColor = borderColor;
    }
    return html`<span className=${className} style=${badgeStyle} title=${tooltip} aria-label=${tooltip}>
      ${Icon({ icon: config.icon, color: config.iconColor || "#ffffff", className: imageClassName })}
    </span>`;
  }

  function characterNodeBadges(character, portraitDiameter) {
    var badgeSize = Math.round(clamp(toNumber(portraitDiameter, 74) * 0.28, 18, 42));
    var badges = [];
    var sect = normalizeSectValue(character && character.sect);
    var clan = normalizeClanValue(character && character.clan);
    var sectIcon = resolveSectIcon(sect);
    var clanIcon = resolveClanIcon(clan);

    if (sect !== "None" && sectIcon) {
      badges.push({
        id: "sect",
        anchor: "left",
        icon: sectIcon,
        tooltip: sect,
        size: badgeSize,
        backgroundColor: "#000000",
        borderColor: "#2e2e2e",
        iconColor: "#d10d40"
      });
    }

    if (clan !== "None" && clanIcon) {
      badges.push({
        id: "clan",
        anchor: "right",
        icon: clanIcon,
        tooltip: clan,
        size: badgeSize,
        backgroundColor: "#000000",
        borderColor: "#2e2e2e",
        iconColor: "#ffffff"
      });
    }

    return badges;
  }

  function renderNodeBadgeAnchors(badges) {
    if (!badges || !badges.length) {
      return null;
    }

    var grouped = {
      left: [],
      right: []
    };

    badges.forEach(function (badge) {
      if (!badge || !badge.icon) {
        return;
      }
      var anchor = badge.anchor === "right" ? "right" : "left";
      grouped[anchor].push(badge);
    });

    function renderAnchor(anchor) {
      var entries = grouped[anchor];
      if (!entries.length) {
        return null;
      }
      return html`<div className=${"node-badge-anchor node-badge-anchor-" + anchor}>
        ${entries.map(function (badge, index) {
          return html`<span className="node-badge-item" key=${"node-badge-" + anchor + "-" + (badge.id || index) + "-" + index}>
            ${IconBadge({
              icon: badge.icon,
              size: badge.size,
              backgroundColor: badge.backgroundColor,
              borderColor: badge.borderColor,
              iconColor: badge.iconColor,
              tooltip: badge.tooltip,
              className: "node-icon-badge"
            })}
          </span>`;
        })}
      </div>`;
    }

    return html`<div className="node-badge-layer" aria-hidden="true">
      ${renderAnchor("left")}
      ${renderAnchor("right")}
    </div>`;
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
    if (sharedCharacters.characterBiographyHtml) {
      return sharedCharacters.characterBiographyHtml(character);
    }
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

  function safeHexColor(value, fallback) {
    var text = String(value || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      return text.toLowerCase();
    }
    return fallback;
  }

  function resolveCampaignAtlasIcon(iconId, fallbackGlyph) {
    var asset = CAMPAIGN_ATLAS_ICON_ASSETS[iconId];
    if (!asset) {
      if (!warnedMissingIcons[iconId]) {
        warnedMissingIcons[iconId] = true;
        console.warn("Missing Campaign Atlas icon asset for '" + iconId + "'. Falling back to current icon.");
      }
      return {
        src: "",
        fallback: fallbackGlyph || ""
      };
    }

    return {
      src: asset,
      fallback: fallbackGlyph || ""
    };
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

  function IconButton(options) {
    var opts = options && typeof options === "object" ? options : {};
    var className = opts.className || "";
    var icon = opts.icon || "";
    var ariaLabel = opts.ariaLabel || "";
    var title = opts.title || ariaLabel || "";
    var type = opts.type || "button";
    var disabled = Boolean(opts.disabled);
    var onClick = opts.onClick;

    return html`<button
      type=${type}
      className=${"icon-button" + (className ? " " + className : "")}
      aria-label=${ariaLabel || title}
      title=${title}
      disabled=${disabled}
      onClick=${onClick}
    >
      <span className="icon-button-icon" aria-hidden="true">${icon}</span>
    </button>`;
  }

  function ToolbarIcon(options) {
    var opts = options && typeof options === "object" ? options : {};
    var iconId = opts.iconId || "";
    var fallbackGlyph = opts.fallbackGlyph || "";
    var alt = opts.alt || opts.label || "";
    var resolved = resolveCampaignAtlasIcon(iconId, fallbackGlyph);
    var _imageError = useState(false);
    var imageError = _imageError[0];
    var setImageError = _imageError[1];

    if (!resolved.src || imageError) {
      return html`<span className="tool-rail-icon-fallback" aria-hidden="true">${resolved.fallback}</span>`;
    }

    return html`<img
      className="tool-rail-icon-image"
      src=${resolved.src}
      alt=${alt}
      aria-hidden=${alt ? "false" : "true"}
      onError=${function () {
        setImageError(true);
        if (resolved.src && !warnedMissingIcons[iconId + "::error"]) {
          warnedMissingIcons[iconId + "::error"] = true;
          console.warn("Failed to load Campaign Atlas icon asset for '" + iconId + "': " + resolved.src);
        }
      }}
    />`;
  }

  function ColorField(options) {
    var opts = options && typeof options === "object" ? options : {};
    var label = opts.label || "Colour";
    var value = safeHexColor(opts.value, opts.fallback || "#d10d40");
    var onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
    var onHexInput = typeof opts.onHexInput === "function" ? opts.onHexInput : null;
    var fieldName = opts.fieldName || label;
    var textValue = opts.textValue === undefined || opts.textValue === null ? value : String(opts.textValue);

    return html`<div className="color-field">
      <label>${label}</label>
      <div className="color-field-row">
        <div className="color-field-swatch-wrap">
          <span className="color-field-swatch" style=${{ backgroundColor: value }} aria-hidden="true"></span>
          <input
            className="color-field-native"
            type="color"
            value=${value}
            aria-label=${fieldName}
            onInput=${function (event) { onChange(event.target.value); }}
          />
        </div>
        <input
          className="color-field-hex"
          value=${textValue}
          onInput=${function (event) {
            if (onHexInput) {
              onHexInput(event.target.value);
              return;
            }
            onChange(event.target.value);
          }}
          spellCheck="false"
          inputMode="text"
        />
      </div>
    </div>`;
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

  function sortTimelineDisplayEntries(entries) {
    return entries.sort(function (a, b) {
      if (a.hasDate && b.hasDate) {
        if (a.dateValue !== b.dateValue) {
          return a.dateValue - b.dateValue;
        }
        // Lifecycle events have a deliberate order only when they share a day.
        // User events retain their existing relative order between them.
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

  function timelineEventsForDisplay(events, dateOfBirth, dateOfDeath) {
    // Merge persisted events and virtual lifecycle events before this one sort.
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

    // Lifecycle entries are derived only for this display collection; they are
    // never added to the character's persisted timeline array.
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
        event: { date: systemEvent.date, title: systemEvent.title, description: "" },
        isSystem: true,
        sequence: (events || []).length + systemIndex,
        sortPriority: systemEvent.id === "birth" ? 0 : 2,
        hasDate: true,
        dateValue: Date.parse(systemEvent.date + "T00:00:00")
      });
    });

    return sortTimelineDisplayEntries(merged);
  }

  function timelineEventLabel(event) {
    var normalized = normalizeTimelineEvent(event);
    var title = normalized.title.trim() || "Untitled Event";
    var year = normalized.date ? normalized.date.slice(0, 4) : "";
    return year ? "(" + year + ") " + title : title;
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
      tagGroups: clone(source.tagGroups || [])
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
      delete merged.badges;
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
        { id: "r1", from: "alexandra", to: "prince", category: "Romantic Relations", type: "Partner", color: "#ff6fae", thickness: 2, style: "solid", arrow: "none", labelColor: "#ffffff", opacity: 1, visible: true },
        { id: "r2", from: "whitlock", to: "prince", category: "Vampire Relations", type: "Sire", color: "#d10d40", thickness: 2, style: "solid", arrow: "end", labelColor: "#ffffff", opacity: 1, visible: true },
        { id: "r3", from: "amelia", to: "whitlock", category: "Vampire Relations", type: "Sire", color: "#d10d40", thickness: 2, style: "solid", arrow: "end", labelColor: "#ffffff", opacity: 1, visible: true }
      ],
      relationshipCategories: clone(DEFAULT_RELATIONSHIP_CATEGORIES),
      tagGroups: [
        { id: "tg1", name: "Politics", tags: [{ id: "t1", name: "Prince", color: "#d10d40", icon: "♛", description: "Ruling authority", visible: true }, { id: "t2", name: "Council", color: "#8b1e46", icon: "◎", description: "Council aligned", visible: true }] }
      ]
    };
  }

  function App(props) {
    var loaded = useMemo(function () {
      var source = props && props.initialData ? props.initialData : initialState();
      var merged = Object.assign(initialState(), source);
      delete merged.badges;
      delete merged.overlays;
      merged.characters = (merged.characters || []).map(normalizeCharacterRecord);
      merged.relationshipCategories = normalizeRelationshipCategories(merged.relationshipCategories);
      merged.relationships = normalizeRelationships(merged.relationships, merged.relationshipCategories);
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

    var _relationshipPreview = useState(null);
    var relationshipPreview = _relationshipPreview[0];
    var setRelationshipPreview = _relationshipPreview[1];

    var _relationshipDropTarget = useState(null);
    var relationshipDropTarget = _relationshipDropTarget[0];
    var setRelationshipDropTarget = _relationshipDropTarget[1];

    var _relationshipEditor = useState(null);
    var relationshipEditor = _relationshipEditor[0];
    var setRelationshipEditor = _relationshipEditor[1];

    var _relationshipCategoryExpanded = useState({});
    var relationshipCategoryExpanded = _relationshipCategoryExpanded[0];
    var setRelationshipCategoryExpanded = _relationshipCategoryExpanded[1];

    var _relationshipCategoryCreate = useState({ open: false, name: "", color: "#d10d40" });
    var relationshipCategoryCreate = _relationshipCategoryCreate[0];
    var setRelationshipCategoryCreate = _relationshipCategoryCreate[1];

    var _relationshipCategoryEdit = useState({ categoryId: null, name: "", color: "#d10d40" });
    var relationshipCategoryEdit = _relationshipCategoryEdit[0];
    var setRelationshipCategoryEdit = _relationshipCategoryEdit[1];

    var _relationshipTypeDraftsByCategory = useState({});
    var relationshipTypeDraftsByCategory = _relationshipTypeDraftsByCategory[0];
    var setRelationshipTypeDraftsByCategory = _relationshipTypeDraftsByCategory[1];

    var _relationshipResetDialogOpen = useState(false);
    var relationshipResetDialogOpen = _relationshipResetDialogOpen[0];
    var setRelationshipResetDialogOpen = _relationshipResetDialogOpen[1];

    var _zoneDraft = useState(null);
    var zoneDraft = _zoneDraft[0];
    var setZoneDraft = _zoneDraft[1];

    var _selectedZoneId = useState(null);
    var selectedZoneId = _selectedZoneId[0];
    var setSelectedZoneId = _selectedZoneId[1];

    var _zoneEditDraft = useState(null);
    var zoneEditDraft = _zoneEditDraft[0];
    var setZoneEditDraft = _zoneEditDraft[1];

    var _zoneEditorOpen = useState(false);
    var zoneEditorOpen = _zoneEditorOpen[0];
    var setZoneEditorOpen = _zoneEditorOpen[1];

    var _zonePreview = useState(null);
    var zonePreview = _zonePreview[0];
    var setZonePreview = _zonePreview[1];

    var _contextMenu = useState(null);
    var contextMenu = _contextMenu[0];
    var setContextMenu = _contextMenu[1];

    var _tagGroupExpanded = useState({});
    var tagGroupExpanded = _tagGroupExpanded[0];
    var setTagGroupExpanded = _tagGroupExpanded[1];

    var _tagGroupCreate = useState({ open: false, name: "" });
    var tagGroupCreate = _tagGroupCreate[0];
    var setTagGroupCreate = _tagGroupCreate[1];

    var _tagGroupRenameDraft = useState({ groupId: null, name: "" });
    var tagGroupRenameDraft = _tagGroupRenameDraft[0];
    var setTagGroupRenameDraft = _tagGroupRenameDraft[1];

    var _tagDraftsByGroup = useState({});
    var tagDraftsByGroup = _tagDraftsByGroup[0];
    var setTagDraftsByGroup = _tagDraftsByGroup[1];

    var _tagEditDialog = useState({
      open: false,
      groupId: null,
      tagId: null,
      originalName: "",
      name: "",
      color: "#d10d40",
      icon: "",
      description: ""
    });
    var tagEditDialog = _tagEditDialog[0];
    var setTagEditDialog = _tagEditDialog[1];

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
    var characterSyncChannelRef = useRef(null);
    var characterSyncSourceRef = useRef("relationship-map-" + Date.now() + "-" + Math.floor(Math.random() * 100000));
    var storageWriteErrorRef = useRef(false);
    var portraitDragRef = useRef({ active: false, pointerId: null, lastX: 0, lastY: 0 });
    var portraitPinchRef = useRef({ active: false, startDistance: 0, startZoom: 1 });
    var portraitStageSizeRef = useRef(PORTRAIT_EDITOR_SIZE);
    var panRef = useRef({ x: 0, y: 0 });
    var spacePanRef = useRef(false);
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
    var zoneInteractionRef = useRef(null);
    var zonePreviewRef = useRef(null);
    var zoneDraftRef = useRef(null);
    var zoneEditorPanelRef = useRef(null);

    useLayoutEffect(function () {
      if (zoneEditorOpen && zoneEditorPanelRef.current) {
        zoneEditorPanelRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }, [zoneEditorOpen, selectedZoneId]);

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

    function zoneMemberCount(zone) {
      return data.characters.filter(function (character) {
        return character.x >= zone.x && character.x <= zone.x + zone.width && character.y >= zone.y && character.y <= zone.y + zone.height;
      }).length;
    }

    function zoneWithDefaults(zone) {
      return Object.assign({
        name: "Untitled Zone", description: "", color: "#d10d40", borderColor: "", opacity: 0.18,
        borderThickness: 2, borderStyle: "dashed", lock: false, hidden: false, layer: 0,
        shape: "rectangle", cornerRadius: 12, icon: "", notes: "", permissions: ""
      }, zone || {});
    }

    function selectZone(zoneId, openPanel) {
      var zone = data.zones.find(function (entry) { return entry.id === zoneId; });
      if (!zone) {
        return;
      }
      setSelectedZoneId(zoneId);
      setZoneEditDraft(zoneWithDefaults(clone(zone)));
      setSelected([]);
      setZoneEditorOpen(Boolean(openPanel));
      if (openPanel) {
        setActivePanel("zones");
      }
    }

    function zoneIsVisibleInViewport(zone) {
      var viewport = viewportRef.current;
      if (!viewport || !zone) {
        return true;
      }
      var rect = viewport.getBoundingClientRect();
      var left = view.x + zone.x * view.scale;
      var top = view.y + zone.y * view.scale;
      var right = view.x + (zone.x + zone.width) * view.scale;
      var bottom = view.y + (zone.y + zone.height) * view.scale;
      return right >= 0 && bottom >= 0 && left <= rect.width && top <= rect.height;
    }

    function focusZoneFromList(zoneId) {
      var zone = data.zones.find(function (entry) { return entry.id === zoneId; });
      if (!zone) {
        return;
      }
      selectZone(zoneId, true);
      if (zoneIsVisibleInViewport(zone)) {
        return;
      }
      var viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      var rect = viewport.getBoundingClientRect();
      var centerX = zone.x + zone.width / 2;
      var centerY = zone.y + zone.height / 2;
      setView(function (prev) {
        return {
          x: rect.width / 2 - centerX * prev.scale,
          y: rect.height / 2 - centerY * prev.scale,
          scale: prev.scale
        };
      });
    }
    function clearZoneSelection(showZoneList) {
      setSelectedZoneId(null);
      setZoneEditDraft(null);
      setZoneEditorOpen(false);
      if (showZoneList) {
        setActivePanel("zones");
      }
    }

    function enterZoneDrawingMode() {
      setDrawingZone(true);
      setZoneDraft(null);
      zoneDraftRef.current = null;
      clearZoneSelection(false);
    }

    function finishZoneDraft() {
      var draft = zoneDraftRef.current || zoneDraft;
      if (!draft) {
        return;
      }
      var x = Math.min(draft.x, draft.x + draft.width);
      var y = Math.min(draft.y, draft.y + draft.height);
      var width = Math.abs(draft.width);
      var height = Math.abs(draft.height);
      if (width >= 30 && height >= 30) {
        var newZoneId = "zone-" + Date.now();
        commit(function (next) {
          next.zones.push({
            id: newZoneId,
            name: "New Zone",
            x: x,
            y: y,
            width: width,
            height: height,
            color: "#d10d40",
            opacity: 0.18,
            borderThickness: 2,
            borderColor: "#d10d40",
            borderStyle: "dashed",
            description: "",
            lock: false,
            hidden: false,
            layer: (next.zones || []).length,
            shape: "rectangle",
            cornerRadius: 12
          });
        });
        setSelectedZoneId(newZoneId);
        setZoneEditDraft(zoneWithDefaults({ id: newZoneId, name: "New Zone", x: x, y: y, width: width, height: height, borderColor: "#d10d40" }));
        setZoneEditorOpen(false);
      }
      zoneDraftRef.current = null;
      setZoneDraft(null);
      setDrawingZone(false);
    }

    function cancelZoneDraft() {
      zoneDraftRef.current = null;
      setZoneDraft(null);
      setDrawingZone(false);
    }

    function relationshipTypeDefaults(categoryRef, typeRef) {
      return relationshipTypeDefaultsFromCategory(data.relationshipCategories, categoryRef, typeRef);
    }

    function relationshipLineStyleName(style) {
      var value = String(style || "solid").toLowerCase();
      return RELATIONSHIP_TYPE_STYLE_OPTIONS.indexOf(value) >= 0 ? value : "solid";
    }

    function makeRelationshipTypeDraft(seed) {
      var source = seed && typeof seed === "object" ? seed : {};
      return {
        open: Boolean(source.open),
        mode: source.mode || "create",
        typeId: source.typeId || null,
        originalName: String(source.originalName || ""),
        name: String(source.name || ""),
        label: String(source.label || ""),
        color: safeHexColor(source.color, "#d10d40"),
        style: relationshipLineStyleName(source.style || "solid"),
        width: Math.max(1, Math.min(8, Number(source.width) || 2)),
        animated: Boolean(source.animated),
        arrow: Boolean(source.arrow)
      };
    }

    function toggleRelationshipCategory(categoryId) {
      setRelationshipCategoryExpanded(function (prev) {
        var current = Object.prototype.hasOwnProperty.call(prev, categoryId) ? prev[categoryId] : true;
        return Object.assign({}, prev, { [categoryId]: !current });
      });
    }

    function openRelationshipCategoryCreate() {
      setRelationshipCategoryCreate({ open: true, name: "", color: "#d10d40" });
    }

    function cancelRelationshipCategoryCreate() {
      setRelationshipCategoryCreate({ open: false, name: "", color: "#d10d40" });
    }

    function saveRelationshipCategoryCreate() {
      var name = String(relationshipCategoryCreate.name || "").trim();
      if (!name) {
        return;
      }
      var categoryId = makeRelationshipUiId("rel-cat");
      var color = safeHexColor(relationshipCategoryCreate.color, "#d10d40");
      commit(function (next) {
        next.relationshipCategories.push({
          id: categoryId,
          name: name,
          color: color,
          types: [normalizeRelationshipType({ name: "Connection", label: "Connection", color: color }, color)]
        });
      });
      setRelationshipCategoryExpanded(function (prev) { return Object.assign({}, prev, { [categoryId]: true }); });
      cancelRelationshipCategoryCreate();
    }

    function openRelationshipCategoryEdit(category) {
      setRelationshipCategoryEdit({
        categoryId: category.id,
        name: category.name || "",
        color: safeHexColor(category.color, "#d10d40")
      });
    }

    function cancelRelationshipCategoryEdit() {
      setRelationshipCategoryEdit({ categoryId: null, name: "", color: "#d10d40" });
    }

    function saveRelationshipCategoryEdit() {
      var categoryId = relationshipCategoryEdit.categoryId;
      var nextName = String(relationshipCategoryEdit.name || "").trim();
      if (!categoryId || !nextName) {
        cancelRelationshipCategoryEdit();
        return;
      }
      var nextColor = safeHexColor(relationshipCategoryEdit.color, "#d10d40");
      commit(function (next) {
        var target = next.relationshipCategories.find(function (entry) { return entry.id === categoryId; });
        if (!target) {
          return;
        }
        var previousName = target.name;
        target.name = nextName;
        target.color = nextColor;
        target.types = (target.types || []).map(function (typeItem) {
          return Object.assign({}, typeItem, {
            color: safeHexColor(typeItem.color, nextColor)
          });
        });
        next.relationships.forEach(function (relationship) {
          if (relationship.categoryId === categoryId || relationship.category === previousName) {
            relationship.categoryId = categoryId;
            relationship.category = nextName;
          }
        });
      });
      cancelRelationshipCategoryEdit();
    }

    function deleteRelationshipCategory(categoryId) {
      var category = (data.relationshipCategories || []).find(function (entry) { return entry.id === categoryId; });
      if (!category) {
        return;
      }
      var confirmDelete = window.confirm("Delete category '" + category.name + "' and all relationships that use its types?");
      if (!confirmDelete) {
        return;
      }
      var typeIds = (category.types || []).map(function (typeItem) { return typeItem.id; });
      commit(function (next) {
        next.relationshipCategories = next.relationshipCategories.filter(function (entry) { return entry.id !== categoryId; });
        next.relationships = next.relationships.filter(function (relationship) {
          return relationship.categoryId !== categoryId && typeIds.indexOf(relationship.typeId) < 0;
        });
      });
      setRelationshipTypeDraftsByCategory(function (prev) {
        if (!Object.prototype.hasOwnProperty.call(prev, categoryId)) {
          return prev;
        }
        var next = Object.assign({}, prev);
        delete next[categoryId];
        return next;
      });
      if (relationshipCategoryEdit.categoryId === categoryId) {
        cancelRelationshipCategoryEdit();
      }
    }

    function openRelationshipTypeCreate(categoryId, categoryColor) {
      setRelationshipTypeDraftsByCategory(function (prev) {
        return Object.assign({}, prev, {
          [categoryId]: makeRelationshipTypeDraft({ open: true, mode: "create", color: safeHexColor(categoryColor, "#d10d40") })
        });
      });
    }

    function openRelationshipTypeEdit(categoryId, typeItem) {
      setRelationshipTypeDraftsByCategory(function (prev) {
        return Object.assign({}, prev, {
          [categoryId]: makeRelationshipTypeDraft({
            open: true,
            mode: "edit",
            typeId: typeItem.id,
            originalName: typeItem.name,
            name: typeItem.name,
            label: typeItem.label,
            color: typeItem.color,
            style: typeItem.style,
            width: typeItem.width,
            animated: typeItem.animated,
            arrow: typeItem.arrow
          })
        });
      });
    }

    function cancelRelationshipTypeDraft(categoryId) {
      setRelationshipTypeDraftsByCategory(function (prev) {
        if (!Object.prototype.hasOwnProperty.call(prev, categoryId)) {
          return prev;
        }
        var next = Object.assign({}, prev);
        next[categoryId] = makeRelationshipTypeDraft({ open: false });
        return next;
      });
    }

    function updateRelationshipTypeDraft(categoryId, field, value) {
      setRelationshipTypeDraftsByCategory(function (prev) {
        var current = makeRelationshipTypeDraft(prev[categoryId] || { open: true });
        var next = Object.assign({}, current, { [field]: value, open: true });
        if (field === "color") {
          next.color = safeHexColor(value, current.color);
        }
        if (field === "style") {
          next.style = relationshipLineStyleName(value);
        }
        if (field === "width") {
          next.width = Math.max(1, Math.min(8, Number(value) || 1));
        }
        return Object.assign({}, prev, { [categoryId]: next });
      });
    }

    function saveRelationshipTypeDraft(category) {
      var categoryId = category.id;
      var draft = makeRelationshipTypeDraft(relationshipTypeDraftsByCategory[categoryId] || {});
      var typeName = String(draft.name || "").trim();
      if (!draft.open || !typeName) {
        return;
      }
      var displayLabel = String(draft.label || "").trim() || typeName;
      var normalized = normalizeRelationshipType({
        id: draft.typeId || makeRelationshipUiId("rel-type"),
        name: typeName,
        label: displayLabel,
        color: draft.color,
        width: draft.width,
        style: draft.style,
        animated: draft.animated,
        arrow: draft.arrow
      }, category.color);

      var shouldUpdateExisting = draft.mode === "edit" ? window.confirm("Update existing relationships using this type?") : true;
      commit(function (next) {
        var targetCategory = next.relationshipCategories.find(function (entry) { return entry.id === categoryId; });
        if (!targetCategory) {
          return;
        }
        targetCategory.types = targetCategory.types || [];
        if (draft.mode === "edit") {
          var index = targetCategory.types.findIndex(function (typeItem) { return typeItem.id === draft.typeId; });
          if (index >= 0) {
            targetCategory.types[index] = normalized;
          }
        } else {
          targetCategory.types.push(normalized);
        }

        if (shouldUpdateExisting) {
          var defaults = relationshipTypeDefaultsFromCategory(next.relationshipCategories, categoryId, normalized.id);
          next.relationships.forEach(function (relationship) {
            var sameType = relationship.typeId === normalized.id || (relationship.categoryId === categoryId && relationship.type === draft.originalName);
            if (!sameType) {
              return;
            }
            relationship.categoryId = defaults.categoryId;
            relationship.category = defaults.category;
            relationship.typeId = defaults.typeId;
            relationship.type = defaults.type;
            relationship.displayLabel = defaults.displayLabel;
            relationship.color = defaults.color;
            relationship.thickness = defaults.thickness;
            relationship.style = defaults.style;
            relationship.animated = defaults.animated;
            relationship.arrow = defaults.arrow;
            relationship.lineMeta = Object.assign(makeRelationshipTypeDecoration(), defaults.lineMeta || {});
          });
        }
      });

      cancelRelationshipTypeDraft(categoryId);
    }

    function deleteRelationshipType(category, typeItem) {
      var categoryId = category.id;
      var typeId = typeItem.id;
      var confirmDelete = window.confirm("Delete relationship type '" + typeItem.name + "'?");
      if (!confirmDelete) {
        return;
      }
      commit(function (next) {
        var targetCategory = next.relationshipCategories.find(function (entry) { return entry.id === categoryId; });
        if (!targetCategory) {
          return;
        }
        targetCategory.types = (targetCategory.types || []).filter(function (entry) { return entry.id !== typeId; });
        next.relationships = next.relationships.filter(function (relationship) {
          return relationship.typeId !== typeId;
        });
      });
    }

    function hexToRgb(hexValue) {
      var hex = safeHexColor(hexValue, "#000000").slice(1);
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }

    function relationshipDistanceScore(currentRelationship, category, typeItem) {
      var score = 0;
      var relCategory = String(currentRelationship.category || "").toLowerCase();
      var relType = String(currentRelationship.type || "").toLowerCase();
      var relLabel = String(currentRelationship.displayLabel || "").toLowerCase();
      var catName = String(category.name || "").toLowerCase();
      var typeName = String(typeItem.name || "").toLowerCase();
      var typeLabel = String(typeItem.label || "").toLowerCase();

      if (relCategory && relCategory === catName) {
        score += 45;
      }
      if (relType && (relType === typeName || relType === typeLabel)) {
        score += 65;
      }
      if (relLabel && (relLabel === typeLabel || relLabel === typeName)) {
        score += 30;
      }
      if (String(currentRelationship.style || "") === String(typeItem.style || "")) {
        score += 20;
      }
      var relArrow = ["end", "both"].indexOf(String(currentRelationship.arrow || "none").toLowerCase()) >= 0;
      if (relArrow === Boolean(typeItem.arrow)) {
        score += 14;
      }
      if (Boolean(currentRelationship.animated) === Boolean(typeItem.animated)) {
        score += 12;
      }

      var relWidth = Math.max(1, Number(currentRelationship.thickness) || 2);
      var typeWidth = Math.max(1, Number(typeItem.width) || 2);
      score += Math.max(0, 10 - Math.abs(relWidth - typeWidth) * 3);

      var relRgb = hexToRgb(currentRelationship.color);
      var typeRgb = hexToRgb(typeItem.color);
      var distance = Math.sqrt(
        Math.pow(relRgb.r - typeRgb.r, 2) +
        Math.pow(relRgb.g - typeRgb.g, 2) +
        Math.pow(relRgb.b - typeRgb.b, 2)
      );
      score += Math.max(0, 24 - distance / 12);

      return score;
    }

    function closestDefaultRelationshipType(currentRelationship, defaultCategories) {
      var exactById = null;
      (defaultCategories || []).some(function (category) {
        var match = (category.types || []).find(function (typeItem) {
          return currentRelationship.typeId && typeItem.id === currentRelationship.typeId;
        });
        if (match) {
          exactById = { category: category, type: match, score: 999 };
          return true;
        }
        return false;
      });
      if (exactById) {
        return exactById;
      }

      var best = null;
      (defaultCategories || []).forEach(function (category) {
        (category.types || []).forEach(function (typeItem) {
          var score = relationshipDistanceScore(currentRelationship, category, typeItem);
          if (!best || score > best.score) {
            best = { category: category, type: typeItem, score: score };
          }
        });
      });

      return best && best.score >= 42 ? best : null;
    }

    function resetRelationshipDefaults() {
      var defaults = normalizeRelationshipCategories(clone(DEFAULT_RELATIONSHIP_CATEGORIES));
      var fallbackCategory = defaults[0] || { id: "", name: "", color: "#d10d40" };

      commit(function (next) {
        next.relationshipCategories = clone(defaults);
        next.relationships = (next.relationships || []).map(function (relationship) {
          var current = clone(relationship || {});
          var match = closestDefaultRelationshipType(current, defaults);
          if (match && match.category && match.type) {
            var mapped = relationshipTypeDefaultsFromCategory(defaults, match.category.id, match.type.id);
            return Object.assign({}, current, {
              category: mapped.category,
              categoryId: mapped.categoryId,
              type: mapped.type,
              typeId: mapped.typeId,
              displayLabel: mapped.displayLabel,
              color: mapped.color,
              thickness: mapped.thickness,
              style: mapped.style,
              animated: mapped.animated,
              arrow: mapped.arrow,
              lineMeta: Object.assign(makeRelationshipTypeDecoration(), mapped.lineMeta || {}, current.lineMeta || {})
            });
          }

          // Preserve unmatched relationships by marking them as custom while keeping line details.
          return Object.assign({}, current, {
            category: fallbackCategory.name,
            categoryId: fallbackCategory.id,
            type: CUSTOM_RELATIONSHIP_FALLBACK_LABEL,
            typeId: "",
            displayLabel: CUSTOM_RELATIONSHIP_FALLBACK_LABEL
          });
        });
      });

      setRelationshipTypeDraftsByCategory({});
      setRelationshipCategoryCreate({ open: false, name: "", color: "#d10d40" });
      setRelationshipCategoryEdit({ categoryId: null, name: "", color: "#d10d40" });
      setRelationshipResetDialogOpen(false);
      setRelationshipEditor(null);
      setActivePanel("relationships");
    }

    function openRelationshipEditorFor(relationship, isNew) {
      if (!relationship) {
        return;
      }
      var defaults = relationshipTypeDefaults(relationship.categoryId || relationship.category, relationship.typeId || relationship.type);
      var draftRelationship = clone(relationship);
      delete draftRelationship.sourceAnchor;
      delete draftRelationship.destinationAnchor;
      delete draftRelationship.fromAnchor;
      delete draftRelationship.toAnchor;
      setRelationshipEditor(Object.assign({}, defaults, draftRelationship, { isNew: Boolean(isNew) }));
      setActivePanel("relationship-editor");
    }

    function createRelationshipFromAnchors(fromId, toId) {
      var defaults = relationshipTypeDefaults();
      var id = makeRelationshipUiId("rel");
      var relationship = Object.assign({
        id: id,
        from: fromId,
        to: toId,
        description: "",
        gmNotes: "",
        hiddenFromCollaborators: false,
        visible: true,
        opacity: 1,
        labelColor: "#ffffff"
      }, defaults);
      commit(function (next) {
        next.relationships.push(clone(relationship));
      });
      openRelationshipEditorFor(Object.assign({}, relationship), true);
    }

    function beginRelationshipDrag(event, character, anchor) {
      if (event.button !== 0) {
        return;
      }
      if (selected.indexOf(character.id) < 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      var start = pointOnCanvas(event.clientX, event.clientY);
      setRelationshipPreview({ from: character.id, x1: start.x, y1: start.y, x2: start.x, y2: start.y });
      setRelationshipDropTarget(null);

      function move(moveEvent) {
        var point = pointOnCanvas(moveEvent.clientX, moveEvent.clientY);
        setRelationshipPreview(function (current) {
          return current ? Object.assign({}, current, { x2: point.x, y2: point.y }) : current;
        });
        var targetElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        var targetHandle = targetElement && targetElement.closest ? targetElement.closest("[data-relationship-anchor]") : null;
        var targetCharacterId = targetHandle && targetHandle.getAttribute("data-character-id");
        if (targetCharacterId && targetCharacterId !== character.id) {
          setRelationshipDropTarget({
            characterId: targetCharacterId,
            anchor: targetHandle.getAttribute("data-relationship-anchor") || "left"
          });
        } else {
          setRelationshipDropTarget(null);
        }
      }

      function up(upEvent) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        var target = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        var handle = target && target.closest ? target.closest("[data-relationship-anchor]") : null;
        var toId = handle && handle.getAttribute("data-character-id");
        if (toId && toId !== character.id) {
          createRelationshipFromAnchors(character.id, toId);
        }
        setRelationshipPreview(null);
        setRelationshipDropTarget(null);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
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
      if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") {
        return;
      }

      var channel = new window.BroadcastChannel(CHARACTER_SYNC_CHANNEL);
      characterSyncChannelRef.current = channel;

      channel.onmessage = function (event) {
        var message = event && event.data ? event.data : null;
        if (!message || message.source === characterSyncSourceRef.current) {
          return;
        }

        if (message.type === "character-updated" && message.character && message.character.id) {
          var incoming = normalizeCharacterRecord(message.character);
          setData(function (prev) {
            var next = clone(prev);
            var index = next.characters.findIndex(function (entry) { return entry.id === incoming.id; });
            if (index < 0) {
              return prev;
            }
            next.characters[index] = Object.assign({}, next.characters[index], incoming);
            return next;
          });

          setCharacterDraft(function (current) {
            if (!current || current.id !== incoming.id) {
              return current;
            }
            var normalized = characterToDraft(incoming);
            return Object.assign({}, current, normalized);
          });
          return;
        }

        if (message.type === "characters-snapshot" && Array.isArray(message.characters)) {
          setData(function (prev) {
            var next = clone(prev);
            next.characters = message.characters.map(normalizeCharacterRecord);
            if (Array.isArray(message.relationships)) {
              next.relationships = normalizeRelationships(message.relationships, next.relationshipCategories);
            }
            return next;
          });
        }
      };

      return function () {
        characterSyncChannelRef.current = null;
        channel.close();
      };
    }, []);

    useEffect(function () {
      var channel = characterSyncChannelRef.current;
      if (!channel) {
        return;
      }
      channel.postMessage({
        type: "characters-snapshot",
        source: characterSyncSourceRef.current,
        characters: clone(data.characters || []),
        relationships: clone(data.relationships || [])
      });
    }, [data.characters, data.relationships]);

    useEffect(function () {
      if (activePanel === "characters" && previousPanelRef.current !== "characters") {
        setCharacterView("directory");
        setCharacterEditMode(false);
        setCharacterDraft(null);
      }
      previousPanelRef.current = activePanel;
    }, [activePanel]);

    useEffect(function () {
      setTagGroupExpanded(function (prev) {
        var next = {};
        var changed = false;

        (data.tagGroups || []).forEach(function (group) {
          if (Object.prototype.hasOwnProperty.call(prev, group.id)) {
            next[group.id] = prev[group.id];
          } else {
            next[group.id] = true;
            changed = true;
          }
        });

        Object.keys(prev).forEach(function (groupId) {
          if (!Object.prototype.hasOwnProperty.call(next, groupId)) {
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, [data.tagGroups]);

    useEffect(function () {
      setRelationshipCategoryExpanded(function (prev) {
        var next = {};
        var changed = false;

        (data.relationshipCategories || []).forEach(function (category) {
          if (Object.prototype.hasOwnProperty.call(prev, category.id)) {
            next[category.id] = prev[category.id];
          } else {
            next[category.id] = true;
            changed = true;
          }
        });

        Object.keys(prev).forEach(function (categoryId) {
          if (!Object.prototype.hasOwnProperty.call(next, categoryId)) {
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, [data.relationshipCategories]);

    useEffect(function () {
      function onKey(event) {
        if (isEditableElement(document.activeElement)) {
          return;
        }

        if (event.code === "Space") {
          spacePanRef.current = true;
          event.preventDefault();
          return;
        }

        if (event.key === "Escape" && nodeDragRef.current.active) {
          endNodeDrag();
        }
        if (event.key === "Escape") {
          if (drawingZone) {
            cancelZoneDraft();
            return;
          }
          if (relationshipPreview) {
            setRelationshipPreview(null);
            setRelationshipDropTarget(null);
          }
          finishZoneInteraction();
          if (selectedZoneId || zoneEditorOpen) {
            clearZoneSelection(true);
            setContextMenu(null);
            return;
          }
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

      function onKeyUp(event) {
        if (event.code === "Space") {
          spacePanRef.current = false;
        }
      }

      function onBlur() {
        spacePanRef.current = false;
      }

      document.addEventListener("keydown", onKey);
      document.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      return function () {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
      };
    }, [selected, undoStack, redoStack, data, workspaceMode, profileEditMode, characterEditMode, portraitWorkflow.open, drawingZone, selectedZoneId, zoneEditorOpen, relationshipPreview]);

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
        var draft = { x: pz.x, y: pz.y, width: 0, height: 0 };
        zoneDraftRef.current = draft;
        setZoneDraft(draft);
        setSelectedZoneId(null);
        return;
      }
      setContextMenu(null);
      var isZoneTarget = Boolean(event.target && event.target.closest && event.target.closest(".zone"));
      var isNodeTarget = Boolean(event.target && event.target.closest && event.target.closest(".node"));
      if (!isZoneTarget && !isNodeTarget) {
        setSelected([]);
        setRelationshipPreview(null);
        setRelationshipDropTarget(null);
      }
      if (!isZoneTarget && !isNodeTarget && (selectedZoneId || zoneEditorOpen)) {
        clearZoneSelection(true);
      }
      setIsPanning(true);
      panRef.current = { x: event.clientX - view.x, y: event.clientY - view.y };
    }

    function onCanvasMouseMove(event) {
      var activeZoneDraft = zoneDraftRef.current || zoneDraft;
      if (activeZoneDraft) {
        var p = pointOnCanvas(event.clientX, event.clientY);
        var width = p.x - activeZoneDraft.x;
        var height = p.y - activeZoneDraft.y;
        if (event.shiftKey) {
          var side = Math.max(Math.abs(width), Math.abs(height));
          width = (width < 0 ? -1 : 1) * side;
          height = (height < 0 ? -1 : 1) * side;
        }
        var nextDraft = { x: activeZoneDraft.x, y: activeZoneDraft.y, width: width, height: height };
        zoneDraftRef.current = nextDraft;
        setZoneDraft(nextDraft);
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
      if (zoneDraftRef.current || zoneDraft) {
        finishZoneDraft();
      }
    }

    function finishZoneInteraction() {
      var interaction = zoneInteractionRef.current;
      if (!interaction) {
        return;
      }
      zoneInteractionRef.current = null;
      if (zonePreviewRef.current) {
        var finalZone = zonePreviewRef.current;
        commit(function (next) {
          var target = next.zones.find(function (zone) { return zone.id === finalZone.id; });
          if (target) {
            target.x = finalZone.x;
            target.y = finalZone.y;
            target.width = finalZone.width;
            target.height = finalZone.height;
          }
        });
        setZoneEditDraft(function (current) {
          return current && current.id === finalZone.id ? Object.assign({}, current, finalZone) : current;
        });
      }
      zonePreviewRef.current = null;
      setZonePreview(null);
    }

    function beginZoneInteraction(event, zone, handle) {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      if (handle && handle !== "move") {
        selectZone(zone.id, false);
      }
      if (zone.lock) {
        return;
      }
      var start = pointOnCanvas(event.clientX, event.clientY);
      var original = zoneWithDefaults(zone);
      var pendingInteraction = {
        id: zone.id,
        handle: handle || "move",
        startX: start.x,
        startY: start.y,
        startClientX: event.clientX,
        startClientY: event.clientY,
        original: original
      };
      var dragThresholdPixels = 4;
      var dragThresholdPixelsSquared = dragThresholdPixels * dragThresholdPixels;

      function onMove(moveEvent) {
        var interaction = zoneInteractionRef.current;
        if (!interaction) {
          var dxPixels = moveEvent.clientX - pendingInteraction.startClientX;
          var dyPixels = moveEvent.clientY - pendingInteraction.startClientY;
          if ((dxPixels * dxPixels + dyPixels * dyPixels) < dragThresholdPixelsSquared) {
            return;
          }
          zoneInteractionRef.current = {
            id: pendingInteraction.id,
            handle: pendingInteraction.handle,
            startX: pendingInteraction.startX,
            startY: pendingInteraction.startY,
            original: pendingInteraction.original
          };
          interaction = zoneInteractionRef.current;
        }
        if (!interaction) {
          return;
        }
        var point = pointOnCanvas(moveEvent.clientX, moveEvent.clientY);
        var deltaX = point.x - interaction.startX;
        var deltaY = point.y - interaction.startY;
        var next = Object.assign({}, interaction.original);
        var handleName = interaction.handle;
        if (handleName === "move") {
          next.x += deltaX;
          next.y += deltaY;
        } else {
          if (handleName.indexOf("w") >= 0) {
            next.x += deltaX;
            next.width -= deltaX;
          }
          if (handleName.indexOf("e") >= 0) {
            next.width += deltaX;
          }
          if (handleName.indexOf("n") >= 0) {
            next.y += deltaY;
            next.height -= deltaY;
          }
          if (handleName.indexOf("s") >= 0) {
            next.height += deltaY;
          }
          if (next.width < 30) {
            if (handleName.indexOf("w") >= 0) next.x = interaction.original.x + interaction.original.width - 30;
            next.width = 30;
          }
          if (next.height < 30) {
            if (handleName.indexOf("n") >= 0) next.y = interaction.original.y + interaction.original.height - 30;
            next.height = 30;
          }
        }
        zonePreviewRef.current = next;
        setZonePreview(next);
      }

      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (zoneInteractionRef.current) {
          finishZoneInteraction();
        }
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }

    function onZoneMouseDown(event, zone) {
      if (event.button !== 0) {
        return;
      }
      var isSelectedZone = selectedZoneId === zone.id;
      if (!isSelectedZone || spacePanRef.current || zone.lock) {
        return;
      }
      beginZoneInteraction(event, zone, "move");
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
      clearZoneSelection(false);

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

    function safeHexColor(value, fallback) {
      var text = String(value || "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(text)) {
        return text.toLowerCase();
      }
      return fallback;
    }

    function rangeFillPercent(value, min, max) {
      var minimum = Number(min);
      var maximum = Number(max);
      var current = Number(value);
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum || !Number.isFinite(current)) {
        return 0;
      }
      return Math.max(0, Math.min(100, ((current - minimum) / (maximum - minimum)) * 100));
    }

    function rangeFillStyle(value, min, max) {
      return { "--fill": rangeFillPercent(value, min, max) + "%" };
    }

    function syncRangeFill(event) {
      var input = event.currentTarget;
      if (input) {
        input.style.setProperty("--fill", rangeFillPercent(input.value, input.min, input.max) + "%");
      }
    }

    function zoneFillColor(color, opacity) {
      var hex = safeHexColor(color, "#d10d40").slice(1);
      var red = parseInt(hex.slice(0, 2), 16);
      var green = parseInt(hex.slice(2, 4), 16);
      var blue = parseInt(hex.slice(4, 6), 16);
      return "rgba(" + red + "," + green + "," + blue + "," + Math.max(0, Math.min(0.8, Number(opacity) || 0)) + ")";
    }

    function renderZoneResizeHandles(zone) {
      if (!zone || zone.lock) {
        return null;
      }
      var handles = [
        ["nw", "0%", "0%"], ["n", "50%", "0%"], ["ne", "100%", "0%"],
        ["w", "0%", "50%"], ["e", "100%", "50%"],
        ["sw", "0%", "100%"], ["s", "50%", "100%"], ["se", "100%", "100%"]
      ];
      var size = 8 / view.scale;
      return html`<div className="zone-resize-handles">${handles.map(function (handle) {
        return html`<span key=${handle[0]} className=${"zone-resize-handle zone-resize-" + handle[0]} style=${{ left: handle[1], top: handle[2], width: size, height: size }} onMouseDown=${function (event) { beginZoneInteraction(event, zone, handle[0]); }}></span>`;
      })}</div>`;
    }

    function makeUiId(prefix) {
      return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    }

    function countTagUsage(tagName) {
      return data.characters.filter(function (character) {
        return (character.tags || []).indexOf(tagName) >= 0;
      }).length;
    }

    function formatTagUsageCount(usageCount) {
      if (usageCount <= 0) {
        return "Unused";
      }
      if (usageCount === 1) {
        return "1 character";
      }
      return usageCount + " characters";
    }

    function toggleTagGroup(groupId) {
      setTagGroupExpanded(function (prev) {
        var current = Object.prototype.hasOwnProperty.call(prev, groupId) ? prev[groupId] : true;
        return Object.assign({}, prev, { [groupId]: !current });
      });
    }

    function openTagGroupCreate() {
      setTagGroupCreate({ open: true, name: "" });
    }

    function cancelTagGroupCreate() {
      setTagGroupCreate({ open: false, name: "" });
    }

    function saveTagGroupCreate() {
      var name = String(tagGroupCreate.name || "").trim();
      if (!name) {
        return;
      }
      var groupId = makeUiId("tg");
      commit(function (next) {
        next.tagGroups.push({ id: groupId, name: name, tags: [] });
      });
      setTagGroupExpanded(function (prev) { return Object.assign({}, prev, { [groupId]: true }); });
      setTagGroupCreate({ open: false, name: "" });
    }

    function openTagGroupRename(group) {
      setTagGroupRenameDraft({ groupId: group.id, name: group.name || "" });
    }

    function cancelTagGroupRename() {
      setTagGroupRenameDraft({ groupId: null, name: "" });
    }

    function saveTagGroupRename() {
      var targetGroupId = tagGroupRenameDraft.groupId;
      var nextName = String(tagGroupRenameDraft.name || "").trim();
      if (!targetGroupId || !nextName) {
        cancelTagGroupRename();
        return;
      }

      commit(function (next) {
        var target = next.tagGroups.find(function (group) { return group.id === targetGroupId; });
        if (target) {
          target.name = nextName;
        }
      });

      cancelTagGroupRename();
    }

    function deleteTagGroup(groupId) {
      var group = (data.tagGroups || []).find(function (item) { return item.id === groupId; });
      if (!group) {
        return;
      }

      commit(function (next) {
        next.tagGroups = next.tagGroups.filter(function (item) { return item.id !== groupId; });
      });

      setTagDraftsByGroup(function (prev) {
        if (!Object.prototype.hasOwnProperty.call(prev, groupId)) {
          return prev;
        }
        var next = Object.assign({}, prev);
        delete next[groupId];
        return next;
      });

      setTagGroupExpanded(function (prev) {
        if (!Object.prototype.hasOwnProperty.call(prev, groupId)) {
          return prev;
        }
        var next = Object.assign({}, prev);
        delete next[groupId];
        return next;
      });

      if (tagGroupRenameDraft.groupId === groupId) {
        cancelTagGroupRename();
      }
      if (tagEditDialog.groupId === groupId) {
        closeTagEditDialog();
      }
    }

    function openTagCreate(groupId) {
      setTagDraftsByGroup(function (prev) {
        return Object.assign({}, prev, {
          [groupId]: {
            open: true,
            name: "",
            color: "#d10d40"
          }
        });
      });
    }

    function closeTagCreate(groupId) {
      setTagDraftsByGroup(function (prev) {
        if (!Object.prototype.hasOwnProperty.call(prev, groupId)) {
          return prev;
        }
        var next = Object.assign({}, prev);
        next[groupId] = { open: false, name: "", color: "#d10d40" };
        return next;
      });
    }

    function updateTagCreateDraft(groupId, field, value) {
      setTagDraftsByGroup(function (prev) {
        var current = prev[groupId] || { open: true, name: "", color: "#d10d40" };
        return Object.assign({}, prev, {
          [groupId]: Object.assign({}, current, { [field]: value })
        });
      });
    }

    function saveTagCreate(groupId) {
      var draft = tagDraftsByGroup[groupId] || { open: false, name: "", color: "#d10d40" };
      var tagName = String(draft.name || "").trim();
      if (!tagName) {
        return;
      }

      commit(function (next) {
        var group = next.tagGroups.find(function (item) { return item.id === groupId; });
        if (!group) {
          return;
        }
        group.tags = group.tags || [];
        group.tags.push({
          id: makeUiId("tag"),
          name: tagName,
          color: safeHexColor(draft.color, "#d10d40"),
          icon: "",
          description: "",
          visible: true
        });
      });

      closeTagCreate(groupId);
    }

    function updateTagColor(groupId, tagId, color) {
      commit(function (next) {
        var group = next.tagGroups.find(function (item) { return item.id === groupId; });
        var tag = group && (group.tags || []).find(function (item) { return item.id === tagId; });
        if (tag) {
          tag.color = safeHexColor(color, "#d10d40");
        }
      });
    }

    function openTagEditDialog(groupId, tagId) {
      var group = (data.tagGroups || []).find(function (item) { return item.id === groupId; });
      var tag = group && (group.tags || []).find(function (item) { return item.id === tagId; });
      if (!tag) {
        return;
      }

      setTagEditDialog({
        open: true,
        groupId: groupId,
        tagId: tagId,
        originalName: String(tag.name || ""),
        name: String(tag.name || ""),
        color: safeHexColor(tag.color, "#d10d40"),
        icon: String(tag.icon || ""),
        description: String(tag.description || "")
      });
    }

    function closeTagEditDialog() {
      setTagEditDialog({
        open: false,
        groupId: null,
        tagId: null,
        originalName: "",
        name: "",
        color: "#d10d40",
        icon: "",
        description: ""
      });
    }

    function updateTagEditField(field, value) {
      setTagEditDialog(function (prev) {
        if (!prev.open) {
          return prev;
        }
        return Object.assign({}, prev, { [field]: value });
      });
    }

    function saveTagEditDialog() {
      if (!tagEditDialog.open || !tagEditDialog.groupId || !tagEditDialog.tagId) {
        return;
      }

      var nextTagName = String(tagEditDialog.name || "").trim();
      if (!nextTagName) {
        return;
      }

      commit(function (next) {
        var group = next.tagGroups.find(function (item) { return item.id === tagEditDialog.groupId; });
        var tag = group && (group.tags || []).find(function (item) { return item.id === tagEditDialog.tagId; });
        if (!tag) {
          return;
        }

        tag.name = nextTagName;
        tag.color = safeHexColor(tagEditDialog.color, "#d10d40");
        tag.icon = String(tagEditDialog.icon || "");
        tag.description = String(tagEditDialog.description || "");
      });

      closeTagEditDialog();
    }

    function deleteTag(groupId, tagId) {
      var group = (data.tagGroups || []).find(function (item) { return item.id === groupId; });
      var tag = group && (group.tags || []).find(function (item) { return item.id === tagId; });
      if (!tag) {
        return;
      }

      commit(function (next) {
        var nextGroup = next.tagGroups.find(function (item) { return item.id === groupId; });
        if (nextGroup) {
          nextGroup.tags = (nextGroup.tags || []).filter(function (item) { return item.id !== tagId; });
        }
      });

      if (tagEditDialog.open && tagEditDialog.groupId === groupId && tagEditDialog.tagId === tagId) {
        closeTagEditDialog();
      }
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
        delete merged.badges;
        merged.characters = (merged.characters || []).map(normalizeCharacterRecord);
        merged.relationshipCategories = normalizeRelationshipCategories(merged.relationshipCategories);
        merged.relationships = normalizeRelationships(merged.relationships, merged.relationshipCategories);
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
        ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
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
            ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
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
                      ${(c.tags || []).slice(0, 3).map(function (t, index) { return html`<span className="tag" key=${c.id + "-tag-" + t + "-" + index}>${t}</span>`; })}
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
          dossierEntryGroup({ key: "field-" + character.id + "-convictions", title: "Convictions", entryText: character.convictions, accentColor: "#d10d40", emptyText: "Not set" }),
          dossierEntryGroup({ key: "field-" + character.id + "-touchstones", title: "Touchstones", entryText: character.touchstones, accentColor: "#d10d40", emptyText: "Not set" })
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
                  ${(character.tags || []).map(function (tag, index) { return html`<span className="tag" key=${"summary-" + character.id + "-" + tag + "-" + index}>${tag}</span>`; })}
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

        function onOutlineHexInput(rawValue) {
          var value = String(rawValue || "").trim();
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
            ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
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
                ${IconButton({ onClick: clearPortrait, ariaLabel: "Delete portrait", icon: "⌫", className: "icon-button-48 edit-portrait-delete" })}
              </div>
            </section>

            <section className="edit-character-section">
              ${ColorField({
                label: "Outline Colour",
                fieldName: "Outline Colour",
                value: outlineColor,
                fallback: "#d10d40",
                textValue: String(characterDraft.outlineColor || "").toUpperCase(),
                onChange: function (nextColor) {
                  updateDraft("outlineColor", String(nextColor || "").toUpperCase());
                },
                onHexInput: onOutlineHexInput
              })}
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
              ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
            </div>
            <div className="panel-body"><div className="card">No character selected.</div></div>
          </div>`;
        }
        return html`<div key=${"details-" + (characterEditMode ? "edit" : "read") + "-" + focused.id} className=${"character-view character-view-details" + (characterEditMode ? " mode-edit" : " mode-read")}>
          <div className="panel-header details-header">
            <button onClick=${backToDirectory}>Directory</button>
            <h2>Character Details</h2>
            ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
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
                style=${rangeFillStyle(portraitWorkflow.zoom, portraitWorkflow.minZoom || 1, 4)}
                onInput=${function (event) { syncRangeFill(event); updatePortraitZoom(Number(event.target.value)); }}
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
      var timelineDisplayEvents = profileEditMode
        ? timelineEventsForDisplay(draft.timelineEvents || [], draft.dateOfBirth, draft.dateOfDeath)
        : timelineEventsForDisplay(profileRecord.timeline || [], profileRecord.dateOfBirth, profileRecord.dateOfDeath);

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
            ${IconButton({ onClick: returnFromCharacterProfile, ariaLabel: "Close biography view", icon: "×", className: "icon-button-34 profile-close-button" })}
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
                ? (SharedBiographyWorkspace
                    ? html`<${SharedBiographyWorkspace}
                        editable=${true}
                        value=${String(draft.bioHtml || "")}
                        onChange=${function (htmlValue) { updateDraftField("bioHtml", htmlValue); }}
                        editorClassName="rich-editor profile-rich-editor character-rich-text"
                        viewerClassName="profile-biography-content character-rich-text"
                      />`
                    : html`<div className="profile-biography-content character-rich-text" dangerouslySetInnerHTML=${{ __html: characterBiographyHtml(profileRecord) }}></div>`)
                : (SharedBiographyWorkspace
                    ? html`<${SharedBiographyWorkspace}
                        editable=${false}
                        value=${String(characterBiographyHtml(profileRecord) || "")}
                        viewerClassName="profile-biography-content character-rich-text"
                      />`
                    : html`<div className="profile-biography-content character-rich-text" dangerouslySetInnerHTML=${{ __html: characterBiographyHtml(profileRecord) }}></div>`)}
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
                ${timelineDisplayEvents.length ? timelineDisplayEvents.map(function (entry) {
                  var sourceIndex = entry.sourceIndex;
                  var item = normalizeTimelineEvent(entry.event);
                  var isSystem = entry.isSystem;
                  var isExpanded = timelineExpandedIndex === sourceIndex;
                  var label = timelineEventLabel(item);
                  return html`<article className=${"timeline-log-item expandable" + (isSystem ? " timeline-system-item" : "") + (isExpanded ? " expanded" : "")} key=${"timeline-event-" + sourceIndex}>
                    ${isSystem ? html`<div className="timeline-log-head">
                      <div className="timeline-log-main" onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>
                        <p className="timeline-log-title-row"><span className="timeline-log-caret">${isExpanded ? "▼" : "▶"}</span><strong>${label}</strong><span className="timeline-system-badge">System Event</span></p>
                        ${isExpanded ? html`<p className="timeline-log-date">${formatDisplayDate(item.date)}</p>` : null}
                      </div>
                      <div className="timeline-log-actions"><span className="timeline-system-readonly">Read-only</span></div>
                    </div>` : html`<div className="timeline-log-head" onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>
                      <div className="timeline-log-main">
                        <p className="timeline-log-title-row"><span className="timeline-log-caret">${isExpanded ? "▼" : "▶"}</span><strong>${label}</strong></p>
                        ${isExpanded ? html`<p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>` : null}
                        ${isExpanded ? (item.description
                          ? html`<p className="timeline-log-description">${item.description}</p>`
                          : html`<p className="timeline-log-description hint">No description provided.</p>`) : null}
                      </div>
                      ${isExpanded ? html`<div className="timeline-log-actions">
                        <button className="timeline-action-button" onClick=${function (e) { e.stopPropagation(); setTimelineExpandedIndex(null); }}>Close</button>
                        <button className="timeline-action-button" onClick=${function (e) { e.stopPropagation(); removeTimelineEvent(sourceIndex); }}>Delete</button>
                      </div>` : null}
                    </div>`}
                    ${isExpanded && !isSystem ? html`<div className="timeline-log-editor">
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
                ${timelineDisplayEvents.length ? timelineDisplayEvents.map(function (entry) {
                  var sourceIndex = entry.sourceIndex;
                  var item = normalizeTimelineEvent(entry.event);
                  var isSystem = entry.isSystem;
                  var isExpanded = timelineExpandedIndex === sourceIndex;
                  var label = timelineEventLabel(item);
                  return html`<article className=${"timeline-log-item timeline-readonly-item expandable" + (isSystem ? " timeline-system-item" : "") + (isExpanded ? " expanded" : "")} key=${"timeline-readonly-" + sourceIndex}>
                    ${isSystem ? html`<div className="timeline-log-head">
                      <div
                        className="timeline-log-main"
                        role="button"
                        tabIndex="0"
                        onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}
                        onKeyDown=${function (e) {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setTimelineExpandedIndex(isExpanded ? null : sourceIndex);
                          }
                        }}
                      >
                        <p className="timeline-log-title-row"><span className="timeline-log-caret">${isExpanded ? "▼" : "▶"}</span><strong>${label}</strong><span className="timeline-system-badge">System Event</span></p>
                        ${isExpanded ? html`<p className="timeline-log-date">${formatDisplayDate(item.date)}</p>` : null}
                      </div>
                      <div className="timeline-log-actions"><span className="timeline-system-readonly">Read-only</span></div>
                    </div>` : html`<div className="timeline-log-head" onClick=${function () { setTimelineExpandedIndex(isExpanded ? null : sourceIndex); }}>
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
                        ${isExpanded ? html`<p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>` : null}
                        ${isExpanded ? (item.description
                          ? html`<p className="timeline-log-description">${item.description}</p>`
                          : html`<p className="timeline-log-description hint">No description provided.</p>`) : null}
                      </div>
                    </div>`}
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
      var selectedZone = selectedZoneId ? data.zones.find(function (zone) { return zone.id === selectedZoneId; }) : null;
      var draft = zoneEditorOpen && zoneEditDraft && selectedZone ? zoneEditDraft : null;
      function updateField(field, value) {
        setZoneEditDraft(function (current) { return current ? Object.assign({}, current, { [field]: value }) : current; });
      }
      function onColorHexInput(field, rawValue) {
        var value = String(rawValue || "").trim();
        if (value && value.charAt(0) !== "#") {
          value = "#" + value;
        }
        if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
          updateField(field, value.toUpperCase());
        }
      }
      function saveZone() {
        if (!draft || !selectedZone || draft.id !== selectedZone.id) return;
        commit(function (next) {
          var target = next.zones.find(function (zone) { return zone.id === draft.id; });
          if (target) Object.assign(target, zoneWithDefaults(draft));
        });
        setZoneEditorOpen(false);
      }
      if (draft) {
        return html`${panelHeader("Edit Zone")}
        <div className="panel-body zone-editor-panel" ref=${zoneEditorPanelRef}>
          <section className="zone-editor-group"><h4>General</h4>
            <label>Zone Name</label><input value=${draft.name} onInput=${function (e) { updateField("name", e.target.value); }} />
            <label>Description</label><textarea rows="3" value=${draft.description || ""} onInput=${function (e) { updateField("description", e.target.value); }} />
          </section>
          <section className="zone-editor-group"><h4>Appearance</h4>
            <div className="split">
              <div>
                ${ColorField({
                  label: "Fill Colour",
                  fieldName: "Fill Colour",
                  value: safeHexColor(draft.color, "#d10d40"),
                  fallback: "#d10d40",
                  textValue: String(draft.color || "").toUpperCase(),
                  onChange: function (nextColor) { updateField("color", String(nextColor || "").toUpperCase()); },
                  onHexInput: function (nextValue) { onColorHexInput("color", nextValue); }
                })}
              </div>
              <div>
                ${ColorField({
                  label: "Border Colour",
                  fieldName: "Border Colour",
                  value: safeHexColor(draft.borderColor || draft.color, "#d10d40"),
                  fallback: "#d10d40",
                  textValue: String((draft.borderColor || draft.color) || "").toUpperCase(),
                  onChange: function (nextColor) { updateField("borderColor", String(nextColor || "").toUpperCase()); },
                  onHexInput: function (nextValue) { onColorHexInput("borderColor", nextValue); }
                })}
              </div>
            </div>
            <label>Fill Opacity <span className="hint">${Math.round(Number(draft.opacity || 0) * 100)}%</span></label><input type="range" min="0" max="0.8" step="0.01" value=${draft.opacity} style=${rangeFillStyle(draft.opacity, 0, 0.8)} onInput=${function (e) { syncRangeFill(e); updateField("opacity", Number(e.target.value)); }} />
            <label>Border Thickness</label><input type="range" min="1" max="8" step="1" value=${draft.borderThickness} style=${rangeFillStyle(draft.borderThickness, 1, 8)} onInput=${function (e) { syncRangeFill(e); updateField("borderThickness", Number(e.target.value)); }} />
            <label>Border Style</label><select value=${draft.borderStyle || "dashed"} onChange=${function (e) { updateField("borderStyle", e.target.value); }}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select>
          </section>
          <section className="zone-editor-group"><h4>Behaviour</h4>
            <article className="zone-lock-card">
              <span className="zone-lock-icon" aria-hidden="true">${Icon({ icon: CAMPAIGN_ATLAS_ICON_ASSETS.lock, size: 17, className: "zone-lock-icon-glyph" })}</span>
              <div className="zone-lock-copy">
                <strong>Lock Zone</strong>
                <p>Prevent this zone from being moved or resized on the Relationship Map.</p>
              </div>
              <button
                type="button"
                className=${"toggle-switch zone-lock-toggle" + (draft.lock ? " on" : "")}
                aria-pressed=${draft.lock ? "true" : "false"}
                aria-label="Toggle lock zone"
                onClick=${function () { updateField("lock", !draft.lock); }}
              ><span></span></button>
            </article>
          </section>
          <section className="zone-editor-group"><h4>Layer Controls</h4><div className="row">
            <button onClick=${function () { updateField("layer", Math.max.apply(null, data.zones.map(function (zone) { return Number(zone.layer) || 0; })) + 1); }}>Bring Forward</button>
            <button onClick=${function () { updateField("layer", Math.min.apply(null, data.zones.map(function (zone) { return Number(zone.layer) || 0; })) - 1); }}>Send Backward</button>
          </div></section>
          <div className="zone-editor-actions"><button onClick=${saveZone}>Save</button><button onClick=${function () { setZoneEditorOpen(false); }}>Back to Zone List</button><button className="destructive" onClick=${function () { commit(function (next) { next.zones = next.zones.filter(function (zone) { return zone.id !== draft.id; }); }); setSelectedZoneId(null); setZoneEditDraft(null); setZoneEditorOpen(false); }}>Delete Zone</button></div>
        </div>`;
      }
      return html`${panelHeader("Zones")}
      <div className="panel-body zone-list-panel">
        <button className="zone-draw-button" onClick=${enterZoneDrawingMode}>Draw New Zone</button>
        <div className="zone-list">${data.zones.map(function (zone) {
          var current = zoneWithDefaults(zone);
          return html`<button className="zone-list-item" key=${zone.id} onClick=${function () { focusZoneFromList(zone.id); }}><span className="zone-list-swatch" style=${{ backgroundColor: current.color }}></span><span className="zone-list-name">${current.name}</span><span className="zone-list-count">${zoneMemberCount(current)} members</span></button>`;
        })}</div>
        <button className="destructive zone-delete-all" disabled=${!data.zones.length} onClick=${function () { commit(function (next) { next.zones = []; }); setSelectedZoneId(null); setZoneEditDraft(null); setZoneEditorOpen(false); }}>Delete All Zones</button>
      </div>`;
    }

    function relationshipEditorPanel() {
      var draft = relationshipEditor;
      if (!draft) {
        return null;
      }
      var from = data.characters.find(function (character) { return character.id === draft.from; });
      var to = data.characters.find(function (character) { return character.id === draft.to; });
      var selectedCategory = data.relationshipCategories.find(function (entry) {
        return entry.id === draft.categoryId || entry.name === draft.category;
      }) || data.relationshipCategories[0];
      var availableTypes = selectedCategory ? (selectedCategory.types || []) : [];

      function update(field, value) {
        setRelationshipEditor(function (current) {
          if (!current) {
            return current;
          }
          return Object.assign({}, current, { [field]: value });
        });
      }

      function chooseCategory(category) {
        var firstType = (category.types || [])[0];
        var defaults = relationshipTypeDefaults(category.id, firstType && firstType.id);
        setRelationshipEditor(function (current) {
          return current ? Object.assign({}, current, defaults) : current;
        });
      }

      function chooseType(category, typeItem) {
        var defaults = relationshipTypeDefaults(category.id, typeItem.id);
        setRelationshipEditor(function (current) {
          return current ? Object.assign({}, current, defaults) : current;
        });
      }

      function save() {
        var savedDraft = clone(draft);
        delete savedDraft.sourceAnchor;
        delete savedDraft.destinationAnchor;
        delete savedDraft.fromAnchor;
        delete savedDraft.toAnchor;
        commit(function (next) {
          var relationship = next.relationships.find(function (entry) { return entry.id === draft.id; });
          if (relationship) {
            Object.assign(relationship, savedDraft, { isNew: undefined });
          }
        });
        setRelationshipEditor(null);
        setActivePanel(null);
      }

      function cancel() {
        if (draft.isNew) {
          commit(function (next) {
            next.relationships = next.relationships.filter(function (entry) { return entry.id !== draft.id; });
          });
        }
        setRelationshipEditor(null);
        setActivePanel(null);
      }

      function remove() {
        commit(function (next) {
          next.relationships = next.relationships.filter(function (entry) { return entry.id !== draft.id; });
        });
        setRelationshipEditor(null);
        setActivePanel(null);
      }

      return html`${panelHeader("Relationship Editor")}
      <div className="panel-body relationship-editor-panel">
        <div className="relationship-editor-parties">
          <div><span>From</span><strong>${from ? from.name : "Unknown"}</strong></div>
          <div><span>To</span><strong>${to ? to.name : "Unknown"}</strong></div>
        </div>

        <div className="relationship-editor-live-preview">
          <span>Live Preview</span>
          <svg viewBox="0 0 280 32" className="relationship-editor-preview-svg" aria-hidden="true">
            <defs key="relationship-editor-preview-defs"><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>
            ${(() => {
              var draftResolvedAnchors = relationshipResolvedAnchors(from || { x: 18, y: 16, nodeSize: 1 }, to || { x: 262, y: 16, nodeSize: 1 });
              return renderRelationshipStroke({
                route: relationshipRouteSpec(
                  relationshipAnchorPoint(from || { x: 18, y: 16, nodeSize: 1 }, draftResolvedAnchors.sourceAnchor),
                  relationshipAnchorPoint(to || { x: 262, y: 16, nodeSize: 1 }, draftResolvedAnchors.destinationAnchor),
                  draftResolvedAnchors.sourceAnchor,
                  draftResolvedAnchors.destinationAnchor,
                  draft.routingMode || "auto"
                ),
                style: draft.style,
                color: draft.color,
                width: Math.max(1, Number(draft.thickness) || 2),
                opacity: Number(draft.opacity),
                animated: Boolean(draft.animated),
                markerEnd: draft.arrow === "end" || draft.arrow === "both" ? "url(#arrowHead)" : null,
                markerStart: draft.arrow === "start" || draft.arrow === "both" ? "url(#arrowHead)" : null,
                includeHitArea: false,
                keyPrefix: "relationship-editor-preview"
              });
            })()}
          </svg>
        </div>

        <h4>Relationship Category</h4>
        <div className="relationship-category-buttons">
          ${data.relationshipCategories.map(function (category) {
            var isActive = category.id === draft.categoryId;
            return html`<button key=${"rel-cat-option-" + category.id} className=${isActive ? "active" : ""} style=${{ borderColor: category.color }} onClick=${function () { chooseCategory(category); }}>${category.name}</button>`;
          })}
        </div>

        <h4>Relationship Type</h4>
        <div className="relationship-type-cards">
          ${availableTypes.map(function (typeItem) {
            var isActive = typeItem.id === draft.typeId;
            var previewRoute = relationshipRouteSpec({ x: 4, y: 6 }, { x: 116, y: 6 }, "right", "left", "straight");
            return html`<button key=${"rel-type-option-" + typeItem.id} className=${"relationship-type-card" + (isActive ? " active" : "")} onClick=${function () { chooseType(selectedCategory, typeItem); }}>
              <span className="relationship-type-color" style=${{ backgroundColor: typeItem.color }}></span>
              <strong>${typeItem.name}</strong>
              <svg viewBox="0 0 120 12" className="relationship-type-preview" aria-hidden="true">
                <defs key=${"type-preview-defs-" + typeItem.id}><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>
                ${renderRelationshipStroke({
                  route: previewRoute,
                  style: typeItem.style,
                  color: typeItem.color,
                  width: Math.max(1, typeItem.width),
                  opacity: 1,
                  animated: Boolean(typeItem.animated),
                  markerEnd: typeItem.arrow ? "url(#arrowHead)" : null,
                  includeHitArea: false,
                  keyPrefix: "type-preview-card-" + typeItem.id
                })}
              </svg>
            </button>`;
          })}
        </div>

        <label>Direction</label>
        <select value=${draft.arrow || "end"} onChange=${function (event) { update("arrow", event.target.value); }}>
          <option value="end">${from ? from.name : "Character A"} → ${to ? to.name : "Character B"}</option>
          <option value="start">${to ? to.name : "Character B"} → ${from ? from.name : "Character A"}</option>
          <option value="both">Bidirectional</option>
        </select>

        <label>Routing</label>
        <select value=${draft.routingMode || "auto"} onChange=${function (event) { update("routingMode", event.target.value); }}>
          <option value="auto">Auto</option>
          <option value="straight">Straight</option>
          <option value="curved">Curved</option>
        </select>

        <label className="zone-toggle"><input type="checkbox" checked=${Boolean(draft.hiddenFromCollaborators)} onChange=${function (event) { update("hiddenFromCollaborators", event.target.checked); }} /> Hide Relationship from Collaborators</label>
        <label>Description</label>
        <textarea rows="3" value=${draft.description || ""} onInput=${function (event) { update("description", event.target.value); }}></textarea>
        <label>GM Notes</label>
        <textarea rows="3" value=${draft.gmNotes || ""} onInput=${function (event) { update("gmNotes", event.target.value); }} placeholder="Future-ready storyteller notes"></textarea>

        <div className="zone-editor-actions">
          <button onClick=${save}>Save</button>
          <button onClick=${cancel}>Cancel</button>
          <button className="destructive" onClick=${remove}>Delete</button>
        </div>
      </div>`;
    }

    var RELATIONSHIP_CONNECTION_NODE_DIAMETER = 12;
    var RELATIONSHIP_CONNECTION_NODE_OFFSET_X = -6;
    var RELATIONSHIP_CONNECTION_NODE_OFFSET_Y = -6;

    function relationshipNodeGeometry(character) {
      var nodeSize = Math.max(0.7, Math.min(1.8, Number(character && character.nodeSize) || 1));
      var shellDiameter = 74 * nodeSize;
      return {
        x: Number(character && character.x) || 0,
        y: Number(character && character.y) || 0,
        nodeSize: nodeSize,
        shellDiameter: shellDiameter,
        shellRadius: shellDiameter / 2,
        nodeRadius: RELATIONSHIP_CONNECTION_NODE_DIAMETER / 2
      };
    }

    function relationshipConnectionNodeLocalPoint(geometry, anchor) {
      var offsetX = RELATIONSHIP_CONNECTION_NODE_OFFSET_X;
      var offsetY = RELATIONSHIP_CONNECTION_NODE_OFFSET_Y;
      var topBottomShiftX = 4;
      var bottomShiftY = -2;
      switch (String(anchor || "").toLowerCase()) {
        case "top": return { x: geometry.shellRadius + offsetX + topBottomShiftX, y: offsetY };
        case "right": return { x: geometry.shellDiameter + offsetX, y: geometry.shellRadius + offsetY };
        case "bottom": return { x: geometry.shellRadius + offsetX + topBottomShiftX, y: geometry.shellDiameter + offsetY + bottomShiftY };
        case "left": return { x: offsetX, y: geometry.shellRadius + offsetY };
        default: return { x: geometry.shellRadius + offsetX, y: geometry.shellRadius + offsetY };
      }
    }

    function relationshipAnchorPoint(character, anchor) {
      var geometry = relationshipNodeGeometry(character);
      var localPoint = relationshipConnectionNodeLocalPoint(geometry, anchor);
      return {
        x: geometry.x - geometry.shellRadius + localPoint.x,
        y: geometry.y - geometry.shellRadius + localPoint.y
      };
    }

    function relationshipAnchorVector(anchor) {
      switch (String(anchor || "").toLowerCase()) {
        case "top": return { x: 0, y: -1 };
        case "right": return { x: 1, y: 0 };
        case "bottom": return { x: 0, y: 1 };
        case "left": return { x: -1, y: 0 };
        default: return { x: 1, y: 0 };
      }
    }

    function relationshipRouteStraight(fromPoint, toPoint) {
      var mid = {
        x: (fromPoint.x + toPoint.x) / 2,
        y: (fromPoint.y + toPoint.y) / 2
      };
      return {
        kind: "straight",
        from: { x: fromPoint.x, y: fromPoint.y },
        to: { x: toPoint.x, y: toPoint.y },
        d: "M " + fromPoint.x + " " + fromPoint.y + " L " + toPoint.x + " " + toPoint.y,
        labelPoint: mid
      };
    }

    function cubicBezierPoint(p0, p1, p2, p3, t) {
      var mt = 1 - t;
      var mt2 = mt * mt;
      var t2 = t * t;
      return {
        x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
        y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
      };
    }

    function relationshipRouteCurved(fromPoint, toPoint, fromAnchor, toAnchor, mode) {
      var dx = toPoint.x - fromPoint.x;
      var dy = toPoint.y - fromPoint.y;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var sourceVector = relationshipAnchorVector(fromAnchor);
      var targetVector = relationshipAnchorVector(toAnchor);

      var pull = clamp(distance * (mode === "curved" ? 0.28 : 0.22), 24, 210);
      if (mode === "auto") {
        if (distance < 180) {
          pull *= 0.62;
        } else if (distance > 760) {
          pull *= 1.2;
        }
      }

      var control1 = {
        x: fromPoint.x + sourceVector.x * pull,
        y: fromPoint.y + sourceVector.y * pull
      };
      var control2 = {
        x: toPoint.x + targetVector.x * pull,
        y: toPoint.y + targetVector.y * pull
      };
      var label = cubicBezierPoint(fromPoint, control1, control2, toPoint, 0.5);

      return {
        kind: "curved",
        from: { x: fromPoint.x, y: fromPoint.y },
        to: { x: toPoint.x, y: toPoint.y },
        control1: control1,
        control2: control2,
        d: "M " + fromPoint.x + " " + fromPoint.y + " C " + control1.x + " " + control1.y + ", " + control2.x + " " + control2.y + ", " + toPoint.x + " " + toPoint.y,
        labelPoint: label
      };
    }

    var RELATIONSHIP_ROUTE_ENGINES = {
      straight: function (fromPoint, toPoint) {
        return relationshipRouteStraight(fromPoint, toPoint);
      },
      curved: function (fromPoint, toPoint, fromAnchor, toAnchor) {
        return relationshipRouteCurved(fromPoint, toPoint, fromAnchor, toAnchor, "curved");
      },
      auto: function (fromPoint, toPoint, fromAnchor, toAnchor) {
        var dx = Math.abs(toPoint.x - fromPoint.x);
        var dy = Math.abs(toPoint.y - fromPoint.y);
        var distance = Math.sqrt(dx * dx + dy * dy);
        var alignTolerance = Math.max(24, Math.min(56, distance * 0.08));
        var approximatelyAligned = dx <= alignTolerance || dy <= alignTolerance;
        if (approximatelyAligned) {
          return relationshipRouteStraight(fromPoint, toPoint);
        }
        return relationshipRouteCurved(fromPoint, toPoint, fromAnchor, toAnchor, "auto");
      }
    };

    function relationshipRouteSpec(fromPoint, toPoint, fromAnchor, toAnchor, routingMode) {
      var mode = String(routingMode || "auto").toLowerCase();
      var engine = RELATIONSHIP_ROUTE_ENGINES[mode] || RELATIONSHIP_ROUTE_ENGINES.auto;
      return engine(fromPoint, toPoint, fromAnchor, toAnchor);
    }

    function relationshipRouteSample(route, t) {
      var clampedT = clamp(Number(t) || 0, 0, 1);
      if (!route || route.kind === "straight") {
        var fromPoint = route && route.from ? route.from : { x: 0, y: 0 };
        var toPoint = route && route.to ? route.to : { x: 0, y: 0 };
        var dx = toPoint.x - fromPoint.x;
        var dy = toPoint.y - fromPoint.y;
        return {
          point: {
            x: fromPoint.x + dx * clampedT,
            y: fromPoint.y + dy * clampedT
          },
          tangent: { x: dx, y: dy }
        };
      }

      var p0 = route.from;
      var p1 = route.control1;
      var p2 = route.control2;
      var p3 = route.to;
      var point = cubicBezierPoint(p0, p1, p2, p3, clampedT);
      var mt = 1 - clampedT;
      var tangent = {
        x: (3 * mt * mt * (p1.x - p0.x)) + (6 * mt * clampedT * (p2.x - p1.x)) + (3 * clampedT * clampedT * (p3.x - p2.x)),
        y: (3 * mt * mt * (p1.y - p0.y)) + (6 * mt * clampedT * (p2.y - p1.y)) + (3 * clampedT * clampedT * (p3.y - p2.y))
      };
      return { point: point, tangent: tangent };
    }

    function relationshipRouteArcTable(route, segments) {
      var count = Math.max(8, Number(segments) || 32);
      var entries = [];
      var total = 0;
      var first = relationshipRouteSample(route, 0).point;
      entries.push({ t: 0, length: 0, point: first });
      var previous = first;
      for (var i = 1; i <= count; i += 1) {
        var t = i / count;
        var sample = relationshipRouteSample(route, t).point;
        var segmentLength = Math.sqrt(Math.pow(sample.x - previous.x, 2) + Math.pow(sample.y - previous.y, 2));
        total += segmentLength;
        entries.push({ t: t, length: total, point: sample });
        previous = sample;
      }
      return { entries: entries, total: total };
    }

    function relationshipRouteSampleAtDistance(route, arcTable, distance) {
      var table = arcTable || relationshipRouteArcTable(route, 32);
      var target = clamp(Number(distance) || 0, 0, table.total || 0);
      var entries = table.entries;
      if (!entries || entries.length < 2) {
        return relationshipRouteSample(route, 0);
      }
      var right = entries[entries.length - 1];
      var left = entries[0];
      for (var i = 1; i < entries.length; i += 1) {
        if (entries[i].length >= target) {
          right = entries[i];
          left = entries[i - 1];
          break;
        }
      }
      var span = right.length - left.length;
      var ratio = span <= 0 ? 0 : (target - left.length) / span;
      var t = left.t + (right.t - left.t) * ratio;
      return relationshipRouteSample(route, t);
    }

    function relationshipDashArray(styleName) {
      switch (String(styleName || "").toLowerCase()) {
        case "dashed": return "10 6";
        case "dotted": return "2 6";
        default: return "";
      }
    }

    function relationshipPatternStep(styleName, lineWidth) {
      var width = Math.max(1, Number(lineWidth) || 2);
      if (styleName === "chain") {
        return Math.max(6, width * 2.2);
      }
      if (styleName === "droplets") {
        return Math.max(8, width * 3.2);
      }
      return 0;
    }

    function relationshipPatternShape(styleName, index, color, lineWidth, opacity, animated) {
      var width = Math.max(1, Number(lineWidth) || 2);
      if (styleName === "chain") {
        var linkWidth = Math.max(8, width * 3.6);
        var linkHeight = Math.max(3.8, width * 1.35);
        return html`<g className=${animated ? "relationship-pattern-shape animated" : "relationship-pattern-shape"} opacity=${opacity}>
          <rect x=${-linkWidth / 2} y=${-linkHeight / 2} width=${linkWidth} height=${linkHeight} rx=${linkHeight / 2} ry=${linkHeight / 2} fill="none" stroke=${color} strokeWidth=${Math.max(1, width * 0.55)}></rect>
        </g>`;
      }
      if (styleName === "droplets") {
        var sizeFactors = [1.0, 0.82, 1.12, 0.9];
        var factor = sizeFactors[index % sizeFactors.length];
        var radius = Math.max(2.2, width * 0.9) * factor;
        var dropletPath = "M 0 " + (-radius) +
          " C " + (radius * 0.68) + " " + (-radius * 0.44) + ", " + (radius * 0.98) + " " + (radius * 0.34) + ", 0 " + (radius * 1.08) +
          " C " + (-radius * 0.98) + " " + (radius * 0.34) + ", " + (-radius * 0.68) + " " + (-radius * 0.44) + ", 0 " + (-radius) + " Z";
        return html`<g className=${animated ? "relationship-pattern-shape animated" : "relationship-pattern-shape"} opacity=${opacity}>
          <path d=${dropletPath} fill=${color}></path>
        </g>`;
      }
      return null;
    }

    function renderRelationshipStroke(options) {
      var opts = options && typeof options === "object" ? options : {};
      var route = opts.route;
      if (!route || !route.d) {
        return null;
      }

      var styleName = String(opts.style || "solid").toLowerCase();
      var color = safeHexColor(opts.color, "#d10d40");
      var opacity = Number.isFinite(Number(opts.opacity)) ? Number(opts.opacity) : 1;
      var lineWidth = Math.max(1, Number(opts.width) || 2);
      var markerEnd = opts.markerEnd || null;
      var markerStart = opts.markerStart || null;
      var animated = Boolean(opts.animated);
      var keyPrefix = String(opts.keyPrefix || "rel");
      var onDoubleClick = typeof opts.onDoubleClick === "function" ? opts.onDoubleClick : null;
      var includeHitArea = opts.includeHitArea !== false;

      var elements = [];
      if (includeHitArea) {
        elements.push(html`<path key=${keyPrefix + "-hit"} className="relationship-line-hit" d=${route.d} stroke=${color} strokeWidth=${Math.max(lineWidth, 10)} strokeOpacity="0" fill="none" onDoubleClick=${onDoubleClick}></path>`);
      }

      if (styleName === "chain" || styleName === "droplets") {
        elements.push(html`<path key=${keyPrefix + "-carrier"} className=${animated ? "relationship-line relationship-line-carrier animated" : "relationship-line relationship-line-carrier"} d=${route.d} stroke=${color} strokeWidth=${lineWidth} strokeOpacity="0" opacity=${opacity} markerEnd=${markerEnd} markerStart=${markerStart} fill="none"></path>`);
        var arcTable = relationshipRouteArcTable(route, styleName === "chain" ? 38 : 34);
        var step = relationshipPatternStep(styleName, lineWidth);
        var inset = Math.max(2, lineWidth * 1.25);
        var travel = Math.max(0, arcTable.total - inset * 2);
        var count = step > 0 ? Math.max(1, Math.floor(travel / step)) : 0;
        for (var i = 0; i <= count; i += 1) {
          var distance = inset + i * step;
          var sample = relationshipRouteSampleAtDistance(route, arcTable, distance);
          var tangent = sample.tangent || { x: 1, y: 0 };
          var angle = Math.atan2(tangent.y || 0, tangent.x || 0) * 180 / Math.PI;
          var rotate = styleName === "droplets" ? angle + 90 : angle;
          var shape = relationshipPatternShape(styleName, i, color, lineWidth, opacity, animated);
          if (!shape) {
            continue;
          }
          elements.push(html`<g key=${keyPrefix + "-pattern-" + i} className=${animated ? "relationship-pattern relationship-pattern-animated" : "relationship-pattern"} transform=${"translate(" + sample.point.x + " " + sample.point.y + ") rotate(" + rotate + ")"}>${shape}</g>`);
        }
      } else {
        elements.push(html`<path key=${keyPrefix + "-stroke"} className=${animated ? "relationship-line animated" : "relationship-line"} d=${route.d} stroke=${color} strokeWidth=${lineWidth} strokeDasharray=${relationshipDashArray(styleName)} opacity=${opacity} markerEnd=${markerEnd} markerStart=${markerStart} fill="none"></path>`);
      }

      return elements;
    }

    function relationshipsPanel() {
      return html`${panelHeader("Relationship Manager")}
      <div className="panel-body relationship-manager-body">
        <div className="relationship-manager-scroll">
        <div className="tag-group-create-root relationship-category-create-root">
          <button onClick=${openRelationshipCategoryCreate}>+ New Category</button>
          <div className=${"tag-inline-editor-shell" + (relationshipCategoryCreate.open ? " expanded" : "") }>
            <div className="tag-inline-editor-grid">
              <label>Category Name</label>
              <input value=${relationshipCategoryCreate.name} onInput=${function (event) { setRelationshipCategoryCreate({ open: true, name: event.target.value, color: relationshipCategoryCreate.color }); }} placeholder="Political Relations" />
              ${ColorField({
                label: "Colour",
                fieldName: "Category Colour",
                value: relationshipCategoryCreate.color,
                fallback: "#d10d40",
                onChange: function (nextColor) { setRelationshipCategoryCreate({ open: true, name: relationshipCategoryCreate.name, color: nextColor }); }
              })}
              <div className="tag-inline-editor-actions">
                <button type="button" onClick=${cancelRelationshipCategoryCreate}>Cancel</button>
                <button type="button" onClick=${saveRelationshipCategoryCreate}>Add Category</button>
              </div>
            </div>
          </div>
        </div>

        ${data.relationshipCategories.map(function (category) {
          var isExpanded = relationshipCategoryExpanded[category.id] !== false;
          var typeCount = (category.types || []).length;
          var typeDraft = makeRelationshipTypeDraft(relationshipTypeDraftsByCategory[category.id] || { open: false, color: category.color });
          var editingCategory = relationshipCategoryEdit.categoryId === category.id;
          return html`<section className="tag-group-shell relationship-category-shell" key=${category.id}>
            <header className="tag-group-header relationship-category-header">
              <button className="tag-group-toggle" onClick=${function () { toggleRelationshipCategory(category.id); }} aria-expanded=${String(isExpanded)}>
                <span className="tag-group-caret">${isExpanded ? "▼" : "▶"}</span>
                <span className="relationship-category-chip" style=${{ backgroundColor: category.color }}></span>
                <strong>${category.name}</strong>
              </button>
              <div className="tag-group-actions">
                <span className="hint">${typeCount} types</span>
                ${IconButton({ onClick: function () { openRelationshipCategoryEdit(category); }, ariaLabel: "Edit category", icon: "✎", className: "icon-button-24 tag-icon-button" })}
                ${IconButton({ onClick: function () { deleteRelationshipCategory(category.id); }, ariaLabel: "Delete category", icon: "✕", className: "icon-button-24 tag-icon-button" })}
              </div>
            </header>

            <div className=${"tag-group-content" + (isExpanded ? " expanded" : "") }>
              <div className="tag-group-content-inner">
                <div className=${"tag-inline-editor-shell" + (editingCategory ? " expanded" : "") }>
                  <div className="tag-inline-editor-grid">
                    <label>Category Name</label>
                    <input value=${editingCategory ? relationshipCategoryEdit.name : ""} onInput=${function (event) { setRelationshipCategoryEdit({ categoryId: category.id, name: event.target.value, color: relationshipCategoryEdit.color }); }} placeholder="Category name" />
                    ${ColorField({
                      label: "Colour",
                      fieldName: "Category Colour",
                      value: editingCategory ? relationshipCategoryEdit.color : category.color,
                      fallback: "#d10d40",
                      onChange: function (nextColor) {
                        setRelationshipCategoryEdit({
                          categoryId: category.id,
                          name: editingCategory ? relationshipCategoryEdit.name : category.name,
                          color: nextColor
                        });
                      }
                    })}
                    <div className="tag-inline-editor-actions">
                      <button type="button" onClick=${cancelRelationshipCategoryEdit}>Cancel</button>
                      <button type="button" onClick=${saveRelationshipCategoryEdit}>Save Category</button>
                    </div>
                  </div>
                </div>

                <div className="relationship-type-list">
                  ${(category.types || []).map(function (typeItem) {
                    var miniRoute = relationshipRouteSpec({ x: 2, y: 5 }, { x: 94, y: 5 }, "right", "left", "straight");
                    return html`<article className="tag-row relationship-type-row" key=${typeItem.id}>
                      <div className="tag-row-main">
                        <span className="relationship-category-chip" style=${{ backgroundColor: typeItem.color }}></span>
                        <span className="tag-row-name">${typeItem.name}</span>
                        <svg viewBox="0 0 96 10" className="relationship-type-mini-preview" aria-hidden="true">
                          <defs key=${"type-mini-defs-" + typeItem.id}><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>
                          ${renderRelationshipStroke({
                            route: miniRoute,
                            style: typeItem.style,
                            color: typeItem.color,
                            width: Math.max(1, typeItem.width),
                            opacity: 1,
                            animated: Boolean(typeItem.animated),
                            markerEnd: typeItem.arrow ? "url(#arrowHead)" : null,
                            includeHitArea: false,
                            keyPrefix: "type-preview-mini-" + typeItem.id
                          })}
                        </svg>
                      </div>
                      <div className="tag-row-actions">
                        ${IconButton({ onClick: function () { openRelationshipTypeEdit(category.id, typeItem); }, ariaLabel: "Edit " + typeItem.name, icon: "✎", className: "icon-button-24 tag-icon-button" })}
                        ${IconButton({ onClick: function () { deleteRelationshipType(category, typeItem); }, ariaLabel: "Delete " + typeItem.name, icon: "✕", className: "icon-button-24 tag-icon-button" })}
                      </div>
                    </article>`;
                  })}
                </div>

                <button className="tag-add-button" onClick=${function () { openRelationshipTypeCreate(category.id, category.color); }}>+ Add Type</button>

                <div className=${"tag-inline-editor-shell" + (typeDraft.open ? " expanded" : "") }>
                  <div className="tag-inline-editor-grid relationship-type-editor-grid">
                    <label>Type Name</label>
                    <input value=${typeDraft.name} onInput=${function (event) { updateRelationshipTypeDraft(category.id, "name", event.target.value); }} placeholder="Sire" />
                    <label>Display Label</label>
                    <input value=${typeDraft.label} onInput=${function (event) { updateRelationshipTypeDraft(category.id, "label", event.target.value); }} placeholder="If blank, Type Name is used" />

                    ${ColorField({
                      label: "Colour",
                      fieldName: "Type Colour",
                      value: typeDraft.color,
                      fallback: "#d10d40",
                      onChange: function (nextColor) { updateRelationshipTypeDraft(category.id, "color", nextColor); }
                    })}

                    <label>Line Style</label>
                    <select value=${typeDraft.style} onChange=${function (event) { updateRelationshipTypeDraft(category.id, "style", event.target.value); }}>
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="chain">Chain</option>
                      <option value="droplets">Droplets</option>
                    </select>

                    <label>Width</label>
                    <input type="number" min="1" max="8" step="1" value=${typeDraft.width} onInput=${function (event) { updateRelationshipTypeDraft(category.id, "width", Number(event.target.value)); }} />

                    <label className="zone-toggle"><input type="checkbox" checked=${Boolean(typeDraft.animated)} onChange=${function (event) { updateRelationshipTypeDraft(category.id, "animated", event.target.checked); }} /> Animated</label>
                    <label className="zone-toggle"><input type="checkbox" checked=${Boolean(typeDraft.arrow)} onChange=${function (event) { updateRelationshipTypeDraft(category.id, "arrow", event.target.checked); }} /> Arrow</label>

                    <label>Preview</label>
                    <svg viewBox="0 0 280 20" className="relationship-type-editor-preview" aria-hidden="true">
                      <defs key=${"type-editor-defs"}><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>
                      ${renderRelationshipStroke({
                        route: relationshipRouteSpec({ x: 8, y: 10 }, { x: 272, y: 10 }, "right", "left", "straight"),
                        style: typeDraft.style,
                        color: typeDraft.color,
                        width: Math.max(1, Number(typeDraft.width) || 2),
                        opacity: 1,
                        animated: Boolean(typeDraft.animated),
                        markerEnd: typeDraft.arrow ? "url(#arrowHead)" : null,
                        includeHitArea: false,
                        keyPrefix: "type-preview-editor-" + category.id
                      })}
                    </svg>

                    <div className="tag-inline-editor-actions">
                      <button type="button" onClick=${function () { cancelRelationshipTypeDraft(category.id); }}>Cancel</button>
                      <button type="button" onClick=${function () { saveRelationshipTypeDraft(category); }}>${typeDraft.mode === "edit" ? "Save Type" : "Add Type"}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>`;
        })}
        </div>

        <footer className="relationship-manager-footer">
          <div className="relationship-reset-card">
            <h4>Reset Relationship Defaults</h4>
            <p>Restore the built-in Campaign Atlas relationship categories and relationship types.</p>
            <button type="button" className="destructive relationship-reset-button" onClick=${function () { setRelationshipResetDialogOpen(true); }}>
              <span className="relationship-reset-button-icon" aria-hidden="true">${Icon({ icon: CAMPAIGN_ATLAS_ICON_ASSETS.delete, size: 14, className: "relationship-reset-icon-glyph" })}</span>
              <span>Reset to Defaults</span>
            </button>
          </div>
        </footer>
      </div>`;
    }

    function tagsPanel() {
      return html`${panelHeader("Tag Manager")}
      <div className="panel-body tag-manager-body">
        <div className="tag-group-create-root">
          <button onClick=${openTagGroupCreate}>+ New Tag Group</button>
          <div className=${"tag-inline-editor-shell" + (tagGroupCreate.open ? " expanded" : "") }>
            <div className="tag-inline-editor-grid">
              <label>Group Name</label>
              <input value=${tagGroupCreate.name} onInput=${function (e) { setTagGroupCreate({ open: true, name: e.target.value }); }} placeholder="Politics" />
              <div className="tag-inline-editor-actions">
                <button type="button" onClick=${cancelTagGroupCreate}>Cancel</button>
                <button type="button" onClick=${saveTagGroupCreate}>Add Group</button>
              </div>
            </div>
          </div>
        </div>

        ${data.tagGroups.map(function (group) {
          var isExpanded = tagGroupExpanded[group.id] !== false;
          var createTagDraft = tagDraftsByGroup[group.id] || { open: false, name: "", color: "#d10d40" };
          var groupTagCount = (group.tags || []).length;
          var isRenaming = tagGroupRenameDraft.groupId === group.id;

          return html`<section className="tag-group-shell" key=${group.id}>
            <header className="tag-group-header">
              <button className="tag-group-toggle" onClick=${function () { toggleTagGroup(group.id); }} aria-expanded=${String(isExpanded)}>
                <span className="tag-group-caret">${isExpanded ? "▼" : "▶"}</span>
                <strong>${group.name}</strong>
              </button>
              <div className="tag-group-actions">
                <span className="hint">${groupTagCount} tags</span>
                ${IconButton({ onClick: function () { openTagGroupRename(group); }, ariaLabel: "Rename tag group", icon: "✎", className: "icon-button-24 tag-icon-button" })}
                ${IconButton({ onClick: function () { deleteTagGroup(group.id); }, ariaLabel: "Delete tag group", icon: "✕", className: "icon-button-24 tag-icon-button" })}
              </div>
            </header>

            <div className=${"tag-group-content" + (isExpanded ? " expanded" : "") }>
              <div className="tag-group-content-inner">
                <div className=${"tag-inline-editor-shell" + (isRenaming ? " expanded" : "") }>
                  <div className="tag-inline-editor-grid">
                    <label>Group Name</label>
                    <input value=${isRenaming ? tagGroupRenameDraft.name : ""} onInput=${function (e) { setTagGroupRenameDraft({ groupId: group.id, name: e.target.value }); }} placeholder="Group name" />
                    <div className="tag-inline-editor-actions">
                      <button type="button" onClick=${cancelTagGroupRename}>Cancel</button>
                      <button type="button" onClick=${saveTagGroupRename}>Save Group</button>
                    </div>
                  </div>
                </div>

                <div className="tag-row-list">
                  ${(group.tags || []).map(function (tag) {
                    var usageCount = countTagUsage(tag.name);
                    return html`<article className="tag-row" key=${tag.id}>
                      <div className="tag-row-main">
                        <div className="tag-color-cell">
                          <span className="tag-color-square" style=${{ backgroundColor: safeHexColor(tag.color, "#d10d40") }} aria-hidden="true"></span>
                          <input className="tag-color-input tag-row-color-input" type="color" value=${safeHexColor(tag.color, "#d10d40")} onInput=${function (event) { updateTagColor(group.id, tag.id, event.target.value); if (tagEditDialog.open && tagEditDialog.groupId === group.id && tagEditDialog.tagId === tag.id) { updateTagEditField("color", event.target.value); } }} aria-label=${"Tag color for " + tag.name} />
                        </div>
                        <span className="tag-row-name">${tag.name}</span>
                      </div>
                      <div className="tag-row-actions">
                        <span className="tag-row-usage">${formatTagUsageCount(usageCount)}</span>
                        ${IconButton({ onClick: function () { openTagEditDialog(group.id, tag.id); }, ariaLabel: "Edit " + tag.name, icon: "✎", className: "icon-button-24 tag-icon-button" })}
                        ${IconButton({ onClick: function () { deleteTag(group.id, tag.id); }, ariaLabel: "Delete " + tag.name, icon: "✕", className: "icon-button-24 tag-icon-button" })}
                      </div>
                    </article>`;
                  })}
                </div>

                <button className="tag-add-button" onClick=${function () { openTagCreate(group.id); }}>+ Add Tag</button>

                <div className=${"tag-inline-editor-shell" + (createTagDraft.open ? " expanded" : "") }>
                  <div className="tag-inline-editor-grid">
                    <label>Tag Name</label>
                    <input value=${createTagDraft.name} onInput=${function (event) { updateTagCreateDraft(group.id, "name", event.target.value); }} placeholder="Sheriff" />
                    ${ColorField({
                      label: "Colour",
                      fieldName: "Colour",
                      value: createTagDraft.color,
                      fallback: "#d10d40",
                      onChange: function (nextColor) {
                        updateTagCreateDraft(group.id, "color", nextColor);
                      }
                    })}
                    <div className="tag-inline-editor-actions">
                      <button type="button" onClick=${function () { closeTagCreate(group.id); }}>Cancel</button>
                      <button type="button" onClick=${function () { saveTagCreate(group.id); }}>Add Tag</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>`;
        })}
      </div>`;
    }

    function renderTagEditDialog() {
      if (!tagEditDialog.open) {
        return null;
      }

      var usageCount = countTagUsage(tagEditDialog.originalName || tagEditDialog.name);

      return html`<div className="tag-edit-dialog-backdrop" onClick=${closeTagEditDialog}>
        <div className="tag-edit-dialog" onClick=${function (event) { event.stopPropagation(); }}>
          <header className="tag-edit-dialog-header">
            <h3>Edit Tag</h3>
          </header>
          <div className="tag-edit-dialog-body">
            <label>Tag Name</label>
            <input value=${tagEditDialog.name} onInput=${function (event) { updateTagEditField("name", event.target.value); }} placeholder="Tag name" />

            ${ColorField({
              label: "Colour Picker",
              fieldName: "Colour Picker",
              value: tagEditDialog.color,
              fallback: "#d10d40",
              onChange: function (nextColor) {
                updateTagEditField("color", nextColor);
                updateTagColor(tagEditDialog.groupId, tagEditDialog.tagId, nextColor);
              }
            })}

            <label>Icon (future use)</label>
            <input value=${tagEditDialog.icon} onInput=${function (event) { updateTagEditField("icon", event.target.value); }} placeholder="e.g. ♛" />

            <label>Description (future use)</label>
            <textarea rows="3" value=${tagEditDialog.description} onInput=${function (event) { updateTagEditField("description", event.target.value); }} placeholder="Optional description"></textarea>

            <label>Usage Count</label>
            <p className="tag-edit-usage">${usageCount} ${usageCount === 1 ? "character" : "characters"}</p>
          </div>
          <footer className="tag-edit-dialog-actions">
            <button type="button" onClick=${saveTagEditDialog}>Save</button>
            <button type="button" onClick=${closeTagEditDialog}>Cancel</button>
            <button type="button" className="destructive" onClick=${function () { deleteTag(tagEditDialog.groupId, tagEditDialog.tagId); }}>Delete Tag</button>
          </footer>
        </div>
      </div>`;
    }

    function renderRelationshipResetDialog() {
      if (!relationshipResetDialogOpen) {
        return null;
      }
      return html`<div className="tag-edit-dialog-backdrop" onClick=${function () { setRelationshipResetDialogOpen(false); }}>
        <div className="tag-edit-dialog relationship-reset-dialog" onClick=${function (event) { event.stopPropagation(); }}>
          <header className="tag-edit-dialog-header">
            <h3>Reset Relationship Defaults?</h3>
          </header>
          <div className="tag-edit-dialog-body">
            <p>This will restore the default Campaign Atlas relationship categories and relationship types.</p>
            <p>Any custom categories or relationship types you have created will be permanently removed.</p>
            <p>Existing relationships between characters will NOT be deleted, but any relationship using a removed custom type will be reassigned to its closest matching default type where possible. If no suitable default exists, it will be marked as "Custom Relationship" so no data is lost.</p>
          </div>
          <footer className="tag-edit-dialog-actions relationship-reset-dialog-actions">
            <button type="button" onClick=${function () { setRelationshipResetDialogOpen(false); }}>Cancel</button>
            <button type="button" className="destructive" onClick=${resetRelationshipDefaults}>Reset to Defaults</button>
          </footer>
        </div>
      </div>`;
    }

    function renderPanel() {
      switch (activePanel) {
        case "characters": return charactersPanel();
        case "zones": return zonesPanel();
        case "relationships": return relationshipsPanel();
        case "relationship-editor": return relationshipEditorPanel();
        case "tags": return tagsPanel();
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
                <span className="tool-rail-icon" aria-hidden="true"><${ToolbarIcon} iconId=${item.iconId} fallbackGlyph=${item.icon} label=${item.label} /></span>
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
            ${drawingZone ? html`<${React.Fragment}>
              <span className="badge">Drawing Zone: drag on canvas</span>
              <button onClick=${cancelZoneDraft}>Cancel Zone</button>
            </${React.Fragment}>` : null}
          </div>

          <div className=${"canvas-viewport" + (isPanning ? " panning" : "") + (drawingZone ? " drawing-zone" : "")} ref=${viewportRef} onMouseDown=${onCanvasMouseDown} onMouseMove=${onCanvasMouseMove} onMouseUp=${onCanvasMouseUp} onMouseLeave=${onCanvasMouseUp} onWheel=${onWheel} onContextMenu=${function (e) { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: "canvas" }); }}>
            <div className="canvas-surface" style=${{ transform: "translate(" + view.x + "px," + view.y + "px) scale(" + view.scale + ")" }}>
              <div className="zone-layer">
                ${data.zones.filter(function (zone) { return !zone.hidden; }).map(function (zone) {
                  var current = zoneWithDefaults(zone);
                  if (zoneEditDraft && zoneEditDraft.id === current.id) {
                    current = zoneWithDefaults(Object.assign({}, current, zoneEditDraft));
                  }
                  if (zonePreview && zonePreview.id === current.id) {
                    current = Object.assign({}, current, {
                      x: zonePreview.x,
                      y: zonePreview.y,
                      width: zonePreview.width,
                      height: zonePreview.height
                    });
                  }
                  var isSelected = selectedZoneId === current.id;
                  return html`<div key=${current.id} className=${"zone" + (isSelected ? " selected" : "")} style=${{ left: current.x, top: current.y, width: current.width, height: current.height, borderWidth: current.borderThickness, borderStyle: current.borderStyle, borderColor: safeHexColor(current.borderColor || current.color, "#d10d40"), backgroundColor: zoneFillColor(current.color, current.opacity), borderRadius: current.cornerRadius || 12, zIndex: Number(current.layer) || 0 }} onMouseDown=${function (event) { onZoneMouseDown(event, current); }} onDoubleClick=${function (event) { event.stopPropagation(); selectZone(current.id, true); }}>
                    <span className="zone-title">${current.name}</span>
                    ${isSelected ? html`<span className="zone-selection-outline"></span>` : null}
                    ${isSelected ? renderZoneResizeHandles(current) : null}
                  </div>`;
                })}
                ${zoneDraft ? html`<div className="zone zone-drawing-preview" style=${{ left: Math.min(zoneDraft.x, zoneDraft.x + zoneDraft.width), top: Math.min(zoneDraft.y, zoneDraft.y + zoneDraft.height), width: Math.abs(zoneDraft.width), height: Math.abs(zoneDraft.height) }}><span className="zone-title">Drawing Zone</span></div>` : null}
              </div>
              <svg className="link-layer" viewBox="0 0 2000 1400" preserveAspectRatio="none">
                <defs key="map-arrow-defs"><marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>
                ${data.relationships.filter(function (r) { return r.visible; }).map(function (r) {
                  var from = data.characters.find(function (c) { return c.id === r.from; });
                  var to = data.characters.find(function (c) { return c.id === r.to; });
                  if (!from || !to) {
                    return null;
                  }
                  var resolvedAnchors = relationshipResolvedAnchors(from, to);
                  var fromPoint = relationshipAnchorPoint(from, resolvedAnchors.sourceAnchor);
                  var toPoint = relationshipAnchorPoint(to, resolvedAnchors.destinationAnchor);
                  var route = relationshipRouteSpec(fromPoint, toPoint, resolvedAnchors.sourceAnchor, resolvedAnchors.destinationAnchor, r.routingMode || "auto");
                  var mx = route.labelPoint.x;
                  var my = route.labelPoint.y;
                  var markerEnd = r.arrow === "end" || r.arrow === "both" ? "url(#arrowHead)" : null;
                  var markerStart = r.arrow === "start" || r.arrow === "both" ? "url(#arrowHead)" : null;
                  var lineWidth = Math.max(1, Number(r.thickness) || 2);
                  return html`<g key=${r.id}>
                    ${renderRelationshipStroke({
                      route: route,
                      style: r.style,
                      color: r.color,
                      width: lineWidth,
                      opacity: Number(r.opacity),
                      animated: Boolean(r.animated),
                      markerEnd: markerEnd,
                      markerStart: markerStart,
                      includeHitArea: true,
                      keyPrefix: "relationship-" + r.id,
                      onDoubleClick: function (event) { event.stopPropagation(); openRelationshipEditorFor(Object.assign({}, r), false); }
                    })}
                    <rect x=${mx - 24} y=${my - 11} width="48" height="18" rx="5" fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.15)"></rect>
                    <text x=${mx} y=${my + 2} fill=${r.labelColor || "#ffffff"} fontSize="11" textAnchor="middle">${r.displayLabel || r.type}</text>
                  </g>`;
                })}
                ${relationshipPreview ? html`<line className="relationship-preview-line" x1=${relationshipPreview.x1} y1=${relationshipPreview.y1} x2=${relationshipPreview.x2} y2=${relationshipPreview.y2}></line>` : null}
              </svg>

              <div className="node-layer">
                ${characterList().filter(function (c) { return !c.hidden; }).map(function (c) {
                  var geometry = relationshipNodeGeometry(c);
                  var nodeSize = geometry.nodeSize;
                  var outlineColor = c.outlineColor || "#d10d40";
                  var shape = c.nodeShape === "rounded" ? "square" : (c.nodeShape || "circle");
                  var radius = shape === "circle" ? "50%" : "8px";
                  var clip = shape === "hexagon" ? "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)" : "none";
                  var portraitDiameter = geometry.shellDiameter;
                  var nodeBadges = characterNodeBadges(c, portraitDiameter);
                  var isSelectedNode = selected.indexOf(c.id) >= 0;
                  var isDropCharacter = relationshipDropTarget && relationshipDropTarget.characterId === c.id;
                  var layerStateClass = isSelectedNode
                    ? " active"
                    : (relationshipPreview ? " destination-ready" : "");
                  if (isDropCharacter) {
                    layerStateClass += " drop-character";
                  }
                  return html`<div key=${c.id} className=${"node" + (isSelectedNode ? " selected" : "")} style=${{ left: c.x, top: c.y, width: 130 * nodeSize }} onPointerDown=${function (e) { onNodePointerDown(e, c); }} onLostPointerCapture=${onNodeLostPointerCapture} onMouseDown=${function (e) { e.stopPropagation(); }} onClick=${function (e) { e.stopPropagation(); setFocusedId(c.id); if (!e.shiftKey) setSelected([c.id]); }} onDoubleClick=${function (e) { e.stopPropagation(); setFocusedId(c.id); setActivePanel("characters"); }} onContextMenu=${function (e) { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: "node", id: c.id }); }}>
                    <div className="node-portrait-shell">
                      <div className="node-portrait-frame" style=${{ width: portraitDiameter, height: portraitDiameter, borderColor: outlineColor, borderRadius: radius, clipPath: clip }}>
                        <img className="node-portrait media" src=${portraitState(c).src} alt=${c.name} style=${portraitMediaStyle(c)} />
                      </div>
                      ${renderNodeBadgeAnchors(nodeBadges)}
                      <div className=${"relationship-handle-layer" + layerStateClass }>
                        ${["top", "right", "bottom", "left"].map(function (anchor) {
                          var localPoint = relationshipConnectionNodeLocalPoint(geometry, anchor);
                          var isDropAnchor = Boolean(isDropCharacter && relationshipDropTarget && relationshipDropTarget.anchor === anchor);
                          return html`<span key=${anchor} className=${"relationship-handle relationship-handle-" + anchor + (isDropAnchor ? " drop-target" : "")} style=${{ left: localPoint.x, top: localPoint.y }} data-relationship-anchor=${anchor} data-character-id=${c.id} onPointerDown=${function (event) { beginRelationshipDrag(event, c, anchor); }}></span>`;
                        })}
                      </div>
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
          <button onClick=${function () { enterZoneDrawingMode(); setContextMenu(null); }}>Draw Zone</button>
          <button onClick=${function () { setView({ x: 80, y: 60, scale: 0.58 }); setContextMenu(null); }}>Reset View</button>
        </div>`}
      </div>` : null}

      ${renderTagEditDialog()}
      ${renderRelationshipResetDialog()}

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

