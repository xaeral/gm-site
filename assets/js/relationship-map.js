(function () {
  var viewport = document.getElementById("relmapViewport");
  var canvas = document.getElementById("relmapCanvas");
  var nodesLayer = document.getElementById("relmapNodes");
  var zonesLayer = document.getElementById("relmapZones");
  var linksLayer = document.getElementById("relmapLinks");
  var zoomInBtn = document.getElementById("zoomInBtn");
  var zoomOutBtn = document.getElementById("zoomOutBtn");
  var zoomStatus = document.getElementById("zoomStatus");

  var nodeForm = document.getElementById("nodeForm");
  var nodeNameInput = document.getElementById("nodeNameInput");
  var nodeImageSelect = document.getElementById("nodeImageSelect");
  var nodeXInput = document.getElementById("nodeXInput");
  var nodeYInput = document.getElementById("nodeYInput");

  var linkForm = document.getElementById("linkForm");
  var linkFromSelect = document.getElementById("linkFromSelect");
  var linkToSelect = document.getElementById("linkToSelect");
  var linkLabelInput = document.getElementById("linkLabelInput");
  var linkColorInput = document.getElementById("linkColorInput");
  var linkDashedInput = document.getElementById("linkDashedInput");
  var linkArrowInput = document.getElementById("linkArrowInput");

  var zoneForm = document.getElementById("zoneForm");
  var zoneLabelInput = document.getElementById("zoneLabelInput");
  var zoneClassSelect = document.getElementById("zoneClassSelect");
  var zoneXInput = document.getElementById("zoneXInput");
  var zoneYInput = document.getElementById("zoneYInput");
  var zoneWInput = document.getElementById("zoneWInput");
  var zoneHInput = document.getElementById("zoneHInput");

  var deleteNodeBtn = document.getElementById("deleteNodeBtn");
  var deleteLinkBtn = document.getElementById("deleteLinkBtn");
  var deleteZoneBtn = document.getElementById("deleteZoneBtn");
  var saveMapBtn = document.getElementById("saveMapBtn");
  var exportMapBtn = document.getElementById("exportMapBtn");
  var importMapBtn = document.getElementById("importMapBtn");
  var resetMapBtn = document.getElementById("resetMapBtn");
  var mapJsonInput = document.getElementById("mapJsonInput");
  var mapStatusText = document.getElementById("mapStatusText");

  var characterInspector = document.getElementById("characterInspector");
  var closeInspectorBtn = document.getElementById("closeInspectorBtn");
  var inspectorEmpty = document.getElementById("inspectorEmpty");
  var inspectorContent = document.getElementById("inspectorContent");
  var inspectorImage = document.getElementById("inspectorImage");
  var inspectorName = document.getElementById("inspectorName");
  var inspectorSubtitle = document.getElementById("inspectorSubtitle");
  var inspectorSect = document.getElementById("inspectorSect");
  var inspectorClan = document.getElementById("inspectorClan");
  var inspectorBio = document.getElementById("inspectorBio");
  var inspectorFields = document.getElementById("inspectorFields");
  var inspectorRelationships = document.getElementById("inspectorRelationships");
  var openFullBioBtn = document.getElementById("openFullBioBtn");

  var profileEditorModal = document.getElementById("profileEditorModal");
  var closeProfileModalBtn = document.getElementById("closeProfileModalBtn");
  var saveProfileBtn = document.getElementById("saveProfileBtn");
  var profileEditorForm = document.getElementById("profileEditorForm");
  var profileNameInput = document.getElementById("profileNameInput");
  var profileImageSelect = document.getElementById("profileImageSelect");
  var profileSectInput = document.getElementById("profileSectInput");
  var profileClanInput = document.getElementById("profileClanInput");
  var profileBiographyInput = document.getElementById("profileBiographyInput");
  var profileConceptInput = document.getElementById("profileConceptInput");
  var profileAmbitionInput = document.getElementById("profileAmbitionInput");
  var profileDesireInput = document.getElementById("profileDesireInput");
  var profileConvictionsInput = document.getElementById("profileConvictionsInput");
  var profileTouchstonesInput = document.getElementById("profileTouchstonesInput");
  var profilePredatorInput = document.getElementById("profilePredatorInput");
  var profileGenerationInput = document.getElementById("profileGenerationInput");
  var profileSireInput = document.getElementById("profileSireInput");
  var profileTrueAgeInput = document.getElementById("profileTrueAgeInput");
  var profileApparentAgeInput = document.getElementById("profileApparentAgeInput");
  var profileBirthInput = document.getElementById("profileBirthInput");
  var profileDeathInput = document.getElementById("profileDeathInput");

  if (!viewport || !canvas || !nodesLayer || !zonesLayer || !linksLayer || !zoomInBtn || !zoomOutBtn || !zoomStatus ||
    !nodeForm || !nodeNameInput || !nodeImageSelect || !nodeXInput || !nodeYInput ||
    !linkForm || !linkFromSelect || !linkToSelect || !linkLabelInput || !linkColorInput || !linkDashedInput || !linkArrowInput ||
    !zoneForm || !zoneLabelInput || !zoneClassSelect || !zoneXInput || !zoneYInput || !zoneWInput || !zoneHInput ||
    !deleteNodeBtn || !deleteLinkBtn || !deleteZoneBtn || !saveMapBtn || !exportMapBtn || !importMapBtn || !resetMapBtn ||
    !mapJsonInput || !mapStatusText || !characterInspector || !closeInspectorBtn || !inspectorEmpty || !inspectorContent ||
    !inspectorImage || !inspectorName || !inspectorSubtitle || !inspectorSect || !inspectorClan || !inspectorBio ||
    !inspectorFields || !inspectorRelationships || !openFullBioBtn || !profileEditorModal || !closeProfileModalBtn ||
    !saveProfileBtn || !profileEditorForm || !profileNameInput || !profileImageSelect || !profileSectInput || !profileClanInput ||
    !profileBiographyInput || !profileConceptInput || !profileAmbitionInput || !profileDesireInput ||
    !profileConvictionsInput || !profileTouchstonesInput || !profilePredatorInput || !profileGenerationInput ||
    !profileSireInput || !profileTrueAgeInput || !profileApparentAgeInput || !profileBirthInput || !profileDeathInput) {
    return;
  }

  var storageKey = "campaignAtlas.relationshipMap.v2";
  var imageDir = "../Relationship map/";

  var availablePortraits = [
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

  var profileFieldLabels = {
    concept: "Concept",
    ambition: "Ambition",
    desire: "Desire",
    convictions: "Convictions",
    touchstones: "Touchstones",
    predator: "Predator",
    generation: "Generation",
    sire: "Sire",
    trueAge: "True Age",
    apparentAge: "Apparent Age",
    dateOfBirth: "Date Of Birth",
    dateOfDeath: "Date Of Death"
  };

  var defaultState = {
    canvas: { width: 1200, height: 900 },
    nodes: [
      { id: "evelyn", name: "SHERIFF EVELYN SHAW", x: 78, y: 82, image: "1781360687819-4zdtrbu (1).jpg" },
      { id: "alexandra", name: "SENESCHAL ALEXANDRA", x: 250, y: 82, image: "1781360688508-m6a94gv (1).jpg" },
      { id: "prince", name: "PRINCE TAYLOR", x: 730, y: 82, image: "1780754903809-mwu505a (1).png" },
      { id: "primogen", name: "PRIMOGEN JAMES WHITLOCK", x: 730, y: 260, image: "1781360689686-pn1xijl (1).jpg" },
      { id: "amelia", name: "DR AMELIA RHODES", x: 730, y: 545, image: "1784677430587-k4v44gh (1).jpg" },
      { id: "antonio", name: "ANTONIO GIANNI", x: 1140, y: 760, image: "1780754917541-b280c8m (1).png" }
    ],
    zones: [
      { id: "zone-1", cls: "council", label: "PRIMOGEN COUNCIL", x: 300, y: 170, width: 840, height: 180 },
      { id: "zone-2", cls: "coterie", label: "PLAYER COTERIE", x: 460, y: 620, width: 540, height: 240 }
    ],
    links: [
      { id: "link-1", from: "alexandra", to: "prince", color: "#bf6db1", dashed: true, label: "Partner", arrow: false },
      { id: "link-2", from: "primogen", to: "prince", color: "#7f3cff", arrow: true, label: "Sire", dashed: false },
      { id: "link-3", from: "amelia", to: "primogen", color: "#7f3cff", arrow: true, label: "Sire", dashed: false }
    ],
    profiles: {
      prince: {
        subtitle: "Character Profile",
        sect: "Camarilla",
        clan: "Brujah",
        biography: "Leslie Joseph Theodore \"Squizzy\" Taylor rose from poverty into Melbourne's ruthless underworld and rebuilt himself as a prince who rewards competence over ideology.",
        fields: {
          concept: "Underworld tyrant who seized the ivory tower",
          ambition: "Keep Melbourne united and prosperous under his rule.",
          desire: "Root out the conspiracy tied to illegal embraces.",
          convictions: "Power belongs to those strong enough to keep it.",
          touchstones: "Tommy O'Reilly; Margaret Doyle; Richmond Football Club",
          predator: "Extortionist",
          generation: "9",
          sire: "Red Meg",
          trueAge: "144",
          apparentAge: "39",
          dateOfBirth: "18/03/1882",
          dateOfDeath: "22/06/1921"
        }
      }
    }
  };

  var state = loadState();
  ensureProfiles();

  var selectedNodeId = null;
  var draggingNodeId = null;
  var inspectorDismissed = false;
  var scale = 1;
  var translateX = 0;
  var translateY = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveState() {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function setStatus(message) {
    mapStatusText.textContent = message;
  }

  function encodeMapPath(fileName) {
    return imageDir + encodeURIComponent(fileName || "Default.png");
  }

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "node";
  }

  function uniqueNodeId(base) {
    var id = base;
    var index = 1;
    while (state.nodes.some(function (node) { return node.id === id; })) {
      id = base + "-" + String(index);
      index += 1;
    }
    return id;
  }

  function titleCase(value) {
    return value.toLowerCase().split(/\s+/).map(function (part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : "";
    }).join(" ");
  }

  function findNode(nodeId) {
    return state.nodes.find(function (node) {
      return node.id === nodeId;
    });
  }

  function defaultProfileForNode(node) {
    return {
      subtitle: "Character Profile",
      sect: "Unknown Sect",
      clan: "Unknown Clan",
      biography: "No biography yet.",
      fields: {
        concept: "",
        ambition: "",
        desire: "",
        convictions: "",
        touchstones: "",
        predator: "",
        generation: "",
        sire: "",
        trueAge: "",
        apparentAge: "",
        dateOfBirth: "",
        dateOfDeath: ""
      }
    };
  }

  function normalizeProfile(profile, node) {
    var fallback = defaultProfileForNode(node);
    var next = profile && typeof profile === "object" ? profile : {};
    if (!next.fields || typeof next.fields !== "object") {
      next.fields = {};
    }

    Object.keys(fallback.fields).forEach(function (key) {
      if (typeof next.fields[key] !== "string") {
        next.fields[key] = fallback.fields[key];
      }
    });

    if (typeof next.subtitle !== "string") {
      next.subtitle = fallback.subtitle;
    }
    if (typeof next.sect !== "string") {
      next.sect = fallback.sect;
    }
    if (typeof next.clan !== "string") {
      next.clan = fallback.clan;
    }
    if (typeof next.biography !== "string") {
      next.biography = fallback.biography;
    }

    return next;
  }

  function ensureProfiles() {
    if (!state.profiles || typeof state.profiles !== "object") {
      state.profiles = {};
    }

    state.nodes.forEach(function (node) {
      state.profiles[node.id] = normalizeProfile(state.profiles[node.id], node);
    });

    Object.keys(state.profiles).forEach(function (profileId) {
      if (!findNode(profileId)) {
        delete state.profiles[profileId];
      }
    });
  }

  function getProfile(nodeId) {
    var node = findNode(nodeId);
    if (!node) {
      return null;
    }

    state.profiles[nodeId] = normalizeProfile(state.profiles[nodeId], node);
    return state.profiles[nodeId];
  }

  function sanitizeImportedState(parsed) {
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.links) || !Array.isArray(parsed.zones)) {
      throw new Error("Invalid map JSON shape.");
    }

    if (!parsed.canvas || typeof parsed.canvas.width !== "number" || typeof parsed.canvas.height !== "number") {
      parsed.canvas = clone(defaultState.canvas);
    }

    if (!parsed.profiles || typeof parsed.profiles !== "object") {
      parsed.profiles = {};
    }

    return parsed;
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return clone(defaultState);
      }

      return sanitizeImportedState(JSON.parse(raw));
    } catch (_error) {
      return clone(defaultState);
    }
  }

  function mapCoordFromPointer(clientX, clientY) {
    var rect = viewport.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left - translateX) / scale),
      y: Math.round((clientY - rect.top - translateY) / scale)
    };
  }

  function clampNode(node) {
    node.x = Math.max(0, Math.min(state.canvas.width, node.x));
    node.y = Math.max(0, Math.min(state.canvas.height, node.y));
  }

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

  function createSvg(tagName, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, String(attrs[key]));
    });
    return el;
  }

  function refreshNodeSelectors() {
    var options = state.nodes.map(function (node) {
      return '<option value="' + node.id + '">' + titleCase(node.name) + "</option>";
    }).join("");

    linkFromSelect.innerHTML = options;
    linkToSelect.innerHTML = options;

    if (state.nodes.length >= 2) {
      linkFromSelect.value = state.nodes[0].id;
      linkToSelect.value = state.nodes[1].id;
    }
  }

  function populatePortraitSelects() {
    var options = availablePortraits.map(function (fileName) {
      return '<option value="' + fileName + '">' + fileName + "</option>";
    }).join("");

    nodeImageSelect.innerHTML = options;
    profileImageSelect.innerHTML = options;
  }

  function renderZones() {
    zonesLayer.innerHTML = "";

    state.zones.forEach(function (zone) {
      var el = document.createElement("div");
      el.className = "relmap-zone " + zone.cls;
      el.style.left = zone.x + "px";
      el.style.top = zone.y + "px";
      el.style.width = zone.width + "px";
      el.style.height = zone.height + "px";
      el.textContent = zone.label;
      zonesLayer.appendChild(el);
    });
  }

  function renderNodes() {
    nodesLayer.innerHTML = "";

    state.nodes.forEach(function (node) {
      var wrapper = document.createElement("article");
      wrapper.className = "relmap-node";
      wrapper.style.left = node.x + "px";
      wrapper.style.top = node.y + "px";
      wrapper.dataset.nodeId = node.id;
      if (node.id === selectedNodeId) {
        wrapper.classList.add("selected");
      }

      var image = document.createElement("img");
      image.src = encodeMapPath(node.image || "Default.png");
      image.alt = node.name;
      image.loading = "lazy";

      var title = document.createElement("strong");
      title.textContent = node.name;

      wrapper.appendChild(image);
      wrapper.appendChild(title);
      nodesLayer.appendChild(wrapper);

      wrapper.addEventListener("mousedown", function (event) {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        selectedNodeId = node.id;
        inspectorDismissed = false;
        characterInspector.classList.remove("dismissed");
        draggingNodeId = node.id;
        renderNodes();
        renderInspector();
      });

      wrapper.addEventListener("click", function (event) {
        event.stopPropagation();
        selectedNodeId = node.id;
        inspectorDismissed = false;
        characterInspector.classList.remove("dismissed");
        renderNodes();
        renderInspector();
      });
    });
  }

  function renderLinks() {
    linksLayer.innerHTML = "";

    var defs = createSvg("defs", {});
    var marker = createSvg("marker", {
      id: "relmapArrow",
      viewBox: "0 0 10 10",
      refX: 8,
      refY: 5,
      markerWidth: 5,
      markerHeight: 5,
      orient: "auto-start-reverse"
    });
    marker.appendChild(createSvg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#7f3cff" }));
    defs.appendChild(marker);
    linksLayer.appendChild(defs);

    state.links.forEach(function (link) {
      var fromNode = findNode(link.from);
      var toNode = findNode(link.to);
      if (!fromNode || !toNode) {
        return;
      }

      var startX = fromNode.x;
      var startY = fromNode.y;
      var endX = toNode.x;
      var endY = toNode.y;
      var midX = (startX + endX) / 2;
      var midY = (startY + endY) / 2;

      var path = createSvg("line", {
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        stroke: link.color,
        "stroke-width": 2
      });

      if (link.dashed) {
        path.setAttribute("stroke-dasharray", "6 4");
      }

      if (link.arrow) {
        path.setAttribute("marker-end", "url(#relmapArrow)");
      }

      linksLayer.appendChild(path);

      if (link.label) {
        var width = Math.max(34, link.label.length * 6 + 14);
        var tag = createSvg("rect", {
          x: midX - width / 2,
          y: midY - 10,
          width: width,
          height: 16,
          rx: 4,
          ry: 4,
          class: "relmap-link-tag"
        });

        var text = createSvg("text", {
          x: midX,
          y: midY + 1,
          "text-anchor": "middle",
          class: "relmap-link-label"
        });

        text.textContent = link.label;
        linksLayer.appendChild(tag);
        linksLayer.appendChild(text);
      }
    });
  }

  function renderInspectorRelationships(nodeId) {
    inspectorRelationships.innerHTML = "";

    var entries = state.links.filter(function (link) {
      return link.from === nodeId || link.to === nodeId;
    });

    if (!entries.length) {
      var emptyItem = document.createElement("li");
      emptyItem.className = "stack-item";
      emptyItem.textContent = "No relationships linked yet.";
      inspectorRelationships.appendChild(emptyItem);
      return;
    }

    entries.forEach(function (link) {
      var fromNode = findNode(link.from);
      var toNode = findNode(link.to);
      if (!fromNode || !toNode) {
        return;
      }

      var direction = link.from === nodeId ? "outgoing" : "incoming";
      var otherNode = link.from === nodeId ? toNode : fromNode;
      var item = document.createElement("li");
      item.className = "stack-item";
      item.innerHTML = "<strong>" + (link.label || "Link") + "</strong><p>" + direction + " \u2192 " + titleCase(otherNode.name) + "</p>";
      inspectorRelationships.appendChild(item);
    });
  }

  function renderInspectorFields(profile) {
    inspectorFields.innerHTML = "";

    Object.keys(profile.fields).forEach(function (fieldKey) {
      var value = profile.fields[fieldKey];
      if (!value) {
        return;
      }

      var item = document.createElement("div");
      item.className = "inspector-field";
      item.innerHTML = "<strong>" + profileFieldLabels[fieldKey] + "</strong><span>" + value + "</span>";
      inspectorFields.appendChild(item);
    });

    if (!inspectorFields.childElementCount) {
      var empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = "No custom fields set yet.";
      inspectorFields.appendChild(empty);
    }
  }

  function renderInspector() {
    if (inspectorDismissed) {
      characterInspector.classList.add("dismissed");
      return;
    }

    characterInspector.classList.remove("dismissed");

    if (!selectedNodeId) {
      inspectorContent.hidden = true;
      inspectorEmpty.hidden = false;
      return;
    }

    var node = findNode(selectedNodeId);
    if (!node) {
      selectedNodeId = null;
      inspectorContent.hidden = true;
      inspectorEmpty.hidden = false;
      return;
    }

    var profile = getProfile(selectedNodeId);
    inspectorImage.src = encodeMapPath(node.image || "Default.png");
    inspectorName.textContent = titleCase(node.name);
    inspectorSubtitle.textContent = profile.subtitle || "Character Profile";
    inspectorSect.textContent = profile.sect || "Unknown Sect";
    inspectorClan.textContent = profile.clan || "Unknown Clan";

    var bio = profile.biography || "No biography yet.";
    inspectorBio.textContent = bio.length > 320 ? bio.slice(0, 320) + "..." : bio;

    renderInspectorFields(profile);
    renderInspectorRelationships(node.id);

    inspectorEmpty.hidden = true;
    inspectorContent.hidden = false;
  }

  function openProfileEditor() {
    if (!selectedNodeId) {
      return;
    }

    var node = findNode(selectedNodeId);
    var profile = getProfile(selectedNodeId);
    if (!node || !profile) {
      return;
    }

    profileNameInput.value = titleCase(node.name);
    profileImageSelect.value = node.image || "Default.png";
    profileSectInput.value = profile.sect;
    profileClanInput.value = profile.clan;
    profileBiographyInput.value = profile.biography;
    profileConceptInput.value = profile.fields.concept;
    profileAmbitionInput.value = profile.fields.ambition;
    profileDesireInput.value = profile.fields.desire;
    profileConvictionsInput.value = profile.fields.convictions;
    profileTouchstonesInput.value = profile.fields.touchstones;
    profilePredatorInput.value = profile.fields.predator;
    profileGenerationInput.value = profile.fields.generation;
    profileSireInput.value = profile.fields.sire;
    profileTrueAgeInput.value = profile.fields.trueAge;
    profileApparentAgeInput.value = profile.fields.apparentAge;
    profileBirthInput.value = profile.fields.dateOfBirth;
    profileDeathInput.value = profile.fields.dateOfDeath;

    profileEditorModal.dataset.nodeId = selectedNodeId;
    profileEditorModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeProfileEditor() {
    profileEditorModal.hidden = true;
    delete profileEditorModal.dataset.nodeId;
    document.body.style.overflow = "";
  }

  function applyTransform() {
    canvas.style.transform = "translate(" + translateX + "px, " + translateY + "px) scale(" + scale + ")";
    zoomStatus.textContent = "Zoom " + String(Math.round(scale * 100)) + "%";
  }

  function zoomBy(delta, originX, originY) {
    var prevScale = scale;
    scale = Math.min(1.8, Math.max(0.6, scale + delta));
    var ratio = scale / prevScale;

    translateX = originX - (originX - translateX) * ratio;
    translateY = originY - (originY - translateY) * ratio;
    applyTransform();
  }

  function centerCanvas() {
    var rect = viewport.getBoundingClientRect();
    translateX = (rect.width - state.canvas.width) / 2;
    translateY = 24;
    scale = Math.min(1, rect.width / (state.canvas.width + 60));
    applyTransform();
  }

  function applyCanvasSize() {
    canvas.style.width = state.canvas.width + "px";
    canvas.style.height = state.canvas.height + "px";
    linksLayer.setAttribute("viewBox", "0 0 " + state.canvas.width + " " + state.canvas.height);
  }

  function renderAll() {
    ensureProfiles();
    applyCanvasSize();
    renderZones();
    renderNodes();
    renderLinks();
    refreshNodeSelectors();
    renderInspector();
  }

  function initPanZoom() {
    var draggingCanvas = false;
    var startX = 0;
    var startY = 0;

    viewport.addEventListener("mousedown", function (event) {
      if (event.target.closest(".relmap-node")) {
        return;
      }

      draggingCanvas = true;
      startX = event.clientX - translateX;
      startY = event.clientY - translateY;
      viewport.classList.add("dragging");
    });

    document.addEventListener("mousemove", function (event) {
      if (draggingNodeId) {
        var node = findNode(draggingNodeId);
        if (node) {
          var point = mapCoordFromPointer(event.clientX, event.clientY);
          node.x = point.x;
          node.y = point.y;
          clampNode(node);
          renderNodes();
          renderLinks();
          renderInspector();
        }
        return;
      }

      if (!draggingCanvas) {
        return;
      }

      translateX = event.clientX - startX;
      translateY = event.clientY - startY;
      applyTransform();
    });

    document.addEventListener("mouseup", function () {
      if (draggingNodeId) {
        saveState();
      }
      draggingNodeId = null;
      draggingCanvas = false;
      viewport.classList.remove("dragging");
    });

    viewport.addEventListener("wheel", function (event) {
      event.preventDefault();
      var amount = event.deltaY < 0 ? 0.08 : -0.08;
      var rect = viewport.getBoundingClientRect();
      zoomBy(amount, event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });

    zoomInBtn.addEventListener("click", function () {
      var rect = viewport.getBoundingClientRect();
      zoomBy(0.1, rect.width / 2, rect.height / 2);
    });

    zoomOutBtn.addEventListener("click", function () {
      var rect = viewport.getBoundingClientRect();
      zoomBy(-0.1, rect.width / 2, rect.height / 2);
    });

    window.addEventListener("resize", centerCanvas);
  }

  function bindMapCreatorEvents() {
    nodeForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var rawName = nodeNameInput.value.trim();
      if (!rawName) {
        setStatus("Node name is required.");
        return;
      }

      var node = {
        id: uniqueNodeId(slugify(rawName)),
        name: rawName.toUpperCase(),
        x: Number(nodeXInput.value),
        y: Number(nodeYInput.value),
        image: nodeImageSelect.value || "Default.png"
      };

      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        node.x = Math.round(state.canvas.width / 2);
        node.y = Math.round(state.canvas.height / 2);
      }

      clampNode(node);
      state.nodes.push(node);
      state.profiles[node.id] = defaultProfileForNode(node);
      selectedNodeId = node.id;

      saveState();
      renderAll();

      nodeForm.reset();
      nodeImageSelect.value = node.image;
      setStatus("Node added: " + node.name + ".");
    });

    linkForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var fromId = linkFromSelect.value;
      var toId = linkToSelect.value;
      if (!fromId || !toId || fromId === toId) {
        setStatus("Link requires two different nodes.");
        return;
      }

      state.links.push({
        id: "link-" + Date.now(),
        from: fromId,
        to: toId,
        label: linkLabelInput.value.trim(),
        color: linkColorInput.value,
        dashed: linkDashedInput.checked,
        arrow: linkArrowInput.checked
      });

      saveState();
      renderLinks();
      renderInspector();
      linkLabelInput.value = "";
      setStatus("Link added.");
    });

    zoneForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var label = zoneLabelInput.value.trim();
      if (!label) {
        setStatus("Zone label is required.");
        return;
      }

      state.zones.push({
        id: "zone-" + Date.now(),
        cls: zoneClassSelect.value,
        label: label.toUpperCase(),
        x: Number(zoneXInput.value) || 0,
        y: Number(zoneYInput.value) || 0,
        width: Number(zoneWInput.value) || 220,
        height: Number(zoneHInput.value) || 120
      });

      saveState();
      renderZones();
      zoneForm.reset();
      zoneClassSelect.value = "council";
      setStatus("Zone added.");
    });

    deleteNodeBtn.addEventListener("click", function () {
      if (!selectedNodeId) {
        setStatus("Select a node first.");
        return;
      }

      state.nodes = state.nodes.filter(function (node) { return node.id !== selectedNodeId; });
      state.links = state.links.filter(function (link) {
        return link.from !== selectedNodeId && link.to !== selectedNodeId;
      });
      delete state.profiles[selectedNodeId];

      selectedNodeId = null;
      saveState();
      renderAll();
      setStatus("Selected node deleted.");
    });

    deleteLinkBtn.addEventListener("click", function () {
      if (!state.links.length) {
        setStatus("No links to delete.");
        return;
      }

      state.links.pop();
      saveState();
      renderLinks();
      renderInspector();
      setStatus("Last link deleted.");
    });

    deleteZoneBtn.addEventListener("click", function () {
      if (!state.zones.length) {
        setStatus("No zones to delete.");
        return;
      }

      state.zones.pop();
      saveState();
      renderZones();
      setStatus("Last zone deleted.");
    });

    saveMapBtn.addEventListener("click", function () {
      saveState();
      setStatus("Map saved in browser local storage.");
    });

    exportMapBtn.addEventListener("click", function () {
      mapJsonInput.value = JSON.stringify(state, null, 2);
      setStatus("Map JSON exported to the text area.");
    });

    importMapBtn.addEventListener("click", function () {
      try {
        state = sanitizeImportedState(JSON.parse(mapJsonInput.value));
        ensureProfiles();
        selectedNodeId = null;
        saveState();
        renderAll();
        centerCanvas();
        setStatus("Map JSON imported.");
      } catch (_error) {
        setStatus("Import failed. Please paste valid map JSON.");
      }
    });

    resetMapBtn.addEventListener("click", function () {
      state = clone(defaultState);
      selectedNodeId = null;
      saveState();
      renderAll();
      centerCanvas();
      setStatus("Map reset to defaults.");
    });
  }

  function bindInspectorEvents() {
    closeInspectorBtn.addEventListener("click", function () {
      inspectorDismissed = true;
      selectedNodeId = null;
      renderNodes();
      renderInspector();
    });

    openFullBioBtn.addEventListener("click", function () {
      openProfileEditor();
    });
  }

  function bindProfileEditorEvents() {
    closeProfileModalBtn.addEventListener("click", function () {
      closeProfileEditor();
    });

    profileEditorModal.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.hasAttribute("data-close-modal")) {
        closeProfileEditor();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (isEditableElement(document.activeElement)) {
        return;
      }

      if (event.key === "Escape" && !profileEditorModal.hidden) {
        closeProfileEditor();
      }
    });

    profileEditorForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var editingNodeId = profileEditorModal.dataset.nodeId || selectedNodeId;
      if (!editingNodeId) {
        closeProfileEditor();
        return;
      }

      var node = findNode(editingNodeId);
      var profile = getProfile(editingNodeId);
      if (!node || !profile) {
        closeProfileEditor();
        return;
      }

      var nextName = profileNameInput.value.trim();
      if (!nextName) {
        setStatus("Character name is required.");
        return;
      }

      node.name = nextName.toUpperCase();
      node.image = profileImageSelect.value || node.image || "Default.png";

      profile.sect = profileSectInput.value.trim();
      profile.clan = profileClanInput.value.trim();
      profile.biography = profileBiographyInput.value.trim();
      profile.fields.concept = profileConceptInput.value.trim();
      profile.fields.ambition = profileAmbitionInput.value.trim();
      profile.fields.desire = profileDesireInput.value.trim();
      profile.fields.convictions = profileConvictionsInput.value.trim();
      profile.fields.touchstones = profileTouchstonesInput.value.trim();
      profile.fields.predator = profilePredatorInput.value.trim();
      profile.fields.generation = profileGenerationInput.value.trim();
      profile.fields.sire = profileSireInput.value.trim();
      profile.fields.trueAge = profileTrueAgeInput.value.trim();
      profile.fields.apparentAge = profileApparentAgeInput.value.trim();
      profile.fields.dateOfBirth = profileBirthInput.value.trim();
      profile.fields.dateOfDeath = profileDeathInput.value.trim();

      saveState();
      selectedNodeId = editingNodeId;
      inspectorDismissed = false;
      renderAll();
      closeProfileEditor();
      setStatus("Character profile saved.");
    });

    saveProfileBtn.addEventListener("click", function () {
      profileEditorForm.requestSubmit();
    });
  }

  populatePortraitSelects();
  renderAll();
  centerCanvas();
  initPanZoom();
  bindMapCreatorEvents();
  bindInspectorEvents();
  bindProfileEditorEvents();
  setStatus("Creator ready. Click a character to open details. Use Full Biography to edit everything.");
})();
