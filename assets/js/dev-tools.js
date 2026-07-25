(function () {
  if (!window.React || !window.ReactDOM || !window.htm) {
    return;
  }

  var useState = React.useState;
  var useRef = React.useRef;
  var html = htm.bind(React.createElement);
  var tools = window.ChronicleCampaignDataTools;

  var DANGER_ACTIONS = [
    {
      key: "relationshipMap",
      label: "Clear Relationship Map",
      description: "Deletes every character, relationship connection, and zone. Character portraits and timelines go with them, and the Characters page will also come up empty.",
      confirmLabel: "Clear Relationship Map",
      busyLabel: "Clearing...",
      run: function () { return tools.clearRelationshipMapData(); }
    },
    {
      key: "timeline",
      label: "Clear Timeline",
      description: "Deletes every custom timeline event from every character. Characters and relationships are left untouched.",
      confirmLabel: "Clear Timeline",
      busyLabel: "Clearing...",
      run: function () { return tools.clearTimelineData(); }
    },
    {
      key: "locations",
      label: "Clear Locations",
      description: "Deletes every location record from the Locations database.",
      confirmLabel: "Clear Locations",
      busyLabel: "Clearing...",
      run: function () { return tools.clearLocationsData(); }
    },
    {
      key: "sessions",
      label: "Clear Sessions",
      description: "Deletes every session recap in the Session Journal.",
      confirmLabel: "Clear Sessions",
      busyLabel: "Clearing...",
      run: function () { return tools.clearSessionsData(); }
    },
    {
      key: "gmNotes",
      label: "Clear GM Notes",
      description: "Deletes every note and folder in the GM Notes notebook.",
      confirmLabel: "Clear GM Notes",
      busyLabel: "Clearing...",
      run: function () { return tools.clearGmNotesData(); }
    }
  ];

  var CLEAR_ALL_ACTION = {
    key: "all",
    label: "Clear All Campaign Data",
    description: "Deletes every character, relationship, zone, timeline event, location, session, and GM note. Application settings are preserved.",
    confirmLabel: "Clear All Campaign Data",
    busyLabel: "Clearing...",
    run: function () { return tools.clearAllCampaignData(); }
  };

  function ConfirmModal(props) {
    var action = props.action;
    var onCancel = props.onCancel;
    var onConfirm = props.onConfirm;
    var busy = props.busy;

    var _confirmText = useState("");
    var confirmText = _confirmText[0];
    var setConfirmText = _confirmText[1];

    React.useEffect(function () {
      setConfirmText("");
    }, [action]);

    if (!action) {
      return null;
    }

    var requiresTyped = action.key === "all";
    var canConfirm = !busy && (!requiresTyped || confirmText.trim().toUpperCase() === "DELETE");

    return html`<div className="chronicle-modal" role="dialog" aria-modal="true" aria-label=${"Confirm: " + action.label}>
      <div className="chronicle-modal-backdrop" onClick=${busy ? undefined : onCancel}></div>
      <div className="chronicle-modal-panel card dev-tools-confirm-modal">
        <div className="chronicle-modal-head">
          <h3>${action.label}</h3>
          <button type="button" className="icon-button chronicle-modal-close-button" aria-label="Close dialog" onClick=${onCancel} disabled=${busy}>×</button>
        </div>
        <p className="dev-tools-confirm-copy">${action.description}</p>
        <p className="dev-tools-confirm-warning">This action cannot be undone.</p>
        ${requiresTyped ? html`<label className="dev-tools-confirm-type">
          <span>Type <strong>DELETE</strong> to enable this action</span>
          <input
            type="text"
            value=${confirmText}
            onInput=${function (event) { setConfirmText(event.target.value); }}
            autoFocus=${true}
            placeholder="DELETE"
            autoComplete="off"
          />
        </label>` : null}
        <div className="chronicle-modal-actions">
          <button type="button" onClick=${onCancel} disabled=${busy}>Cancel</button>
          <button type="button" className="dev-tools-danger-button" onClick=${onConfirm} disabled=${!canConfirm}>${busy ? action.busyLabel || "Working..." : "Confirm " + (action.confirmLabel || action.label)}</button>
        </div>
      </div>
    </div>`;
  }

  function DevToolsPanel() {
    var _pending = useState(null);
    var pendingAction = _pending[0];
    var setPendingAction = _pending[1];

    var _busy = useState(false);
    var busy = _busy[0];
    var setBusy = _busy[1];

    var _exporting = useState(false);
    var exporting = _exporting[0];
    var setExporting = _exporting[1];

    var _status = useState(null);
    var status = _status[0];
    var setStatus = _status[1];

    var fileInputRef = useRef(null);

    if (!tools) {
      return html`<section className="card dev-tools-card">
        <h3>Developer Tools</h3>
        <p className="note">Campaign data tools are unavailable in this browser.</p>
      </section>`;
    }

    function openConfirm(action) {
      setStatus(null);
      setPendingAction(action);
    }

    function closeConfirm() {
      if (busy) {
        return;
      }
      setPendingAction(null);
    }

    async function runAction() {
      if (!pendingAction) {
        return;
      }
      var action = pendingAction;
      setBusy(true);
      try {
        await action.run();
        setStatus({ type: "success", text: (action.completedLabel || action.label) + " completed." });
        setPendingAction(null);
      } catch (error) {
        setStatus({ type: "error", text: "Failed to complete " + action.label + ": " + (error && error.message ? error.message : "Unknown error") });
      } finally {
        setBusy(false);
      }
    }

    async function exportCampaign() {
      setStatus(null);
      setExporting(true);
      try {
        var fileName = await tools.exportCampaignToFile();
        setStatus({ type: "success", text: "Campaign exported to " + fileName + "." });
      } catch (error) {
        setStatus({ type: "error", text: "Failed to export campaign: " + (error && error.message ? error.message : "Unknown error") });
      } finally {
        setExporting(false);
      }
    }

    function triggerImportPicker() {
      setStatus(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
    }

    async function onImportFileSelected(event) {
      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      try {
        var payload = await tools.parseCampaignFile(file);
        openConfirm({
          key: "import",
          label: "Import Campaign",
          description: "Replaces every character, relationship, zone, timeline event, location, session, and GM note in this browser with the contents of “" + file.name + "”.",
          confirmLabel: "Import Campaign",
          completedLabel: "Campaign import",
          busyLabel: "Importing...",
          run: function () { return tools.importCampaignData(payload); }
        });
      } catch (error) {
        setStatus({ type: "error", text: "Could not import that file: " + (error && error.message ? error.message : "Unknown error") });
      }
    }

    return html`<section className="card dev-tools-card">
      <div className="section-heading">
        <h3>Developer Tools</h3>
        <span className="note-subtitle">Utilities for managing campaign data during development and testing.</span>
      </div>

      <div className="dev-tools-campaign-management">
        <div className="dev-tools-campaign-management-head">
          <h4>Campaign Management</h4>
          <p className="note">Export the current campaign to a JSON file, or import a previously exported campaign.</p>
        </div>
        <div className="dev-tools-campaign-actions">
          <button type="button" className="dev-tools-primary-button" onClick=${exportCampaign} disabled=${exporting}>${exporting ? "Exporting..." : "Export Campaign"}</button>
          <button type="button" className="dev-tools-primary-button" onClick=${triggerImportPicker}>Import Campaign</button>
          <input ref=${fileInputRef} type="file" accept="application/json,.json" hidden onChange=${onImportFileSelected} />
        </div>
      </div>

      <div className="dev-tools-danger-zone">
        <div className="dev-tools-danger-zone-head">
          <h4>Danger Zone</h4>
          <p className="note">These actions permanently delete persisted campaign data from this browser. Each requires confirmation.</p>
        </div>
        <div className="dev-tools-danger-actions">
          ${DANGER_ACTIONS.map(function (action) {
            return html`<button key=${action.key} type="button" className="dev-tools-danger-button" onClick=${function () { openConfirm(action); }}>${action.label}</button>`;
          })}
        </div>
        <div className="dev-tools-danger-zone-all">
          <button type="button" className="dev-tools-danger-button dev-tools-clear-all" onClick=${function () { openConfirm(CLEAR_ALL_ACTION); }}>${CLEAR_ALL_ACTION.label}</button>
        </div>
      </div>

      ${status ? html`<p className=${"dev-tools-status " + (status.type === "error" ? "dev-tools-status-error" : "dev-tools-status-success")} role="status">${status.text}</p>` : null}

      <${ConfirmModal} action=${pendingAction} onCancel=${closeConfirm} onConfirm=${runAction} busy=${busy} />
    </section>`;
  }

  var root = document.getElementById("devToolsApp");
  if (!root) {
    return;
  }
  ReactDOM.createRoot(root).render(React.createElement(DevToolsPanel));
})();
