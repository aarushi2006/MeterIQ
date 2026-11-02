import { useState } from "react";
import CardHeader from "../components/CardHeader";

export default function Settings({ onShowToast }) {
  const [threshold, setThreshold] = useState(0.65);
  const [sensitivity, setSensitivity] = useState("medium");
  const [notifications, setNotifications] = useState(true);
  const [autoTriage, setAutoTriage] = useState(false);
  const [preferredCircle, setPreferredCircle] = useState("All Circles");

  const handleSave = () => {
    if (onShowToast) {
      onShowToast("Platform detection settings saved successfully", "success");
    }
  };

  const handleReset = () => {
    setThreshold(0.65);
    setSensitivity("medium");
    setNotifications(true);
    setAutoTriage(false);
    setPreferredCircle("All Circles");
    if (onShowToast) {
      onShowToast("Settings reset to utility defaults", "info");
    }
  };

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>PLATFORM CONFIGURATION</label>
          <h1>Platform Settings</h1>
          <p>Configure anomaly detection sensitivity, investigation thresholds, and decision-support parameters.</p>
        </div>
      </section>

      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Anomaly Scoring & Investigation Thresholds"
            text="Adjust statistical bounds triggering operator reviews"
          />
          <div className="settings-form">
            <div className="setting-group">
              <label>Human Review Trigger Threshold</label>
              <p>Meters with an anomaly risk score above this value are routed to the Priority Investigation Queue</p>
              <div className="threshold-control">
                <input
                  type="range"
                  min="0.40"
                  max="0.95"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                />
                <span className="threshold-value">{threshold.toFixed(2)}</span>
              </div>
              <div className="threshold-labels">
                <span>More Alerts (0.40)</span>
                <span>Balanced Default (0.65)</span>
                <span>Fewer Alerts (0.95)</span>
              </div>
            </div>

            <div className="setting-group">
              <label>Model Sensitivity</label>
              <p>Prototype control — the anomaly-scoring model this will tune isn't connected yet</p>
              <div className="sensitivity-options">
                {["low", "medium", "high"].map((s) => (
                  <button
                    key={s}
                    className={`sensitivity-btn ${sensitivity === s ? "active" : ""}`}
                    onClick={() => setSensitivity(s)}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)} Contamination
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="card">
          <CardHeader
            title="Operations & Notifications"
            text="Operator triage workflow preferences"
          />
          <div className="settings-form">
            <div className="setting-toggle">
              <div>
                <strong>Immediate High-Risk Alerts</strong>
                <small>Prototype preference — surfacing is not yet wired to a live feed</small>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-toggle">
              <div>
                <strong>Automated Investigation Case Creation</strong>
                <small>Automatically spawn investigation records for scores &gt; 0.85</small>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={autoTriage}
                  onChange={(e) => setAutoTriage(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-group">
              <label>Default Distribution Circle</label>
              <select
                className="setting-select"
                value={preferredCircle}
                onChange={(e) => setPreferredCircle(e.target.value)}
              >
                <option value="All Circles">All Circles (Mathura & Bareilly)</option>
                <option value="Mathura">Mathura Circle Only</option>
                <option value="Bareilly">Bareilly Circle Only</option>
              </select>
            </div>
          </div>
        </article>
      </section>

      {/* Summary and Action Card */}
      <article className="card" style={{ marginTop: "20px" }}>
        <CardHeader title="Configuration Audit Summary" text="Active operational rules" />
        <div className="config-summary">
          <div className="config-item">
            <span className="config-label">Review Threshold:</span>
            <span className="config-value">Score &gt; {threshold.toFixed(2)}</span>
          </div>
          <div className="config-item">
            <span className="config-label">Contamination Mode:</span>
            <span className="config-value">{sensitivity.toUpperCase()}</span>
          </div>
          <div className="config-item">
            <span className="config-label">High-Risk Alerts:</span>
            <span className="config-value">{notifications ? "ENABLED" : "DISABLED"}</span>
          </div>
          <div className="config-item">
            <span className="config-label">Default Circle:</span>
            <span className="config-value">{preferredCircle}</span>
          </div>
        </div>
        <div className="config-actions">
          <button className="primary" onClick={handleSave}>
            Save Configuration Changes
          </button>
          <button className="secondary" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>
      </article>
    </>
  );
}
