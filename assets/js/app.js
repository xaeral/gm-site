(function () {
  var data = window.GMData;

  if (!data) {
    return;
  }

  function createItem(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text) {
      el.textContent = text;
    }
    return el;
  }

  function renderRecentNotes() {
    var list = document.getElementById("recentNotesList");
    if (!list) return;

    data.recentNotes.forEach(function (note) {
      var li = createItem("li", "stack-item");
      li.appendChild(createItem("strong", null, note.title));
      li.appendChild(createItem("p", null, note.summary));
      list.appendChild(li);
    });
  }

  function renderPinnedNPCs() {
    var list = document.getElementById("pinnedNpcList");
    if (!list) return;

    data.pinnedNPCs.forEach(function (npc) {
      var li = createItem("li", "stack-item");
      li.appendChild(createItem("strong", null, npc.name + " - " + npc.role));
      li.appendChild(createItem("p", null, npc.status + " | " + npc.detail));
      list.appendChild(li);
    });
  }

  function renderActiveThreads() {
    var list = document.getElementById("activeThreadsList");
    if (!list) return;

    data.activeThreads.forEach(function (thread) {
      var li = createItem("li", "stack-item");
      li.appendChild(createItem("strong", null, thread.thread));
      li.appendChild(createItem("p", null, "State: " + thread.state + " | Urgency: " + thread.urgency));
      list.appendChild(li);
    });
  }

  function renderTags(targetId, items) {
    var list = document.getElementById(targetId);
    if (!list) return;

    items.forEach(function (item) {
      var li = createItem("li", "tag-item", item);
      list.appendChild(li);
    });
  }

  function renderQuickLinks() {
    var list = document.getElementById("quickLinksList");
    if (!list) return;

    data.quickLinks.forEach(function (link) {
      var li = createItem("li", "link-item");
      var a = createItem("a", null, link.label);
      a.href = link.url;
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function buildSearchIndex() {
    var npcEntries = data.pinnedNPCs.map(function (npc) {
      return {
        type: "NPC",
        title: npc.name,
        description: npc.role + ". " + npc.detail,
        href: "#npcs"
      };
    });

    var noteEntries = data.recentNotes.map(function (note) {
      return {
        type: "Note",
        title: note.title,
        description: note.summary,
        href: "pages/gm-notes.html"
      };
    });

    var locationEntries = data.locations.map(function (location) {
      return {
        type: "Location",
        title: location,
        description: "Campaign location entry",
        href: "#locations"
      };
    });

    var clueEntries = data.clues.map(function (clue) {
      return {
        type: "Clue",
        title: clue,
        description: "Evidence trail",
        href: "#clues"
      };
    });

    return data.searchable.concat(npcEntries, noteEntries, locationEntries, clueEntries);
  }

  function renderSearchResults(entries) {
    var resultList = document.getElementById("searchResults");
    if (!resultList) return;

    resultList.innerHTML = "";

    if (!entries.length) {
      var empty = createItem("li", "result-item empty", "No matching content found.");
      resultList.appendChild(empty);
      return;
    }

    entries.slice(0, 8).forEach(function (entry) {
      var li = createItem("li", "result-item");
      var link = createItem("a", null, entry.title);
      link.href = entry.href;

      var meta = createItem("span", "result-meta", entry.type + " | " + entry.description);
      li.appendChild(link);
      li.appendChild(meta);
      resultList.appendChild(li);
    });
  }

  function setupSearch() {
    var input = document.getElementById("globalSearch");
    var clearBtn = document.getElementById("clearSearch");
    if (!input || !clearBtn) return;

    var index = buildSearchIndex();
    renderSearchResults(index.slice(0, 6));

    input.addEventListener("input", function () {
      var term = input.value.trim().toLowerCase();
      if (!term) {
        renderSearchResults(index.slice(0, 6));
        return;
      }

      var filtered = index.filter(function (entry) {
        var haystack = (entry.type + " " + entry.title + " " + entry.description).toLowerCase();
        return haystack.indexOf(term) !== -1;
      });

      renderSearchResults(filtered);
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      input.focus();
      renderSearchResults(index.slice(0, 6));
    });
  }

  renderRecentNotes();
  renderPinnedNPCs();
  renderActiveThreads();
  renderTags("locationList", data.locations);
  renderTags("clueList", data.clues);
  renderTags("sessionList", data.sessions);
  renderTags("encounterList", data.encounters);
  renderQuickLinks();
  setupSearch();
})();
