(function () {
  if (!window.React || !window.ReactDOM || !window.htm) {
    return;
  }

  var useEffect = React.useEffect;
  var useState = React.useState;
  var html = htm.bind(React.createElement);

  var shared = window.CampaignAtlasCharactersShared || {};
  var dashboardData = window.ChronicleHomeDashboard;
  var CharacterProfilePortrait = shared.CharacterProfilePortrait || null;

  function EmptyState(props) {
    return html`<p className="dashboard-empty">${props.text}</p>`;
  }

  function ContinueWorkCard(props) {
    return html`<a className="card dashboard-continue-card" href=${props.href}>
      <span className="dashboard-continue-label">${props.label}</span>
      <strong className="dashboard-continue-title">${props.title}</strong>
      ${props.subtitle ? html`<span className="dashboard-continue-subtitle">${props.subtitle}</span>` : null}
    </a>`;
  }

  function ActivityList(props) {
    var items = props.items || [];
    if (!items.length) {
      return html`<${EmptyState} text="No recent activity yet. Start editing your campaign to see updates here." />`;
    }
    return html`<ul className="dashboard-activity-list">
      ${items.map(function (item) {
        return html`<li key=${item.key} className="dashboard-activity-item">
          <a href=${item.href}>
            <span className="dashboard-activity-icon" aria-hidden="true">${item.icon}</span>
            <span className="dashboard-activity-body">
              <span className="dashboard-activity-title">${item.title}</span>
              <span className="dashboard-activity-meta">${item.label} • ${item.relativeLabel}</span>
            </span>
          </a>
        </li>`;
      })}
    </ul>`;
  }

  function PinnedNpcs(props) {
    var characters = props.characters || [];
    if (!characters.length) {
      return html`<${EmptyState} text="No pinned NPCs yet. Pin characters from the Characters page to feature them here." />`;
    }
    return html`<ul className="dashboard-pinned-list">
      ${characters.map(function (character) {
        return html`<li key=${character.id} className="dashboard-pinned-item">
          ${CharacterProfilePortrait ? html`<${CharacterProfilePortrait} record=${character} className="dashboard-pinned-portrait" />` : null}
          <span className="dashboard-pinned-meta">
            <strong>${character.name}</strong>
            <span>${character.clan}${character.generation ? " • Generation " + character.generation : ""}</span>
            <span>${character.relationshipCount} relationship${character.relationshipCount === 1 ? "" : "s"}</span>
          </span>
        </li>`;
      })}
    </ul>`;
  }

  function UpcomingSessions(props) {
    var sessions = props.sessions || [];
    if (!sessions.length) {
      return html`<${EmptyState} text="No upcoming sessions scheduled. Set a Date Played on a session to see it here." />`;
    }
    return html`<ul className="dashboard-session-list">
      ${sessions.map(function (session) {
        return html`<li key=${session.id} className="dashboard-session-item">
          <span className="dashboard-session-number">Session ${session.sessionNumber || "?"}</span>
          <span className="dashboard-session-title">${session.title}</span>
          <span className="dashboard-session-date">${session.scheduledLabel}</span>
        </li>`;
      })}
    </ul>`;
  }

  function TimelineSnapshot(props) {
    var events = props.events || [];
    if (!events.length) {
      return html`<${EmptyState} text="No timeline events recorded yet." />`;
    }
    return html`<ul className="dashboard-timeline-list">
      ${events.map(function (event) {
        return html`<li key=${event.key} className="dashboard-timeline-item">
          <strong>${event.title}</strong>
          <span>${event.characterName}${event.date ? " • " + event.date : ""}</span>
        </li>`;
      })}
    </ul>`;
  }

  function Dashboard() {
    var _state = useState(null);
    var state = _state[0];
    var setState = _state[1];

    var _loading = useState(true);
    var loading = _loading[0];
    var setLoading = _loading[1];

    useEffect(function () {
      var cancelled = false;
      if (!dashboardData) {
        setLoading(false);
        return function () {};
      }
      dashboardData.readDashboardState()
        .then(function (result) {
          if (!cancelled) {
            setState(result);
            setLoading(false);
          }
        })
        .catch(function () {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return function () { cancelled = true; };
    }, []);

    if (loading) {
      return html`<p className="dashboard-empty">Loading your chronicle...</p>`;
    }

    var data = state || {
      characters: [], relationships: [], locations: [], sessions: [], notes: [],
      currentSession: null, latestNote: null, lastEditedLocation: null,
      pinnedCharacters: [], upcomingSessions: [], timelineSnapshot: [], recentActivity: []
    };

    var currentSessionSubtitle = data.currentSession
      ? "Session " + (data.currentSession.sessionNumber || "?") + (data.currentSession.datePlayed ? " • " + dashboardData.formatScheduledDate(data.currentSession.datePlayed) : "")
      : "No sessions recorded yet";
    var currentSessionTitle = data.currentSession ? (data.currentSession.title || "Untitled Session") : "Start your first session";

    var notebookTitle = data.notes.length ? data.notes.length + " note" + (data.notes.length === 1 ? "" : "s") : "No notes yet";
    var notebookSubtitle = data.latestNote ? "Last edited: " + (data.latestNote.title || "Untitled Note") : "Write your first campaign note";

    var mapTitle = data.characters.length + " character" + (data.characters.length === 1 ? "" : "s");
    var mapSubtitle = data.relationships.length + " relationship" + (data.relationships.length === 1 ? "" : "s") + " mapped";

    var locationTitle = data.lastEditedLocation ? (data.lastEditedLocation.name || "Unnamed Location") : "No locations yet";
    var locationSubtitle = data.lastEditedLocation ? "Last edited " + dashboardData.formatRelativeTime(data.lastEditedLocation.updatedAt) : "Add your first location";

    return html`<div className="home-dashboard">
      <section className="dashboard-hero" role="img" aria-label="Chronicle Codex hero banner">
        <div className="dashboard-hero-overlay">
          <h1>Welcome back, Storyteller.</h1>
          <p>Your chronicle awaits.</p>
        </div>
      </section>

      <section className="dashboard-continue-section">
        <div className="section-heading"><h3>Continue Your Work</h3></div>
        <div className="dashboard-continue-grid">
          <${ContinueWorkCard} href="pages/sessions.html" label="Current Session" title=${currentSessionTitle} subtitle=${currentSessionSubtitle} />
          <${ContinueWorkCard} href="pages/gm-notes.html" label="GM Notebook" title=${notebookTitle} subtitle=${notebookSubtitle} />
          <${ContinueWorkCard} href="pages/relationship-map.html" label="Relationship Map" title=${mapTitle} subtitle=${mapSubtitle} />
          <${ContinueWorkCard} href=${data.lastEditedLocation ? "pages/locations.html?location=" + encodeURIComponent(data.lastEditedLocation.id) : "pages/locations.html"} label="Last Edited Location" title=${locationTitle} subtitle=${locationSubtitle} />
        </div>
      </section>

      <section className="dashboard-columns">
        <article className="card dashboard-activity-card" aria-labelledby="dashboard-activity-heading">
          <div className="section-heading">
            <h3 id="dashboard-activity-heading">Recent Activity</h3>
          </div>
          <${ActivityList} items=${data.recentActivity} />
        </article>

        <div className="dashboard-side-stack">
          <article className="card dashboard-pinned-card" aria-labelledby="dashboard-pinned-heading">
            <div className="section-heading">
              <h3 id="dashboard-pinned-heading">Pinned NPCs</h3>
              <a href="pages/characters.html">Manage</a>
            </div>
            <${PinnedNpcs} characters=${data.pinnedCharacters} />
          </article>

          <article className="card dashboard-sessions-card" aria-labelledby="dashboard-upcoming-heading">
            <div className="section-heading">
              <h3 id="dashboard-upcoming-heading">Upcoming Sessions</h3>
              <a href="pages/sessions.html">View all</a>
            </div>
            <${UpcomingSessions} sessions=${data.upcomingSessions} />
          </article>

          <article className="card dashboard-timeline-card" aria-labelledby="dashboard-timeline-heading">
            <div className="section-heading">
              <h3 id="dashboard-timeline-heading">Timeline Snapshot</h3>
              <a href="pages/timeline.html">Open Timeline</a>
            </div>
            <${TimelineSnapshot} events=${data.timelineSnapshot} />
          </article>
        </div>
      </section>
    </div>`;
  }

  var root = document.getElementById("homeDashboardApp");
  if (!root) {
    return;
  }
  ReactDOM.createRoot(root).render(React.createElement(Dashboard));
})();
