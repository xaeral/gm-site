window.GMData = {
  recentNotes: [
    { title: "Raven Market Timeline", summary: "Auction disrupted by masked envoys from the glass coast." },
    { title: "Temple Vault Seal", summary: "Three rotating sigils keyed to bloodline phrases." },
    { title: "House Verrik Debts", summary: "Two favors owed to smugglers and one to city archivists." },
    { title: "Ashwood Patrol Routes", summary: "Night patrol skipped every third bell due to labor strike." }
  ],

  pinnedNPCs: [
    { name: "Mara Kest", role: "Fixer", status: "Wary ally", detail: "Controls access to the lower canals." },
    { name: "Brother Caldus", role: "Priest-Scholar", status: "Unreliable", detail: "Knows the burial key but hides the final verse." },
    { name: "Captain Orin Vale", role: "Watch Commander", status: "Pressured", detail: "Balancing crown demands against public order." },
    { name: "Ilya Thorn", role: "Courier", status: "Missing", detail: "Last seen carrying coded wax tablets." }
  ],

  activeThreads: [
    { thread: "Who forged the counterfeit royal writ?", state: "Open", urgency: "High" },
    { thread: "Why is the moonwell draining early?", state: "Escalating", urgency: "Critical" },
    { thread: "Who finances the ash-mask cult?", state: "Open", urgency: "Medium" },
    { thread: "Where did the mapmaker vanish?", state: "Stalled", urgency: "Low" }
  ],

  locations: [],

  clues: [
    "Blue wax seal with fractured sun mark",
    "Ledger page torn between entries 14 and 15",
    "Witness heard bell pattern at second dusk",
    "Smudged charcoal map hidden under altar stone"
  ],

  sessions: [
    "Session 18: Market of Broken Vows",
    "Session 19: The Silent Cistern",
    "Session 20: Blood Oath at Dawn"
  ],

  encounters: [
    "Dockside Ambush (Level 5)",
    "Vault Sentinel Puzzle Trap",
    "Rooftop Chase Through Lantern Ward",
    "Negotiation: Council Blackmail Hearing"
  ],

  quickLinks: [
    { label: "Campaign Calendar", url: "#" },
    { label: "Treasure Ledger", url: "#" },
    { label: "Initiative Tracker", url: "#" },
    { label: "Faction Reputation", url: "#" },
    { label: "Rules Reference", url: "#" },
    { label: "Safety Checklist", url: "#" }
  ],

  searchable: [
    { type: "Page", title: "Home", description: "Campaign dashboard and activity overview", href: "index.html" },
    { type: "Page", title: "GM Notes", description: "Campaign notebook and live note hub", href: "pages/gm-notes.html" },
    { type: "Page", title: "Relationship Map", description: "Dedicated relationship workspace", href: "pages/relationship-map.html" },
    { type: "Page", title: "Characters", description: "Searchable NPC database", href: "pages/characters.html" },
    { type: "Page", title: "Locations", description: "Location records and linked notes", href: "pages/locations.html" },
    { type: "Page", title: "Timeline", description: "Chronological campaign events", href: "pages/timeline.html" },
    { type: "Page", title: "Sessions", description: "Session planning and archive", href: "pages/sessions.html" },
    { type: "Page", title: "Tools", description: "Utility trackers and checklists", href: "pages/tools.html" },
    { type: "Page", title: "Settings", description: "Application preferences", href: "pages/settings.html" },
    { type: "Section", title: "NPCs", description: "Pinned character overview", href: "#npcs" },
    { type: "Section", title: "Locations", description: "Major places and regions", href: "#locations" },
    { type: "Section", title: "Clues", description: "Evidence and unresolved leads", href: "#clues" },
    { type: "Section", title: "Sessions", description: "Session prep and recaps", href: "#sessions" },
    { type: "Section", title: "Encounters", description: "Combat and social scenes", href: "#encounters" },
    { type: "Section", title: "Quick Links", description: "External campaign references", href: "#quick-links" }
  ]
};
