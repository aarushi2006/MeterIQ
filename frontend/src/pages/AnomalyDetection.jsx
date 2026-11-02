import { useState, useEffect } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import Badge from "../components/Badge";
import RiskDonut from "../charts/RiskDonut";
import { anomalyService } from "../services/anomalyService";
import { investigationService } from "../services/investigationService";

export default function AnomalyDetection({ onSelectMeterById, onNavigateToInvestigations, onShowToast }) {
  const [anomalies, setAnomalies] = useState([]);
  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function fetchAnomalies() {
      const data = await anomalyService.getAnomalies({
        risk: riskFilter,
        type: typeFilter,
        region: regionFilter,
        status: statusFilter,
        search
      });
      setAnomalies(data);
    }
    fetchAnomalies();
  }, [riskFilter, typeFilter, regionFilter, statusFilter, search]);

  const highRisk = anomalies.filter((a) => a.riskLevel === "High").length;
  const medRisk = anomalies.filter((a) => a.riskLevel === "Medium").length;
  const resolvedCount = anomalies.filter((a) => a.status === "Resolved").length;
  const resolutionRate = anomalies.length ? Math.round((resolvedCount / anomalies.length) * 100) : 0;

  const handleSendToInvestigation = async (anomaly) => {
    setIsProcessing(true);
    const newCase = await investigationService.createInvestigationFromAnomaly({
      meterId: anomaly.meterId,
      region: anomaly.region,
      area: anomaly.area,
      score: anomaly.riskScore,
      risk: anomaly.riskLevel,
      anomalyType: anomaly.anomalyType,
      contributingFactors: anomaly.contributingFactors
    });
    setIsProcessing(false);
    setSelectedAnomaly(null);
    if (onShowToast) {
      onShowToast(`Dispatched ${anomaly.meterId} to Investigation Queue (${newCase.id})`, "success");
    }
    if (onNavigateToInvestigations) {
      onNavigateToInvestigations();
    }
  };

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>DECISION-SUPPORT INTELLIGENCE</label>
          <h1>Explainable Anomaly Detection</h1>
          <p>Statistical outlier classification and automated contributing factor decomposition.</p>
        </div>
      </section>

      {/* 4 Summary Stats */}
      <section className="stats">
        <Stat
          icon="△"
          title="Total Anomalies"
          value={String(anomalies.length)}
          sub="Flagged across all circles"
        />
        <Stat
          icon="!"
          title="High Risk Signals"
          value={String(highRisk)}
          sub="Score &gt; 0.75 (Priority)"
          tone="danger"
        />
        <Stat
          icon="⚠️"
          title="Medium Risk Signals"
          value={String(medRisk)}
          sub="Score 0.50 - 0.75"
          tone="warning"
        />
        <Stat
          icon="✓"
          title="Resolution Rate"
          value={`${resolutionRate}%`}
          sub="Resolved vs. total flagged (current filter)"
        />
      </section>

      {/* Filter and Query Section */}
      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by Meter ID, Area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="clear-btn" onClick={() => setSearch("")}>✕</button>}
          </div>

          <div className="select-wrap">
            <label>Region</label>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="all">All Regions</option>
              <option value="Mathura">Mathura Circle</option>
              <option value="Bareilly">Bareilly Circle</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Risk Level</label>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="all">All Risk Levels</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Anomaly Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Anomaly Types</option>
              <option value="Unexpected Zero Usage">Unexpected Zero Usage</option>
              <option value="Consumption Drop">Consumption Drop</option>
              <option value="Consumption Spike">Consumption Spike</option>
              <option value="Baseline Deviation">Baseline Deviation</option>
              <option value="Night-time Pattern">Night-time Pattern</option>
              <option value="Sudden Pattern Change">Sudden Pattern Change</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Under Review">Under Review</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Anomaly Table Card */}
      <article className="card">
        <CardHeader
          title="Flagged Anomaly Telemetry Records"
          text={`${anomalies.length} meters require operator inspection`}
          right="Prototype scoring — ML model not yet trained"
        />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Anomaly ID</th>
                <th>Meter ID</th>
                <th>Region</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Anomaly Category</th>
                <th>Detected</th>
                <th>Review Status</th>
                <th>Contributing Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id} className="interactive-row" onClick={() => setSelectedAnomaly(a)}>
                  <td>
                    <span className="anomaly-id-pill">{a.id}</span>
                  </td>
                  <td>
                    <button
                      className="meter-link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMeterById(a.meterId);
                      }}
                    >
                      {a.meterId}
                    </button>
                  </td>
                  <td>
                    <span className="dimmed-val">📍 {a.region}</span>
                  </td>
                  <td>
                    <b className={`score-badge ${a.riskLevel.toLowerCase()}`}>
                      {a.riskScore.toFixed(2)}
                    </b>
                  </td>
                  <td>
                    <Badge risk={a.riskLevel} />
                  </td>
                  <td>
                    <span className="type-pill">{a.anomalyType}</span>
                  </td>
                  <td>
                    <span className="time-val">{a.detectedAt}</span>
                  </td>
                  <td>
                    <span className={`status-pill ${a.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <span className="factors-snippet" title={a.contributingFactors}>
                      {a.contributingFactors}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons-cell">
                      <button
                        className="explain-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnomaly(a);
                        }}
                      >
                        Explain ✦
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {anomalies.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-table-cell">
                    No anomalies found matching the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Explainability Inspection Drawer / Modal */}
      {selectedAnomaly && (
        <div className="modal-backdrop" onClick={() => setSelectedAnomaly(null)}>
          <div className="modal-card explain-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-spark">✦</span>
                <div>
                  <h2>Anomaly Explanation: {selectedAnomaly.meterId}</h2>
                  <span className="modal-sub">Record: {selectedAnomaly.id} · {selectedAnomaly.region} Circle</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedAnomaly(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="explain-risk-hero">
                <div className="risk-hero-item">
                  <span className="hero-lbl">Calculated Risk Score</span>
                  <div className="hero-val-wrap">
                    <span className={`hero-score ${selectedAnomaly.riskLevel.toLowerCase()}`}>
                      {selectedAnomaly.riskScore.toFixed(2)}
                    </span>
                    <Badge risk={selectedAnomaly.riskLevel} />
                  </div>
                </div>
                <div className="risk-hero-item">
                  <span className="hero-lbl">Anomaly Classification</span>
                  <strong className="hero-type">{selectedAnomaly.anomalyType}</strong>
                </div>
                <div className="risk-hero-item">
                  <span className="hero-lbl">Detection Timestamp</span>
                  <span className="hero-time">{selectedAnomaly.detectedAt}</span>
                </div>
              </div>

              <div className="explain-section-block">
                <h4>Why was this meter flagged?</h4>
                <p className="explain-prototype-note" style={{ marginBottom: "10px" }}>
                  Prototype explanation — generated from mock rules for UI development, not yet
                  produced by a trained anomaly-detection model.
                </p>
                <p className="explain-desc">
                  This is a risk indicator, not a confirmed finding. The factors below are what a
                  human investigator would check first:
                </p>
                <div className="contributing-box">
                  <span className="contributing-title">Possible Contributing Factors:</span>
                  <p className="contributing-text">{selectedAnomaly.contributingFactors}</p>
                </div>
              </div>

              <div className="action-box">
                <span className="action-title">Recommended Human Action:</span>
                <p className="action-body">
                  "{selectedAnomaly.action}. Review recent smart-meter readings and compare against feeder peer meters."
                </p>
                <small className="notice-sub">
                  Final determination requires human operational review.
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary"
                onClick={() => onSelectMeterById(selectedAnomaly.meterId)}
              >
                Full Meter Diagnostics →
              </button>
              <button
                className="primary"
                onClick={() => handleSendToInvestigation(selectedAnomaly)}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Dispatch to Investigation Queue →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
