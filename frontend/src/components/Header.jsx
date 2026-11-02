export default function Header({ page, role, onToggleMobileMenu }) {
  const pageMeta = {
    dashboard: { title: "Operations Dashboard", desc: "Unified telemetry overview and grid operations pulse" },
    meters: { title: "Meter Analysis", desc: "Search, select, and inspect meters across Mathura and Bareilly" },
    "meter-detail": { title: "Meter Diagnostic Workspace", desc: "Explainable consumption behavior and load patterns" },
    consumption: { title: "Consumption Analytics", desc: "Macro trends, load factor, and diurnal pattern benchmarks" },
    anomalies: { title: "Explainable Anomaly Detection", desc: "ML-driven outlier scoring with human-in-the-loop validation" },
    forecasting: { title: "Short-Term Load Forecasting", desc: "Predictive demand models with chronological validation" },
    investigations: { title: "Investigation Workflow", desc: "Decision-support case tracking and verification records" },
    reports: { title: "Analytical Reports & Exports", desc: "Official utility compliance exports and audit logs" },
    "data-quality": { title: "Data Quality & Ingestion", desc: "Cleaned CEEW 3-minute telemetries and stationarity checks" },
    "meter-health": { title: "Meter Health", desc: "Fleet-wide connectivity and device status" },
    settings: { title: "Platform Settings", desc: "Anomaly sensitivity thresholds and alert policies" },
    about: { title: "About MeterIQ", desc: "Smart Meter Decision Support System" },
  };

  const current = pageMeta[page] || { title: "Dashboard", desc: "Operational Overview" };

  return (
    <header className="top">
      <div className="top-left">
        {onToggleMobileMenu && (
          <button className="mobile-menu-btn" onClick={onToggleMobileMenu} aria-label="Toggle Menu">
            ☰
          </button>
        )}
        <div>
          <div className="breadcrumb">
            <span className="brand-crumb">MeterIQ</span> / <span className="current">{current.title}</span>
          </div>
          <h2>{current.title}</h2>
          <span className="page-desc-inline">{current.desc}</span>
        </div>
      </div>

      <div className="top-right">
        <div className="top-status">
          <span className="status-dot online" />
          <span className="status-text">Prototype</span> · <span className="role-badge">{role?.toUpperCase()}</span>
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
