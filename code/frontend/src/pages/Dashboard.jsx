
import { useCallback, useEffect, useState } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import RiskDonut from "../charts/RiskDonut";
import RegionalRiskMap from "../components/RegionalRiskMap";
import { ErrorState, InlineNotice, LoadingState } from "../components/StateViews";
import {
  anomalyService,
  consumptionService,
  investigationService,
  meterService,
} from "../services";

const numberFormat = new Intl.NumberFormat("en-IN");
const DASHBOARD_CACHE_KEY = "meteriq_dashboard_snapshot";

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function retryRequest(request, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await wait(700 * (attempt + 1));
    }
  }
  throw lastError;
}

function readDashboardCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(DASHBOARD_CACHE_KEY));
    return cached?.data ? cached : null;
  } catch {
    return null;
  }
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits ? number.toFixed(digits) : numberFormat.format(number);
}

function formatKwh(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const magnitude = Math.abs(number);

  if (magnitude >= 1000) {
    return `${formatNumber(number / 1000, 2)} MWh`;
  }

  const digits = magnitude >= 100 ? 1 : magnitude >= 1 ? 2 : 4;

  return `${formatNumber(number, digits)} kWh`;
}

export default function Dashboard({ onSelectMeter, onNavigate, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [showingCachedData, setShowingCachedData] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarnings([]);

    const results = await Promise.allSettled([
      retryRequest(() => anomalyService.getSummary()),
      consumptionService.getRegionalStats(),
      meterService.getMeters({ page: 1, pageSize: 1 }),
      investigationService.getInvestigations({ status: "all" }),
      consumptionService.getConsumption({ range: "7D" }),
      consumptionService.getConsumptionLeaders({ range: "7D", limit: 8 }),
      anomalyService.getAnomalies({
        page: 1,
        pageSize: 5,
        sort: "severity_desc",
      }),
    ]);

    const [summary, regional, meters, cases, consumption, leaders, anomalies] =
      results;

    if (summary.status === "rejected") {
      const cached = readDashboardCache();
      if (cached) {
        setData(cached.data);
        setWarnings(["Live analytics are temporarily unavailable. Showing the most recently loaded dashboard data."]);
        setShowingCachedData(true);
        setLoading(false);
        return;
      }
      setError(summary.reason.message || "Unable to load analytics. Please retry in a moment.");
      setLoading(false);
      return;
    }

    const nextWarnings = [];

    if (regional.status === "rejected") {
      nextWarnings.push(
        `Regional analytics: ${regional.reason.message}`
      );
    }

    if (meters.status === "rejected") {
      nextWarnings.push(
        `Meter catalogue: ${meters.reason.message}`
      );
    }

    if (cases.status === "rejected") {
      nextWarnings.push(
        `Investigations: ${cases.reason.message}`
      );
    }

    if (consumption.status === "rejected") {
      nextWarnings.push(
        `Consumption analytics: ${consumption.reason.message}`
      );
    }

    if (anomalies.status === "rejected") {
      nextWarnings.push(
        `Anomaly records: ${anomalies.reason.message}`
      );
    }

    if (leaders.status === "rejected") nextWarnings.push(`Consumption leaders: ${leaders.reason.message}`);

    setWarnings(nextWarnings);

    const nextData = {
      summary: summary.value,
      regional:
        regional.status === "fulfilled" ? regional.value : null,
      meters:
        meters.status === "fulfilled" ? meters.value : null,
      cases:
        cases.status === "fulfilled" ? cases.value : null,
      consumption:
        consumption.status === "fulfilled" ? consumption.value : null,
      leaders: leaders.status === "fulfilled" ? leaders.value : null,
      anomalies:
        anomalies.status === "fulfilled" ? anomalies.value : null,
    };
    setData(nextData);
    setShowingCachedData(false);
    try {
      sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: nextData }));
    } catch {
      // Dashboard caching is a resilience enhancement; rendering must not depend on it.
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <LoadingState label="Loading dashboard metrics from the MeterIQ API…" />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message={error}
        onRetry={load}
      />
    );
  }

  const summary = data.summary;
  const metersSummary = data.meters?.summary || summary;

  const activeInvestigations =
    (data.cases?.statusCounts?.OPEN || 0) +
    (data.cases?.statusCounts?.["IN PROGRESS"] || 0);

  const totalCases =
    data.cases?.statusCounts?.total ??
    data.cases?.total ??
    0;

  const consumptionSummary = data.consumption?.summary;

  const highRiskMeters =
    summary.riskDistribution?.high ??
    summary.highRiskMeters ??
    0;

  const reviewMeters =
    summary.riskDistribution?.review ??
    summary.reviewMeters ??
    0;

  const normalMeters =
    summary.riskDistribution?.normal ??
    summary.normalMeters ??
    0;

  const totalMeters =
    metersSummary.totalMeters ??
    summary.totalMeters ??
    0;

  // Flagged meters = High Risk + Review.
  // Fall back to the API value if risk distribution is unavailable.
  const hasRiskDistribution =
    summary.riskDistribution != null &&
    (
      summary.riskDistribution.high != null ||
      summary.riskDistribution.review != null
    );

  const flaggedMeters = hasRiskDistribution
    ? Number(highRiskMeters) + Number(reviewMeters)
    : Number(summary.flaggedMeters ?? 0);

  const flaggedRate =
    Number(totalMeters) > 0
      ? (flaggedMeters / Number(totalMeters)) * 100
      : 0;

  return (
    <div className="dashboard-page">
      <div className="top">
        <div>
          <div className="breadcrumb">
            MeterIQ / Operations Dashboard
          </div>

          <h2>{currentUser?.role === "analyst" ? "My Investigation Dashboard" : "Operations Dashboard"}</h2>

          <p className="dashboard-subtitle">
            {currentUser?.role === "analyst"
              ? "Your assigned investigation workload alongside current meter analytics."
              : "Operational meter analytics and current investigation workload."}
          </p>
        </div>

        <div className="top-right">
          <div className="top-status">
            <span className="status-dot online" />
            Dashboard refreshed{" "}
            {new Date().toLocaleTimeString("en-IN")}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <InlineNotice
          tone="warning"
          title="Some widgets are unavailable"
        >
          <ul className="notice-list">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InlineNotice>
      )}

      {showingCachedData && (
        <InlineNotice tone="info" title="Showing saved dashboard data">
          The live analytics service is reconnecting. Use Refresh or return shortly for the latest values.
        </InlineNotice>
      )}

      <section className="dashboard-section-heading">
        <div>
          <div className="breadcrumb">
            Analytics / Overview
          </div>

          <h2>Grid-Wide Overview</h2>
        </div>

        <button
          className="dashboard-view-button"
          onClick={() => onNavigate?.("meters")}
        >
          View All Meters{" "}
          <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="kpi-grid-4 dashboard-kpi-grid">
        <Stat
          label="Total Meters"
          value={formatNumber(totalMeters)}
          icon="📡"
          trend={`${formatNumber(
            regionalMeterCount(data.regional)
          )} in regional analytics`}
        />

        <Stat
          label="Flagged Meters"
          value={formatNumber(flaggedMeters)}
          icon="⚠️"
          trend={`${formatNumber(flaggedRate, 2)}% of fleet`}
          color="danger"
        />

        <Stat
          label="High-Risk Meters"
          value={formatNumber(highRiskMeters)}
          icon="🚨"
          trend={`${formatNumber(reviewMeters)} under review`}
          color="danger"
        />

        <Stat
          label="Active Investigations"
          value={formatNumber(activeInvestigations)}
          icon="📁"
          trend={`${formatNumber(totalCases)} total cases`}
        />

        <Stat
          label="Consumption (7D)"
          value={
            consumptionSummary
              ? formatKwh(consumptionSummary.total_consumption)
              : "—"
          }
          icon="⚡"
          trend={
            consumptionSummary
              ? `Peak ${formatKwh(
                  consumptionSummary.peak_consumption
                )} at ${formatDateTime(
                  consumptionSummary.peak_timestamp
                )}`
              : "Consumption analytics unavailable"
          }
        />

        <Stat
          label="Anomaly Observations"
          value={formatNumber(summary.totalAnomalyObservations)}
          icon="📊"
          trend={`${formatNumber(
            summary.totalObservations
          )} scored observations`}
        />

        <Stat
          label="Average Anomaly Rate"
          value={`${formatNumber(
            (summary.averageAnomalyRate || 0) * 100,
            2
          )}%`}
          icon="📈"
          trend="Average across monitored meters"
        />

        <Stat
          label="Data-Quality Flags"
          value={formatNumber(summary.totalDataQualityFlags)}
          icon="🧪"
          trend={`${formatNumber(normalMeters)} meters classified as normal`}
        />
      </section>

      <section className="dashboard-analytics-grid">
        <article className="card dashboard-panel dashboard-risk-panel">
          <CardHeader
            title="Risk Distribution"
            text="Meter-level classification from the anomaly summary artifact"
          />

          <div className="dashboard-donut-wrapper">
            <RiskDonut
              high={highRiskMeters}
              medium={reviewMeters}
              low={normalMeters}
            />
          </div>

          <p className="panel-footnote">
            Classification rule: meters with ≥10% high-risk
            observations are HIGH_RISK, ≥5% REVIEW, otherwise
            NORMAL. A flag is not a theft confirmation.
          </p>
        </article>

        <article className="card dashboard-panel dashboard-region-panel">
          <CardHeader
            title="Regional Operations Map"
            text="Mathura and Bareilly meter coverage with live risk indicators"
          />

          {data.regional?.regions ? (
            <RegionalRiskMap
              regionData={data.regional.regions}
            />
          ) : (
            <p className="empty-table-cell">
              Regional analytics are currently unavailable.
            </p>
          )}
        </article>
      </section>

      <section className="grid2">
        <article className="card">
          <CardHeader title="Highest measured consumption" text="Top meters by recorded consumption over the latest seven days" right={<button className="link-button" onClick={() => onNavigate?.("meters")}>Review meters →</button>} />
          {data.leaders?.meters?.length ? (
            <ol className="indicator-list consumption-leaders-list">
              {data.leaders.meters.map((meter) => (
                <li key={meter.meter_id}>
                  <button className="meter-link-btn" onClick={() => onSelectMeter?.({ meter_id: meter.meter_id })}>{meter.meter_id}</button>
                  <span>{meter.region}</span>
                  <strong>{formatKwh(meter.consumption)}</strong>
                </li>
              ))}
            </ol>
          ) : <p className="empty-table-cell">No measured consumption ranking is available.</p>}
        </article>
        <article className="card">
          <CardHeader
            title="Top Indicators"
            text="Most frequent model explanations across flagged observations"
          />

          {Array.isArray(summary.topReasons) &&
          summary.topReasons.length > 0 ? (
            <ol className="indicator-list">
              {summary.topReasons.map((item) => (
                <li key={item.reason}>
                  <span>{item.reason}</span>
                  <strong>
                    {formatNumber(item.meters)} meters
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-table-cell">
              No indicator summary available.
            </p>
          )}
        </article>

        <article className="card">
          <CardHeader
            title="Recent Anomaly Records"
            text="Historical observation-level records from the anomaly artifact"
            right={
              <button
                className="link-button"
                onClick={() => onNavigate?.("anomalies")}
              >
                View all →
              </button>
            }
          />

          {data.anomalies &&
          data.anomalies.available === false ? (
            <InlineNotice
              tone="warning"
              title="Observation artifact unavailable"
            >
              {data.anomalies.message}
            </InlineNotice>
          ) : data.anomalies?.records?.length ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Meter</th>
                    <th>Severity</th>
                    <th>Risk</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {data.anomalies.records.map((record, index) => (
                    <tr
                      key={`${record.meter_id}-${record.timestamp}-${index}`}
                    >
                      <td>{formatDateTime(record.timestamp)}</td>

                      <td>
                        <button
                          className="meter-link-btn"
                          onClick={() =>
                            onSelectMeter?.({
                              meter_id: record.meter_id,
                            })
                          }
                        >
                          {record.meter_id}
                        </button>
                      </td>

                      <td>
                        {formatNumber(record.severity, 2)}
                      </td>

                      <td>{record.risk_level}</td>

                      <td>
                        <button
                          className="link-button"
                          onClick={() =>
                            onSelectMeter?.({
                              meter_id: record.meter_id,
                            })
                          }
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-table-cell">
              No anomaly records are available.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}

function regionalMeterCount(regional) {
  if (!regional?.regions) return 0;

  return Object.values(regional.regions).reduce(
    (sum, region) =>
      sum + (Number(region.meter_count) || 0),
    0
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
