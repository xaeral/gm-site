(function () {
  var target = document.getElementById("notesContent");
  var scratchInput = document.getElementById("gmScratchpad");
  var status = document.getElementById("scratchStatus");
  var editableDocUrlInput = document.getElementById("editableDocUrl");
  var saveDocUrlBtn = document.getElementById("saveDocUrlBtn");
  var openEditableDocBtn = document.getElementById("openEditableDocBtn");
  var saveScratchBtn = document.getElementById("saveScratchBtn");
  var copyScratchBtn = document.getElementById("copyScratchBtn");
  var clearScratchBtn = document.getElementById("clearScratchBtn");

  var DRAFT_KEY = "gmDashboard.scratchDraft";
  var DOC_URL_KEY = "gmDashboard.editableDocUrl";
  var DEFAULT_DOC_URL = "https://docs.google.com/document/d/19F099MPiCUjggg-EI1INKBKQqRRpswrvCszTIH4KnN0/edit?tab=t.0";

  function setStatus(message) {
    if (status) {
      status.textContent = message;
    }
  }

  function loadWritebackState() {
    if (editableDocUrlInput) {
      editableDocUrlInput.value = localStorage.getItem(DOC_URL_KEY) || DEFAULT_DOC_URL;
    }

    if (scratchInput) {
      scratchInput.value = localStorage.getItem(DRAFT_KEY) || "";
    }
  }

  function saveDocUrl() {
    if (!editableDocUrlInput) {
      return;
    }

    var value = editableDocUrlInput.value.trim();
    if (!value) {
      localStorage.removeItem(DOC_URL_KEY);
      setStatus("Editable URL cleared.");
      return;
    }

    localStorage.setItem(DOC_URL_KEY, value);
    setStatus("Editable Google Doc URL saved.");
  }

  function openEditableDoc() {
    var storedUrl = localStorage.getItem(DOC_URL_KEY) || (editableDocUrlInput ? editableDocUrlInput.value.trim() : "");
    if (!storedUrl) {
      setStatus("Add and save your editable Google Doc URL first.");
      return;
    }

    window.open(storedUrl, "_blank", "noopener,noreferrer");
    setStatus("Opened editable Google Doc in a new tab.");
  }

  function saveDraft() {
    if (!scratchInput) {
      return;
    }

    localStorage.setItem(DRAFT_KEY, scratchInput.value || "");
    setStatus("Draft saved locally.");
  }

  function clearDraft() {
    if (!scratchInput) {
      return;
    }

    scratchInput.value = "";
    localStorage.removeItem(DRAFT_KEY);
    setStatus("Draft cleared.");
  }

  function copyDraft() {
    if (!scratchInput) {
      return;
    }

    var text = scratchInput.value || "";
    if (!text.trim()) {
      setStatus("Nothing to copy yet.");
      return;
    }

    navigator.clipboard.writeText(text)
      .then(function () {
        setStatus("Draft copied to clipboard.");
      })
      .catch(function () {
        scratchInput.focus();
        scratchInput.select();
        document.execCommand("copy");
        setStatus("Draft copied.");
      });
  }

  function bindWritebackActions() {
    loadWritebackState();

    if (saveDocUrlBtn) {
      saveDocUrlBtn.addEventListener("click", saveDocUrl);
    }

    if (openEditableDocBtn) {
      openEditableDocBtn.addEventListener("click", openEditableDoc);
    }

    if (saveScratchBtn) {
      saveScratchBtn.addEventListener("click", saveDraft);
    }

    if (copyScratchBtn) {
      copyScratchBtn.addEventListener("click", copyDraft);
    }

    if (clearScratchBtn) {
      clearScratchBtn.addEventListener("click", clearDraft);
    }
  }

  bindWritebackActions();

  if (!target) {
    return;
  }

  function htmlToReadableText(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");

    doc.querySelectorAll("script, style, noscript").forEach(function (el) {
      el.remove();
    });

    var candidates = [
      ".doc-content",
      ".kix-page-content-wrapper",
      ".kix-page",
      "main",
      "article",
      "body"
    ];

    var root = null;
    for (var i = 0; i < candidates.length; i += 1) {
      var found = doc.querySelector(candidates[i]);
      if (found) {
        root = found;
        break;
      }
    }

    if (!root) {
      root = doc.body;
    }

    var blocks = root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
    var lines = [];

    blocks.forEach(function (block) {
      var line = (block.textContent || "").replace(/\s+/g, " ").trim();
      if (line) {
        lines.push(line);
      }
    });

    if (!lines.length) {
      var fallback = (root.textContent || "").replace(/\s+/g, " ").trim();
      return fallback;
    }

    return lines.join("\n\n");
  }

  fetch("/integrations/gdocs-content", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Unable to load notes content");
      }
      return response.text();
    })
    .then(function (html) {
      var text = htmlToReadableText(html);
      var pre = document.createElement("pre");
      pre.className = "notes-pre";
      pre.textContent = text || "No readable text was found in the published notes source.";
      target.innerHTML = "";
      target.appendChild(pre);
    })
    .catch(function () {
      target.textContent = "Unable to load local notes view. Use the open-in-new-tab link above as a temporary fallback.";
    });
})();
