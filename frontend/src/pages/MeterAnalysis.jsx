import { useState } from "react";
import Badge from "../components/Badge";
import CardHeader from "../components/CardHeader";
import ConsumptionChart from "../charts/ConsumptionChart";
import { investigationService } from "../services/investigationService";
import { anomaliesList } from "../data/mockData";

export default function MeterAnalysis({ meter, onBack, onNavigateToInvestigations, onShowToast }) {
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  if (!meter) {
    return (
      <div className="empty-meter-view">
        <p>No meter selected for inspection.</p>
        <button className="primary" onClick={onBack}>← Back to Meters List</button>
      </div>
    );
  }

  const handleCreateInvestigation = async () => {
    setIsCreatingCase(true);
    const newCase = await investigationService.createInvestigationFromAnomaly(meter);
    setIsCreatingCase(false);
    if (onShowToast) {
      onShowToast(`Investigation ${newCase.id} initiated for meter ${meter.id}`, "success");
    }
    if (onNavigateToInvestigations) {
      onNavigateToInvestigations();
    }
  };

  const chartData = (meter.hourlyHistory || []).map((h) => ({
    day: h.hour,
    kwh: h.actual,
    baseline: h.baseline,
    forecast: null
  }));

  const meterAnomalyCount =
    anomaliesList.filter((a) => a.meterId === meter.id).length ||
    (meter.anomalyStatus === "Active Flag" ? 1 : 0);

  return (
    <>
      <section className="analysis-title">
        <button className="back-link" onClick={onBack}>
          ← Back to Smart Meters List
        </button>
        <div className="analysis-header-row">
          <div>
            <div className="meter-breadcrumbs">
              <span>{meter.region} Circle</span> · <span>{meter.area}</span> · <span>Feeder Line A</span>
            </div>
            <h1>Smart Meter {meter.id}</h1>
          </div>
          <div className="meter-actions-bar">
            <button
              className="primary action-btn"
              onClick={handleCreateInvestigation}
              disabled={isCreatingCase}
            >
              {isCreatingCase ? "Creating Case..." : "Create Investigation Case →"}
            </button>
          </div>
        </div>
      </section>

      {/* Primary Diagnostic Metrics */}
      <section className="meter-kpi-grid">
        <article className="card score-card">
          <div className="card-top-label">
            <span>Anomaly Risk Score</span>
            <Badge risk={meter.risk} />
          </div>
          <div className="score-hero">
            <span className="score-number">{meter.score.toFixed(2)}</span>
            <div className="score-meter-bar">
              <div
                className={`score-fill ${meter.risk.toLowerCase()}`}
                style={{ width: `${meter.score * 100}%` }}
              />
            </div>
          </div>
          <small className="score-help">
            Threshold: 0.65 · {meter.risk === "High" ? "Priority Investigation" : "Standard Verification"}
          </small>
        </article>

        <article className="card">
          <div className="card-top-label">Current Reading</div>
          <div className="metric-large">
            {meter.currentKwh.toFixed(1)} <small>kWh</small>
          </div>
          <span className={`delta-tag ${meter.delta < 0 ? "negative" : "positive"}`}>
            {meter.delta > 0 ? `↑ +${meter.delta}%` : `↓ ${meter.delta}%`} vs 30d baseline
          </span>
          <small className="timestamp-note">Received: {meter.lastReading}</small>
        </article>

        <article className="card">
          <div className="card-top-label">Average Daily Demand</div>
          <div className="metric-large">
            {meter.avgDailyKwh.toFixed(1)} <small>kWh/day</small>
          </div>
          <small className="help-sub">Calculated over trailing 30 active billing cycles</small>
        </article>

        <article className="card">
          <div className="card-top-label">Peak Demand</div>
          <div className="metric-large">
            {meter.peakKwh.toFixed(1)} <small>kWh</small>
          </div>
          <small className="help-sub">Min observed: {meter.minKwh?.toFixed(1) || "0.2"} kWh</small>
        </article>

        <article className="card">
          <div className="card-top-label">Anomaly Count</div>
          <div className="metric-large">
            {meterAnomalyCount}
          </div>
          <small className="help-sub">Flags recorded for this meter in the prototype dataset</small>
        </article>
      </section>

      {/* Explainable Diagnostics & Chart Grid */}
      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Hourly Telemetry vs. Baseline Profile"
            text="Last 24 hours interval readings compared against seasonal normal"
          />
          <ConsumptionChart data={chartData} />
          <div className="chart-legend-custom">
            <span className="legend-item"><span className="legend-color actual" /> Actual Telemetry</span>
            <span className="legend-item"><span className="legend-color baseline" /> Expected Feeder Baseline</span>
          </div>
        </article>

        {/* MeterIQ Explainability Block */}
        <article className="card explain-card">
          <div className="explain-header">
            <span className="explain-spark">✦</span>
            <div>
              <h3>Why was this meter flagged?</h3>
              <p>Automated statistical indicators contributing to anomaly score</p>
            </div>
          </div>

          <p className="explain-prototype-note">
            Prototype / demo explanation — generated from mock rules for UI development, not yet
            produced by a trained anomaly-detection model.
          </p>

          <div className="explain-reasons">
            {meter.why && meter.why.length > 0 ? (
              <ul>
                {meter.why.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p>Normal telemetry behavior. No statistically anomalous deviations detected.</p>
            )}
          </div>

          {meter.contributingFactors && meter.contributingFactors.length > 0 && (
            <div className="factors-table-wrap">
              <span className="factors-title">Contributing Feature Factors</span>
              <div className="factors-grid">
                {meter.contributingFactors.map((f, idx) => (
                  <div key={idx} className="factor-pill">
                    <span className="factor-name">{f.factor}</span>
                    <b className="factor-val">{f.value}</b>
                    <span className={`factor-impact ${f.impact}`}>{f.impact} impact</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="action-recommendation">
            <span className="action-label">Recommended Decision-Support Action:</span>
            <p className="action-text">
              "{meter.recommendedAction || "Monitor recent readings and compare against historical seasonal consumption."}"
            </p>
            <small className="notice-sub">
              Human review required. This system provides statistical evidence to assist engineers, not definitive theft determinations.
            </small>
          </div>
        </article>
      </section>

      {/* Hardware & Grid Metadata */}
      <section className="meter-meta-card">
        <article className="card">
          <CardHeader title="Smart Meter Technical Specifications" text="Hardware attributes and feeder connection records" />
          <div className="meta-spec-grid">
            <div className="spec-item">
              <span className="spec-label">Connection Type</span>
              <strong className="spec-value">{meter.type}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Utility Provider</span>
              <strong className="spec-value">{meter.provider}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Commission Date</span>
              <strong className="spec-value">{meter.installed}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Firmware Version</span>
              <strong className="spec-value">{meter.firmware}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Hardware Health</span>
              <strong className={`spec-value health-${meter.health?.toLowerCase()}`}>● {meter.health}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Sampling Interval</span>
              <strong className="spec-value">3 Minutes (CEEW Specification)</strong>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
