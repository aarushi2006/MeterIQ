import { meters } from "../data/mockData";
import CardHeader from "../components/CardHeader";

export default function Reports() {
  const highRisk = meters.filter((m) => m.risk === "High");
  const medRisk = meters.filter((m) => m.risk === "Medium");

  const reports = [
    { id: "RPT001", title: "Weekly Anomaly Summary", date: "Sep 8, 2026", type: "Anomaly", status: "Ready", meters: meters.length },
    { id: "RPT002", title: "High Risk Meter Report", date: "Sep 8, 2026", type: "Risk", status: "Ready", meters: highRisk.length },
    { id: "RPT003", title: "Mathura City Analysis", date: "Sep 7, 2026", type: "City", status: "Ready", meters: meters.filter((m) => m.city === "Mathura").length },
    { id: "RPT004", title: "Bareilly City Analysis", date: "Sep 7, 2026", type: "City", status: "Ready", meters: meters.filter((m) => m.city === "Bareilly").length },
    { id: "RPT005", title: "Load Forecast Report", date: "Sep 8, 2026", type: "Forecast", status: "Ready", meters: meters.length },
    { id: "RPT006", title: "Meter Health Status", date: "Sep 8, 2026", type: "Health", status: "Ready", meters: meters.length },
  ];

  return (
    <>
      <section className="page-header">
        <label>REPORTS & EXPORTS</label>
        <h1>Reports</h1>
        <p>Generate and export analysis reports for authorities.</p>
      </section>

      <section className="stats">
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>📄</span>
            <span className="stat-label">Available Reports</span>
          </div>
          <h2>{reports.length}</h2>
          <small>Ready to export</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>⚠</span>
            <span className="stat-label">High Risk Meters</span>
          </div>
          <h2>{highRisk.length}</h2>
          <small>Need detailed report</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>△</span>
            <span className="stat-label">Medium Risk</span>
          </div>
          <h2>{medRisk.length}</h2>
          <small>Monitor closely</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>✓</span>
            <span className="stat-label">Normal Meters</span>
          </div>
          <h2>{meters.filter((m) => m.risk === "Low").length}</h2>
          <small>Within expected range</small>
        </article>
      </section>

      <article className="card">
        <CardHeader title="Generated Reports" text="Download or share reports with stakeholders" right="" />
        <div className="reports-grid">
          {reports.map((r) => (
            <div key={r.id} className="report-card">
              <div className="report-icon">
                {r.type === "Anomaly" ? "△" : r.type === "Risk" ? "!" : r.type === "City" ? "⌖" : r.type === "Forecast" ? "↗" : "✓"}
              </div>
              <div className="report-info">
                <strong>{r.title}</strong>
                <small>{r.date} · {r.meters} meters</small>
              </div>
              <div className="report-actions">
                <span className={`report-status ${r.status.toLowerCase()}`}>{r.status}</span>
                <button className="report-download">↓ PDF</button>
                <button className="report-share">Share</button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <section className="grid2" style={{ marginTop: "20px" }}>
        <article className="card">
          <CardHeader title="Quick Export" text="Export specific data subsets" right="" />
          <div className="export-options">
            <button className="export-btn">
              <span>📊</span>
              <div><strong>All Meters CSV</strong><small>Export all meter data</small></div>
            </button>
            <button className="export-btn">
              <span>⚠</span>
              <div><strong>High Risk Only</strong><small>Meters with score &gt; 0.8</small></div>
            </button>
            <button className="export-btn">
              <span>📍</span>
              <div><strong>By City</strong><small>Mathura or Bareilly</small></div>
            </button>
            <button className="export-btn">
              <span>📈</span>
              <div><strong>Forecast Data</strong><small>24-hour predictions</small></div>
            </button>
          </div>
        </article>
        <article className="card">
          <CardHeader title="Recent Exports" text="Download history" right="" />
          <div className="export-history">
            <div className="export-item">
              <strong>anomaly_report_2026-09-08.pdf</strong>
              <small>Generated 2 hours ago · 2.4 MB</small>
            </div>
            <div className="export-item">
              <strong>meter_data_mathura.csv</strong>
              <small>Generated yesterday · 856 KB</small>
            </div>
            <div className="export-item">
              <strong>weekly_summary_w36.pdf</strong>
              <small>Generated Sep 7 · 1.8 MB</small>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
