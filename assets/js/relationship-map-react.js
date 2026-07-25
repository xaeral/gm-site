(function () {
  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var useState = React.useState;
  var html = htm.bind(React.createElement);
  var sharedCharacters = window.CampaignAtlasCharactersShared || {};
  var SharedBiographyWorkspace = sharedCharacters.CharacterBiographyWorkspace || null;
  var SharedCharacterProfileWorkspace = sharedCharacters.CharacterProfileWorkspace || null;
  var CHARACTER_SYNC_CHANNEL = "campaign-atlas-characters";

  // All persistence access is routed through these three services. This module
  // never opens IndexedDB directly: CharacterService owns character records,
  // RelationshipService owns relationship records, and MapLayoutService owns
  // this map's own view state (node layout, zones, viewport, preferences).
  var characterService = window.CharacterService;
  var relationshipService = window.RelationshipService;
  var mapLayoutService = window.MapLayoutService;

  // React Flow is the rendering engine for this page: node/edge rendering,
  // dragging, zooming, panning and selection are all owned by React Flow.
  // This module only supplies node/edge data (from CharacterService and
  // RelationshipService) and persists layout changes (via MapLayoutService).
  var ReactFlowLib = window.ReactFlow || {};
  var ReactFlowComponent = ReactFlowLib.ReactFlow;
  var ReactFlowProvider = ReactFlowLib.ReactFlowProvider;
  var ReactFlowHandle = ReactFlowLib.Handle;
  var ReactFlowPosition = ReactFlowLib.Position || { Left: "left", Right: "right", Top: "top", Bottom: "bottom" };
  var ReactFlowConnectionMode = ReactFlowLib.ConnectionMode || { Strict: "strict", Loose: "loose" };
  var ReactFlowMarkerType = ReactFlowLib.MarkerType || { Arrow: "arrow", ArrowClosed: "arrowclosed" };
  var ReactFlowBaseEdge = ReactFlowLib.BaseEdge;
  var ReactFlowGetBezierPath = ReactFlowLib.getBezierPath;
  var ReactFlowEdgeLabelRenderer = ReactFlowLib.EdgeLabelRenderer;
  var useFlowNodesState = ReactFlowLib.useNodesState;
  var useFlowEdgesState = ReactFlowLib.useEdgesState;
  var useReactFlowInstance = ReactFlowLib.useReactFlow;

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

  // Edge-stroke translation for each declared relationship line style. Solid/
  // dashed/dotted are plain SVG dash patterns; chain/droplets are dash-pattern
  // approximations. solid/dashed/dotted render this way for real -- a plain
  // stroked path is the correct, cheapest representation for them, and
  // always will be. chain/droplets keep dasharray entries too, purely as a
  // fallback for when EdgeLabelRenderer isn't available (see
  // DECORATIVE_EDGE_RENDERERS below, which is what actually draws them).
  var RELATIONSHIP_STYLE_DASHARRAY = {
    solid: "none",
    dashed: "9 5",
    dotted: "1.5 5",
    chain: "10 3 2 3",
    droplets: "1 9"
  };

  var CHAIN_LINK_ICON = "../assets/Icons/chain-link.svg";
  var CHAIN_LINK_ASPECT = 24 / 4.95;

  // Four hand-drawn droplet-tile variants (rather than one repeated asset)
  // so the trail doesn't read as an obviously stamped pattern. Each has its
  // own true aspect ratio, computed from its own SVG's width/height -- a
  // tile is never stretched/squashed regardless of which variant a given
  // placement draws (see pickTileVariant).
  var DROPLET_VARIANT_ICONS = [
    { icon: "../assets/Icons/droplet1.svg", aspect: 14682.07 / 2415 },
    { icon: "../assets/Icons/droplet2.svg", aspect: 11100.9 / 2199.98 },
    { icon: "../assets/Icons/droplet3.svg", aspect: 4985.51 / 2173.74 },
    { icon: "../assets/Icons/droplet4.svg", aspect: 8483.36 / 1785.69 }
  ];

  // Default fraction of a tile's own rendered width to advance before
  // placing the next one, for any tiled style that opts into overlap-based
  // "stamp" spacing (see the `tileAdvanceRatio` style config field and
  // resolveTileSpacing) instead of a fixed absolute arc-length `spacing`.
  // 0.4 means each new stamp only advances 40% of the previous tile's own
  // width -- a 60% overlap -- so stamps merge into one continuous smear
  // rather than reading as separate, evenly-spaced icons.
  var TILE_ADVANCE_RATIO_DEFAULT = 0.4;

  // The arrow marker's own rendered length along the path (matches the
  // width/height relationshipEdgeMarker actually draws it at -- one source
  // of truth for both, so the padding calculation below can never drift out
  // of sync with the marker's real size).
  var RELATIONSHIP_ARROW_MARKER_SIZE = 18;

  // Configurable safety margin (in flow/path units, screen space at 100%
  // zoom), on top of RELATIONSHIP_ARROW_MARKER_SIZE, defining how close a
  // decorative element may render to the literal tip of an edge before it
  // gets clipped rather than skipped -- see decorationMarkerClip. Decorative
  // elements are placed with even spacing along the FULL path (they are
  // never stopped early to "leave room" for a marker); whichever one ends up
  // nearest a marker gets exactly the portion beyond this boundary masked
  // off via clip-path, so the pattern flows naturally up to the arrowhead
  // with a small consistent gap and never protrudes past it. Tuning this one
  // constant -- or RELATIONSHIP_ARROW_MARKER_SIZE above, if the arrowhead
  // size itself changes -- adjusts every decorative renderer at once, with
  // no per-renderer hardcoded offsets.
  var MARKER_END_PADDING = 4;

  // Small deterministic PRNG (mulberry32) seeded from a string -- used to
  // give each tile of a tiled decorative style (see renderTiledDecoration)
  // stable-but-unique per-tile variation: the same relationship always
  // renders identically across sessions (same seed in, same values out),
  // while different tiles -- and different relationships -- look visibly
  // distinct from one another.
  function makeSeededRandom(seedString) {
    var seed = 0;
    var text = String(seedString || "seed");
    for (var i = 0; i < text.length; i++) {
      seed = (Math.imul(seed, 31) + text.charCodeAt(i)) | 0;
    }
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Samples evenly-spaced points (by arc length, so spacing looks consistent
  // regardless of curvature) and local tangent angles along a real, mounted
  // SVGPathElement. This is the one piece of geometry every decorative edge
  // style shares -- every current style (Chain, Droplets) tiles a small SVG
  // asset at each point via renderTiledDecoration, but nothing here assumes
  // that; a future non-tiled style can consume the same points differently.
  // Works identically for straight and curved (bezier) edges since it reads
  // the actual rendered path rather than assuming any particular shape.
  //
  // Samples the FULL path, all the way to both literal ends -- decorative
  // elements are never stopped early to "leave room" for a marker (that
  // used to leave a large, variable gap before the arrowhead). Each point
  // carries its own arc length (len) and the path's totalLength so a
  // renderer can figure out, per element, how close it lands to either end
  // and clip accordingly -- see decorationMarkerClip.
  function sampleEdgePathPoints(pathEl, spacing) {
    if (!pathEl || typeof pathEl.getTotalLength !== "function") {
      return [];
    }
    var totalLength = pathEl.getTotalLength();
    if (!totalLength || totalLength <= 0) {
      return [];
    }
    var step = Math.max(4, spacing || 20);
    var count = Math.max(1, Math.floor(totalLength / step));
    var points = [];
    for (var i = 0; i <= count; i++) {
      var len = Math.min(totalLength, i * step);
      var point = pathEl.getPointAtLength(len);
      var aheadLen = Math.min(totalLength, len + 1);
      var ahead = pathEl.getPointAtLength(aheadLen);
      var angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * (180 / Math.PI);
      points.push({ x: point.x, y: point.y, angle: angle, len: len, totalLength: totalLength });
    }
    return points;
  }

  // Shared by every decorative renderer: figures out how many px of a
  // decorative element's own along-path extent (its width in the direction
  // of travel -- a chain link's width, a droplet's height, whatever a future
  // style uses) fall inside the reserved zone at either end of the edge
  // where a marker is drawn, given that end's boundary length (0 if that end
  // has no marker at all). Returns 0/0 when nothing needs clipping.
  function decorationMarkerClip(point, elementLength, startBoundaryLen, endBoundaryLen) {
    var half = (elementLength || 0) / 2;
    var distanceFromStart = point.len;
    var distanceFromEnd = point.totalLength - point.len;
    return {
      clipStart: Math.max(0, (startBoundaryLen || 0) - (distanceFromStart - half)),
      clipEnd: Math.max(0, (endBoundaryLen || 0) - (distanceFromEnd - half))
    };
  }

  // Turns a decorationMarkerClip() result into a CSS clip-path, masking off
  // only the overlapping portion of an element (never scaling or squashing
  // it) -- applied in the element's own local box space, which is why every
  // decorative element must be positioned/sized BEFORE rotation: clipping
  // the local right edge always removes the "leading" (tip-ward) portion of
  // an element that's rotated to face the path's direction of travel, and
  // the local left edge the "trailing" (start-ward) portion, regardless of
  // the path's actual curve direction at that point.
  function decorationClipPath(clip) {
    if (!clip || (clip.clipStart <= 0 && clip.clipEnd <= 0)) {
      return undefined;
    }
    return "inset(0px " + Math.max(0, clip.clipEnd) + "px 0px " + Math.max(0, clip.clipStart) + "px)";
  }

  // Generic tiled decorative renderer: repeats a small SVG asset along the
  // edge, each instance rotated to the path's local tangent -- never a
  // single SVG stretched across the whole edge. Reuses Icon()'s existing
  // mask-image + currentColor recoloring (the same technique already used
  // for Clan/Sect badges) so the relationship color applies without a
  // tinted asset copy. Shared by every tiled style (Chain, Droplets, and any
  // future one) via TILED_DECORATIVE_STYLES below -- adding a new tiled
  // style is exactly one config entry (asset path, tile dimensions, tile
  // spacing) with no new rendering code.
  //
  // Tiles are placed with even spacing all the way to the path's literal
  // ends -- never stopped early to leave room for a marker. Whichever tile
  // ends up nearest a marker gets the overlapping portion clip-masked
  // (decorationMarkerClip/decorationClipPath) instead of being omitted, so
  // the trail flows naturally up to and under the arrowhead with only a
  // small, consistent, configurable (MARKER_END_PADDING) gap, and no tile is
  // ever scaled or squashed to make it fit. That same end-padding constant
  // is shared by every tiled style, deliberately -- see MARKER_END_PADDING.
  //
  // If styleConfig.variation is set, each tile also gets subtle, per-tile,
  // deterministic variation (random flip/scale/rotation/position jitter --
  // see computeTileVariation) seeded from `seedKey` (the relationship id)
  // and the tile's own index, so the pattern never looks like an obviously
  // repeating stamp but is still 100% stable across reloads. The tile's
  // SAMPLED point (and therefore tile spacing/overlap) is never touched by
  // this -- the position jitter is added on top as a small render-time
  // offset, so the trail's underlying continuity is always preserved.
  function renderTiledDecoration(styleConfig, samplePoints, color, seedKey, markerClip) {
    if (!ReactFlowEdgeLabelRenderer || !samplePoints.length) {
      return null;
    }
    var tileWidth = styleConfig.tileWidth;
    var clipInfo = markerClip || { startBoundaryLen: 0, endBoundaryLen: 0 };
    return html`<${ReactFlowEdgeLabelRenderer}>
      ${samplePoints.map(function (point, index) {
        var clip = decorationMarkerClip(point, tileWidth, clipInfo.startBoundaryLen, clipInfo.endBoundaryLen);
        var variant = pickTileVariant(styleConfig, seedKey, index);
        var tileHeight = tileWidth / variant.aspect;
        var variation = styleConfig.variation ? computeTileVariation(point.angle, seedKey, index) : null;
        var left = point.x + (variation ? variation.offsetX : 0);
        var top = point.y + (variation ? variation.offsetY : 0);
        var transform = variation ? variation.transform : "translate(-50%, -50%) rotate(" + point.angle + "deg)";
        return html`<div
          key=${styleConfig.className + "-" + index}
          className=${styleConfig.className}
          style=${{
            position: "absolute",
            left: left + "px",
            top: top + "px",
            width: tileWidth + "px",
            height: tileHeight + "px",
            transform: transform,
            clipPath: decorationClipPath(clip),
            pointerEvents: "none"
          }}
        >
          ${Icon({ icon: variant.icon, color: color, width: tileWidth, height: tileHeight, className: styleConfig.className + "-icon" })}
        </div>`;
      })}
    </${ReactFlowEdgeLabelRenderer}>`;
  }

  // Picks which SVG asset a tile uses. A style with a single fixed asset
  // (Chain) just returns it unchanged. A style with multiple `variants`
  // (Droplets) draws one deterministically -- a dedicated seeded PRNG per
  // tile (seedKey + its own index, kept separate from computeTileVariation's
  // own PRNG so variant choice doesn't depend on whether shape variation is
  // enabled) picks an index, never sequentially, so the same relationship
  // always renders the same sequence of assets while different relationships
  // -- and different tiles along the same trail -- look naturally varied.
  function pickTileVariant(styleConfig, seedKey, tileIndex) {
    if (!styleConfig.variants || !styleConfig.variants.length) {
      return { icon: styleConfig.icon, aspect: styleConfig.aspect };
    }
    var rand = makeSeededRandom(seedKey + "-tile-" + tileIndex + "-variant");
    var index = Math.floor(rand() * styleConfig.variants.length);
    return styleConfig.variants[Math.min(index, styleConfig.variants.length - 1)];
  }

  // Computes one varied tile's CSS transform plus a small position offset,
  // from a fresh seeded PRNG per tile (seedKey + its own index) -- every
  // tile's variation is independent and deterministic regardless of how
  // many tiles the edge has, or of any other tile's own random draws.
  //
  // Random horizontal/vertical flips (each 50%, and can combine) come from
  // negating the relevant scale() axis; a random uniform 0.9x-1.1x scale and
  // a small +-3 degree rotation offset (added on top of the real edge
  // tangent, never replacing it) round out the shape variation.
  // translate(-50%, -50%) is applied first in the transform so every
  // subsequent rotate/scale pivots around the tile's own center -- the
  // random scale/flip never shifts its placement point.
  //
  // offsetX/offsetY nudge that placement point itself by a small amount
  // resolved in the path's own tangent/normal directions (not raw x/y), so
  // "lateral" and "longitudinal" mean the same thing they visually look
  // like regardless of the edge's on-screen angle: a lateral offset (+-2 to
  // 4px, randomised sign) shifts the tile sideways off the centreline, and a
  // longitudinal offset (+-2px) shifts it forward/back along the trail. Both
  // are kept small relative to the tile's own size and the configured
  // overlap specifically so neighbouring tiles never lose enough overlap to
  // visibly gap or disconnect.
  function computeTileVariation(tangentAngle, seedKey, tileIndex) {
    var rand = makeSeededRandom(seedKey + "-tile-" + tileIndex);
    var scale = 0.9 + rand() * 0.2;
    var flipX = rand() < 0.5 ? -1 : 1;
    var flipY = rand() < 0.5 ? -1 : 1;
    var rotationJitter = (rand() - 0.5) * 6;
    var lateralOffset = (rand() < 0.5 ? -1 : 1) * (2 + rand() * 2);
    var longitudinalOffset = (rand() - 0.5) * 4;
    var radians = (tangentAngle * Math.PI) / 180;
    var alongX = Math.cos(radians) * longitudinalOffset;
    var alongY = Math.sin(radians) * longitudinalOffset;
    var acrossX = -Math.sin(radians) * lateralOffset;
    var acrossY = Math.cos(radians) * lateralOffset;
    return {
      offsetX: alongX + acrossX,
      offsetY: alongY + acrossY,
      transform: "translate(-50%, -50%) rotate(" + (tangentAngle + rotationJitter) + "deg) scale(" + (flipX * scale) + ", " + (flipY * scale) + ")"
    };
  }

  // Per-style config for renderTiledDecoration -- the one place a tiled
  // decorative style is defined. Spacing between tile centres comes from
  // EITHER of two mutually exclusive fields, resolved by resolveTileSpacing:
  //   - `spacing`: a fixed absolute arc-length distance. Less than
  //     `tileWidth` means adjacent tiles overlap slightly; more means a
  //     visible gap between them (Chain, by design -- individual links, not
  //     a solid line).
  //   - `tileAdvanceRatio`: a fraction of the style's OWN `tileWidth` to
  //     advance instead, so heavily-overlapping "stamp" styles (Droplets)
  //     scale their spacing to their own asset size rather than an
  //     unrelated fixed number -- see TILE_ADVANCE_RATIO_DEFAULT.
  // `variation` opts a style into computeTileVariation's per-tile
  // flip/scale/rotation/position jitter (Droplets, to break up the
  // repeating stamp look); omitting it (Chain) keeps that style's tiles
  // exactly as rotated-to-tangent as before, unchanged. A style uses either
  // a single fixed `icon`/`aspect` (Chain) or a `variants` list of
  // {icon, aspect} pairs that pickTileVariant chooses between per tile
  // (Droplets) -- `tileWidth` always stays fixed across variants so spacing/
  // overlap is unaffected by which asset a given tile draws; only the
  // rendered height follows that variant's own aspect ratio.
  var TILED_DECORATIVE_STYLES = {
    chain: {
      icon: CHAIN_LINK_ICON,
      aspect: CHAIN_LINK_ASPECT,
      tileWidth: 24,
      spacing: 26,
      className: "relationship-chain-link"
    },
    droplets: {
      variants: DROPLET_VARIANT_ICONS,
      tileWidth: 42,
      tileAdvanceRatio: TILE_ADVANCE_RATIO_DEFAULT,
      className: "relationship-droplet-tile",
      variation: true
    }
  };

  // Resolves the actual arc-length spacing (px, at 100% zoom) used to
  // sample points for a tiled style -- see the field-by-field explanation
  // above TILED_DECORATIVE_STYLES. Styles that don't opt into
  // `tileAdvanceRatio` (Chain) are entirely unaffected and keep using their
  // own fixed `spacing`, unchanged.
  function resolveTileSpacing(styleConfig) {
    if (styleConfig.tileAdvanceRatio) {
      return styleConfig.tileWidth * styleConfig.tileAdvanceRatio;
    }
    return styleConfig.spacing;
  }

  // The extensibility point the task calls for: adding a new tiled
  // decorative style is exactly one new TILED_DECORATIVE_STYLES entry --
  // nothing else in RelationshipFlowEdge or the sampling pipeline changes.
  // A future non-tiled style can still be added the same way this pair of
  // maps has always supported: a direct DECORATIVE_EDGE_RENDERERS /
  // DECORATIVE_EDGE_SPACING entry with its own renderer function.
  var DECORATIVE_EDGE_RENDERERS = {};
  var DECORATIVE_EDGE_SPACING = {};
  Object.keys(TILED_DECORATIVE_STYLES).forEach(function (styleKey) {
    var styleConfig = TILED_DECORATIVE_STYLES[styleKey];
    DECORATIVE_EDGE_RENDERERS[styleKey] = function (samplePoints, color, seedKey, markerClip) {
      return renderTiledDecoration(styleConfig, samplePoints, color, seedKey, markerClip);
    };
    DECORATIVE_EDGE_SPACING[styleKey] = resolveTileSpacing(styleConfig);
  });

  // Every decorative renderer above portals its content into React Flow's
  // shared EdgeLabelRenderer layer, which sits above the SVG canvas (and
  // therefore above BaseEdge's own SVG-rendered label) -- so a label drawn
  // through BaseEdge's label prop would end up underneath chain links or
  // droplets from any edge, not just its own. Rendering the label through
  // the same portal, with an explicit z-index higher than the decorations
  // (which don't set one), keeps it on top regardless of DOM order across
  // however many edges are portaling content into that shared layer at
  // once. Kept visually identical to BaseEdge's previous built-in label.
  function renderRelationshipLabel(labelX, labelY, label) {
    if (!ReactFlowEdgeLabelRenderer || !label) {
      return null;
    }
    return html`<${ReactFlowEdgeLabelRenderer}>
      <div
        className="relationship-edge-label"
        style=${{
          position: "absolute",
          left: labelX + "px",
          top: labelY + "px",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          pointerEvents: "none",
          background: "rgba(15, 15, 22, 0.85)",
          color: "#f4f4ff",
          fontSize: "11px",
          fontWeight: 600,
          padding: "2px 4px",
          borderRadius: "4px",
          whiteSpace: "nowrap"
        }}
      >${label}</div>
    </${ReactFlowEdgeLabelRenderer}>`;
  }

  var DEFAULT_RELATIONSHIP_CATEGORIES = [
    {
      id: "cat-vampire-relations",
      name: "Vampire Relations",
      color: "#7a3db8",
      types: [
        { id: "type-sire", name: "Sire", label: "Sire", color: "#db243f", width: 2, style: "droplets", animated: false, arrow: true },
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
    var arrow = typeof source.arrow === "boolean" ? source.arrow : (String(source.arrow || "").toLowerCase() === "end" || String(source.arrow || "").toLowerCase() === "both");
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
      // Whether an arrowhead (when `arrow` is on) renders at both ends of
      // the edge instead of just the end -- feeds relationshipTypeDefaults
      // FromCategory's 4-way relationship-level `arrow` field ("start" /
      // "end" / "both" / "none"), which the edge renderer and preview SVG
      // already fully support; this was just never reachable from a type
      // definition before.
      bidirectional: Boolean(source.bidirectional),
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
      arrow: type.arrow ? (type.bidirectional ? "both" : "end") : "none",
      routingMode: "auto",
      lineMeta: Object.assign(makeRelationshipTypeDecoration(), type.decoration || {})
    };
  }

  // Relationship types are the single source of truth for visual styling.
  // A relationship record only ever stores core, relationship-specific data
  // (id/from/to/categoryId/typeId/displayLabel/description/etc) -- it never
  // caches color/thickness/style/animated/arrow/routingMode/lineMeta/
  // category/type. Any such fields found on legacy/loaded data are stripped
  // here (the one place every relationship passes through on load and on
  // save) so a stale cached value can never again shadow the live type
  // definition. Visual properties are resolved fresh at render time instead
  // -- see resolveRelationshipVisuals.
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

      var resolved = relationshipTypeDefaultsFromCategory(availableCategories, current.categoryId || current.category, current.typeId || current.type);
      if (current.typeId && typeLookup[current.typeId]) {
        var exact = typeLookup[current.typeId];
        resolved = relationshipTypeDefaultsFromCategory(availableCategories, exact.category.id, exact.type.id);
      }

      delete current.color;
      delete current.thickness;
      delete current.width;
      delete current.style;
      delete current.animated;
      delete current.arrow;
      delete current.routingMode;
      delete current.lineMeta;
      delete current.category;
      delete current.type;

      return Object.assign({
        id: current.id || ("rel-" + Date.now() + "-" + index),
        from: "",
        to: "",
        displayLabel: "",
        description: "",
        gmNotes: "",
        hiddenFromCollaborators: false,
        visible: true,
        opacity: 1
      }, current, {
        categoryId: resolved.categoryId,
        typeId: resolved.typeId,
        displayLabel: current.displayLabel || resolved.displayLabel
      });
    });
  }

  // Resolves a relationship's live visual styling from its relationship
  // type, merged with its own relationship-specific fields (from/to/label/
  // description/etc). Call this at every render site instead of reading
  // color/thickness/style/etc directly off a relationship -- this is what
  // makes editing a relationship type immediately update every relationship
  // that uses it, with no delete/recreate and no reload required.
  function resolveRelationshipVisuals(relationship, categories) {
    var visuals = relationshipTypeDefaultsFromCategory(categories, relationship.categoryId, relationship.typeId);
    return Object.assign({}, relationship, visuals, {
      displayLabel: relationship.displayLabel || visuals.displayLabel
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
    // width/height override size for non-square source assets (e.g. the
    // chain-link SVG, which is a wide/short strip rather than an icon glyph)
    // -- existing callers that only ever pass `size` are unaffected.
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

  function renderPortraitSource(portrait) {
    if (sharedCharacters.renderPortraitSource) {
      return sharedCharacters.renderPortraitSource(portrait);
    }
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
    if (sharedCharacters.canonicalPortraitFromRecord) {
      return sharedCharacters.canonicalPortraitFromRecord(record);
    }
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
    if (sharedCharacters.portraitState) {
      return sharedCharacters.portraitState(record);
    }
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
    if (sharedCharacters.portraitMediaStyle) {
      return sharedCharacters.portraitMediaStyle(record);
    }
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
    if (sharedCharacters.parseDossierEntries) {
      return sharedCharacters.parseDossierEntries(rawText);
    }
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
    if (sharedCharacters.dossierEntryGroup) {
      return sharedCharacters.dossierEntryGroup(options);
    }
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function indexedDbAvailable() {
    return typeof window !== "undefined" && !!window.indexedDB;
  }

  // The Relationship Map no longer owns character identity data (name, portrait,
  // biography, clan/sect, timeline, etc.) -- that is persisted exclusively by
  // CharacterService. Relationship records are persisted exclusively by
  // RelationshipService. This map only owns its own view state -- node layout,
  // zones, viewport and view-specific preferences -- persisted exclusively by
  // MapLayoutService. This module does not access IndexedDB directly.
  function nodeLayoutRecordFor(character) {
    return {
      id: character.id,
      x: character.x,
      y: character.y,
      outlineColor: character.outlineColor,
      nodeSize: character.nodeSize,
      nodeShape: character.nodeShape,
      hidden: Boolean(character.hidden)
    };
  }

  // A character only appears on the map once it has a saved node-layout
  // record -- CharacterService's full roster is not automatically placed on
  // the canvas. `onMap` tracks that membership; it is never persisted onto
  // the character record itself (it's derived fresh from MapLayoutService's
  // layout table on every load).
  function applyNodeLayout(character, layout) {
    if (layout) {
      if (typeof layout.x === "number") {
        character.x = layout.x;
      }
      if (typeof layout.y === "number") {
        character.y = layout.y;
      }
      if (layout.outlineColor) {
        character.outlineColor = layout.outlineColor;
      }
      if (typeof layout.nodeSize === "number") {
        character.nodeSize = layout.nodeSize;
      }
      if (layout.nodeShape) {
        character.nodeShape = layout.nodeShape;
      }
      character.hidden = Boolean(layout.hidden);
      character.onMap = true;
      return character;
    }
    character.onMap = false;
    character.hidden = false;
    return character;
  }

  // Returns the grid position a newly added character should default to,
  // offset from however many characters are already on the map.
  function nextMapPosition(characters) {
    var onMapCount = (characters || []).filter(function (character) { return character && character.onMap; }).length;
    return {
      x: 200 + (onMapCount % 5) * 220,
      y: 200 + Math.floor(onMapCount / 5) * 220
    };
  }

  async function persistStateToIndexedDb(state) {
    var source = state && typeof state === "object" ? state : initialState();
    var characters = Array.isArray(source.characters) ? source.characters : [];

    await mapLayoutService.saveNodeLayouts(characters.filter(function (character) {
      return character && character.id && character.onMap;
    }).map(nodeLayoutRecordFor));
    await relationshipService.saveAll(clone(source.relationships || []));
    await mapLayoutService.saveZones(clone(source.zones || []));

    var preferences = {};
    Object.keys(source).forEach(function (key) {
      if (["characters", "relationships", "zones"].indexOf(key) >= 0) {
        return;
      }
      preferences[key] = clone(source[key]);
    });
    await mapLayoutService.savePreferences(preferences);
  }

  async function readStateFromIndexedDb() {
    var characters = await characterService.getAll();
    var relationships = await relationshipService.getAll();
    var zones = await mapLayoutService.getZones();
    var layoutById = await mapLayoutService.getNodeLayouts();
    var preferences = await mapLayoutService.getPreferences();

    var state = initialState();
    state.characters = (characters || []).map(function (character) {
      var normalized = normalizeCharacterRecord(character);
      return applyNodeLayout(normalized, layoutById[normalized.id]);
    });
    state.relationships = clone(relationships || []);

    if (zones && zones.length) {
      state.zones = clone(zones);
    }
    if (preferences && typeof preferences === "object") {
      state = Object.assign(state, clone(preferences));
    }

    return state;
  }

  async function loadInitialState() {
    if (!indexedDbAvailable()) {
      return initialState();
    }
    // The canonical character/relationship/layout services are always trusted,
    // including when they legitimately report zero characters (a fresh or
    // fully-cleared campaign) -- that is real data, not a signal to fall back
    // to anything else.
    return await readStateFromIndexedDb();
  }

  function initialState() {
    return {
      title: "Melbourne by Night",
      session: "Session 18 - Red Ledger",
      notes: ["Prep Elysium confrontation", "Track coterie influence"],
      characters: [],
      zones: [],
      relationships: [],
      relationshipCategories: clone(DEFAULT_RELATIONSHIP_CATEGORIES),
      tagGroups: [
        { id: "tg1", name: "Politics", tags: [{ id: "t1", name: "Prince", color: "#d10d40", icon: "♛", description: "Ruling authority", visible: true }, { id: "t2", name: "Council", color: "#8b1e46", icon: "◎", description: "Council aligned", visible: true }] }
      ]
    };
  }

  // Small circular badge showing the character's status as a single letter,
  // styled to match the existing icon-badge look (used for the clan badge)
  // even though status has no icon asset of its own.
  function nodeStatusBadge(status, size) {
    var badgeStyle = { width: size + "px", height: size + "px", background: "#000000" };
    return html`<span className="icon-badge node-icon-badge node-status-badge" style=${badgeStyle} title=${status} aria-label=${status}>
      <span className="node-status-badge-letter">${String(status).slice(0, 1).toUpperCase()}</span>
    </span>`;
  }

  // Left anchor carries the Sect icon, right anchor carries the Clan badge --
  // same anchor layout and icon-badge styling the map has always used for
  // node badges (see resolveSectIcon/resolveClanIcon above -- the same
  // lookups the Characters page uses, just reused here rather than
  // duplicated). The portrait ring is untouched and still represents Clan.
  function characterNodeBadges(character, portraitDiameter) {
    var badgeSize = Math.round(clamp(toNumber(portraitDiameter, 74) * 0.28, 18, 42));
    var badges = [];
    var clan = normalizeClanValue(character && character.clan);
    var clanIcon = resolveClanIcon(clan);
    var sect = normalizeSectValue(character && character.sect);
    var sectIcon = resolveSectIcon(sect);

    if (sect !== "None" && sectIcon) {
      badges.push({ id: "sect", anchor: "left", kind: "icon", icon: sectIcon, tooltip: sect, size: badgeSize, backgroundColor: "#000000", borderColor: "#2e2e2e", iconColor: "#ffffff" });
    }
    if (clan !== "None" && clanIcon) {
      badges.push({ id: "clan", anchor: "right", kind: "icon", icon: clanIcon, tooltip: clan, size: badgeSize, backgroundColor: "#000000", borderColor: "#2e2e2e", iconColor: "#ffffff" });
    }
    return badges;
  }

  function renderNodeBadgeAnchors(badges) {
    if (!badges || !badges.length) {
      return null;
    }

    var grouped = { left: [], right: [] };
    badges.forEach(function (badge) {
      if (!badge) {
        return;
      }
      var anchor = badge.anchor === "right" ? "right" : "left";
      grouped[anchor].push(badge);
    });

    function renderBadge(badge, anchor, index) {
      if (badge.kind === "status") {
        return html`<span className="node-badge-item" key=${"node-badge-" + anchor + "-status-" + index}>
          ${nodeStatusBadge(badge.value, badge.size)}
        </span>`;
      }
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
    }

    function renderAnchor(anchor) {
      var entries = grouped[anchor];
      if (!entries.length) {
        return null;
      }
      return html`<div className=${"node-badge-anchor node-badge-anchor-" + anchor}>
        ${entries.map(function (badge, index) { return renderBadge(badge, anchor, index); })}
      </div>`;
    }

    return html`<div className="node-badge-layer" aria-hidden="true">
      ${renderAnchor("left")}
      ${renderAnchor("right")}
    </div>`;
  }

  // Chronicle Codex character node: portrait (with the map's existing
  // outline-color/shape customization), clan badge, status indicator and
  // name label -- matching the pre-React-Flow node design. Defined at
  // module scope (not inside App) so its identity is stable across renders
  // -- React Flow keys its `nodeTypes` lookup by reference, and a fresh
  // function every render would remount every node.
  function CharacterFlowNode(props) {
    var character = props && props.data ? props.data.character : null;
    if (!character) {
      return null;
    }
    var nodeSize = typeof character.nodeSize === "number" ? character.nodeSize : 1;
    var outlineColor = character.outlineColor || "#d10d40";
    var shape = character.nodeShape === "rounded" ? "square" : (character.nodeShape || "circle");
    var radius = shape === "circle" ? "50%" : "8px";
    var clip = shape === "hexagon" ? "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)" : "none";
    var portraitDiameter = 74 * nodeSize;
    var badges = characterNodeBadges(character, portraitDiameter);
    // Four connection points, one per side. `connectionMode="loose"` on the
    // <ReactFlow> element (see the App-level JSX) is what actually lets each
    // of these act as both a source and a target -- the `type` below only
    // sets each handle's default cursor/class, it no longer restricts which
    // direction a drag can start or land in.
    return html`<div className=${"flow-node" + (props.selected ? " selected" : "")}>
      ${ReactFlowHandle ? html`<${ReactFlowHandle} id="top" type="target" position=${ReactFlowPosition.Top} />` : null}
      ${ReactFlowHandle ? html`<${ReactFlowHandle} id="left" type="target" position=${ReactFlowPosition.Left} />` : null}
      <div className="node-portrait-shell">
        <div className="node-portrait-frame" style=${{ width: portraitDiameter, height: portraitDiameter, "--node-outline-color": outlineColor, borderRadius: radius, clipPath: clip }}>
          <img className="node-portrait media" src=${portraitState(character).src} alt=${character.name} style=${portraitMediaStyle(character)} />
        </div>
        ${renderNodeBadgeAnchors(badges)}
      </div>
      <span className="flow-node-label">${String(character.name || "").toUpperCase()}</span>
      ${ReactFlowHandle ? html`<${ReactFlowHandle} id="right" type="source" position=${ReactFlowPosition.Right} />` : null}
      ${ReactFlowHandle ? html`<${ReactFlowHandle} id="bottom" type="source" position=${ReactFlowPosition.Bottom} />` : null}
    </div>`;
  }

  var FLOW_NODE_TYPES = { characterNode: CharacterFlowNode };

  // Renders the relationship-type metadata that already exists (color,
  // thickness, line style, animation, arrowheads -- see
  // DEFAULT_RELATIONSHIP_CATEGORIES / normalizeRelationships above) onto the
  // actual React Flow edge. Defined at module scope for the same reason
  // CharacterFlowNode is -- React Flow keys edgeTypes by reference, so a
  // fresh function every render would remount every edge.
  function RelationshipFlowEdge(props) {
    if (!ReactFlowGetBezierPath || !ReactFlowBaseEdge) {
      return null;
    }
    var pathResult = ReactFlowGetBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition
    });
    var edgePath = pathResult[0];
    var labelX = pathResult[1];
    var labelY = pathResult[2];
    var relationshipData = props.data || {};
    var color = relationshipData.color || "#8a8f99";
    var decorativeRenderer = DECORATIVE_EDGE_RENDERERS[relationshipData.style];

    // A real, mounted (but invisible) copy of the path is what lets
    // decorative renderers call getTotalLength()/getPointAtLength() -- the
    // Web Platform doesn't expose that geometry any other way, and it's the
    // one thing every decorative style needs regardless of pattern. Measured
    // in an effect (needs the element to actually be in the DOM first), then
    // re-measured whenever the path shape or style changes.
    var measurePathRef = useRef(null);
    var _samplePoints = useState([]);
    var samplePoints = _samplePoints[0];
    var setSamplePoints = _samplePoints[1];

    // Reserved arc length at whichever end(s) actually carry an arrowhead --
    // an edge with no start marker shouldn't lose any decoration space for
    // nothing. Decorative elements are no longer stopped short of this zone
    // (see sampleEdgePathPoints); instead it's used to clip whichever
    // element lands nearest it, via decorationMarkerClip. Both terms come
    // from the shared constants above, so every decorative renderer stays in
    // sync from one place -- no renderer hardcodes its own end offset.
    var markerClip = {
      startBoundaryLen: props.markerStart ? (RELATIONSHIP_ARROW_MARKER_SIZE + MARKER_END_PADDING) : 0,
      endBoundaryLen: props.markerEnd ? (RELATIONSHIP_ARROW_MARKER_SIZE + MARKER_END_PADDING) : 0
    };

    useLayoutEffect(function () {
      if (!decorativeRenderer || !measurePathRef.current) {
        setSamplePoints(function (prev) { return prev.length ? [] : prev; });
        return;
      }
      var spacing = DECORATIVE_EDGE_SPACING[relationshipData.style] || 20;
      setSamplePoints(sampleEdgePathPoints(measurePathRef.current, spacing));
    }, [edgePath, relationshipData.style]);

    var dashArray = RELATIONSHIP_STYLE_DASHARRAY[relationshipData.style] || "none";
    var edgeStyle = Object.assign({
      stroke: color,
      strokeWidth: relationshipData.thickness || 2,
      // Decorative styles (chain/droplets) draw their own visual via
      // repeated elements below -- the underlying path stays in the DOM
      // (React Flow still uses it for the wide invisible interaction/hit
      // area) but is fully transparent so it doesn't show through the gaps
      // between links/droplets.
      strokeOpacity: decorativeRenderer ? 0 : 1,
      strokeDasharray: decorativeRenderer || dashArray === "none" ? undefined : dashArray
    }, props.style || {});

    return html`<g>
      <path ref=${measurePathRef} d=${edgePath} fill="none" stroke="none" style=${{ pointerEvents: "none" }} />
      <${ReactFlowBaseEdge}
        id=${props.id}
        path=${edgePath}
        style=${edgeStyle}
        markerStart=${props.markerStart}
        markerEnd=${props.markerEnd}
      />
      ${decorativeRenderer ? decorativeRenderer(samplePoints, color, props.id, markerClip) : null}
      ${renderRelationshipLabel(labelX, labelY, props.label)}
    </g>`;
  }

  var FLOW_EDGE_TYPES = { relationshipEdge: RelationshipFlowEdge };

  function relationshipEdgeMarker(kind, relationship) {
    // kind: "start" | "end". relationship.arrow is "start" | "end" | "both" | "none".
    var arrow = relationship.arrow || "none";
    var wantsMarker = arrow === "both" || arrow === kind;
    if (!wantsMarker || !ReactFlowMarkerType) {
      return undefined;
    }
    return { type: ReactFlowMarkerType.ArrowClosed, color: relationship.color || "#8a8f99", width: RELATIONSHIP_ARROW_MARKER_SIZE, height: RELATIONSHIP_ARROW_MARKER_SIZE };
  }

  // Small inline preview of a relationship's line -- same color/style/arrow
  // metadata RelationshipFlowEdge renders on the canvas, just as a compact
  // static swatch for a list card instead of a live canvas path.
  function relationshipPreviewSvg(relationship) {
    var color = relationship.color || "#8a8f99";
    var dash = RELATIONSHIP_STYLE_DASHARRAY[relationship.style] || "none";
    var arrow = relationship.arrow || "none";
    var showStart = arrow === "start" || arrow === "both";
    var showEnd = arrow === "end" || arrow === "both";
    var linecap = relationship.style === "droplets" ? "round" : "butt";
    return html`<svg className="relationship-card-preview" viewBox="0 0 64 16" width="64" height="16" aria-hidden="true">
      ${showStart ? html`<polygon points="10,8 16,4 16,12" fill=${color} />` : null}
      <line
        x1=${showStart ? 15 : 4}
        y1="8"
        x2=${showEnd ? 49 : 60}
        y2="8"
        stroke=${color}
        strokeWidth=${Math.max(1, Math.min(4, relationship.thickness || 2))}
        strokeDasharray=${dash === "none" ? null : dash}
        strokeLinecap=${linecap}
      />
      ${showEnd ? html`<polygon points="54,8 48,4 48,12" fill=${color} />` : null}
    </svg>`;
  }

  // Bridges a type definition's own fields (arrow: boolean, bidirectional:
  // boolean) into the "start"/"end"/"both"/"none" shape relationshipPreviewSvg
  // and the relationship-level `arrow` field both already expect.
  function relationshipTypeArrowValue(typeItem) {
    if (!typeItem || !typeItem.arrow) {
      return "none";
    }
    return typeItem.bidirectional ? "both" : "end";
  }

  function relationshipTypeSummaryText(typeItem) {
    if (!typeItem) {
      return "";
    }
    var styleName = String(typeItem.style || "solid");
    var parts = [styleName.charAt(0).toUpperCase() + styleName.slice(1), "Width " + (typeItem.width || 2)];
    if (typeItem.animated) {
      parts.push("Animated");
    }
    if (typeItem.arrow) {
      parts.push((typeItem.bidirectional ? "↔" : "→") + " Arrow");
    }
    return parts.join(" • ");
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

    var _focused = useState(data.characters[0] ? data.characters[0].id : null);
    var focusedId = _focused[0];
    var setFocusedId = _focused[1];

    var _search = useState("");
    var search = _search[0];
    var setSearch = _search[1];

    var _sort = useState("name");
    var sortMode = _sort[0];
    var setSortMode = _sort[1];

    var _characterView = useState("directory");
    var characterView = _characterView[0];
    var setCharacterView = _characterView[1];

    var _workspaceMode = useState("map");
    var workspaceMode = _workspaceMode[0];
    var setWorkspaceMode = _workspaceMode[1];

    var _timelineExpandedIndex = useState(null);
    var timelineExpandedIndex = _timelineExpandedIndex[0];
    var setTimelineExpandedIndex = _timelineExpandedIndex[1];

    // Draft state for the relationship editor panel (create or edit). Only
    // written to `data.relationships` -- and thus persisted via
    // RelationshipService -- when the user explicitly saves.
    var _relationshipEditor = useState(null);
    var relationshipEditor = _relationshipEditor[0];
    var setRelationshipEditor = _relationshipEditor[1];

    // "Add Character to Map" picker state.
    var _addCharacterOpen = useState(false);
    var addCharacterOpen = _addCharacterOpen[0];
    var setAddCharacterOpen = _addCharacterOpen[1];

    var _addCharacterSearch = useState("");
    var addCharacterSearch = _addCharacterSearch[0];
    var setAddCharacterSearch = _addCharacterSearch[1];

    // Relationships tab filters. Purely a view-state concern -- nothing here
    // touches the relationship data model, RelationshipService or the editor.
    var _relationshipSearch = useState("");
    var relationshipSearch = _relationshipSearch[0];
    var setRelationshipSearch = _relationshipSearch[1];

    var _relationshipCategoryFilter = useState("all");
    var relationshipCategoryFilter = _relationshipCategoryFilter[0];
    var setRelationshipCategoryFilter = _relationshipCategoryFilter[1];

    var _relationshipTypeFilter = useState("all");
    var relationshipTypeFilter = _relationshipTypeFilter[0];
    var setRelationshipTypeFilter = _relationshipTypeFilter[1];

    var _relationshipCharacterFilter = useState("all");
    var relationshipCharacterFilter = _relationshipCharacterFilter[0];
    var setRelationshipCharacterFilter = _relationshipCharacterFilter[1];

    // Which sub-view the Relationships tab is showing -- "list" (the
    // default relationship cards) or "manage-types" (the Relationship Type
    // Manager). Purely a view-state toggle within the same tab; it doesn't
    // touch activePanel so the tool-rail's "Relationships" icon stays
    // highlighted in both sub-views.
    var _relationshipsView = useState("list");
    var relationshipsView = _relationshipsView[0];
    var setRelationshipsView = _relationshipsView[1];

    // Whether a connection is actively being dragged from/to a handle right
    // now -- purely a CSS hook (see the "rf-connecting" class on the
    // <ReactFlow> root below) so every handle on the canvas stays visible
    // for the duration of the drag, not just the one node currently
    // hovered. Handles are otherwise hidden until hover; this is what keeps
    // them from vanishing mid-drag the instant the pointer leaves the
    // source node.
    var _isConnectingRelationship = useState(false);
    var isConnectingRelationship = _isConnectingRelationship[0];
    var setIsConnectingRelationship = _isConnectingRelationship[1];

    function handleFlowConnectStart() {
      setIsConnectingRelationship(true);
    }

    function handleFlowConnectEnd() {
      setIsConnectingRelationship(false);
    }

    // Which single relationship type (if any) is currently expanded into
    // its inline editor within the Type Manager, and the unsaved draft of
    // its fields. Mirrors the same draft-then-commit pattern already used
    // for the per-relationship editor (relationshipEditor / saveRelationship
    // Editor) so Cancel can discard edits without ever touching `data`.
    var _editingRelationshipType = useState(null);
    var editingRelationshipType = _editingRelationshipType[0];
    var setEditingRelationshipType = _editingRelationshipType[1];

    // React Flow owns node/edge rendering, dragging, zooming, panning and
    // selection. These are React Flow's own local view-state hooks, seeded
    // from `data.characters`/`data.relationships` and re-synced whenever
    // that canonical data changes (see the useEffects below).
    var _flowNodes = useFlowNodesState([]);
    var flowNodes = _flowNodes[0];
    var setFlowNodes = _flowNodes[1];
    var onFlowNodesChange = _flowNodes[2];

    var _flowEdges = useFlowEdgesState([]);
    var flowEdges = _flowEdges[0];
    var setFlowEdges = _flowEdges[1];
    var onFlowEdgesChange = _flowEdges[2];

    var reactFlowInstance = useReactFlowInstance ? useReactFlowInstance() : null;

    var _zoomPercent = useState(58);
    var zoomPercent = _zoomPercent[0];
    var setZoomPercent = _zoomPercent[1];

    var directoryListRef = useRef(null);
    var directoryScrollRef = useRef(0);
    var previousPanelRef = useRef(activePanel);
    var profileReturnRef = useRef({ panel: "characters", characterView: "details" });
    var characterSyncChannelRef = useRef(null);
    var characterSyncSourceRef = useRef("relationship-map-" + Date.now() + "-" + Math.floor(Math.random() * 100000));
    var storageWriteErrorRef = useRef(false);

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

    function togglePanel(panelKey) {
      setActivePanel(function (current) {
        return current === panelKey ? null : panelKey;
      });
    }

    // Relationship create/edit/delete. All of these only ever call setData;
    // the persistence effect below is what actually writes the change,
    // exclusively through RelationshipService.saveAll -- this map never
    // owns relationship persistence itself.
    function openRelationshipEditorFor(relationship, isNew) {
      setRelationshipEditor({
        id: relationship.id,
        from: relationship.from,
        to: relationship.to,
        categoryId: relationship.categoryId,
        typeId: relationship.typeId,
        label: relationship.displayLabel || relationship.label || "",
        description: relationship.description || "",
        gmNotes: relationship.gmNotes || "",
        sourceHandle: relationship.sourceHandle || null,
        targetHandle: relationship.targetHandle || null,
        isNew: Boolean(isNew)
      });
      setActivePanel("relationship-editor");
    }

    function closeRelationshipEditor() {
      setRelationshipEditor(null);
      setActivePanel(null);
    }

    function handleFlowConnect(connection) {
      if (!connection || !connection.source || !connection.target || connection.source === connection.target) {
        return;
      }
      var fallback = relationshipTypeDefaultsFromCategory(data.relationshipCategories, null, null);
      openRelationshipEditorFor({
        id: makeRelationshipUiId("rel"),
        from: connection.source,
        to: connection.target,
        categoryId: fallback.categoryId,
        typeId: fallback.typeId,
        displayLabel: fallback.displayLabel,
        // Remember exactly which handle the user dragged from/to so the
        // edge reattaches to that same handle instead of React Flow's
        // default (the first-declared handle, which happens to be "top").
        sourceHandle: connection.sourceHandle || null,
        targetHandle: connection.targetHandle || null
      }, true);
    }

    function onFlowEdgeClick(event, edge) {
      var relationship = data.relationships.find(function (entry) { return entry.id === edge.id; });
      if (relationship) {
        openRelationshipEditorFor(relationship, false);
      }
    }

    function saveRelationshipEditor() {
      if (!relationshipEditor) {
        return;
      }
      var normalized = normalizeRelationships([{
        id: relationshipEditor.id,
        from: relationshipEditor.from,
        to: relationshipEditor.to,
        categoryId: relationshipEditor.categoryId,
        typeId: relationshipEditor.typeId,
        displayLabel: String(relationshipEditor.label || "").trim(),
        description: relationshipEditor.description,
        gmNotes: relationshipEditor.gmNotes,
        sourceHandle: relationshipEditor.sourceHandle || null,
        targetHandle: relationshipEditor.targetHandle || null
      }], data.relationshipCategories)[0];

      setData(function (prev) {
        var next = clone(prev);
        var index = next.relationships.findIndex(function (entry) { return entry.id === normalized.id; });
        if (index >= 0) {
          next.relationships[index] = normalized;
        } else {
          next.relationships = next.relationships.concat([normalized]);
        }
        return next;
      });
      closeRelationshipEditor();
    }

    // Shared by the editor's own Delete button and the Relationships tab's
    // per-card Delete action -- same setData call either way, so there's
    // exactly one place that removes a relationship from `data`.
    function removeRelationship(id) {
      setData(function (prev) {
        var next = clone(prev);
        next.relationships = next.relationships.filter(function (entry) { return entry.id !== id; });
        return next;
      });
    }

    function deleteRelationshipEditor() {
      if (!relationshipEditor) {
        return;
      }
      removeRelationship(relationshipEditor.id);
      closeRelationshipEditor();
    }

    function deleteRelationshipFromCard(relationship, event) {
      if (event) {
        event.stopPropagation();
      }
      var fromCharacter = data.characters.find(function (c) { return c.id === relationship.from; });
      var toCharacter = data.characters.find(function (c) { return c.id === relationship.to; });
      var label = (fromCharacter ? fromCharacter.name : "Unknown") + " → " + (toCharacter ? toCharacter.name : "Unknown");
      if (!window.confirm("Delete relationship \"" + label + "\"? This cannot be undone.")) {
        return;
      }
      removeRelationship(relationship.id);
      if (relationshipEditor && relationshipEditor.id === relationship.id) {
        closeRelationshipEditor();
      }
    }

    // Relationship Type Manager mutators. Every one of these re-runs the
    // full category list through normalizeRelationshipCategories before
    // writing it to `data` -- the exact same normalization the app already
    // uses on load and in the relationship editor, so a raw/partial edit
    // (e.g. a brand-new category with no `types` yet) always comes out the
    // other side fully validated (safe hex colors, clamped width, a
    // guaranteed-non-empty types array, etc.) with zero new validation
    // logic. Persistence is already automatic: relationshipCategories lives
    // in `data`, and the existing persistStateToIndexedDb effect sweeps
    // anything in `data` besides characters/relationships/zones into
    // MapLayoutService.savePreferences on every change.
    function updateRelationshipCategories(mutator) {
      setData(function (prev) {
        var next = clone(prev);
        var categories = clone(next.relationshipCategories || []);
        var mutated = mutator(categories) || categories;
        next.relationshipCategories = normalizeRelationshipCategories(mutated);
        return next;
      });
    }

    function addRelationshipCategory() {
      updateRelationshipCategories(function (categories) {
        return categories.concat([{ name: "New Category" }]);
      });
    }

    function renameRelationshipCategory(categoryId, name) {
      updateRelationshipCategories(function (categories) {
        return categories.map(function (category) {
          return category.id === categoryId ? Object.assign({}, category, { name: name }) : category;
        });
      });
    }

    function recolorRelationshipCategory(categoryId, color) {
      updateRelationshipCategories(function (categories) {
        return categories.map(function (category) {
          return category.id === categoryId ? Object.assign({}, category, { color: color }) : category;
        });
      });
    }

    function deleteRelationshipCategory(categoryId, categoryName) {
      var inUse = (data.relationships || []).some(function (relationship) { return relationship.categoryId === categoryId; });
      var warning = "Delete category \"" + (categoryName || "Untitled") + "\" and all its relationship types?" +
        (inUse ? " Existing relationships using it will fall back to the default category on next save." : "") +
        " This cannot be undone.";
      if (!window.confirm(warning)) {
        return;
      }
      updateRelationshipCategories(function (categories) {
        return categories.filter(function (category) { return category.id !== categoryId; });
      });
    }

    function addRelationshipType(categoryId) {
      updateRelationshipCategories(function (categories) {
        return categories.map(function (category) {
          if (category.id !== categoryId) {
            return category;
          }
          var types = (category.types || []).concat([{ name: "New Type" }]);
          return Object.assign({}, category, { types: types });
        });
      });
    }

    function updateRelationshipType(categoryId, typeId, field, value) {
      updateRelationshipCategories(function (categories) {
        return categories.map(function (category) {
          if (category.id !== categoryId) {
            return category;
          }
          var types = (category.types || []).map(function (typeItem) {
            if (typeItem.id !== typeId) {
              return typeItem;
            }
            var patch = {};
            patch[field] = value;
            return Object.assign({}, typeItem, patch);
          });
          return Object.assign({}, category, { types: types });
        });
      });
    }

    function deleteRelationshipType(categoryId, typeId, typeName) {
      var inUse = (data.relationships || []).some(function (relationship) { return relationship.typeId === typeId; });
      var warning = "Delete relationship type \"" + (typeName || "Untitled") + "\"?" +
        (inUse ? " Existing relationships using it will fall back to a default type on next save." : "") +
        " This cannot be undone.";
      if (!window.confirm(warning)) {
        return;
      }
      updateRelationshipCategories(function (categories) {
        return categories.map(function (category) {
          if (category.id !== categoryId) {
            return category;
          }
          return Object.assign({}, category, { types: (category.types || []).filter(function (typeItem) { return typeItem.id !== typeId; }) });
        });
      });
      if (editingRelationshipType && editingRelationshipType.typeId === typeId) {
        setEditingRelationshipType(null);
      }
    }

    // Inline type editor: expand/collapse, edit the draft, commit or discard.
    // Only one type can be mid-edit at a time since it's a single state
    // value, not per-row -- opening a new one implicitly closes any other.
    function startEditRelationshipType(categoryId, typeItem) {
      setEditingRelationshipType({ categoryId: categoryId, typeId: typeItem.id, draft: clone(typeItem) });
    }

    function cancelEditRelationshipType() {
      setEditingRelationshipType(null);
    }

    function updateEditingRelationshipTypeField(field, value) {
      setEditingRelationshipType(function (prev) {
        if (!prev) {
          return prev;
        }
        var patch = {};
        patch[field] = value;
        return Object.assign({}, prev, { draft: Object.assign({}, prev.draft, patch) });
      });
    }

    function saveEditingRelationshipType() {
      if (!editingRelationshipType) {
        return;
      }
      var categoryId = editingRelationshipType.categoryId;
      var typeId = editingRelationshipType.typeId;
      var draft = editingRelationshipType.draft;
      updateRelationshipCategories(function (categories) {
        return categories.map(function (category) {
          if (category.id !== categoryId) {
            return category;
          }
          var types = (category.types || []).map(function (typeItem) {
            return typeItem.id === typeId ? Object.assign({}, typeItem, draft, { id: typeId }) : typeItem;
          });
          return Object.assign({}, category, { types: types });
        });
      });
      setEditingRelationshipType(null);
    }

    // Add/remove characters from the map. Neither operation touches
    // CharacterService -- adding never creates a character record, and
    // removing only deletes this map's own layout entry for it.
    function openAddCharacterModal() {
      setAddCharacterSearch("");
      setAddCharacterOpen(true);
    }

    function closeAddCharacterModal() {
      setAddCharacterOpen(false);
    }

    function addCharacterToMap(characterId) {
      setData(function (prev) {
        var next = clone(prev);
        var target = next.characters.find(function (character) { return character.id === characterId; });
        if (!target || target.onMap) {
          return prev;
        }
        var position = nextMapPosition(next.characters);
        target.onMap = true;
        target.hidden = false;
        target.x = position.x;
        target.y = position.y;
        return next;
      });
      closeAddCharacterModal();
    }

    function removeCharacterFromMap(characterId) {
      setData(function (prev) {
        var next = clone(prev);
        var target = next.characters.find(function (character) { return character.id === characterId; });
        if (target) {
          target.onMap = false;
          delete target.x;
          delete target.y;
        }
        return next;
      });
      mapLayoutService.deleteNodeLayout(characterId).catch(function () { return null; });
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
          return;
        }

        if (message.type === "characters-snapshot" && Array.isArray(message.characters)) {
          setData(function (prev) {
            var next = clone(prev);
            // The Characters page broadcasts its own CharacterService-sourced
            // records, which never carry this map's view-state fields
            // (onMap/x/y/hidden/outlineColor/nodeSize/nodeShape -- those are
            // MapLayoutService's alone). Re-apply each character's existing
            // view-state on top of the incoming snapshot so an already-open
            // map tab doesn't lose track of who's on the map -- and doesn't
            // start reporting mapped characters as available -- every time
            // another tab creates or deletes a character.
            var previousById = {};
            next.characters.forEach(function (entry) { previousById[entry.id] = entry; });
            next.characters = message.characters.map(function (incomingCharacter) {
              var normalized = normalizeCharacterRecord(incomingCharacter);
              var existing = previousById[normalized.id];
              return existing ? Object.assign({}, normalized, {
                onMap: existing.onMap,
                hidden: existing.hidden,
                x: existing.x,
                y: existing.y,
                outlineColor: existing.outlineColor,
                nodeSize: existing.nodeSize,
                nodeShape: existing.nodeShape
              }) : normalized;
            });
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
      }
      previousPanelRef.current = activePanel;
    }, [activePanel]);

    useEffect(function () {
      function onKey(event) {
        if (isEditableElement(document.activeElement)) {
          return;
        }
        if (event.key === "Escape") {
          setRelationshipEditor(null);
          setAddCharacterOpen(false);
          setActivePanel(null);
        }
      }
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("keydown", onKey);
      };
    }, []);

    // Re-sync React Flow's local nodes/edges whenever the canonical data
    // changes (initial load, cross-tab sync, or a committed drag). During an
    // in-progress drag, React Flow tracks position locally via
    // `onFlowNodesChange` -- this effect does not run mid-drag.
    useEffect(function () {
      setFlowNodes(function () {
        return (data.characters || []).filter(function (character) {
          return character.onMap && !character.hidden;
        }).map(function (character) {
          var nodeSize = typeof character.nodeSize === "number" ? character.nodeSize : 1;
          return {
            id: character.id,
            type: "characterNode",
            position: {
              x: typeof character.x === "number" ? character.x : 0,
              y: typeof character.y === "number" ? character.y : 0
            },
            style: { width: 130 * nodeSize },
            data: { character: character }
          };
        });
      });
    }, [data.characters]);

    // A relationship only renders as an edge once both characters it
    // references are on the map -- removing a character from the map hides
    // (but never deletes) any relationship attached to it. It reappears
    // automatically as soon as that character is added back.
    useEffect(function () {
      var onMapIds = {};
      (data.characters || []).forEach(function (character) {
        if (character.onMap) {
          onMapIds[character.id] = true;
        }
      });
      setFlowEdges(function () {
        return (data.relationships || []).filter(function (relationship) {
          return onMapIds[relationship.from] && onMapIds[relationship.to];
        }).map(function (relationship) {
          // Visual styling (color/thickness/style/animated/arrow/decoration)
          // always comes fresh from the relationship's type -- never from
          // fields cached on the relationship itself -- so editing a type
          // immediately updates every relationship using it. See
          // resolveRelationshipVisuals.
          var resolved = resolveRelationshipVisuals(relationship, data.relationshipCategories);
          return {
            id: relationship.id,
            source: relationship.from,
            target: relationship.to,
            // Existing relationships saved before per-handle tracking existed
            // simply have no sourceHandle/targetHandle -- React Flow falls
            // back to its own default in that case, which is fine since they
            // never had a specific handle to preserve.
            sourceHandle: relationship.sourceHandle || undefined,
            targetHandle: relationship.targetHandle || undefined,
            label: resolved.displayLabel || resolved.type || "",
            type: "relationshipEdge",
            animated: Boolean(resolved.animated),
            data: {
              color: resolved.color,
              thickness: resolved.thickness,
              style: resolved.style
            },
            markerStart: relationshipEdgeMarker("start", resolved),
            markerEnd: relationshipEdgeMarker("end", resolved)
          };
        });
      });
    }, [data.relationships, data.characters, data.relationshipCategories]);

    function onNodeDragStop(event, node) {
      setData(function (prev) {
        var next = clone(prev);
        var target = next.characters.find(function (character) { return character.id === node.id; });
        if (target) {
          target.x = node.position.x;
          target.y = node.position.y;
        }
        return next;
      });
    }

    // React Flow's own click-to-select toggle doesn't fire a "select"
    // NodeChange for this node type/config (onNodeClick reliably fires, but
    // no accompanying select change ever reaches onNodesChange -- confirmed
    // by instrumenting it directly). Setting `selected` on flowNodes here
    // is what actually drives the node's `.selected` styling and the
    // toolbar's "Selected N" count.
    function onFlowNodeClick(event, node) {
      setFocusedId(node.id);
      setFlowNodes(function (nodes) {
        return nodes.map(function (entry) {
          return entry.selected === (entry.id === node.id) ? entry : Object.assign({}, entry, { selected: entry.id === node.id });
        });
      });
    }

    function onFlowPaneClick() {
      setFlowNodes(function (nodes) {
        return nodes.some(function (entry) { return entry.selected; })
          ? nodes.map(function (entry) { return entry.selected ? Object.assign({}, entry, { selected: false }) : entry; })
          : nodes;
      });
    }

    function onFlowNodeDoubleClick(event, node) {
      setFocusedId(node.id);
      setActivePanel("characters");
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

    var focused = data.characters.find(function (c) { return c.id === focusedId; }) || null;

    function panelHeader(title) {
      return html`<div className="panel-header">
        <h2>${title}</h2>
        ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
      </div>`;
    }

    function openCharacterProfile() {
      if (!focused) {
        return;
      }
      profileReturnRef.current = {
        panel: activePanel || "characters",
        characterView: characterView || "details"
      };
      setWorkspaceMode("profile");
    }

    function returnFromCharacterProfile() {
      var restore = profileReturnRef.current || { panel: "characters", characterView: "details" };
      setWorkspaceMode("map");
      setActivePanel(restore.panel || "characters");
      setCharacterView(restore.characterView || "details");
    }

    function renderAddCharacterModal() {
      if (!addCharacterOpen) {
        return null;
      }
      var query = addCharacterSearch.trim().toLowerCase();
      var candidates = (data.characters || []).filter(function (character) { return !character.onMap; });
      if (query) {
        candidates = candidates.filter(function (character) {
          return String(character.name || "").toLowerCase().indexOf(query) >= 0;
        });
      }
      candidates = candidates.slice().sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      return html`<div className="tag-edit-dialog-backdrop" onClick=${closeAddCharacterModal}>
        <div className="tag-edit-dialog" onClick=${function (event) { event.stopPropagation(); }}>
          <header className="tag-edit-dialog-header"><h3>Add Character to Map</h3></header>
          <div className="tag-edit-dialog-body">
            <label>Search</label>
            <input type="text" value=${addCharacterSearch} onInput=${function (e) { setAddCharacterSearch(e.target.value); }} placeholder="Search characters..." />
            <div className="char-list">
              ${!candidates.length ? html`<p className="hint">${(data.characters || []).length ? "All characters are already on the map." : "No characters found. Add characters from the Characters page first."}</p>` : null}
              ${candidates.map(function (character) {
                return html`<div className="char-card" key=${"add-char-" + character.id} onClick=${function () { addCharacterToMap(character.id); }}>
                  <div className="character-summary-portrait-frame compact">
                    <img className="character-summary-portrait media" src=${portraitState(character).src} alt=${character.name} style=${portraitMediaStyle(character)} />
                  </div>
                  <strong>${character.name}</strong>
                </div>`;
              })}
            </div>
          </div>
          <footer className="tag-edit-dialog-actions">
            <button type="button" onClick=${closeAddCharacterModal}>Close</button>
          </footer>
        </div>
      </div>`;
    }

    function charactersPanel() {
      var list = characterList();

      function openCharacterDetails(characterId) {
        if (directoryListRef.current) {
          directoryScrollRef.current = directoryListRef.current.scrollTop;
        }
        setFocusedId(characterId);
        setCharacterView("details");
      }

      function backToDirectory() {
        setCharacterView("directory");
        window.requestAnimationFrame(function () {
          if (directoryListRef.current) {
            directoryListRef.current.scrollTop = directoryScrollRef.current;
          }
        });
      }

      function renderDirectoryView() {
        return html`<div key="directory" className="character-view character-view-directory">
          <div className="panel-header">
            <h2>Character Directory</h2>
            ${IconButton({ onClick: function () { setActivePanel(null); }, ariaLabel: "Close panel", icon: "×", className: "icon-button-32 panel-close-button" })}
          </div>
          <div className="panel-body character-directory-body">
            <div className="character-directory-controls">
              <input placeholder="Search" value=${search} onInput=${function (e) { setSearch(e.target.value); }} />
              <button>Filter</button>
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
                ${character.onMap
                  ? html`<button className="destructive" onClick=${function () { removeCharacterFromMap(character.id); }}>Remove from Map</button>`
                  : html`<button onClick=${function () { addCharacterToMap(character.id); }}>Add to Map</button>`}
              </div>
            </div>
          </section>

          <section className="details-section">
            <h4 className="details-section-title">Biography Preview</h4>
            <div className="character-bio-card">
              <div className="bio-preview-scroll">
                <div className="character-rich-text" dangerouslySetInnerHTML=${{ __html: biographyHtml }}></div>
              </div>
              <button className="bio-preview-action" onClick=${function () { openCharacterProfile(); }}>Read Full Biography</button>
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
        return html`<div key=${"details-read-" + focused.id} className="character-view character-view-details mode-read">
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

      return html`${characterView === "directory" ? renderDirectoryView() : renderDetailsView()}`;
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

      if (SharedCharacterProfileWorkspace) {
        return html`<${SharedCharacterProfileWorkspace}
          character=${focused}
          characters=${data.characters}
          relationships=${data.relationships}
          editable=${false}
          onRequestClose=${returnFromCharacterProfile}
          onOpenStoryNote=${function (note) {
            var focus = encodeURIComponent(String((note && note.focusText) || (note && note.title) || ""));
            window.location.href = "gm-notes.html?focus=" + focus;
          }}
        />`;
      }

      var linked = data.relationships.filter(function (r) { return r.from === focused.id || r.to === focused.id; }).map(function (r) {
        return resolveRelationshipVisuals(r, data.relationshipCategories);
      });
      var profileSectIcon = resolveSectIcon(focused.sect);
      var profileClanIcon = resolveClanIcon(focused.clan);
      var profileRecord = normalizeCharacterRecord(focused);
      var timelineDisplayEvents = timelineEventsForDisplay(profileRecord.timeline || [], profileRecord.dateOfBirth, profileRecord.dateOfDeath);

      function sidebarField(label, key, multiline, inputType) {
        var value = profileRecord[key] || "";
        var displayValue = (inputType === "date") ? formatDisplayDate(value) : value;
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

      return html`<section className="character-profile-page">
        <div className="profile-dossier-shell">
        <div className="profile-content-container">
        <header className="profile-header">
          <div className="profile-header-main">
            <div className="profile-portrait-shell">
              <img className="profile-portrait-image" src=${portraitState(profileRecord).src} alt=${profileRecord.name} style=${portraitMediaStyle(profileRecord)} />
            </div>
            <div className="profile-title-block">
              <h1>${profileRecord.name}</h1>
              <p className="profile-subtitle">Character Profile</p>
            </div>
          </div>
          <div className="profile-header-controls">
            ${IconButton({ onClick: returnFromCharacterProfile, ariaLabel: "Close biography view", icon: "×", className: "icon-button-34 profile-close-button" })}
          </div>
        </header>

        <div className="profile-layout">
          <main className="profile-main-column">
            <article className="profile-biography">
              <div className="profile-biography-head">
                <h3>Biography</h3>
              </div>
              ${SharedBiographyWorkspace
                ? html`<${SharedBiographyWorkspace}
                    editable=${false}
                    value=${String(characterBiographyHtml(profileRecord) || "")}
                    viewerClassName="profile-biography-content character-rich-text"
                  />`
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
              <div className="timeline-log">
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
                        <p className="timeline-log-title-row"><strong>${label}</strong><span className="timeline-system-badge">System Event</span></p>
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
                        <p className="timeline-log-title-row"><strong>${label}</strong></p>
                        ${isExpanded ? html`<p className="timeline-log-date">${item.date ? formatDisplayDate(item.date) : "Unknown Date"}</p>` : null}
                        ${isExpanded ? (item.description
                          ? html`<p className="timeline-log-description">${item.description}</p>`
                          : html`<p className="timeline-log-description hint">No description provided.</p>`) : null}
                      </div>
                    </div>`}
                  </article>`;
                }) : html`<p className="hint">No timeline entries yet.</p>`}
              </div>
            </section>

            <section className="profile-section">
              <h3>Storyteller Notes</h3>
              <p>${profileRecord.storytellerNotes || "No storyteller notes yet."}</p>
            </section>

            <section className="profile-section gm-only">
              <h3>GM-Only Information</h3>
              <p>${profileRecord.gmOnlyInformation || "No GM-only notes yet."}</p>
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

    // Zones and Tags retain their toolbar entry points and panel shell, but
    // zone drawing and tag management are not implemented in this
    // rendering-engine phase -- these panels show a static placeholder.
    function inertPanel(title, message) {
      return html`<div className="character-view">
        ${panelHeader(title)}
        <div className="panel-body">
          <div className="card"><p className="hint">${message}</p></div>
        </div>
      </div>`;
    }

    function zonesPanel() {
      return inertPanel("Zones", "Zone editing isn't available yet in this rendering engine.");
    }

    function tagsPanel() {
      return inertPanel("Tags", "Tag management isn't available yet in this rendering engine.");
    }

    function relationshipTypeManagerPanel() {
      var categories = data.relationshipCategories || [];

      return html`<div className="character-view">
        ${panelHeader("Relationships")}
        <div className="panel-body relationship-type-manager">
          <button type="button" className="relationship-toolbar-action relationship-type-manager-back" onClick=${function () { setRelationshipsView("list"); }}>← Back to Relationships</button>
          <h3 className="relationship-type-manager-title">Relationship Types</h3>

          ${categories.map(function (category) {
            return html`<div className="rtm-category" key=${"rtm-cat-" + category.id}>
              <div className="rtm-category-header">
                <input
                  type="text"
                  className="rtm-category-name"
                  value=${category.name}
                  onInput=${function (e) { renameRelationshipCategory(category.id, e.target.value); }}
                  placeholder="Category name"
                />
                <input
                  type="color"
                  className="rtm-color-input"
                  value=${category.color}
                  onInput=${function (e) { recolorRelationshipCategory(category.id, e.target.value); }}
                  title="Category color"
                />
                <button type="button" className="relationship-card-action-btn destructive" onClick=${function () { deleteRelationshipCategory(category.id, category.name); }}>Delete Category</button>
              </div>

              <div className="rtm-types-list">
                ${(category.types || []).map(function (typeItem) {
                  var isEditing = Boolean(editingRelationshipType) && editingRelationshipType.categoryId === category.id && editingRelationshipType.typeId === typeItem.id;

                  if (isEditing) {
                    var draft = editingRelationshipType.draft;
                    var draftPreviewShape = { color: draft.color, style: draft.style, thickness: draft.width, arrow: relationshipTypeArrowValue(draft) };
                    return html`<div className="rtm-type-card rtm-type-card-editing" key=${"rtm-type-" + typeItem.id}>
                      <label className="rtm-field-label">Type Name</label>
                      <input type="text" value=${draft.name} onInput=${function (e) { updateEditingRelationshipTypeField("name", e.target.value); }} placeholder="Type name" />

                      <label className="rtm-field-label">Display Label</label>
                      <input type="text" value=${draft.label} onInput=${function (e) { updateEditingRelationshipTypeField("label", e.target.value); }} placeholder="Shown on the map" />

                      <div className="rtm-field-row">
                        <div className="rtm-field-col">
                          <label className="rtm-field-label">Color</label>
                          <input type="color" className="rtm-color-input" value=${draft.color} onInput=${function (e) { updateEditingRelationshipTypeField("color", e.target.value); }} />
                        </div>
                        <div className="rtm-field-col">
                          <label className="rtm-field-label">Width</label>
                          <input type="number" className="rtm-width-input" min="1" max="8" value=${draft.width} onInput=${function (e) { updateEditingRelationshipTypeField("width", Number(e.target.value)); }} />
                        </div>
                        <div className="rtm-field-col rtm-field-col-grow">
                          <label className="rtm-field-label">Line Style</label>
                          <select className="rtm-style-select" value=${draft.style} onChange=${function (e) { updateEditingRelationshipTypeField("style", e.target.value); }}>
                            ${RELATIONSHIP_TYPE_STYLE_OPTIONS.map(function (styleOption) {
                              return html`<option key=${"rtm-style-" + typeItem.id + "-" + styleOption} value=${styleOption}>${styleOption}</option>`;
                            })}
                          </select>
                        </div>
                      </div>

                      <div className="rtm-toggle-row">
                        <label className="rtm-checkbox-label">
                          <input type="checkbox" checked=${Boolean(draft.animated)} onChange=${function (e) { updateEditingRelationshipTypeField("animated", e.target.checked); }} />
                          Animated
                        </label>
                        <label className="rtm-checkbox-label">
                          <input type="checkbox" checked=${Boolean(draft.arrow)} onChange=${function (e) { updateEditingRelationshipTypeField("arrow", e.target.checked); }} />
                          Arrow
                        </label>
                        <label className="rtm-checkbox-label">
                          <input type="checkbox" checked=${Boolean(draft.bidirectional)} onChange=${function (e) { updateEditingRelationshipTypeField("bidirectional", e.target.checked); }} />
                          Bidirectional
                        </label>
                      </div>

                      <div className="rtm-type-editor-preview">${relationshipPreviewSvg(draftPreviewShape)}</div>

                      <div className="rtm-type-editor-actions">
                        <button type="button" onClick=${saveEditingRelationshipType}>Save</button>
                        <button type="button" className="relationship-card-action-btn" onClick=${cancelEditRelationshipType}>Cancel</button>
                      </div>
                    </div>`;
                  }

                  return html`<div className="rtm-type-card" key=${"rtm-type-" + typeItem.id}>
                    <div className="rtm-type-summary-row">
                      <span className="rtm-type-color-dot" style=${{ background: typeItem.color }} aria-hidden="true"></span>
                      <span className="rtm-type-summary-name">${typeItem.name}</span>
                      <div className="rtm-type-summary-actions">
                        <button type="button" className="rtm-icon-btn" title="Edit" aria-label="Edit" onClick=${function () { startEditRelationshipType(category.id, typeItem); }}>✏</button>
                        <button type="button" className="rtm-icon-btn destructive" title="Delete" aria-label="Delete" onClick=${function () { deleteRelationshipType(category.id, typeItem.id, typeItem.name); }}>✕</button>
                      </div>
                    </div>
                    <p className="rtm-type-summary-style">${relationshipTypeSummaryText(typeItem)}</p>
                  </div>`;
                })}
                <button type="button" className="relationship-toolbar-action rtm-add-type" onClick=${function () { addRelationshipType(category.id); }}>+ New Type</button>
              </div>
            </div>`;
          })}

          <button type="button" className="relationship-toolbar-action rtm-add-category" onClick=${addRelationshipCategory}>+ New Category</button>
        </div>
      </div>`;
    }

    function relationshipsPanel() {
      if (relationshipsView === "manage-types") {
        return relationshipTypeManagerPanel();
      }

      var categories = data.relationshipCategories || [];
      // Cards render live-resolved visual data (color/style/thickness/arrow/
      // category/type name) rather than anything cached on the relationship
      // record, so an edited type is reflected immediately here too.
      var list = (data.relationships || []).map(function (relationship) {
        return resolveRelationshipVisuals(relationship, categories);
      });
      var characters = data.characters || [];
      var selectedCategoryForFilter = categories.find(function (c) { return c.id === relationshipCategoryFilter; });
      var typeFilterOptions = relationshipCategoryFilter === "all"
        ? categories.reduce(function (acc, category) { return acc.concat(category.types || []); }, [])
        : ((selectedCategoryForFilter && selectedCategoryForFilter.types) || []);

      function onCategoryFilterChange(value) {
        setRelationshipCategoryFilter(value);
        setRelationshipTypeFilter("all");
      }

      var query = relationshipSearch.trim().toLowerCase();
      var filteredList = list.filter(function (relationship) {
        var fromCharacter = characters.find(function (c) { return c.id === relationship.from; });
        var toCharacter = characters.find(function (c) { return c.id === relationship.to; });
        if (relationshipCategoryFilter !== "all" && relationship.categoryId !== relationshipCategoryFilter) {
          return false;
        }
        if (relationshipTypeFilter !== "all" && relationship.typeId !== relationshipTypeFilter) {
          return false;
        }
        if (relationshipCharacterFilter !== "all" && relationship.from !== relationshipCharacterFilter && relationship.to !== relationshipCharacterFilter) {
          return false;
        }
        if (query) {
          var haystack = [
            fromCharacter ? fromCharacter.name : "",
            toCharacter ? toCharacter.name : "",
            relationship.category || "",
            relationship.type || "",
            relationship.displayLabel || "",
            relationship.description || ""
          ].join(" ").toLowerCase();
          if (haystack.indexOf(query) < 0) {
            return false;
          }
        }
        return true;
      });

      var hasAnyRelationships = Boolean(list.length);
      var hasFiltersApplied = Boolean(query) || relationshipCategoryFilter !== "all" || relationshipTypeFilter !== "all" || relationshipCharacterFilter !== "all";

      return html`<div className="character-view">
        ${panelHeader("Relationships")}
        <div className="panel-body">
          <div className="relationship-toolbar">
            <button type="button" className="relationship-toolbar-action" onClick=${function () { setRelationshipsView("manage-types"); }}>Manage Types</button>
          </div>
          <div className="relationship-filter-bar">
            <input
              type="text"
              className="relationship-filter-search"
              value=${relationshipSearch}
              onInput=${function (e) { setRelationshipSearch(e.target.value); }}
              placeholder="Search relationships..."
            />
            <div className="relationship-filter-bar-selects">
              <select value=${relationshipCategoryFilter} onChange=${function (e) { onCategoryFilterChange(e.target.value); }}>
                <option value="all">All Categories</option>
                ${categories.map(function (category) {
                  return html`<option key=${"rel-filter-cat-" + category.id} value=${category.id}>${category.name}</option>`;
                })}
              </select>
              <select value=${relationshipTypeFilter} onChange=${function (e) { setRelationshipTypeFilter(e.target.value); }}>
                <option value="all">All Types</option>
                ${typeFilterOptions.map(function (typeItem) {
                  return html`<option key=${"rel-filter-type-" + typeItem.id} value=${typeItem.id}>${typeItem.name}</option>`;
                })}
              </select>
              <select value=${relationshipCharacterFilter} onChange=${function (e) { setRelationshipCharacterFilter(e.target.value); }}>
                <option value="all">All Characters</option>
                ${characters.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); }).map(function (character) {
                  return html`<option key=${"rel-filter-char-" + character.id} value=${character.id}>${character.name}</option>`;
                })}
              </select>
            </div>
          </div>

          ${!hasAnyRelationships ? html`<div className="card"><p className="hint">No relationships yet. Drag from one character node's handle to another on the canvas to create one.</p></div>` : null}
          ${hasAnyRelationships && !filteredList.length ? html`<div className="card"><p className="hint">${hasFiltersApplied ? "No relationships match the current filters." : "No relationships yet."}</p></div>` : null}

          ${filteredList.map(function (relationship) {
            var fromCharacter = characters.find(function (c) { return c.id === relationship.from; });
            var toCharacter = characters.find(function (c) { return c.id === relationship.to; });
            var description = String(relationship.description || "").trim();
            return html`<div className="relationship-card" key=${"rel-card-" + relationship.id} onClick=${function () { openRelationshipEditorFor(relationship, false); }}>
              <div className="relationship-card-connection">
                <span className="relationship-card-character relationship-card-character-from" title=${fromCharacter ? fromCharacter.name : "Unknown"}>${fromCharacter ? fromCharacter.name : "Unknown"}</span>
                <span className="relationship-card-preview-wrap">${relationshipPreviewSvg(relationship)}</span>
                <span className="relationship-card-character relationship-card-character-to" title=${toCharacter ? toCharacter.name : "Unknown"}>${toCharacter ? toCharacter.name : "Unknown"}</span>
              </div>
              <div className="relationship-card-meta">
                <p className="relationship-card-meta-line">
                  <span className="relationship-card-meta-label">Category:</span>
                  <span className="relationship-card-category">${relationship.category || "Uncategorized"}</span>
                </p>
                <p className="relationship-card-meta-line">
                  <span className="relationship-card-meta-label">Type:</span>
                  <span className="relationship-card-type">${relationship.displayLabel || relationship.type || "Connection"}</span>
                </p>
                ${description ? html`<p className="relationship-card-meta-line relationship-card-description">
                  <span className="relationship-card-meta-label">Description:</span>
                  <span>${description}</span>
                </p>` : null}
              </div>
              <div className="relationship-card-actions">
                <button type="button" className="relationship-card-action-btn" onClick=${function (e) { e.stopPropagation(); openRelationshipEditorFor(relationship, false); }}>Edit</button>
                <button type="button" className="relationship-card-action-btn destructive" onClick=${function (e) { deleteRelationshipFromCard(relationship, e); }}>Delete</button>
              </div>
            </div>`;
          })}
        </div>
      </div>`;
    }

    function relationshipEditorPanel() {
      if (!relationshipEditor) {
        return inertPanel("Relationship", "No relationship selected.");
      }

      var categories = data.relationshipCategories || [];
      var selectedCategory = categories.find(function (c) { return c.id === relationshipEditor.categoryId; }) || categories[0];
      var typesForCategory = (selectedCategory && selectedCategory.types) || [];
      var fromCharacter = data.characters.find(function (c) { return c.id === relationshipEditor.from; });
      var toCharacter = data.characters.find(function (c) { return c.id === relationshipEditor.to; });

      function updateField(field, value) {
        setRelationshipEditor(function (prev) { return prev ? Object.assign({}, prev, { [field]: value }) : prev; });
      }

      function onCategoryChange(categoryId) {
        var category = categories.find(function (c) { return c.id === categoryId; }) || categories[0];
        var firstType = category && category.types && category.types[0];
        setRelationshipEditor(function (prev) {
          if (!prev) {
            return prev;
          }
          return Object.assign({}, prev, {
            categoryId: category ? category.id : prev.categoryId,
            typeId: firstType ? firstType.id : prev.typeId,
            label: firstType ? firstType.label : prev.label
          });
        });
      }

      function onTypeChange(typeId) {
        var type = typesForCategory.find(function (t) { return t.id === typeId; });
        setRelationshipEditor(function (prev) {
          if (!prev) {
            return prev;
          }
          return Object.assign({}, prev, { typeId: typeId, label: type ? type.label : prev.label });
        });
      }

      return html`<div className="character-view">
        ${panelHeader(relationshipEditor.isNew ? "New Relationship" : "Edit Relationship")}
        <div className="panel-body">
          <div className="card">
            <p className="hint">${fromCharacter ? fromCharacter.name : "Unknown"} → ${toCharacter ? toCharacter.name : "Unknown"}</p>

            <label>Category</label>
            <select value=${relationshipEditor.categoryId} onChange=${function (e) { onCategoryChange(e.target.value); }}>
              ${categories.map(function (category) {
                return html`<option key=${"rel-cat-" + category.id} value=${category.id}>${category.name}</option>`;
              })}
            </select>

            <label>Type</label>
            <select value=${relationshipEditor.typeId} onChange=${function (e) { onTypeChange(e.target.value); }}>
              ${typesForCategory.map(function (typeItem) {
                return html`<option key=${"rel-type-" + typeItem.id} value=${typeItem.id}>${typeItem.name}</option>`;
              })}
            </select>

            <label>Label</label>
            <input type="text" value=${relationshipEditor.label} onInput=${function (e) { updateField("label", e.target.value); }} placeholder="Displayed on the map" />

            <label>Description</label>
            <textarea rows="3" value=${relationshipEditor.description} onInput=${function (e) { updateField("description", e.target.value); }} placeholder="Shared description"></textarea>

            <label>GM Notes</label>
            <textarea rows="3" value=${relationshipEditor.gmNotes} onInput=${function (e) { updateField("gmNotes", e.target.value); }} placeholder="Storyteller-only notes"></textarea>

            <div className="zone-editor-actions">
              <button onClick=${saveRelationshipEditor}>Save</button>
              <button onClick=${closeRelationshipEditor}>Cancel</button>
              ${!relationshipEditor.isNew ? html`<button className="destructive" onClick=${deleteRelationshipEditor}>Delete Relationship</button>` : null}
            </div>
          </div>
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
      return html`<div className="map-workspace-shell profile-mode">
        ${characterProfileView()}
      </div>`;
    }

    function zoomIn() {
      if (reactFlowInstance) {
        reactFlowInstance.zoomIn();
      }
    }

    function zoomOut() {
      if (reactFlowInstance) {
        reactFlowInstance.zoomOut();
      }
    }

    function onFlowMove(event, viewport) {
      setZoomPercent(Math.round(viewport.zoom * 100));
    }

    var selectedNodeCount = flowNodes.filter(function (node) { return node.selected; }).length;

    return html`<div className="map-workspace-shell">
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
            <button onClick=${openAddCharacterModal}>Add Character</button>
            <button onClick=${zoomIn}>Zoom In</button>
            <button onClick=${zoomOut}>Zoom Out</button>
            <span className="badge">${zoomPercent}%</span>
            <span className="badge">Selected ${selectedNodeCount}</span>
            <button disabled=${true} title="Undo is not available in this rendering engine">Undo</button>
            <button disabled=${true} title="Redo is not available in this rendering engine">Redo</button>
          </div>

          <div className="canvas-viewport">
            ${ReactFlowComponent ? html`<${ReactFlowComponent}
              className=${isConnectingRelationship ? "rf-connecting" : ""}
              nodes=${flowNodes}
              edges=${flowEdges}
              nodeTypes=${FLOW_NODE_TYPES}
              edgeTypes=${FLOW_EDGE_TYPES}
              onNodesChange=${onFlowNodesChange}
              onEdgesChange=${onFlowEdgesChange}
              onNodeDragStop=${onNodeDragStop}
              onNodeClick=${onFlowNodeClick}
              onNodeDoubleClick=${onFlowNodeDoubleClick}
              onPaneClick=${onFlowPaneClick}
              onConnect=${handleFlowConnect}
              onConnectStart=${handleFlowConnectStart}
              onConnectEnd=${handleFlowConnectEnd}
              onEdgeClick=${onFlowEdgeClick}
              onMove=${onFlowMove}
              nodesConnectable=${true}
              elementsSelectable=${true}
              connectionMode=${ReactFlowConnectionMode.Loose}
              deleteKeyCode=${null}
              defaultViewport=${{ x: 80, y: 60, zoom: 0.58 }}
              minZoom=${0.2}
              maxZoom=${2.4}
              proOptions=${{ hideAttribution: true }}
            />` : html`<div className="card"><p className="hint">React Flow failed to load.</p></div>`}
          </div>
        </div>

        ${activePanel ? html`<aside className="right-panel">${renderPanel()}</aside>` : null}
      </section>

      ${renderAddCharacterModal()}
    </div>`;
  }

  loadInitialState()
    .then(function (seedState) {
      ReactDOM.createRoot(document.getElementById("app")).render(html`<${ReactFlowProvider}><${App} initialData=${seedState} /></${ReactFlowProvider}>`);
    })
    .catch(function (error) {
      console.warn("Failed to bootstrap Campaign Atlas state.", error);
      ReactDOM.createRoot(document.getElementById("app")).render(html`<${ReactFlowProvider}><${App} initialData=${initialState()} /></${ReactFlowProvider}>`);
    });
})();

