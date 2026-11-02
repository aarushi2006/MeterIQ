import { useState } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import { reportService } from "../services/reportService";
import { meters, anomaliesList, cityStats } from "../data/mockData";

export default function Reports({ onShowToast }) {
  const [selectedReportType, setSelectedReportType] = useState("all_meters");
  const [previewContent, setPreviewContent] = useState(null);

  const highRisk = meters.filter((m) => m.risk === "High");

  const reportCatalog = [
    {
      id: "RPT-01",
      key: "all_meters",
      title: "Comprehensive Meter Inventory Report",
      type: "Inventory",
      date: "Sep 13, 2026",
      desc: "Full telemetry attributes, connection specs, and current consumption for all active meters.",
      count: `${meters.length} meters`
    },
    {
      id: "RPT-02",
      key: "high_risk",
      title: "High Anomaly Risk Priority Report",
      type: "Risk",
      date: "Sep 13, 2026",
      desc: "Detailed breakdown of meters with anomaly risk scores > 0.75 requiring on-site audit.",
      count: `${highRisk.length} meters`
    },
    {
      id: "RPT-03",
      key: "anomalies",
      title: "Grid Anomaly & Outlier Telemetry Log",
      type: "Anomaly",
      date: "Sep 13, 2026",
      desc: "All classified anomaly events with contributing feature factors and operator review actions.",
      count: `${anomaliesList.length} records`
    },
    {
      id: "RPT-04",
      key: "regional",
      title: "Regional Performance & Circle Benchmark",
      type: "Regional",
      date: "Sep 13, 2026",
      desc: "Macro operational metrics comparing Mathura and Bareilly distribution circles.",
      count: "2 Circles"
    }
  ];

  const handleExport = (typeKey, title) => {
    const csvData = reportService.generateCsv(typeKey);
    const filename = `MeterIQ_${typeKey}_${new Date().toISOString().slice(0, 10)}.csv`;
    reportService.downloadCsv(filename, csvData);
    if (onShowToast) {
      onShowToast(`Exported ${title} to ${filename}`, "success");
    }
  };

  const handlePreview = (typeKey, title) => {
    const csvData = reportService.generateCsv(typeKey);
    setPreviewContent({ title, csvData, typeKey });
  };

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>REPORTS & COMPLIANCE</label>
          <h1>Analytical Reports & Exports</h1>
          <p>Generate auditable compliance summaries and live CSV data exports for regulatory stakeholders.</p>
        </div>
      </section>

      {/* 4 Summary Stats */}
      <section className="stats">
        <Stat
          icon="📄"
          title="Available Report Templates"
          value={String(reportCatalog.length)}
          sub="Pre-configured utility queries"
        />
        <Stat
          icon="!"
          title="High Risk Focus"
          value={String(highRisk.length)}
          sub="Flagged for priority report"
          tone="danger"
        />
        <Stat
          icon="⚡"
          title="Monitored Meters"
          value={meters.length.toLocaleString()}
          sub="In active telemetry database"
        />
        <Stat
          icon="📥"
          title="Export Format"
          value="RFC-4180 CSV"
          sub="Ready for Excel / Python Pandas"
          tone="success"
        />
      </section>

      {/* Reports Catalog Grid */}
      <article className="card" style={{ marginBottom: "20px" }}>
        <CardHeader
          title="Standard Utility Reports Catalog"
          text="Download live datasets or preview table schema"
          right="Generated from prototype dataset"
        />
        <div className="reports-catalog-grid">
          {reportCatalog.map((rpt) => (
            <div key={rpt.id} className="report-item-card">
              <div className="report-item-header">
                <span className="report-item-badge">{rpt.type}</span>
                <span className="report-item-date">{rpt.date}</span>
              </div>
              <h4>{rpt.title}</h4>
              <p className="report-item-desc">{rpt.desc}</p>
              <div className="report-item-meta">
                <span className="item-count">📊 {rpt.count}</span>
              </div>
              <div className="report-item-actions">
                <button
                  className="secondary small-btn"
                  onClick={() => handlePreview(rpt.key, rpt.title)}
                >
                  Preview Data
                </button>
                <button
                  className="primary small-btn"
                  onClick={() => handleExport(rpt.key, rpt.title)}
                >
                  Download CSV ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Live Data Preview Modal */}
      {previewContent && (
        <div className="modal-backdrop" onClick={() => setPreviewContent(null)}>
          <div className="modal-card preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-spark">📄</span>
                <div>
                  <h2>Report Preview: {previewContent.title}</h2>
                  <span className="modal-sub">Formatted tabular data preview (First 10 rows)</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setPreviewContent(null)}>✕</button>
            </div>

            <div className="modal-body">
              <pre className="csv-preview-box">
                {previewContent.csvData.split("\n").slice(0, 12).join("\n")}
              </pre>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setPreviewContent(null)}>
                Close Preview
              </button>
              <button
                className="primary"
                onClick={() => {
                  handleExport(previewContent.typeKey, previewContent.title);
                  setPreviewContent(null);
                }}
              >
                Export Full CSV Now ↓
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
