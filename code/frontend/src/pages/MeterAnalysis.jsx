import { useCallback, useEffect, useState } from "react";
import Badge from "../components/Badge";
import CardHeader from "../components/CardHeader";
import ConsumptionChart from "../charts/ConsumptionChart";
import { ErrorState, InlineNotice, LoadingState } from "../components/StateViews";
import { anomalyService } from "../services/anomalyService";
import { authService } from "../services/authService";
import { investigationService } from "../services/investigationService";
import { meterService } from "../services/meterService";

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits
    ? number.toFixed(digits)
    : new Intl.NumberFormat("en-IN").format(number);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${(number * 100).toFixed(2)}%`;
}

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

function shortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MeterAnalysis({
  meterId,
  currentUser,
  onBack,
  onNavigateToInvestigations,
  onShowToast,
}) {
  const [meter, setMeter] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secondaryErrors, setSecondaryErrors] = useState([]);
  const [creating, setCreating] = useState(false);
  const [caseCreated, setCaseCreated] = useState(null);

  const canManage = authService.isSupervisor(currentUser);

  const load = useCallback(async () => {
    if (!meterId) {
      setError("No meter was selected.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSecondaryErrors([]);

    const [meterResult, consumptionResult, anomalyResult] = await Promise.allSettled([
      meterService.getMeter(meterId),
      meterService.getConsumption(meterId, { resolution: "hourly" }),
      anomalyService.getMeterAnomalies(meterId, { page: 1, pageSize: 20 }),
    ]);

    if (meterResult.status === "rejected") {
      setError(meterResult.reason.message || `Meter ${meterId} could not be loaded.`);
      setLoading(false);
      return;
    }

    const warnings = [];
    if (consumptionResult.status === "rejected") {
      warnings.push(`Consumption telemetry: ${consumptionResult.reason.message}`);
    }
    if (anomalyResult.status === "rejected") {
      warnings.push(`Anomaly history: ${anomalyResult.reason.message}`);
    }

    setMeter(meterResult.value);
    setConsumption(
      consumptionResult.status === "fulfilled" ? consumptionResult.value : null
    );
    setAnomalies(
      anomalyResult.status === "fulfilled" ? anomalyResult.value : null
    );
    setSecondaryErrors(warnings);
    setLoading(false);
  }, [meterId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateInvestigation = async () => {
    if (!meter || !canManage) return;

    setCreating(true);
    try {
      const reason =
        meter.most_common_reasons?.[0] ||
        `Meter ${meter.meter_id} flagged for review by the anomaly pipeline.`;
      const created = await investigationService.create({
        meter_id: meter.meter_id,
        region: meter.region,
        riskScore: meter.mean_severity ?? undefined,
        riskLevel: meter.risk_level,
        priority: meter.risk_level === "HIGH_RISK" ? "HIGH" : "MEDIUM",
        reason,
        evidence: (meter.most_common_reasons || []).join(" | ") || undefined,
        detectedDate: new Date().toISOString(),
      });
      setCaseCreated(created);
      onShowToast?.(`Investigation ${created.id} created`, "success");
      onNavigateToInvestigations?.();
    } catch (err) {
      onShowToast?.(err.message || "Unable to create investigation", "error");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <LoadingState label={`Loading meter ${meterId} diagnostic data…`} />;
  }

  if (error || !meter) {
    return (
      <ErrorState
        title="Meter unavailable"
        message={error || "No meter data returned."}
        onRetry={load}
      />
    );
  }

  const points = consumption?.points || [];
  const chartData = points.map((point) => ({
    time: shortTime(point.timestamp),
    kwh: Number(point.consumption),
  }));
  const anomalyRecords = anomalies?.records || [];
  const summary = anomalies?.summary;

  return (
    <>
      <section className="analysis-title">
        <button className="back-link" onClick={onBack}>
          ← Back to meter list
        </button>
        <div className="analysis-header-row">
          <div>
            <div className="meter-breadcrumbs">
              <span>{meter.region || "Unknown region"}</span> ·{" "}
              <span>{meter.meter_id}</span>
            </div>
            <h1>Smart Meter {meter.meter_id}</h1>
          </div>
          <div className="meter-actions-bar">
            <button
              className="secondary action-btn"
              onClick={load}
              disabled={loading}
            >
              Refresh data
            </button>
            <button
              className="primary action-btn"
              onClick={handleCreateInvestigation}
              disabled={!canManage || creating}
              title={
                canManage
                  ? "Create an investigation case"
                  : "Only supervisors and administrators can create cases"
              }
            >
              {creating ? "Creating case…" : "Create Investigation"}
            </button>
          </div>
        </div>
        {!canManage && (
          <InlineNotice tone="info">
            Your analyst role can review this meter and add notes to existing cases,
            but only a supervisor or administrator can open a new investigation.
          </InlineNotice>
        )}
        {caseCreated && (
          <InlineNotice tone="success" title={`Case ${caseCreated.id} created`}>
            The case is persisted in MongoDB and is visible on the Investigations page.
          </InlineNotice>
        )}
      </section>

      {secondaryErrors.length > 0 && (
        <InlineNotice tone="warning" title="Some meter data is unavailable">
          <ul className="notice-list">
            {secondaryErrors.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InlineNotice>
      )}

      <section className="meter-kpi-grid">
        <article className="card score-card">
          <div className="card-top-label">
            <span>Risk classification</span>
            <Badge risk={meter.risk_level} />
          </div>
          <div className="score-hero">
            <span className="score-number">{formatNumber(meter.anomaly_count)}</span>
            <small>anomaly observations</small>
          </div>
          <small className="score-help">
            Anomaly rate {formatPercent(meter.anomaly_rate)} across{" "}
            {formatNumber(meter.total_observations)} scored observations.
          </small>
        </article>

        <article className="card">
          <div className="card-top-label">High-risk observations</div>
          <div className="metric-large">{formatNumber(meter.high_risk_count)}</div>
          <small className="help-sub">
            Review observations: {formatNumber(meter.review_count)}
          </small>
        </article>

        <article className="card">
          <div className="card-top-label">Mean / max severity</div>
          <div className="metric-large">
            {formatNumber(meter.mean_severity, 2)}
            <small> / {formatNumber(meter.max_severity, 2)}</small>
          </div>
          <small className="help-sub">Model severity on a 0–100 scale</small>
        </article>

        <article className="card">
          <div className="card-top-label">Data-quality flags</div>
          <div className="metric-large">{formatNumber(meter.data_quality_flag_count)}</div>
          <small className="help-sub">Flagged observations in the processed dataset</small>
        </article>

        <article className="card">
          <div className="card-top-label">Data coverage</div>
          <div className="metric-large metric-date">
            {meter.coverage_start ? formatDateTime(meter.coverage_start).split(",")[0] : "—"}
          </div>
          <small className="help-sub">
            to {meter.coverage_end ? formatDateTime(meter.coverage_end).split(",")[0] : "—"}
          </small>
        </article>
      </section>

      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Hourly consumption telemetry"
            text={
              consumption
                ? `${formatNumber(consumption.summary.observations)} processed intervals · ${consumption.resolution} resolution`
                : "Consumption endpoint unavailable"
            }
          />
          {chartData.length > 0 ? (
            <>
              <ConsumptionChart data={chartData} height={280} />
              <div className="chart-legend-custom">
                <span className="legend-item">
                  <span className="legend-color actual" /> Actual consumption (kWh per hour)
                </span>
              </div>
              <p className="panel-footnote">
                Totals are summed from the 3-minute processed telemetry. Anomaly
                overlays require the observation-level artifact.
              </p>
            </>
          ) : (
            <p className="empty-table-cell">
              No consumption points were returned for this meter.
            </p>
          )}
        </article>

        <article className="card explain-card">
          <div className="explain-header">
            <span className="explain-spark">✦</span>
            <div>
              <h3>Model indicators</h3>
              <p>Most common reasons recorded for this meter's flagged observations</p>
            </div>
          </div>

          {meter.most_common_reasons?.length ? (
            <div className="explain-reasons">
              <ul>
                {meter.most_common_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty-table-cell">
              No indicator summary was recorded for this meter.
            </p>
          )}

          <div className="action-recommendation">
            <span className="action-label">Decision-support note</span>
            <p className="action-text">
              A statistical flag is a review indicator. It is not a confirmed theft
              finding; field verification and human judgement are required.
            </p>
          </div>
        </article>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <CardHeader
          title="Recent flagged observations"
          text={
            anomalies?.available === false
              ? "Observation-level artifact unavailable"
              : `${formatNumber(anomalies?.total || 0)} records${
                  summary
                    ? ` · ${formatNumber(summary.high_risk_count)} high risk`
                    : ""
                }`
          }
        />

        {anomalies?.available === false ? (
          <InlineNotice tone="warning" title="Observation records not generated">
            {anomalies.message}
          </InlineNotice>
        ) : anomalyRecords.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Risk</th>
                  <th>Severity</th>
                  <th>Consumption</th>
                  <th>Derived category</th>
                  <th>Indicators</th>
                </tr>
              </thead>
              <tbody>
                {anomalyRecords.map((record, index) => (
                  <tr key={`${record.timestamp}-${index}`}>
                    <td>{formatDateTime(record.timestamp)}</td>
                    <td><Badge risk={record.risk_level} /></td>
                    <td>{formatNumber(record.severity, 2)}</td>
                    <td>{formatNumber(record.consumption, 3)} kWh</td>
                    <td>{record.anomaly_type || "—"}</td>
                    <td>
                      <span className="indicator-snippet" title={record.reasons?.join(" • ")}>
                        {record.reasons?.[0] || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-table-cell">
            No flagged observations are stored for this meter.
          </p>
        )}
      </section>

      <section className="meter-meta-card">
        <article className="card">
          <CardHeader
            title="Meter record"
            text="Only fields present in the MeterIQ API are shown"
          />
          <div className="meta-spec-grid">
            <div className="spec-item">
              <span className="spec-label">Meter ID</span>
              <strong className="spec-value">{meter.meter_id}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Region</span>
              <strong className="spec-value">{meter.region || "—"}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Risk classification</span>
              <strong className="spec-value">{meter.risk_level}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Total observations</span>
              <strong className="spec-value">{formatNumber(meter.total_observations)}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Coverage start</span>
              <strong className="spec-value">{formatDateTime(meter.coverage_start)}</strong>
            </div>
            <div className="spec-item">
              <span className="spec-label">Coverage end</span>
              <strong className="spec-value">{formatDateTime(meter.coverage_end)}</strong>
            </div>
          </div>
          <p className="panel-footnote">
            Hardware attributes such as firmware, battery, and signal strength are not
            present in this dataset and are intentionally not displayed as simulated values.
          </p>
        </article>
      </section>
    </>
  );
}
