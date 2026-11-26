import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../services/api";

const pageMeta = {
  dashboard: { title: "Operations Dashboard", desc: "Unified telemetry overview and grid operations pulse" },
  meters: { title: "Meter Analysis", desc: "Search, select, and inspect meters" },
  "meter-detail": { title: "Meter Diagnostic Workspace", desc: "Consumption behaviour, anomaly indicators, and load data" },
  consumption: { title: "Consumption Analytics", desc: "Load profiles, diurnal curves, and regional comparisons" },
  anomalies: { title: "Anomaly Detection", desc: "Statistical outliers with human-in-the-loop review" },
  forecasting: { title: "Short-Term Load Forecasting", desc: "Backtested predictions with chronological validation" },
  investigations: { title: "Investigation Workflow", desc: "Case tracking and verification records" },
  reports: { title: "Reports & CSV Exports", desc: "Filter-aware data exports" },
  "data-quality": { title: "Data Quality", desc: "Coverage, completeness, and validation indicators" },
  "meter-health": { title: "Meter Health", desc: "Fleet coverage and data-quality status" },
  settings: { title: "Settings", desc: "Local UI preferences and read-only model information" },
  about: { title: "About MeterIQ", desc: "Smart Meter Decision Support System" },
};

const HEALTH_ENDPOINT = `${API_BASE_URL}/health`;

export default function Header({ page, user, role, onToggleMobileMenu }) {
  const [system, setSystem] = useState({ state: "checking", label: "Checking API…" });
  const consecutiveFailures = useRef(0);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const response = await fetch(HEALTH_ENDPOINT);
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && data.status === "healthy") {
          consecutiveFailures.current = 0;
          setSystem({ state: "online", label: "All services online" });
        } else {
          const services = data.services || {};
          const down = Object.entries(services)
            .filter(([, value]) => value === "down" || value === "disconnected")
            .map(([key]) => key);
          const wakingMl = down.length === 1 && down[0] === "ml" && [502, 503, 504].includes(data?.ml?.status);
          setSystem({
            state: "degraded",
            label: wakingMl ? "Waking analytics service…" : down.length ? `Degraded: ${down.join(", ")}` : "API degraded",
          });
        }
      } catch {
        consecutiveFailures.current += 1;
        if (active) setSystem(consecutiveFailures.current >= 3
          ? { state: "offline", label: "Connection temporarily unavailable" }
          : { state: "checking", label: "Reconnecting…" });
      }
    }

    check();
    const timer = window.setInterval(check, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const current = pageMeta[page] || pageMeta.dashboard;
  const displayRole = role || user?.role || "analyst";

  return (
    <header className="top">
      <div className="top-left">
        {onToggleMobileMenu && (
          <button
            className="mobile-menu-btn"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            ☰
          </button>
        )}
        <div>
          <div className="breadcrumb">
            <span className="brand-crumb">MeterIQ</span> /{" "}
            <span className="current">{current.title}</span>
          </div>
          <h2>{current.title}</h2>
          <span className="page-desc-inline">{current.desc}</span>
        </div>
      </div>

      <div className="top-right">
        <div className={`top-status system-${system.state}`}>
          <span className={`status-dot ${system.state}`} />
          <span className="status-text">{system.label}</span>
          <span className="role-badge">{displayRole.toUpperCase()}</span>
        </div>
        <div className="top-date">
          {new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>
    </header>
  );
}
