(function () {
  if (window.ChronicleHomeDashboard) {
    return;
  }

  function normalizeString(value, fallback) {
    var next = String(value || "").trim();
    return next || String(fallback || "");
  }

  function parseTimestamp(value) {
    if (!value) {
      return 0;
    }
    var parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseDateOnly(value) {
    var raw = normalizeString(value, "");
    if (!raw) {
      return 0;
    }
    var parsed = Date.parse(raw.length <= 10 ? raw + "T00:00:00" : raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatRelativeTime(value) {
    var timestamp = parseTimestamp(value);
    if (!timestamp) {
      return "";
    }
    var diffMs = Date.now() - timestamp;
    if (diffMs < 0) {
      diffMs = 0;
    }
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;
    var week = 7 * day;
    var month = 30 * day;
    var year = 365 * day;

    if (diffMs < minute) {
      return "Just now";
    }
    if (diffMs < hour) {
      var minutes = Math.floor(diffMs / minute);
      return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    }
    if (diffMs < day) {
      var hours = Math.floor(diffMs / hour);
      return hours + (hours === 1 ? " hour ago" : " hours ago");
    }
    if (diffMs < week) {
      var days = Math.floor(diffMs / day);
      return days + (days === 1 ? " day ago" : " days ago");
    }
    if (diffMs < month) {
      var weeks = Math.floor(diffMs / week);
      return weeks + (weeks === 1 ? " week ago" : " weeks ago");
    }
    if (diffMs < year) {
      var months = Math.floor(diffMs / month);
      return months + (months === 1 ? " month ago" : " months ago");
    }
    var years = Math.floor(diffMs / year);
    return years + (years === 1 ? " year ago" : " years ago");
  }

  function formatScheduledDate(value) {
    var raw = normalizeString(value, "");
    if (!raw) {
      return "Date not set";
    }
    var parsed = new Date(raw.length <= 10 ? raw + "T00:00:00" : raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
  }

  async function readDashboardState() {
    var atlasShared = window.CampaignAtlasCharactersShared;
    var characterService = window.CharacterService;
    var relationshipService = window.RelationshipService;
    var sessionJournal = window.ChronicleSessionJournal;
    var notebook = window.ChronicleNotebook;

    var characters = characterService ? await characterService.getAll() : [];
    var relationships = relationshipService ? await relationshipService.getAll() : [];
    var locations = atlasShared && atlasShared.readLocationRecords
      ? await atlasShared.readLocationRecords()
      : [];
    var sessionState = sessionJournal && sessionJournal.readSessionJournalState
      ? await sessionJournal.readSessionJournalState()
      : { sessions: [] };
    var notebookState = notebook && notebook.readNotebookState
      ? await notebook.readNotebookState()
      : { folders: [], notes: [] };

    var sessions = sessionState.sessions || [];
    var notes = notebookState.notes || [];

    var characterById = {};
    characters.forEach(function (character) {
      characterById[character.id] = character;
    });

    function characterName(id) {
      var character = characterById[id];
      return character ? normalizeString(character.name, "Unnamed Character") : "Unknown Character";
    }

    // ---- Continue Your Work ----
    var sortedSessionsByEdit = sessions.slice().sort(function (a, b) {
      return parseTimestamp(b.lastEditedAt || b.updatedAt) - parseTimestamp(a.lastEditedAt || a.updatedAt);
    });
    var currentSession = sortedSessionsByEdit[0] || null;

    var sortedNotesByEdit = notes.slice().sort(function (a, b) {
      return parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt);
    });
    var latestNote = sortedNotesByEdit[0] || null;

    var sortedLocationsByEdit = locations.slice().sort(function (a, b) {
      return parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt);
    });
    var lastEditedLocation = sortedLocationsByEdit[0] || null;

    // ---- Pinned NPCs ----
    var pinnedCharacters = characters
      .filter(function (character) { return Boolean(character.pinned); })
      .map(function (character) {
        var relCount = relationships.filter(function (relationship) {
          return relationship && (relationship.from === character.id || relationship.to === character.id);
        }).length;
        return {
          id: character.id,
          name: normalizeString(character.name, "Unnamed Character"),
          clan: normalizeString(character.clan, "None"),
          generation: normalizeString(character.generation, ""),
          portrait: character.portrait,
          relationshipCount: relCount
        };
      })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });

    // ---- Upcoming Sessions ----
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayTimestamp = today.getTime();
    var upcomingSessions = sessions
      .filter(function (session) {
        var ts = parseDateOnly(session.datePlayed);
        return ts > 0 && ts >= todayTimestamp;
      })
      .sort(function (a, b) { return parseDateOnly(a.datePlayed) - parseDateOnly(b.datePlayed); })
      .slice(0, 5)
      .map(function (session) {
        return {
          id: session.id,
          sessionNumber: session.sessionNumber,
          title: normalizeString(session.title, "Untitled Session"),
          datePlayed: session.datePlayed,
          scheduledLabel: formatScheduledDate(session.datePlayed)
        };
      });

    // ---- Timeline Snapshot ----
    var timelineEntries = [];
    characters.forEach(function (character) {
      (character.timeline || []).forEach(function (event, index) {
        timelineEntries.push({
          key: character.id + ":" + (event.id || index),
          characterId: character.id,
          characterName: normalizeString(character.name, "Unnamed Character"),
          title: normalizeString(event.title, "Untitled Event"),
          date: event.date || "",
          createdAt: event.createdAt || "",
          sortValue: parseTimestamp(event.createdAt) || parseDateOnly(event.date)
        });
      });
    });
    var timelineSnapshot = timelineEntries
      .sort(function (a, b) { return b.sortValue - a.sortValue; })
      .slice(0, 6);

    // ---- Recent Activity feed ----
    var activity = [];

    characters.forEach(function (character) {
      if (!character.updatedAt) {
        return;
      }
      activity.push({
        key: "character:" + character.id,
        type: "character",
        icon: "👤",
        label: "Character updated",
        title: normalizeString(character.name, "Unnamed Character"),
        timestamp: character.updatedAt,
        href: "pages/characters.html?character=" + encodeURIComponent(character.id)
      });
    });

    relationships.forEach(function (relationship, index) {
      if (!relationship || !relationship.updatedAt) {
        return;
      }
      activity.push({
        key: "relationship:" + (relationship.id || index),
        type: "relationship",
        icon: "🔗",
        label: "Relationship updated",
        title: characterName(relationship.from) + " & " + characterName(relationship.to),
        timestamp: relationship.updatedAt,
        href: "pages/relationship-map.html"
      });
    });

    sessions.forEach(function (session) {
      var timestamp = session.lastEditedAt || session.updatedAt;
      if (!timestamp) {
        return;
      }
      activity.push({
        key: "session:" + session.id,
        type: "session",
        icon: "📖",
        label: "Session updated",
        title: "Session " + (session.sessionNumber || "?") + ": " + normalizeString(session.title, "Untitled Session"),
        timestamp: timestamp,
        href: "pages/sessions.html"
      });
    });

    locations.forEach(function (location) {
      if (!location.updatedAt) {
        return;
      }
      activity.push({
        key: "location:" + location.id,
        type: "location",
        icon: "📍",
        label: "Location updated",
        title: normalizeString(location.name, "Unnamed Location"),
        timestamp: location.updatedAt,
        href: "pages/locations.html?location=" + encodeURIComponent(location.id)
      });
    });

    timelineEntries.forEach(function (entry) {
      if (!entry.createdAt) {
        return;
      }
      activity.push({
        key: "timeline:" + entry.key,
        type: "timeline",
        icon: "🕒",
        label: "Timeline event added",
        title: entry.title + " (" + entry.characterName + ")",
        timestamp: entry.createdAt,
        href: "pages/timeline.html"
      });
    });

    notes.forEach(function (note) {
      if (!note.updatedAt) {
        return;
      }
      activity.push({
        key: "note:" + note.id,
        type: "note",
        icon: "📝",
        label: "Note updated",
        title: normalizeString(note.title, "Untitled Note"),
        timestamp: note.updatedAt,
        href: "pages/gm-notes.html"
      });
    });

    var recentActivity = activity
      .sort(function (a, b) { return parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp); })
      .slice(0, 12)
      .map(function (item) {
        return Object.assign({}, item, { relativeLabel: formatRelativeTime(item.timestamp) });
      });

    return {
      characters: characters,
      relationships: relationships,
      locations: locations,
      sessions: sessions,
      notes: notes,
      currentSession: currentSession,
      latestNote: latestNote,
      lastEditedLocation: lastEditedLocation,
      pinnedCharacters: pinnedCharacters,
      upcomingSessions: upcomingSessions,
      timelineSnapshot: timelineSnapshot,
      recentActivity: recentActivity
    };
  }

  window.ChronicleHomeDashboard = {
    readDashboardState: readDashboardState,
    formatRelativeTime: formatRelativeTime,
    formatScheduledDate: formatScheduledDate
  };
})();
