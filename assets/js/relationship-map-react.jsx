const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEY = "relationship-map-desktop-v1";

const mainNav = [
  { key: "dashboard", label: "Dashboard", icon: "▦" },
  { key: "characters", label: "Characters", icon: "◉" },
  { key: "zones", label: "Zones", icon: "▭" },
  { key: "relationships", label: "Relationships", icon: "↔" },
  { key: "tags", label: "Tags", icon: "#" },
  { key: "badges", label: "Badges", icon: "◎" },
  { key: "overlays", label: "Overlays", icon: "◍" }
];

const bottomNav = [
  { key: "collaborators", label: "Collaborators", icon: "👥" },
  { key: "whatsnew", label: "What's New", icon: "✦" },
  { key: "settings", label: "Settings", icon: "⚙" },
  { key: "importexport", label: "Import / Export", icon: "⇅" }
];

const portraits = [
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

function imagePath(fileName) {
  return "../Relationship map/" + encodeURIComponent(fileName);
}

function nameToId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function defaultState() {
  const characters = [
    {
      id: "prince",
      name: "Prince Taylor",
      clan: "Brujah",
      sect: "Camarilla",
      status: "Active",
      generation: "9",
      predatorType: "Extortionist",
      ambition: "Keep Melbourne stable.",
      desire: "Expose conspiracy.",
      bio: "Veteran prince balancing fear, influence, and fragile order.",
      timeline: "1882: Born\n1921: Embraced",
      notes: "GM: Keep morally gray.",
      tags: ["Prince", "Power"],
      badges: ["Crown"],
      overlays: [],
      x: 780,
      y: 140,
      portrait: portraits[13]
    },
    {
      id: "seneschal",
      name: "Seneschal Alexandra",
      clan: "Toreador",
      sect: "Camarilla",
      status: "Active",
      generation: "10",
      predatorType: "Siren",
      ambition: "Preserve influence.",
      desire: "Control gossip channels.",
      bio: "A composed strategist and social architect.",
      timeline: "1898: Embraced",
      notes: "GM: key to information control.",
      tags: ["Court"],
      badges: ["Advisor"],
      overlays: [],
      x: 360,
      y: 140,
      portrait: portraits[19]
    },
    {
      id: "primogen",
      name: "Primogen James Whitlock",
      clan: "Ventrue",
      sect: "Camarilla",
      status: "Active",
      generation: "8",
      predatorType: "Scene Queen",
      ambition: "Expand authority.",
      desire: "Break rivals quietly.",
      bio: "An old power broker with expensive loyalties.",
      timeline: "1864: Embraced",
      notes: "GM: pressure point for coterie.",
      tags: ["Primogen"],
      badges: ["Council"],
      overlays: [],
      x: 780,
      y: 340,
      portrait: portraits[20]
    },
    {
      id: "amelia",
      name: "Dr Amelia Rhodes",
      clan: "Malkavian",
      sect: "Anarch",
      status: "Missing",
      generation: "11",
      predatorType: "Bagger",
      ambition: "Decode old prophecies.",
      desire: "Find missing witness.",
      bio: "Brilliant and unstable, guided by disturbing visions.",
      timeline: "1999: Embraced",
      notes: "GM: reveal clues through dreams.",
      tags: ["Mystic"],
      badges: ["Oracle"],
      overlays: ["Missing"],
      x: 780,
      y: 610,
      portrait: portraits[22]
    }
  ];

  return {
    title: "Melbourne by Night",
    session: "Session 18 - Red Ledger",
    activity: ["Linked Alexandra -> Prince (Partner)", "Added Coterie zone", "Updated Prince biography"],
    threads: ["The stolen vitae archive", "Schism in the council"],
    notes: ["Prep Elysium confrontation", "Track coterie influence"],
    characters,
    zones: [
      { id: "zone-council", name: "Primogen Council", x: 480, y: 230, width: 1040, height: 220, color: "#d10d40", opacity: 0.16, borderThickness: 2, description: "Inner political ring", lock: false, hidden: false },
      { id: "zone-coterie", name: "Player Coterie", x: 540, y: 760, width: 900, height: 260, color: "#8b1e46", opacity: 0.2, borderThickness: 2, description: "Coterie operations", lock: false, hidden: false }
    ],
    relationships: [
      { id: "r1", from: "seneschal", to: "prince", category: "Romantic", type: "Partner", color: "#d14b7f", thickness: 2, style: "dashed", arrow: "none", labelColor: "#ffffff", labelPosition: "middle", opacity: 1, hoverColor: "#ffffff", visible: true },
      { id: "r2", from: "primogen", to: "prince", category: "Vampire Relations", type: "Sire", color: "#d10d40", thickness: 2, style: "solid", arrow: "end", labelColor: "#ffffff", labelPosition: "middle", opacity: 1, hoverColor: "#ffffff", visible: true },
      { id: "r3", from: "amelia", to: "primogen", category: "Vampire Relations", type: "Sire", color: "#d10d40", thickness: 2, style: "solid", arrow: "end", labelColor: "#ffffff", labelPosition: "middle", opacity: 1, hoverColor: "#ffffff", visible: true }
    ],
    relationshipCategories: [
      { id: "cat-vampire", name: "Vampire Relations", color: "#d10d40", types: ["Sire", "Childe"] },
      { id: "cat-romance", name: "Romantic Relations", color: "#d14b7f", types: ["Partner", "Former Lover"] }
    ],
    tagGroups: [
      { id: "tg-politics", name: "Politics", tags: [{ id: "t-prince", name: "Prince", color: "#d10d40", icon: "♛", description: "Ruling authority", visible: true }, { id: "t-council", name: "Council", color: "#8b1e46", icon: "◎", description: "Council-aligned", visible: true }] },
      { id: "tg-risks", name: "Risks", tags: [{ id: "t-hunted", name: "Hunted", color: "#ff335f", icon: "!", description: "Under threat", visible: true }] }
    ],
    badges: [
      { id: "b-crown", name: "Crown", position: "Top", icon: "♛", color: "#d10d40", priority: 1, tooltip: "Domain authority", visible: true },
      { id: "b-sire", name: "Sire", position: "Left", icon: "⇧", color: "#d14b7f", priority: 2, tooltip: "Sire relation", visible: true }
    ],
    overlays: [
      { id: "o-missing", name: "Missing", icon: "◌", text: "MISSING", position: "Centre", size: 1, color: "#ff335f", opacity: 0.85, animation: "Pulse", visibleWhen: "status=Missing", enabled: true },
      { id: "o-wanted", name: "Wanted", icon: "⚠", text: "WANTED", position: "Top", size: 1, color: "#d10d40", opacity: 0.9, animation: "None", visibleWhen: "tag=Hunted", enabled: false }
    ]
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function useHistoryState(initial) {
  const [state, setState] = useState(initial);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const apply = (updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(clone(prev)) : updater;
      setUndoStack((stack) => [...stack.slice(-49), clone(prev)]);
      setRedoStack([]);
      return next;
    });
  };

  const undo = () => {
    setUndoStack((stack) => {
      if (!stack.length) {
        return stack;
      }
      const prior = stack[stack.length - 1];
      setRedoStack((redo) => [...redo, clone(state)]);
      setState(prior);
      return stack.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((stack) => {
      if (!stack.length) {
        return stack;
      }
      const next = stack[stack.length - 1];
      setUndoStack((undoItems) => [...undoItems, clone(state)]);
      setState(next);
      return stack.slice(0, -1);
    });
  };

  return { state, setState: apply, undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}

function App() {
  const initial = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultState();
      }
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (_e) {
      return defaultState();
    }
  }, []);

  const history = useHistoryState(initial);
  const map = history.state;

  const [activePanel, setActivePanel] = useState("dashboard");
  const [selectedIds, setSelectedIds] = useState([]);
  const [focusedCharacter, setFocusedCharacter] = useState(map.characters[0]?.id || null);
  const [view, setView] = useState({ x: 80, y: 60, scale: 0.58 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [drawingZone, setDrawingZone] = useState(false);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("name");
  const [filterText, setFilterText] = useState("");

  const viewportRef = useRef(null);
  const panRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isEditableElement = (element) => {
    if (!element || element === document.body || element === document.documentElement) {
      return false;
    }
    if (element.isContentEditable) {
      return true;
    }
    const tagName = element.tagName ? String(element.tagName).toUpperCase() : "";
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }
    if (element.getAttribute?.("role") === "textbox") {
      return true;
    }
    const contentEditable = element.getAttribute?.("contenteditable");
    if (contentEditable && contentEditable !== "false") {
      return true;
    }
    if (element.closest?.('[contenteditable="true"]') || element.closest?.('[role="textbox"]')) {
      return true;
    }
    return false;
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }, [map]);

  useEffect(() => {
    const onKey = (event) => {
      if (isEditableElement(document.activeElement)) {
        return;
      }

      if (event.key === "Escape") {
        setActivePanel(null);
        setContextMenu(null);
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          history.redo();
        } else {
          history.undo();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        history.redo();
      }

      if (event.key === "Delete") {
        if (workspaceMode !== "map" || characterEditMode || profileEditMode || portraitWorkflow.open || !selectedIds.length) {
          return;
        }

        event.preventDefault();
        history.setState((next) => {
          next.characters = next.characters.filter((c) => !selectedIds.includes(c.id));
          next.relationships = next.relationships.filter((r) => !selectedIds.includes(r.from) && !selectedIds.includes(r.to));
          next.zones = next.zones.map((z) => ({ ...z }));
          return next;
        });
        setSelectedIds([]);
      }

      if (activePanel === "characters" && event.key.toLowerCase() === "n") {
        createCharacter();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activePanel, selectedIds, history, workspaceMode, characterEditMode, profileEditMode, portraitWorkflow.open]);

  const characterCount = map.characters.length;
  const relationshipCount = map.relationships.length;
  const zoneCount = map.zones.length;

  const focused = map.characters.find((c) => c.id === focusedCharacter) || null;

  function setPanel(key) {
    setActivePanel((prev) => (prev === key ? key : key));
    setContextMenu(null);
  }

  function closePanel() {
    setActivePanel(null);
  }

  function createCharacter() {
    const id = "char-" + Date.now();
    history.setState((next) => {
      next.characters.push({
        id,
        name: "New Character",
        clan: "Unknown",
        sect: "Unknown",
        status: "Active",
        generation: "",
        predatorType: "",
        ambition: "",
        desire: "",
        bio: "",
        timeline: "",
        notes: "",
        tags: [],
        badges: [],
        overlays: [],
        x: 900,
        y: 700,
        portrait: portraits[0]
      });
      return next;
    });
    setFocusedCharacter(id);
    setSelectedIds([id]);
    setActivePanel("characters");
  }

  function updateCharacter(id, patch) {
    history.setState((next) => {
      const target = next.characters.find((c) => c.id === id);
      if (!target) {
        return next;
      }
      Object.assign(target, patch);
      return next;
    });
  }

  function canvasPoint(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
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
      const p = canvasPoint(event.clientX, event.clientY);
      setZoneDraft({ x: p.x, y: p.y, width: 0, height: 0 });
      return;
    }

    setContextMenu(null);
    setIsPanning(true);
    panRef.current = { x: event.clientX - view.x, y: event.clientY - view.y };
  }

  function onCanvasMouseMove(event) {
    if (dragId) {
      const p = canvasPoint(event.clientX, event.clientY);
      updateCharacter(dragId, { x: Math.round(p.x - dragOffsetRef.current.x), y: Math.round(p.y - dragOffsetRef.current.y) });
      return;
    }

    if (zoneDraft) {
      const p = canvasPoint(event.clientX, event.clientY);
      setZoneDraft((z) => ({ ...z, width: p.x - z.x, height: p.y - z.y }));
      return;
    }

    if (isPanning) {
      setView((prev) => ({ ...prev, x: event.clientX - panRef.current.x, y: event.clientY - panRef.current.y }));
    }
  }

  function onCanvasMouseUp() {
    setIsPanning(false);
    if (zoneDraft) {
      const x = Math.min(zoneDraft.x, zoneDraft.x + zoneDraft.width);
      const y = Math.min(zoneDraft.y, zoneDraft.y + zoneDraft.height);
      const width = Math.abs(zoneDraft.width);
      const height = Math.abs(zoneDraft.height);
      if (width > 20 && height > 20) {
        history.setState((next) => {
          next.zones.push({
            id: "zone-" + Date.now(),
            name: "New Zone",
            x,
            y,
            width,
            height,
            color: "#d10d40",
            opacity: 0.18,
            borderThickness: 2,
            description: "",
            lock: false,
            hidden: false
          });
          return next;
        });
      }
      setZoneDraft(null);
      setDrawingZone(false);
    }
    setDragId(null);
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const ox = event.clientX - rect.left;
    const oy = event.clientY - rect.top;
    const zoom = event.deltaY < 0 ? 1.08 : 0.92;
    setView((prev) => {
      const nextScale = Math.min(2.4, Math.max(0.2, prev.scale * zoom));
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: ox - (ox - prev.x) * ratio,
        y: oy - (oy - prev.y) * ratio
      };
    });
  }

  function onNodeMouseDown(event, character) {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const p = canvasPoint(event.clientX, event.clientY);
    dragOffsetRef.current = { x: p.x - character.x, y: p.y - character.y };
    setDragId(character.id);

    if (event.shiftKey) {
      setSelectedIds((prev) => (prev.includes(character.id) ? prev.filter((id) => id !== character.id) : [...prev, character.id]));
    } else {
      setSelectedIds([character.id]);
    }
  }

  function onNodeClick(event, character) {
    event.stopPropagation();
    if (!event.shiftKey) {
      setSelectedIds([character.id]);
    }
    setFocusedCharacter(character.id);
  }

  function onNodeDoubleClick(_event, character) {
    setFocusedCharacter(character.id);
    setActivePanel("characters");
  }

  function onNodeContextMenu(event, character) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, type: "node", id: character.id });
  }

  function onCanvasContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, type: "canvas", id: null });
  }

  function applySearchSort(items) {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((it) => {
      const text = [it.name, it.clan, it.sect, ...(it.tags || [])].join(" ").toLowerCase();
      return !q || text.includes(q);
    });

    filtered.sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortMode === "clan") {
        return a.clan.localeCompare(b.clan);
      }
      return a.sect.localeCompare(b.sect);
    });
    return filtered;
  }

  function exportJson() {
    return JSON.stringify(map, null, 2);
  }

  function importJson(raw) {
    try {
      const parsed = JSON.parse(raw);
      history.setState(Object.assign(defaultState(), parsed));
    } catch (_e) {
      window.alert("Invalid JSON");
    }
  }

  function PanelHeader({ title }) {
    return (
      <div className="panel-header">
        <h2>{title}</h2>
        <button onClick={closePanel} aria-label="Close panel">×</button>
      </div>
    );
  }

  function DashboardPanel() {
    return (
      <>
        <PanelHeader title="Dashboard" />
        <div className="panel-body">
          <div className="card">
            <strong>{map.title}</strong>
            <p className="hint">{map.session}</p>
            <input placeholder="Global search" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => setActivePanel("characters")}>New Character</button>
              <button onClick={() => setDrawingZone(true)}>Draw Zone</button>
            </div>
          </div>

          <div className="grid-2">
            <div className="card"><strong>{characterCount}</strong><p className="hint">Character Count</p></div>
            <div className="card"><strong>{relationshipCount}</strong><p className="hint">Relationship Count</p></div>
            <div className="card"><strong>{zoneCount}</strong><p className="hint">Zone Count</p></div>
            <div className="card"><strong>{map.threads.length}</strong><p className="hint">Active Story Threads</p></div>
          </div>

          <div className="card">
            <strong>Recent Activity</strong>
            <ul>
              {map.activity.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>

          <div className="card">
            <strong>Recent Notes</strong>
            <ul>
              {map.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </div>
      </>
    );
  }

  function CharacterEditor() {
    if (!focused) {
      return <div className="card">Select a character to edit.</div>;
    }

    const links = map.relationships.filter((r) => r.from === focused.id || r.to === focused.id);

    return (
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <strong>{focused.name}</strong>
        <div className="split">
          <div>
            <label>Name</label>
            <input value={focused.name} onChange={(e) => updateCharacter(focused.id, { name: e.target.value })} />
          </div>
          <div>
            <label>Portrait</label>
            <select value={focused.portrait} onChange={(e) => updateCharacter(focused.id, { portrait: e.target.value })}>
              {portraits.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="split">
          <div><label>Clan</label><input value={focused.clan} onChange={(e) => updateCharacter(focused.id, { clan: e.target.value })} /></div>
          <div><label>Sect</label><input value={focused.sect} onChange={(e) => updateCharacter(focused.id, { sect: e.target.value })} /></div>
          <div><label>Generation</label><input value={focused.generation} onChange={(e) => updateCharacter(focused.id, { generation: e.target.value })} /></div>
          <div><label>Predator Type</label><input value={focused.predatorType} onChange={(e) => updateCharacter(focused.id, { predatorType: e.target.value })} /></div>
        </div>

        <div className="split">
          <div><label>Ambition</label><textarea rows={3} value={focused.ambition} onChange={(e) => updateCharacter(focused.id, { ambition: e.target.value })} /></div>
          <div><label>Desire</label><textarea rows={3} value={focused.desire} onChange={(e) => updateCharacter(focused.id, { desire: e.target.value })} /></div>
        </div>

        <div>
          <label>Biography</label>
          <textarea rows={6} value={focused.bio} onChange={(e) => updateCharacter(focused.id, { bio: e.target.value })} />
        </div>

        <div>
          <label>Relationships</label>
          <ul>
            {links.map((l) => {
              const peerId = l.from === focused.id ? l.to : l.from;
              const peer = map.characters.find((c) => c.id === peerId);
              return <li key={l.id}>{l.type} → {peer?.name || "Unknown"}</li>;
            })}
          </ul>
        </div>

        <div className="split">
          <div><label>Timeline</label><textarea rows={4} value={focused.timeline} onChange={(e) => updateCharacter(focused.id, { timeline: e.target.value })} /></div>
          <div><label>GM Notes</label><textarea rows={4} value={focused.notes} onChange={(e) => updateCharacter(focused.id, { notes: e.target.value })} /></div>
        </div>
      </div>
    );
  }

  function CharactersPanel() {
    const list = applySearchSort(map.characters);

    return (
      <>
        <PanelHeader title="Characters" />
        <div className="panel-body">
          <div className="row">
            <button onClick={createCharacter}>New Character</button>
            <button>Filter</button>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="name">Sort: Name</option>
              <option value="clan">Sort: Clan</option>
              <option value="sect">Sort: Sect</option>
            </select>
            <button>Manage</button>
          </div>
          <input placeholder="Search characters" value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="char-list">
            {list.map((c) => (
              <div key={c.id} className={"char-card" + (focusedCharacter === c.id ? " active" : "")} draggable onDragStart={() => setFocusedCharacter(c.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => {
                if (!focusedCharacter || focusedCharacter === c.id) {
                  return;
                }
                history.setState((next) => {
                  const from = next.characters.findIndex((x) => x.id === focusedCharacter);
                  const to = next.characters.findIndex((x) => x.id === c.id);
                  if (from < 0 || to < 0) {
                    return next;
                  }
                  const [item] = next.characters.splice(from, 1);
                  next.characters.splice(to, 0, item);
                  return next;
                });
              }} onClick={() => setFocusedCharacter(c.id)}>
                <img src={imagePath(c.portrait)} alt={c.name} />
                <div>
                  <strong>{c.name}</strong>
                  <div className="tags">
                    <span className="tag">{c.clan}</span>
                    <span className="tag">{c.sect}</span>
                    <span className="tag">{c.status}</span>
                    {(c.tags || []).map((t) => <span className="tag" key={t}>{t}</span>)}
                  </div>
                </div>
                <div className="hint">{map.relationships.filter((r) => r.from === c.id || r.to === c.id).length} links</div>
              </div>
            ))}
          </div>

          <CharacterEditor />
        </div>
      </>
    );
  }

  function ZonesPanel() {
    return (
      <>
        <PanelHeader title="Zones" />
        <div className="panel-body">
          <button onClick={() => setDrawingZone(true)}>Draw New Zone</button>

          {map.zones.map((z) => (
            <div key={z.id} className="card">
              <div className="row">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, background: z.color, display: "inline-block" }}></span>
                  <strong>{z.name}</strong>
                </div>
                <div className="hint">{map.characters.filter((c) => c.x > z.x && c.x < z.x + z.width && c.y > z.y && c.y < z.y + z.height).length} inside</div>
              </div>

              <div className="split" style={{ marginTop: 8 }}>
                <div><label>Name</label><input value={z.name} onChange={(e) => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.name = e.target.value; return next; })} /></div>
                <div><label>Color</label><input type="color" value={z.color} onChange={(e) => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.color = e.target.value; return next; })} /></div>
                <div><label>Opacity</label><input type="range" min="0.05" max="0.65" step="0.01" value={z.opacity} onChange={(e) => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.opacity = Number(e.target.value); return next; })} /></div>
                <div><label>Border</label><input type="range" min="1" max="6" step="1" value={z.borderThickness} onChange={(e) => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.borderThickness = Number(e.target.value); return next; })} /></div>
              </div>

              <textarea rows={2} placeholder="Description" value={z.description} onChange={(e) => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.description = e.target.value; return next; })}></textarea>

              <div className="row">
                <button onClick={() => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.lock = !target.lock; return next; })}>{z.lock ? "Unlock" : "Lock movement"}</button>
                <button onClick={() => history.setState((next) => { const target = next.zones.find((x) => x.id === z.id); if (target) target.hidden = !target.hidden; return next; })}>{z.hidden ? "Show" : "Hide"}</button>
                <button onClick={() => history.setState((next) => { next.zones = next.zones.filter((x) => x.id !== z.id); return next; })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  function RelationshipsPanel() {
    return (
      <>
        <PanelHeader title="Relationships" />
        <div className="panel-body">
          {map.relationshipCategories.map((cat) => (
            <div key={cat.id} className="card">
              <div className="row">
                <strong>{cat.name}</strong>
                <span className="hint">{cat.types.length} types</span>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <input type="color" value={cat.color} onChange={(e) => history.setState((next) => {
                  const target = next.relationshipCategories.find((x) => x.id === cat.id);
                  if (target) target.color = e.target.value;
                  next.relationships.forEach((rel) => { if (rel.category === cat.name) rel.color = e.target.value; });
                  return next;
                })} />
                <button>Edit</button>
                <button>Delete</button>
              </div>
              {map.relationships.filter((r) => r.category === cat.name).map((rel) => (
                <div key={rel.id} className="card" style={{ marginTop: 8 }}>
                  <strong>{rel.type}</strong>
                  <div className="grid-2" style={{ marginTop: 6 }}>
                    <div><label>Line thickness</label><input type="range" min="1" max="6" value={rel.thickness} onChange={(e) => history.setState((next) => { const t = next.relationships.find((x) => x.id === rel.id); if (t) t.thickness = Number(e.target.value); return next; })} /></div>
                    <div><label>Line style</label><select value={rel.style} onChange={(e) => history.setState((next) => { const t = next.relationships.find((x) => x.id === rel.id); if (t) t.style = e.target.value; return next; })}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></div>
                    <div><label>Arrow style</label><select value={rel.arrow} onChange={(e) => history.setState((next) => { const t = next.relationships.find((x) => x.id === rel.id); if (t) t.arrow = e.target.value; return next; })}><option value="none">None</option><option value="start">Start</option><option value="end">End</option><option value="both">Both</option></select></div>
                    <div><label>Label colour</label><input type="color" value={rel.labelColor} onChange={(e) => history.setState((next) => { const t = next.relationships.find((x) => x.id === rel.id); if (t) t.labelColor = e.target.value; return next; })} /></div>
                    <div><label>Opacity</label><input type="range" min="0.1" max="1" step="0.05" value={rel.opacity} onChange={(e) => history.setState((next) => { const t = next.relationships.find((x) => x.id === rel.id); if (t) t.opacity = Number(e.target.value); return next; })} /></div>
                    <div><label>Visibility</label><select value={String(rel.visible)} onChange={(e) => history.setState((next) => { const t = next.relationships.find((x) => x.id === rel.id); if (t) t.visible = e.target.value === "true"; return next; })}><option value="true">Visible</option><option value="false">Hidden</option></select></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  function TagsPanel() {
    return (
      <>
        <PanelHeader title="Tags" />
        <div className="panel-body">
          {map.tagGroups.map((group) => (
            <div className="card" key={group.id}>
              <div className="row"><strong>{group.name}</strong><span className="hint">{group.tags.length} tags</span></div>
              {group.tags.map((tag) => (
                <div key={tag.id} className="card" style={{ marginTop: 8 }}>
                  <div className="row"><strong>{tag.name}</strong><span className="hint">{map.characters.filter((c) => (c.tags || []).includes(tag.name)).length} used</span></div>
                  <div className="grid-2" style={{ marginTop: 6 }}>
                    <div><label>Colour</label><input type="color" value={tag.color} onChange={(e) => history.setState((next) => { const g = next.tagGroups.find((x) => x.id === group.id); const t = g?.tags.find((x) => x.id === tag.id); if (t) t.color = e.target.value; return next; })} /></div>
                    <div><label>Icon</label><input value={tag.icon} onChange={(e) => history.setState((next) => { const g = next.tagGroups.find((x) => x.id === group.id); const t = g?.tags.find((x) => x.id === tag.id); if (t) t.icon = e.target.value; return next; })} /></div>
                    <div style={{ gridColumn: "1 / -1" }}><label>Description</label><input value={tag.description} onChange={(e) => history.setState((next) => { const g = next.tagGroups.find((x) => x.id === group.id); const t = g?.tags.find((x) => x.id === tag.id); if (t) t.description = e.target.value; return next; })} /></div>
                    <div><label>Visibility</label><select value={String(tag.visible)} onChange={(e) => history.setState((next) => { const g = next.tagGroups.find((x) => x.id === group.id); const t = g?.tags.find((x) => x.id === tag.id); if (t) t.visible = e.target.value === "true"; return next; })}><option value="true">Visible</option><option value="false">Hidden</option></select></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  function BadgesPanel() {
    return (
      <>
        <PanelHeader title="Badges" />
        <div className="panel-body">
          {map.badges.map((b) => (
            <div key={b.id} className="card">
              <div className="row"><strong>{b.name}</strong><span className="hint">{b.position}</span></div>
              <div className="grid-2" style={{ marginTop: 6 }}>
                <div><label>Circular icon</label><input value={b.icon} onChange={(e) => history.setState((next) => { const t = next.badges.find((x) => x.id === b.id); if (t) t.icon = e.target.value; return next; })} /></div>
                <div><label>Colour</label><input type="color" value={b.color} onChange={(e) => history.setState((next) => { const t = next.badges.find((x) => x.id === b.id); if (t) t.color = e.target.value; return next; })} /></div>
                <div><label>Display priority</label><input type="number" value={b.priority} onChange={(e) => history.setState((next) => { const t = next.badges.find((x) => x.id === b.id); if (t) t.priority = Number(e.target.value); return next; })} /></div>
                <div><label>Position</label><select value={b.position} onChange={(e) => history.setState((next) => { const t = next.badges.find((x) => x.id === b.id); if (t) t.position = e.target.value; return next; })}><option>Top</option><option>Left</option><option>Right</option><option>Centre</option></select></div>
                <div style={{ gridColumn: "1 / -1" }}><label>Tooltip</label><input value={b.tooltip} onChange={(e) => history.setState((next) => { const t = next.badges.find((x) => x.id === b.id); if (t) t.tooltip = e.target.value; return next; })} /></div>
                <div><label>Visibility</label><select value={String(b.visible)} onChange={(e) => history.setState((next) => { const t = next.badges.find((x) => x.id === b.id); if (t) t.visible = e.target.value === "true"; return next; })}><option value="true">Visible</option><option value="false">Hidden</option></select></div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  function OverlaysPanel() {
    return (
      <>
        <PanelHeader title="Overlays" />
        <div className="panel-body">
          {map.overlays.map((o) => (
            <div key={o.id} className="card">
              <div className="row"><strong>{o.name}</strong><span className="hint">{o.visibleWhen}</span></div>
              <div className="grid-2" style={{ marginTop: 6 }}>
                <div><label>Icon</label><input value={o.icon} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.icon = e.target.value; return next; })} /></div>
                <div><label>Optional text</label><input value={o.text} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.text = e.target.value; return next; })} /></div>
                <div><label>Position</label><select value={o.position} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.position = e.target.value; return next; })}><option>Top</option><option>Left</option><option>Right</option><option>Centre</option></select></div>
                <div><label>Size</label><input type="range" min="0.5" max="2" step="0.1" value={o.size} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.size = Number(e.target.value); return next; })} /></div>
                <div><label>Colour</label><input type="color" value={o.color} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.color = e.target.value; return next; })} /></div>
                <div><label>Opacity</label><input type="range" min="0.1" max="1" step="0.05" value={o.opacity} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.opacity = Number(e.target.value); return next; })} /></div>
                <div><label>Animation</label><select value={o.animation} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.animation = e.target.value; return next; })}><option>None</option><option>Pulse</option><option>Blink</option><option>Float</option></select></div>
                <div><label>Visibility</label><select value={String(o.enabled)} onChange={(e) => history.setState((next) => { const t = next.overlays.find((x) => x.id === o.id); if (t) t.enabled = e.target.value === "true"; return next; })}><option value="true">Enabled</option><option value="false">Disabled</option></select></div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  function SimplePanel({ title, children }) {
    return (
      <>
        <PanelHeader title={title} />
        <div className="panel-body">{children}</div>
      </>
    );
  }

  function renderPanel() {
    switch (activePanel) {
      case "dashboard":
        return <DashboardPanel />;
      case "characters":
        return <CharactersPanel />;
      case "zones":
        return <ZonesPanel />;
      case "relationships":
        return <RelationshipsPanel />;
      case "tags":
        return <TagsPanel />;
      case "badges":
        return <BadgesPanel />;
      case "overlays":
        return <OverlaysPanel />;
      case "collaborators":
        return <SimplePanel title="Collaborators"><div className="card">Shared chronicle participants, role controls, and presence indicators.</div></SimplePanel>;
      case "whatsnew":
        return <SimplePanel title="What's New"><div className="card">Patch notes, release timeline, and migration tips.</div></SimplePanel>;
      case "settings":
        return <SimplePanel title="Settings"><div className="card">Canvas defaults, keyboard mapping, and visual preferences.</div></SimplePanel>;
      case "importexport":
        return (
          <SimplePanel title="Import / Export">
            <div className="card">
              <button onClick={() => navigator.clipboard.writeText(exportJson())}>Copy JSON</button>
              <textarea rows={16} defaultValue={exportJson()} id="jsonBuffer"></textarea>
              <button onClick={() => importJson(document.getElementById("jsonBuffer").value)}>Import JSON</button>
            </div>
          </SimplePanel>
        );
      default:
        return null;
    }
  }

  const filteredCharacters = applySearchSort(map.characters);

  return (
    <div className="desktop-shell" onClick={() => setContextMenu(null)}>
      <aside className="left-rail">
        <div className="rail-group">
          {mainNav.map((item) => (
            <button key={item.key} className={"rail-item" + (activePanel === item.key ? " active" : "")} onClick={() => setPanel(item.key)}>
              <span className="rail-icon">{item.icon}</span>
              <span className="rail-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="rail-group">
          {bottomNav.map((item) => (
            <button key={item.key} className={"rail-item" + (activePanel === item.key ? " active" : "")} onClick={() => setPanel(item.key)}>
              <span className="rail-icon">{item.icon}</span>
              <span className="rail-label">{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className={"workspace" + (activePanel ? " panel-open" : "") }>
        <div className="canvas-wrap">
          <div className="canvas-toolbar">
            <button onClick={() => setView((v) => ({ ...v, scale: Math.min(2.4, v.scale * 1.1) }))}>+</button>
            <button onClick={() => setView((v) => ({ ...v, scale: Math.max(0.2, v.scale * 0.9) }))}>-</button>
            <span className="badge">{Math.round(view.scale * 100)}%</span>
            <span className="badge">Selected: {selectedIds.length}</span>
            <button onClick={() => setDrawingZone(true)}>Draw Zone</button>
            <button onClick={history.undo} disabled={!history.canUndo}>Undo</button>
            <button onClick={history.redo} disabled={!history.canRedo}>Redo</button>
            <span className="hint"><span className="kbd">Esc</span> close panel</span>
          </div>

          <div
            ref={viewportRef}
            className={"canvas-viewport" + (isPanning ? " panning" : "")}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onWheel={onWheel}
            onContextMenu={onCanvasContextMenu}
          >
            <div className="canvas-surface" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
              <svg className="link-layer" viewBox="0 0 2000 1400" preserveAspectRatio="none">
                <defs>
                  <marker id="arrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#d10d40"></path>
                  </marker>
                </defs>
                {map.relationships.filter((r) => r.visible).map((r) => {
                  const from = map.characters.find((c) => c.id === r.from);
                  const to = map.characters.find((c) => c.id === r.to);
                  if (!from || !to) {
                    return null;
                  }
                  const mx = (from.x + to.x) / 2;
                  const my = (from.y + to.y) / 2;
                  const dash = r.style === "dashed" ? "7 5" : "";
                  const markerEnd = r.arrow === "end" || r.arrow === "both" ? "url(#arrowHead)" : undefined;
                  const markerStart = r.arrow === "start" || r.arrow === "both" ? "url(#arrowHead)" : undefined;
                  return (
                    <g key={r.id}>
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={r.color} strokeWidth={r.thickness} strokeDasharray={dash} opacity={r.opacity} markerEnd={markerEnd} markerStart={markerStart}></line>
                      <rect x={mx - 24} y={my - 11} width="48" height="18" rx="5" fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.15)"></rect>
                      <text x={mx} y={my + 2} fill={r.labelColor} fontSize="11" textAnchor="middle">{r.type}</text>
                    </g>
                  );
                })}
              </svg>

              <div className="zone-layer">
                {map.zones.filter((z) => !z.hidden).map((z) => (
                  <div
                    className={"zone" + (selectedIds.includes(z.id) ? " selected" : "") + (z.name.toLowerCase().includes("coterie") ? " coterie" : "")}
                    key={z.id}
                    style={{ left: z.x, top: z.y, width: z.width, height: z.height, background: `rgba(209,13,64,${z.opacity})`, borderWidth: z.borderThickness, borderColor: z.color }}
                  >
                    {z.name}
                  </div>
                ))}
                {zoneDraft && (
                  <div className="zone" style={{ left: Math.min(zoneDraft.x, zoneDraft.x + zoneDraft.width), top: Math.min(zoneDraft.y, zoneDraft.y + zoneDraft.height), width: Math.abs(zoneDraft.width), height: Math.abs(zoneDraft.height) }}>Drawing zone</div>
                )}
              </div>

              <div className="node-layer">
                {filteredCharacters.map((c) => (
                  <div
                    key={c.id}
                    className={"node" + (selectedIds.includes(c.id) ? " selected" : "")}
                    style={{ left: c.x, top: c.y }}
                    onMouseDown={(e) => onNodeMouseDown(e, c)}
                    onClick={(e) => onNodeClick(e, c)}
                    onDoubleClick={(e) => onNodeDoubleClick(e, c)}
                    onContextMenu={(e) => onNodeContextMenu(e, c)}
                  >
                    <img src={imagePath(c.portrait)} alt={c.name} />
                    <span>{c.name.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {activePanel && <aside className="right-panel">{renderPanel()}</aside>}
      </section>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          {contextMenu.type === "node" ? (
            <div className="context-menu-group">
              <button onClick={() => { setFocusedCharacter(contextMenu.id); setActivePanel("characters"); setContextMenu(null); }}>Edit Character</button>
              <button onClick={() => {
                history.setState((next) => {
                  next.relationships = next.relationships.filter((r) => r.from !== contextMenu.id && r.to !== contextMenu.id);
                  next.characters = next.characters.filter((c) => c.id !== contextMenu.id);
                  return next;
                });
                setSelectedIds((prev) => prev.filter((x) => x !== contextMenu.id));
                setContextMenu(null);
              }}>Delete Character</button>
              <button onClick={() => { setSelectedIds((prev) => Array.from(new Set([...prev, contextMenu.id]))); setContextMenu(null); }}>Multi-select add</button>
            </div>
          )}

          {contextMenu.type === "canvas" && (
            <div className="context-menu-group">
              <button onClick={() => { createCharacter(); setContextMenu(null); }}>New Character</button>
              <button onClick={() => { setDrawingZone(true); setContextMenu(null); }}>Draw Zone</button>
              <button onClick={() => { setView({ x: 80, y: 60, scale: 0.58 }); setContextMenu(null); }}>Reset View</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
