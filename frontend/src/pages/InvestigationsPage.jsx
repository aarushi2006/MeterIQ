import { useState, useEffect } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import Badge from "../components/Badge";
import { investigationService } from "../services/investigationService";

export default function InvestigationsPage({ onSelectMeterById, onShowToast, currentUser }) {
  const [investigations, setInvestigations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [activeCase, setActiveCase] = useState(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCases = async () => {
    const data = await investigationService.getInvestigations({
      status: statusFilter,
      region: regionFilter,
      search
    });
    setInvestigations(data);
    if (activeCase) {
      const refreshed = data.find((c) => c.id === activeCase.id);
      if (refreshed) setActiveCase(refreshed);
    }
  };

  useEffect(() => {
    loadCases();
  }, [statusFilter, regionFilter, search]);

  const openCount = investigations.filter((i) => i.status === "OPEN").length;
  const underReviewCount = investigations.filter((i) => i.status === "UNDER REVIEW").length;
  const resolvedCount = investigations.filter((i) => i.status === "RESOLVED").length;
  const falsePosCount = investigations.filter((i) => i.status === "FALSE POSITIVE").length;

  const handleStatusChange = async (caseId, newStatus) => {
    setIsSubmitting(true);
    await investigationService.updateStatus(caseId, newStatus, newStatus === "RESOLVED" || newStatus === "FALSE POSITIVE" ? resolutionText : null);
    await loadCases();
    setIsSubmitting(false);
    if (onShowToast) {
      onShowToast(`Case ${caseId} updated to ${newStatus}`, "success");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !activeCase) return;

    setIsSubmitting(true);
    await investigationService.addNote(activeCase.id, currentUser?.name || "Unknown Operator", newNoteText);
    setNewNoteText("");
    await loadCases();
    setIsSubmitting(false);
    if (onShowToast) {
      onShowToast("Audit note appended to case history", "info");
    }
  };

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>OPERATIONAL DECISION SUPPORT</label>
          <h1>Investigations Workflow</h1>
          <p>Human-in-the-loop review pipeline, evidence assessment, and resolution tracking.</p>
        </div>
      </section>

      {/* Workflow Diagram Banner */}
      <div className="workflow-banner">
        <div className="workflow-steps">
          <div className="wf-step">
            <span className="wf-num">1</span>
            <span className="wf-label">Anomaly Detected</span>
          </div>
          <span className="wf-arrow">→</span>
          <div className="wf-step">
            <span className="wf-num">2</span>
            <span className="wf-label">Risk Generated</span>
          </div>
          <span className="wf-arrow">→</span>
          <div className="wf-step">
            <span className="wf-num">3</span>
            <span className="wf-label">Review Recommended</span>
          </div>
          <span className="wf-arrow">→</span>
          <div className="wf-step highlight">
            <span className="wf-num">4</span>
            <span className="wf-label">Human Review</span>
          </div>
          <span className="wf-arrow">→</span>
          <div className="wf-step">
            <span className="wf-num">5</span>
            <span className="wf-label">Decision & Resolution</span>
          </div>
        </div>
      </div>

      {/* 4 Status KPIs */}
      <section className="stats">
        <Stat
          icon="!"
          title="Open Queue"
          value={String(openCount)}
          sub="Awaiting review assignment"
          tone="danger"
        />
        <Stat
          icon="⏳"
          title="Under Review"
          value={String(underReviewCount)}
          sub="Active engineer inspection"
          tone="warning"
        />
        <Stat
          icon="✓"
          title="Resolved"
          value={String(resolvedCount)}
          sub="Remediated / Verified"
          tone="success"
        />
        <Stat
          icon="🛡️"
          title="False Positives"
          value={String(falsePosCount)}
          sub="Documented grid variations"
        />
      </section>

      {/* Filter and Query Section */}
      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by Case ID, Meter ID, or Reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="clear-btn" onClick={() => setSearch("")}>✕</button>}
          </div>

          <div className="select-wrap">
            <label>Region</label>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="all">All Circles (Mathura & Bareilly)</option>
              <option value="Mathura">Mathura Circle</option>
              <option value="Bareilly">Bareilly Circle</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Case Status</label>
            <div className="range-pills">
              {["all", "OPEN", "UNDER REVIEW", "RESOLVED", "FALSE POSITIVE"].map((s) => (
                <button
                  key={s}
                  className={`range-pill ${statusFilter === s ? "active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "All Cases" : s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Investigations Table */}
      <article className="card">
        <CardHeader
          title="Investigation Cases"
          text={`${investigations.length} cases tracked across decision lifecycle`}
          right="Audited Decision-Support Log"
        />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Meter ID</th>
                <th>Region</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Detected</th>
                <th>Investigation Status</th>
                <th>Flag Reason</th>
                <th>Assigned Lead</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {investigations.map((c) => (
                <tr key={c.id} className="interactive-row" onClick={() => setActiveCase(c)}>
                  <td>
                    <span className="anomaly-id-pill">{c.id}</span>
                  </td>
                  <td>
                    <button
                      className="meter-link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMeterById(c.meterId);
                      }}
                    >
                      {c.meterId}
                    </button>
                  </td>
                  <td>
                    <span className="dimmed-val">📍 {c.region}</span>
                  </td>
                  <td>
                    <b className={`score-badge ${c.riskLevel.toLowerCase()}`}>
                      {c.riskScore.toFixed(2)}
                    </b>
                  </td>
                  <td>
                    <Badge risk={c.riskLevel} />
                  </td>
                  <td>
                    <span className="time-val">{c.detectedDate}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${c.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <span className="factors-snippet" title={c.reason}>
                      {c.reason}
                    </span>
                  </td>
                  <td>
                    <span className="dimmed-val">{c.assignedTo || "Unassigned"}</span>
                  </td>
                  <td>
                    <button
                      className="inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCase(c);
                      }}
                    >
                      Manage Case →
                    </button>
                  </td>
                </tr>
              ))}
              {investigations.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-table-cell">
                    No investigation cases found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Case Management Modal */}
      {activeCase && (
        <div className="modal-backdrop" onClick={() => setActiveCase(null)}>
          <div className="modal-card case-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-spark">🔍</span>
                <div>
                  <h2>Investigation: {activeCase.id}</h2>
                  <span className="modal-sub">
                    Meter {activeCase.meterId} · {activeCase.region} Circle ({activeCase.area})
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setActiveCase(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Top Case Summary */}
              <div className="case-meta-banner">
                <div>
                  <span className="meta-lbl">Risk Assessment</span>
                  <div className="meta-flex">
                    <span className={`hero-score ${activeCase.riskLevel.toLowerCase()}`}>
                      {activeCase.riskScore.toFixed(2)}
                    </span>
                    <Badge risk={activeCase.riskLevel} />
                  </div>
                </div>
                <div>
                  <span className="meta-lbl">Current Lifecycle Status</span>
                  <span className={`status-pill ${activeCase.status.toLowerCase().replace(/\s+/g, "-")}`}>
                    {activeCase.status}
                  </span>
                </div>
                <div>
                  <span className="meta-lbl">Assigned Investigator</span>
                  <strong>{activeCase.assignedTo || "Unassigned"}</strong>
                </div>
                <div>
                  <span className="meta-lbl">Detection Date</span>
                  <span>{activeCase.detectedDate}</span>
                </div>
              </div>

              {/* Evidence and Reason */}
              <div className="evidence-block">
                <h4>Observed Telemetry Evidence</h4>
                <div className="evidence-box">
                  <p><b>Flag Reason:</b> {activeCase.reason}</p>
                  <p><b>Supporting Data:</b> {activeCase.evidence}</p>
                </div>
              </div>

              {/* Resolution Notes if resolved */}
              {activeCase.resolution && (
                <div className="resolution-block">
                  <h4>Documented Resolution</h4>
                  <div className="resolution-box">
                    <p>{activeCase.resolution}</p>
                  </div>
                </div>
              )}

              {/* Status Transition Action Bar */}
              <div className="status-transition-bar">
                <h4>Transition Case Status:</h4>
                <div className="transition-buttons">
                  <button
                    className={`tr-btn ${activeCase.status === "OPEN" ? "active" : ""}`}
                    onClick={() => handleStatusChange(activeCase.id, "OPEN")}
                    disabled={isSubmitting}
                  >
                    Set OPEN
                  </button>
                  <button
                    className={`tr-btn ${activeCase.status === "UNDER REVIEW" ? "active" : ""}`}
                    onClick={() => handleStatusChange(activeCase.id, "UNDER REVIEW")}
                    disabled={isSubmitting}
                  >
                    Set UNDER REVIEW
                  </button>
                  <button
                    className={`tr-btn success ${activeCase.status === "RESOLVED" ? "active" : ""}`}
                    onClick={() => {
                      const res = prompt("Enter resolution notes (e.g., Verified hardware maintenance completed):", activeCase.resolution || "");
                      if (res !== null) {
                        setResolutionText(res);
                        handleStatusChange(activeCase.id, "RESOLVED");
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Resolve Case ✓
                  </button>
                  <button
                    className={`tr-btn neutral ${activeCase.status === "FALSE POSITIVE" ? "active" : ""}`}
                    onClick={() => {
                      const res = prompt("Enter false positive justification (e.g., Scheduled grid branch maintenance outage):", activeCase.resolution || "");
                      if (res !== null) {
                        setResolutionText(res);
                        handleStatusChange(activeCase.id, "FALSE POSITIVE");
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Mark False Positive 🛡️
                  </button>
                </div>
              </div>

              {/* Audit Notes Log */}
              <div className="case-notes-section">
                <h4>Audit Trail & Investigator Notes ({activeCase.notes?.length || 0})</h4>
                <div className="notes-list">
                  {(activeCase.notes || []).map((n, idx) => (
                    <div key={idx} className="note-item">
                      <div className="note-head">
                        <b>{n.author}</b>
                        <small>{n.time}</small>
                      </div>
                      <p className="note-text">{n.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddNote} className="add-note-form">
                  <input
                    type="text"
                    placeholder="Add operational notes or field inspection remarks..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    required
                  />
                  <button type="submit" className="primary" disabled={isSubmitting}>
                    Add Note
                  </button>
                </form>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary"
                onClick={() => onSelectMeterById(activeCase.meterId)}
              >
                View Meter Telemetry →
              </button>
              <button className="primary" onClick={() => setActiveCase(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
