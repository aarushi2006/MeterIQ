import { useState } from "react";
import CardHeader from "../components/CardHeader";

export default function Settings() {
  const [threshold, setThreshold] = useState(0.65);
  const [sensitivity, setSensitivity] = useState("medium");
  const [notifications, setNotifications] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);

  return (
    <>
      <section className="page-header">
        <label>SYSTEM CONFIGURATION</label>
        <h1>Settings</h1>
        <p>Configure anomaly detection thresholds and system preferences.</p>
      </section>

      <section className="grid2">
        <article className="card">
          <CardHeader title="Detection Thresholds" text="Adjust sensitivity for anomaly detection" right="" />
          <div className="settings-form">
            <div className="setting-group">
              <label>Anomaly Score Threshold</label>
              <p>Alerts trigger when score exceeds this value</p>
              <div className="threshold-control">
                <input type="range" min="0.3" max="0.95" step="0.05" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} />
                <span className="threshold-value">{threshold.toFixed(2)}</span>
              </div>
              <div className="threshold-labels">
                <span>More alerts (0.30)</span>
                <span>Fewer alerts (0.95)</span>
              </div>
            </div>
            <div className="setting-group">
              <label>Detection Sensitivity</label>
              <p>Higher sensitivity catches more anomalies but may increase false positives</p>
              <div className="sensitivity-options">
                {["low", "medium", "high"].map((s) => (
                  <button key={s} className={`sensitivity-btn ${sensitivity === s ? "active" : ""}`} onClick={() => setSensitivity(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="card">
          <CardHeader title="System Preferences" text="Notification and automation settings" right="" />
          <div className="settings-form">
            <div className="setting-toggle">
              <div>
                <strong>Email Notifications</strong>
                <small>Receive alerts via email</small>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-toggle">
              <div>
                <strong>Auto-Assign Alerts</strong>
                <small>Automatically assign high-priority alerts</small>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-group">
              <label>Default City View</label>
              <select className="setting-select">
                <option>All Cities</option>
                <option>Mathura</option>
                <option>Bareilly</option>
              </select>
            </div>
            <div className="setting-group">
              <label>Report Format</label>
              <select className="setting-select">
                <option>PDF</option>
                <option>CSV</option>
                <option>Excel</option>
              </select>
            </div>
          </div>
        </article>
      </section>

      <article className="card" style={{ marginTop: "20px" }}>
        <CardHeader title="Current Configuration Summary" text="Active system settings" right="" />
        <div className="config-summary">
          <div className="config-item">
            <span className="config-label">Threshold</span>
            <span className="config-value">{threshold.toFixed(2)}</span>
          </div>
          <div className="config-item">
            <span className="config-label">Sensitivity</span>
            <span className="config-value">{sensitivity}</span>
          </div>
          <div className="config-item">
            <span className="config-label">Notifications</span>
            <span className="config-value">{notifications ? "Enabled" : "Disabled"}</span>
          </div>
          <div className="config-item">
            <span className="config-label">Auto-Assign</span>
            <span className="config-value">{autoAssign ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
        <div className="config-actions">
          <button className="primary" style={{ background: "#2563eb", color: "#fff", border: "0", borderRadius: "8px", padding: "10px 20px", font: "600 13px Inter", cursor: "pointer" }}>Save Configuration</button>
          <button className="secondary" style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "8px", padding: "10px 20px", font: "600 13px Inter", cursor: "pointer" }}>Reset to Defaults</button>
        </div>
      </article>
    </>
  );
}
