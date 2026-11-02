import { useState, useEffect, useMemo } from "react";
import Stat from "../components/Stat";
import CardHeader from "../components/CardHeader";
import Badge from "../components/Badge";
import ConsumptionChart from "../charts/ConsumptionChart";
import RiskDonut from "../charts/RiskDonut";
import { consumptionTrends, cityStats, anomaliesList, prototypeStatus } from "../data/mockData";
import { meterService } from "../services/meterService";

export default function Dashboard({ onSelectMeter, onSelectMeterById, onNavigate }) {
  const [metersList, setMetersList] = useState([]);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [medRiskCount, setMedRiskCount] = useState(0);
  const [lowRiskCount, setLowRiskCount] = useState(0);
  const [activeRange, setActiveRange] = useState("7D");

  useEffect(() => {
    async function loadData() {
      const data = await meterService.getMeters();
      const meters = Array.isArray(data) ? data : [];
      setMetersList(meters);

      const riskOf = (m) => String(m.risk_level || "").toUpperCase();

      setHighRiskCount(
        meters.filter((m) => ["HIGH", "CRITICAL"].includes(riskOf(m))).length
      );
      setMedRiskCount(
        meters.filter((m) => ["MEDIUM", "MODERATE"].includes(riskOf(m))).length
      );
      setLowRiskCount(
        meters.filter((m) => ["LOW", "NORMAL"].includes(riskOf(m))).length
      );
    }
    loadData();
  }, []);

  const currentTrend = consumptionTrends[activeRange] || consumptionTrends["7D"];

  const totalMeters = metersList.length;
  const totalActiveReporting = cityStats.Mathura.activeReporting + cityStats.Bareilly.activeReporting;
  const reportingPct = totalMeters > 0 ? "—" : "—";
  const totalMwhToday = (cityStats.Mathura.mwhToday + cityStats.Bareilly.mwhToday).toFixed(1);

  // Day-over-day change computed from the mock trend series itself,
  // rather than a separately invented percentage.
  const dayOverDayChange = useMemo(() => {
    const series = consumptionTrends["7D"];
    if (!series || series.length < 2) return null;
    const last = series[series.length - 1].totalMwh;
    const prev = series[series.length - 2].totalMwh;
    if (!prev) return null;
    return (((last - prev) / prev) * 100).toFixed(1);
  }, []);

  // Take the most recent anomalies as-is from the mock dataset (already
  // ordered newest-first) for a compact "Recent Anomalies" table.
  const recentAnomalies = anomaliesList.slice(0, 6);

  const openAnomalyMeter = (meterId) => {
    if (onSelectMeterById) onSelectMeterById(meterId);
  };

  // Static-looking but real: reflects when this prototype snapshot of mock
  // data was put together, not a live sync timestamp.
  const lastUpdatedLabel = prototypeStatus.lastDatasetUpdate;

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>OPERATIONS OVERVIEW</label>
          <h1>Operations Overview</h1>
          <p>
            Smart meter monitoring and anomaly analysis across the Mathura and Bareilly grids.
          </p>
          <small className="last-updated-note">Last updated: {lastUpdatedLabel} (prototype snapshot)</small>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={() => onNavigate("investigations")}>
            Priority Queue <b className="badge-count">{highRiskCount}</b>
          </button>
          <button className="primary" onClick={() => onNavigate("meters")}>
            View All Meters
          </button>
        </div>
      </section>

      {/* Primary KPIs — every value below is derived from the same mock dataset */}
      <section className="stats kpi-grid-4">
        <Stat
          icon="⌁"
          title="Total Smart Meters"
          value={totalMeters.toLocaleString()}
          sub="Reporting rate unavailable from current API"
        />
        <Stat
          icon="⚡"
          title="Consumption Today"
          value={`${totalMwhToday} MWh`}
          sub={dayOverDayChange !== null ? `${dayOverDayChange > 0 ? "↑" : "↓"} ${Math.abs(dayOverDayChange)}% vs prior day` : "—"}
        />
        <Stat
          icon="△"
          title="Anomalies Flagged"
          value={String(highRiskCount + medRiskCount)}
          sub="Awaiting human review"
          tone="warning"
        />
        <Stat
          icon="!"
          title="High-Risk Meters"
          value={String(highRiskCount)}
          sub="Priority investigation recommended"
          tone="danger"
        />
      </section>

      {/* Consumption trend + risk distribution */}
      <section className="grid2">
        <article className="card">
          <div className="card-header-with-filter">
            <CardHeader
              title="Consumption Trend"
              text="Combined grid throughput across both circles"
            />
            <div className="range-pills">
              {["7D", "30D", "3M"].map((r) => (
                <button
                  key={r}
                  className={`range-pill ${activeRange === r ? "active" : ""}`}
                  onClick={() => setActiveRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ConsumptionChart data={currentTrend} />
        </article>

        <article className="card">
          <CardHeader
            title="Anomaly Risk Overview"
            text="Meters currently flagged by the prototype scoring logic"
          />
          <RiskDonut high={highRiskCount} medium={medRiskCount} low={lowRiskCount} />
          <div className="notice decision-notice">
            <div>
              <strong>Decision-Support Notice</strong>
              <p>
                A risk flag is a statistical deviation, not a confirmed finding. Only a
                human investigator can determine tampering or theft after physical
                inspection.
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* Regional info + recent anomalies */}
      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Regional Overview"
            text="Mathura and Bareilly circles — meter counts and flags"
          />
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Meters</th>
                  <th>Anomalies</th>
                  <th>High Risk</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cityStats).map(([city, stats]) => (
                  <tr key={city}>
                    <td><b>{city}</b></td>
                    <td>{stats.meters.toLocaleString()}</td>
                    <td>{stats.flaggedMeters}</td>
                    <td>{stats.highRiskMeters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cities">
            {Object.entries(cityStats).map(([city, stats]) => (
              <div className="city" key={city}>
                <div className="city-header">
                  <div className="city-title">
                    <b>{city} Circle</b>
                  </div>
                  <span className="city-meter-count">{stats.mwhToday} MWh today</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${(stats.activeReporting / stats.meters) * 100}%` }} />
                </div>
                <div className="city-stats-row">
                  <span className="city-stat">
                    <span className="dot online" /> {stats.activeReporting.toLocaleString()} active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-header-with-filter">
            <CardHeader
              title="Recent Anomalies"
              text="Latest flags requiring review"
            />
            <button className="view-all-link" onClick={() => onNavigate("anomalies")}>
              View All →
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Region</th>
                  <th>Timestamp</th>
                  <th>Risk</th>
                  <th>Anomaly Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAnomalies.map((a) => (
                  <tr key={a.id} onClick={() => openAnomalyMeter(a.meterId)}>
                    <td><span className="meter-id">{a.meterId}</span></td>
                    <td>{a.region} · {a.area}</td>
                    <td className="time-value">{a.detectedAt}</td>
                    <td><Badge risk={a.riskLevel} /></td>
                    <td className="anomaly-reason-cell">{a.anomalyType}</td>
                    <td>
                      <span className={`status-pill ${a.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {/* Honest prototype status — no fabricated infrastructure claims */}
      <article className="card prototype-status-card">
        <CardHeader
          title="Data & Model Status"
          text="What in this build is real prototype data vs. still to be built"
        />
        <div className="prototype-status-grid">
          <div className="prototype-status-item">
            <span className="prototype-status-label">Data source</span>
            <span className="prototype-status-value">{prototypeStatus.dataSource}</span>
          </div>
          <div className="prototype-status-item">
            <span className="prototype-status-label">Anomaly detection</span>
            <span className="prototype-status-value">{prototypeStatus.anomalyDetection}</span>
          </div>
          <div className="prototype-status-item">
            <span className="prototype-status-label">Forecasting</span>
            <span className="prototype-status-value">{prototypeStatus.forecasting}</span>
          </div>
          <div className="prototype-status-item">
            <span className="prototype-status-label">Backend / API</span>
            <span className="prototype-status-value">{prototypeStatus.backend}</span>
          </div>
        </div>
      </article>
    </>
  );
}
