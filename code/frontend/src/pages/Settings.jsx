import { useCallback, useEffect, useState } from "react";
import CardHeader from "../components/CardHeader";
import { Field, InlineNotice } from "../components/StateViews";
import { authService } from "../services/authService";
import { meterService } from "../services/meterService";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  resetPreferences,
  savePreferences,
} from "../services/preferences";

const RANGE_OPTIONS = [
  { value: "7D", label: "7 days" },
  { value: "30D", label: "30 days" },
  { value: "3M", label: "3 months" },
  { value: "6M", label: "6 months" },
  { value: "12M", label: "12 months" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function Settings({ onShowToast }) {
  const [preferences, setPreferences] = useState(() => getPreferences());
  const [regions, setRegions] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [pipelineError, setPipelineError] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [saved, setSaved] = useState(false);

  const user = authService.getCurrentUser();

  const loadModelInfo = useCallback(async () => {
    setLoadingModel(true);
    setPipelineError(null);
    try {
      const data = await meterService.getPipelineStatus();
      setPipeline(data);
    } catch (error) {
      setPipelineError(error.message || "Unable to load model information.");
    } finally {
      setLoadingModel(false);
    }
  }, []);

  useEffect(() => {
    loadModelInfo();
  }, [loadModelInfo]);

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

  const updatePreference = (key, value) => {
    setSaved(false);
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    const stored = savePreferences(preferences);
    setPreferences(stored);
    setSaved(true);
    window.dispatchEvent(new CustomEvent("meteriq:preferences"));
    onShowToast?.("Browser preferences saved on this device.", "success");
  };

  const handleReset = () => {
    const reset = resetPreferences();
    setPreferences(reset);
    setSaved(true);
    window.dispatchEvent(new CustomEvent("meteriq:preferences"));
    onShowToast?.("Preferences reset to defaults.", "info");
  };

  const anomalyDetails = pipeline?.details?.anomaly;
  const forecastDetails = pipeline?.details?.forecast;
  const artifacts = pipeline?.artifacts || {};

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>LOCAL PREFERENCES</label>
          <h1>Settings</h1>
          <p>
            These preferences are stored in this browser and only change default filters
            and table density. Model thresholds and pipeline configuration are read-only
            and come from the ML service.
          </p>
        </div>
      </section>

      {saved && (
        <InlineNotice tone="success" title="Preferences updated">
          Your changes are stored locally. They do not alter server-side detection
          thresholds.
        </InlineNotice>
      )}

      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Display defaults"
            text="Applied when you open Meter Management and Consumption Analytics"
          />
          <div className="settings-form">
            <Field label="Default region">
              <select
                value={preferences.defaultRegion}
                onChange={(event) => updatePreference("defaultRegion", event.target.value)}
              >
                <option value="all">All regions</option>
                {regions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </Field>

            <Field label="Default consumption range">
              <select
                value={preferences.defaultRange}
                onChange={(event) => updatePreference("defaultRange", event.target.value)}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Rows per page" hint="Used by meter and health tables">
              <select
                value={preferences.pageSize}
                onChange={(event) =>
                  updatePreference("pageSize", Number(event.target.value))
                }
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} rows</option>
                ))}
              </select>
            </Field>

            <div className="setting-toggle">
              <div>
                <strong>Compact tables</strong>
                <small>Denser table padding across the application</small>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={preferences.compactTables}
                  onChange={(event) =>
                    updatePreference("compactTables", event.target.checked)
                  }
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="config-actions">
              <button className="primary" onClick={handleSave}>
                Save preferences
              </button>
              <button className="secondary" onClick={handleReset}>
                Reset to defaults
              </button>
            </div>
          </div>
        </article>

        <article className="card">
          <CardHeader
            title="Account"
            text="Your role is assigned by the server and cannot be changed here"
          />
          <div className="indicator-table">
            <div className="indicator-row">
              <span>Name</span>
              <strong>{user?.fullName || "—"}</strong>
            </div>
            <div className="indicator-row">
              <span>Email</span>
              <strong>{user?.email || "—"}</strong>
            </div>
            <div className="indicator-row">
              <span>Role</span>
              <strong>{user?.role || "—"}</strong>
            </div>
            <div className="indicator-row">
              <span>Role permissions</span>
              <strong>
                {authService.isSupervisor(user)
                  ? "Review, create cases, assign, resolve"
                  : "Review data and add case notes"}
              </strong>
            </div>
          </div>
          <p className="panel-footnote">
            Public sign-up always creates an analyst account. Supervisor and administrator
            roles are provisioned directly in the database by an administrator.
          </p>
        </article>
      </section>

      <section className="card">
        <CardHeader
          title="Model & pipeline information"
          text="Read-only values reported by the ML service; these controls are not editable"
          right={
            <button className="secondary action-btn" onClick={loadModelInfo} disabled={loadingModel}>
              {loadingModel ? "Loading…" : "Refresh"}
            </button>
          }
        />

        {pipelineError ? (
          <InlineNotice tone="error" title="Pipeline status unavailable">
            {pipelineError}
          </InlineNotice>
        ) : (
          <>
            <div className="settings-readonly-grid">
              <div className="spec-item">
                <span className="spec-label">Anomaly detection</span>
                <strong className="spec-value">{displayValue(pipeline?.anomaly_detection)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Load forecasting</span>
                <strong className="spec-value">{displayValue(pipeline?.load_forecasting)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Anomaly model</span>
                <strong className="spec-value">{displayValue(anomalyDetails?.model_name)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Observations scored</span>
                <strong className="spec-value">{displayValue(anomalyDetails?.n_observations_scored)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Meters in anomaly run</span>
                <strong className="spec-value">{displayValue(anomalyDetails?.n_meters)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Anomaly generated</span>
                <strong className="spec-value">{formatDateTime(anomalyDetails?.generated_at)}</strong>
              </div>
            </div>

            <div className="settings-readonly-grid">
              <div className="spec-item">
                <span className="spec-label">Risk thresholds</span>
                <strong className="spec-value">
                  {displayValue(anomalyDetails?.risk_thresholds)}
                </strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Forecast model</span>
                <strong className="spec-value">{displayValue(forecastDetails?.model_summary)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Forecast baseline</span>
                <strong className="spec-value">{displayValue(forecastDetails?.baseline_summary)}</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Forecast generated</span>
                <strong className="spec-value">{formatDateTime(forecastDetails?.generated_at)}</strong>
              </div>
            </div>

            <h4 className="subheading">Artifact availability</h4>
            <div className="artifact-grid">
              {Object.entries(artifacts).map(([key, value]) => (
                <div key={key} className={`artifact-item ${value ? "available" : "missing"}`}>
                  <span className="artifact-name">{key.replace(/_/g, " ")}</span>
                  <strong>{value ? "Available" : "Missing"}</strong>
                </div>
              ))}
            </div>

            <InlineNotice tone="info">
              Detection thresholds, contamination settings, and model versions are owned
              by the ML pipeline. Changing them requires retraining and artifact
              regeneration, so this page only displays them.
            </InlineNotice>
          </>
        )}
      </section>

      <p className="panel-footnote">
        Preferences last saved from defaults: {Object.keys(DEFAULT_PREFERENCES).length}{" "}
        configurable display fields. Browser storage key:{" "}
        <code>meteriq_preferences</code>.
      </p>
    </>
  );
}
