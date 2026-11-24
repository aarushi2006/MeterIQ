import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import {
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  LoadingState,
} from "../components/StateViews";
import { authService } from "../services/authService";
import { investigationService } from "../services/investigationService";
import { meterService } from "../services/meterService";

const STATUSES = ["OPEN", "IN PROGRESS", "RESOLVED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en-IN").format(number);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status) {
  return String(status || "OPEN").toLowerCase().replace(/\s+/g, "-");
}

export default function InvestigationsPage({
  currentUser,
  onSelectMeterById,
  onShowToast,
}) {
  const canManage = authService.isSupervisor(currentUser);

  const [cases, setCases] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ OPEN: 0, "IN PROGRESS": 0, RESOLVED: 0, total: 0 });
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [activeId, setActiveId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [resolution, setResolution] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    meter_id: "",
    region: "",
    reason: "",
    priority: "MEDIUM",
    assignedTo: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    meterService
      .getMeters({ page: 1, pageSize: 1 })
      .then((data) => {
        if (active) setRegions(data.regions || []);
      })
      .catch(() => {
        if (active) setRegions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await investigationService.getInvestigations({
        status,
        region,
        search: debouncedSearch,
      });
      setCases(data.investigations || []);
      setStatusCounts(
        data.statusCounts || { OPEN: 0, "IN PROGRESS": 0, RESOLVED: 0, total: 0 }
      );
    } catch (err) {
      setError(err.message || "Unable to load investigations.");
    } finally {
      setLoading(false);
    }
  }, [status, region, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCase = useMemo(
    () => cases.find((item) => item._id === activeId || item.id === activeId) || null,
    [cases, activeId]
  );

  useEffect(() => {
    if (activeCase) {
      setAssignee(activeCase.assignedTo || "");
      setPriority(activeCase.priority || "MEDIUM");
      setResolution(activeCase.resolution || "");
      setNoteText("");
    }
  }, [activeCase?._id]);

  const replaceCase = (updated) => {
    setCases((current) =>
      current.map((item) =>
        item._id === updated._id || item.id === updated.id ? updated : item
      )
    );
  };

  const handleStatusChange = async (nextStatus) => {
    if (!activeCase || !canManage) return;
    if (nextStatus === "RESOLVED" && !resolution.trim()) {
      onShowToast?.("Enter a resolution note before resolving the case.", "warning");
      return;
    }

    setSaving(true);
    try {
      const updated = await investigationService.updateStatus(
        activeCase.id,
        nextStatus,
        nextStatus === "RESOLVED" ? resolution.trim() : null
      );
      replaceCase(updated);
      onShowToast?.(`Case ${updated.id} moved to ${nextStatus}`, "success");
    } catch (err) {
      onShowToast?.(err.message || "Unable to update the case.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCaseUpdate = async () => {
    if (!activeCase || !canManage) return;
    setSaving(true);
    try {
      const updated = await investigationService.updateCase(activeCase.id, {
        priority,
        assignedTo: assignee.trim(),
      });
      replaceCase(updated);
      onShowToast?.("Case assignment and priority updated.", "success");
    } catch (err) {
      onShowToast?.(err.message || "Unable to update the case.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!activeCase || !noteText.trim()) return;
    setSaving(true);
    try {
      const updated = await investigationService.addNote(activeCase.id, noteText.trim());
      replaceCase(updated);
      setNoteText("");
      onShowToast?.("Note added to the case history.", "success");
    } catch (err) {
      onShowToast?.(err.message || "Unable to add the note.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canManage || creating) return;

    if (!createForm.meter_id.trim() || !createForm.reason.trim()) {
      setCreateError("Meter ID and reason are required.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await investigationService.create({
        meter_id: createForm.meter_id.trim(),
        region: createForm.region || undefined,
        reason: createForm.reason.trim(),
        priority: createForm.priority,
        assignedTo: createForm.assignedTo.trim() || undefined,
        detectedDate: new Date().toISOString(),
      });
      setCreateOpen(false);
      setCreateForm({ meter_id: "", region: "", reason: "", priority: "MEDIUM", assignedTo: "" });
      onShowToast?.(`Investigation ${created.id} created`, "success");
      setActiveId(created._id);
      await load();
    } catch (err) {
      setCreateError(err.message || "Unable to create the investigation.");
    } finally {
      setCreating(false);
    }
  };

  const openCreate = () => {
    setCreateForm({
      meter_id: "",
      region: "",
      reason: "",
      priority: "MEDIUM",
      assignedTo: "",
    });
    setCreateError(null);
    setCreateOpen(true);
  };

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>HUMAN-IN-THE-LOOP WORKFLOW</label>
          <h1>Investigation Management</h1>
          <p>
            Track verification work for flagged meters. Cases, assignments, notes, and
            history are stored in MongoDB through the MeterIQ API.
          </p>
        </div>
        {canManage && (
          <button className="primary action-btn" onClick={openCreate}>
            + New investigation
          </button>
        )}
      </section>

      {!canManage && (
        <InlineNotice tone="info">
          Your analyst role can review cases and add notes. Only a supervisor or
          administrator can create cases, change status, reassign, or set priority.
        </InlineNotice>
      )}

      <section className="stats kpi-grid-4">
        <Stat icon="📁" label="Total cases" value={formatNumber(statusCounts.total)} sub="Stored in MongoDB" />
        <Stat icon="🟡" label="Open" value={formatNumber(statusCounts.OPEN)} sub="Awaiting triage" />
        <Stat
          icon="🔵"
          label="In progress"
          value={formatNumber(statusCounts["IN PROGRESS"])}
          sub="Under investigation"
        />
        <Stat
          icon="✅"
          label="Resolved"
          value={formatNumber(statusCounts.RESOLVED)}
          sub="Closed with a resolution"
        />
      </section>

      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              placeholder="Search case ID, meter, reason, or assignee…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search investigations"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch("")} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>

          <div className="select-wrap">
            <label htmlFor="case-status">Status</label>
            <select id="case-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="case-region">Region</label>
            <select id="case-region" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="all">All regions</option>
              {regions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label>&nbsp;</label>
            <button className="secondary action-btn" onClick={load} disabled={loading}>
              Refresh cases
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <ErrorState title="Investigations unavailable" message={error} onRetry={load} />
      ) : loading && cases.length === 0 ? (
        <LoadingState label="Loading investigation cases…" />
      ) : (
        <section className="investigations-layout">
          <div className="case-list">
            <CardHeader
              title="Case queue"
              text={`${cases.length} case${cases.length === 1 ? "" : "s"} in the current view`}
              right={loading ? <span className="muted-text">Refreshing…</span> : null}
            />
            {cases.length === 0 ? (
              <EmptyState
                title="No cases match these filters"
                message="Adjust the search or status filter, or create a new investigation."
              />
            ) : (
              cases.map((item) => (
                <button
                  key={item._id || item.id}
                  className={`case-card ${activeCase?._id === item._id ? "active" : ""}`}
                  onClick={() => setActiveId(item._id)}
                >
                  <div className="case-card-top">
                    <span className="case-id">{item.id}</span>
                    <span className={`status-pill ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <strong className="case-meter">{item.meter_id}</strong>
                  <span className="case-region">{item.region || "Unknown region"}</span>
                  <p className="case-reason">{item.reason}</p>
                  <div className="case-card-bottom">
                    <span className={`priority-pill ${String(item.priority).toLowerCase()}`}>
                      {item.priority}
                    </span>
                    <span className="case-date">{formatDateTime(item.updatedAt || item.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="case-detail">
            {activeCase ? (
              <article className="card">
                <div className="case-detail-header">
                  <div>
                    <span className="case-id">{activeCase.id}</span>
                    <h3>Meter {activeCase.meter_id}</h3>
                    <p>
                      {activeCase.region || "Unknown region"} · opened{" "}
                      {formatDateTime(activeCase.createdAt)}
                    </p>
                  </div>
                  <div className="case-detail-badges">
                    <Badge risk={activeCase.riskLevel} />
                    <span className={`status-pill ${statusClass(activeCase.status)}`}>
                      {activeCase.status}
                    </span>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="spec-item">
                    <span className="spec-label">Priority</span>
                    <strong className="spec-value">{activeCase.priority}</strong>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Assigned to</span>
                    <strong className="spec-value">{activeCase.assignedTo || "Unassigned"}</strong>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Risk score</span>
                    <strong className="spec-value">
                      {Number.isFinite(Number(activeCase.riskScore))
                        ? Number(activeCase.riskScore).toFixed(2)
                        : "—"}
                    </strong>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Created by</span>
                    <strong className="spec-value">{activeCase.createdBy || "—"}</strong>
                  </div>
                </div>

                <div className="case-block">
                  <h4>Reason</h4>
                  <p>{activeCase.reason}</p>
                  {activeCase.evidence && (
                    <p className="case-evidence">Evidence: {activeCase.evidence}</p>
                  )}
                </div>

                {activeCase.resolution && (
                  <div className="case-block">
                    <h4>Resolution</h4>
                    <p>{activeCase.resolution}</p>
                  </div>
                )}

                {canManage && (
                  <div className="case-block">
                    <h4>Case actions</h4>
                    <div className="case-form-grid">
                      <Field label="Priority">
                        <select
                          value={priority}
                          onChange={(event) => setPriority(event.target.value)}
                        >
                          {PRIORITIES.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Assigned to" hint="Name or team recorded in the case history">
                        <input
                          type="text"
                          value={assignee}
                          onChange={(event) => setAssignee(event.target.value)}
                          placeholder="e.g. Field verification team"
                        />
                      </Field>
                    </div>
                    <div className="case-action-row">
                      <button
                        className="secondary"
                        onClick={handleCaseUpdate}
                        disabled={saving}
                      >
                        Save assignment & priority
                      </button>
                      {STATUSES.filter((item) => item !== activeCase.status).map((item) => (
                        <button
                          key={item}
                          className={item === "RESOLVED" ? "primary" : "secondary"}
                          onClick={() => handleStatusChange(item)}
                          disabled={saving}
                        >
                          Move to {item}
                        </button>
                      ))}
                    </div>
                    {activeCase.status !== "RESOLVED" && (
                      <Field label="Resolution note" hint="Required before resolving the case">
                        <textarea
                          rows={2}
                          value={resolution}
                          onChange={(event) => setResolution(event.target.value)}
                          placeholder="What was verified, and what was the outcome?"
                        />
                      </Field>
                    )}
                  </div>
                )}

                <div className="case-block">
                  <h4>Notes</h4>
                  {activeCase.notes?.length ? (
                    <div className="note-list">
                      {activeCase.notes.map((note, index) => (
                        <div key={`${note.time}-${index}`} className="note-item">
                          <div className="note-meta">
                            <strong>{note.author}</strong>
                            <span>{formatDateTime(note.time)}</span>
                          </div>
                          <p>{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-text">No notes have been added yet.</p>
                  )}
                  <div className="note-input-row">
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Add an operational note…"
                    />
                    <button
                      className="primary"
                      onClick={handleAddNote}
                      disabled={saving || !noteText.trim()}
                    >
                      Add note
                    </button>
                  </div>
                </div>

                <div className="case-block">
                  <h4>History</h4>
                  {activeCase.history?.length ? (
                    <ul className="history-list">
                      {[...activeCase.history].reverse().map((entry, index) => (
                        <li key={`${entry.at}-${index}`}>
                          <span className="history-action">{entry.action.replace(/_/g, " ")}</span>
                          <span className="history-detail">{entry.detail}</span>
                          <span className="history-meta">
                            {entry.by} · {formatDateTime(entry.at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted-text">No history entries recorded.</p>
                  )}
                </div>

                <div className="case-detail-footer">
                  <button
                    className="secondary"
                    onClick={() => onSelectMeterById?.(activeCase.meter_id)}
                  >
                    Open meter diagnostics →
                  </button>
                </div>
              </article>
            ) : (
              <article className="card">
                <EmptyState
                  title="Select a case"
                  message="Choose a case from the queue to review its details, notes, and history."
                />
              </article>
            )}
          </div>
        </section>
      )}

      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <form
            className="modal-card modal-wide"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreate}
          >
            <div className="modal-header">
              <div>
                <h3>New investigation</h3>
                <span className="modal-sub">
                  The server assigns the case ID and records this action in the history.
                </span>
              </div>
              <button type="button" className="modal-close" onClick={() => setCreateOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              {createError && <InlineNotice tone="error">{createError}</InlineNotice>}
              <div className="case-form-grid">
                <Field label="Meter ID">
                  <input
                    type="text"
                    value={createForm.meter_id}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, meter_id: event.target.value }))
                    }
                    placeholder="e.g. BR02"
                    required
                  />
                </Field>
                <Field label="Region">
                  <input
                    type="text"
                    list="case-region-options"
                    value={createForm.region}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, region: event.target.value }))
                    }
                    placeholder="Region"
                  />
                  <datalist id="case-region-options">
                    {regions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Priority">
                  <select
                    value={createForm.priority}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  >
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Assign to" hint="Optional">
                  <input
                    type="text"
                    value={createForm.assignedTo}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, assignedTo: event.target.value }))
                    }
                    placeholder="Name or team"
                  />
                </Field>
              </div>
              <Field label="Reason" hint="Record what prompted this investigation">
                <textarea
                  rows={3}
                  value={createForm.reason}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  placeholder="Describe the anomaly indicator or verification request…"
                  required
                />
              </Field>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={creating}>
                {creating ? "Creating case…" : "Create investigation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
