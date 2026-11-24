import { useState } from "react";
import { alerts, investigators } from "../data/mockData";
import CardHeader from "../components/CardHeader";

export default function AlertsPage() {
  const [filter, setFilter] = useState("all");
  const [alertList, setAlertList] = useState(alerts);

  const filtered = filter === "all" ? alertList : alertList.filter((a) => a.status === filter);

  const openCount = alertList.filter((a) => a.status === "Open").length;
  const investigatingCount = alertList.filter((a) => a.status === "Investigating").length;
  const resolvedCount = alertList.filter((a) => a.status === "Resolved").length;

  const handleAssign = (alertId, name) => {
    setAlertList((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, assignedTo: name, status: "Investigating" } : a))
    );
  };

  const handleResolve = (alertId) => {
    setAlertList((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: "Resolved" } : a))
    );
  };

  return (
    <>
      <section className="page-header">
        <label>ALERT MANAGEMENT</label>
        <h1>Alerts</h1>
        <p>Track, assign, and resolve meter alerts and anomalies.</p>
      </section>

      <section className="stats">
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>!</span>
            <span className="stat-label">Open</span>
          </div>
          <h2>{openCount}</h2>
          <small>Needs attention</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>⏳</span>
            <span className="stat-label">Investigating</span>
          </div>
          <h2>{investigatingCount}</h2>
          <small>Assigned to team</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>✓</span>
            <span className="stat-label">Resolved</span>
          </div>
          <h2>{resolvedCount}</h2>
          <small>Completed</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>👥</span>
            <span className="stat-label">Team</span>
          </div>
          <h2>{investigators.length}</h2>
          <small>Active investigators</small>
        </article>
      </section>

      <section className="alert-filters">
        {["all", "Open", "Investigating", "Resolved"].map((f) => (
          <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Alerts" : f}
          </button>
        ))}
      </section>

      <article className="card">
        <CardHeader title="Alert List" text={`${filtered.length} alerts`} right="" />
        <div className="alert-list">
          {filtered.map((a) => (
            <div key={a.id} className={`alert-item ${a.priority.toLowerCase()}`}>
              <div className="alert-left">
                <span className={`alert-type ${a.type.toLowerCase()}`}>{a.type}</span>
                <div>
                  <strong>{a.meter}</strong>
                  <p>{a.message}</p>
                  <span className="alert-time">{a.time}</span>
                </div>
              </div>
              <div className="alert-right">
                <span className={`alert-status ${a.status.toLowerCase()}`}>{a.status}</span>
                {a.assignedTo && <span className="alert-assignee">→ {a.assignedTo}</span>}
                {a.status === "Open" && (
                  <select className="alert-assign" onChange={(e) => e.target.value && handleAssign(a.id, e.target.value)}>
                    <option value="">Assign...</option>
                    {investigators.filter((i) => i.name !== "IT Team").map((i) => (
                      <option key={i.name} value={i.name}>{i.name}</option>
                    ))}
                  </select>
                )}
                {a.status === "Investigating" && (
                  <button className="resolve-btn" onClick={() => handleResolve(a.id)}>Resolve</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card" style={{ marginTop: "20px" }}>
        <CardHeader title="Team Workload" text="Investigator assignment summary" right="" />
        <div className="team-workload">
          {investigators.map((i) => (
            <div key={i.name} className="workload-card">
              <div className="workload-avatar">{i.name.split(" ").map((n) => n[0]).join("")}</div>
              <div>
                <strong>{i.name}</strong>
                <small>{i.role}</small>
              </div>
              <div className="workload-stats">
                <span>{i.assigned} active</span>
                <span>{i.resolved} resolved</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
