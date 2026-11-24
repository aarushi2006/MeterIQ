import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import ConsumptionChart from "../charts/ConsumptionChart";
import { EmptyState, ErrorState, InlineNotice, LoadingState } from "../components/StateViews";
import { consumptionService } from "../services/consumptionService";
import { meterService } from "../services/meterService";
import { getPreferences } from "../services/preferences";

const RANGES = [
  { value: "7D", label: "7 Days" },
  { value: "30D", label: "30 Days" },
  { value: "3M", label: "3 Months" },
  { value: "6M", label: "6 Months" },
  { value: "12M", label: "12 Months" },
];

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits
    ? number.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : new Intl.NumberFormat("en-IN").format(number);
}

function formatKwh(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const magnitude = Math.abs(number);
  if (magnitude >= 1000) return `${formatNumber(number / 1000, 2)} MWh`;
  // Small per-interval values need more than one decimal place, otherwise
  // they round to "0.0 kWh".
  const digits = magnitude >= 100 ? 1 : magnitude >= 1 ? 2 : 4;
  return `${formatNumber(number, digits)} kWh`;
}

function shortLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConsumptionAnalytics() {
  const preferences = useMemo(() => getPreferences(), []);
  const [range, setRange] = useState(preferences.defaultRange || "7D");
  const [region, setRegion] = useState(preferences.defaultRegion || "all");
  const [meterId, setMeterId] = useState("all");

  const [consumption, setConsumption] = useState(null);
  const [diurnal, setDiurnal] = useState(null);
  const [regional, setRegional] = useState(null);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    let active = true;
    meterService
      .getMeters({ page: 1, pageSize: 200, sort: "meter_id_asc" })
      .then((data) => {
        if (active) setMeters(data.meters || []);
      })
      .catch(() => {
        if (active) setMeters([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarnings([]);

    const results = await Promise.allSettled([
      consumptionService.getConsumption({ range, region, meterId }),
      consumptionService.getDiurnal(region),
      consumptionService.getRegionalStats(),
    ]);

    const [consumptionResult, diurnalResult, regionalResult] = results;

    if (consumptionResult.status === "rejected") {
      setError(consumptionResult.reason.message || "Unable to load consumption analytics.");
      setConsumption(null);
      setLoading(false);
      return;
    }

    const nextWarnings = [];
    if (diurnalResult.status === "rejected") {
      nextWarnings.push(`Diurnal profile: ${diurnalResult.reason.message}`);
    }
    if (regionalResult.status === "rejected") {
      nextWarnings.push(`Regional summary: ${regionalResult.reason.message}`);
    }

    setConsumption(consumptionResult.value);
    setDiurnal(diurnalResult.status === "fulfilled" ? diurnalResult.value : null);
    setRegional(regionalResult.status === "fulfilled" ? regionalResult.value : null);
    setWarnings(nextWarnings);
    setLoading(false);
  }, [range, region, meterId]);

  useEffect(() => {
    load();
  }, [load]);

  const regions = regional?.regions ? Object.keys(regional.regions) : [];
  const summary = consumption?.summary;
  const chartData = (consumption?.points || []).map((point) => ({
    time: shortLabel(point.timestamp),
    kwh: Number(point.consumption),
  }));
  const profile = consumption?.hourly_profile || [];
  const diurnalHours = diurnal?.hours || [];
  const regionalRows = regional?.regions
    ? Object.entries(regional.regions).map(([name, values]) => ({ name, ...values }))
    : [];

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>ENERGY CONSUMPTION ANALYTICS</label>
          <h1>Consumption Analytics</h1>
          <p>
            Hourly aggregates computed from processed 3-minute telemetry. Date range,
            region, and meter filters are applied by the API.
          </p>
        </div>
      </section>

      <section className="filter-card">
        <div className="filter-grid">
          <div className="select-wrap">
            <label htmlFor="analytics-region">Region</label>
            <select id="analytics-region" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="all">All regions</option>
              {regions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="analytics-meter">Meter</label>
            <select id="analytics-meter" value={meterId} onChange={(event) => setMeterId(event.target.value)}>
              <option value="all">All meters (aggregate)</option>
              {meters.map((meter) => (
                <option key={meter.meter_id} value={meter.meter_id}>
                  {meter.meter_id} · {meter.region}
                </option>
              ))}
            </select>
          </div>

          <div className="select-wrap date-range-wrap">
            <label>Time horizon</label>
            <div className="range-pills">
              {RANGES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`range-pill ${range === item.value ? "active" : ""}`}
                  onClick={() => setRange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {warnings.length > 0 && (
        <InlineNotice tone="warning" title="Some analytics are unavailable">
          <ul className="notice-list">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InlineNotice>
      )}

      {loading ? (
        <LoadingState label="Aggregating consumption telemetry…" />
      ) : error ? (
        <ErrorState
          title="Consumption analytics unavailable"
          message={error}
          onRetry={load}
        />
      ) : (
        <>
          <section className="stats kpi-grid-5">
            <Stat
              icon="⚡"
              title="Total consumption"
              value={formatKwh(summary?.total_consumption)}
              sub={`${range} · ${summary?.meters_included || 0} meter(s)`}
            />
            <Stat
              icon="🔥"
              title="Peak hourly consumption"
              value={formatKwh(summary?.peak_consumption)}
              sub={summary?.peak_timestamp ? shortLabel(summary.peak_timestamp) : "—"}
            />
            <Stat
              icon="⏱"
              title="Peak hour of day"
              value={summary?.peak_hour !== null && summary?.peak_hour !== undefined ? `${String(summary.peak_hour).padStart(2, "0")}:00` : "—"}
              sub="Mean hourly profile"
            />
            <Stat
              icon="📊"
              title={`Average per ${consumption?.bucket || "bucket"}`}
              value={formatKwh(summary?.average_per_bucket)}
              sub="Arithmetic mean of exported buckets"
            />
            <Stat
              icon="🧮"
              title="Processed observations"
              value={formatNumber(summary?.observations)}
              sub="3-minute interval records"
            />
          </section>

          <article className="card" style={{ marginBottom: 20 }}>
            <CardHeader
              title={`Consumption trend (${range})`}
              text={`${meterId === "all" ? "Aggregate" : meterId} · ${region === "all" ? "all regions" : region} · ${consumption?.bucket || "hourly"} buckets`}
              right={consumption?.unit || "kWh"}
            />
            {chartData.length ? (
              <ConsumptionChart data={chartData} height={300} />
            ) : (
              <EmptyState title="No points in this range" message="Adjust the range or filters." />
            )}
          </article>

          <section className="grid2">
            <article className="card">
              <CardHeader
                title="Average hourly profile"
                text="Mean consumption by hour of day for the selected filters"
              />
              {profile.some((item) => item.avg_consumption !== null) ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={profile} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip formatter={(value) => [`${formatNumber(value, 3)} kWh`, "Average"]} labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} />
                      <Bar dataKey="avg_consumption" name="Average kWh" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="No hourly profile" message="No observations match the filters." />
              )}
            </article>

            <article className="card">
              <CardHeader
                title="Diurnal pattern"
                text={
                  region === "all"
                    ? "Weekday vs weekend mean across all regions"
                    : `Weekday vs weekend mean · ${region}`
                }
              />
              {diurnalHours.some((item) => item.weekday !== null || item.weekend !== null) ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={diurnalHours} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip formatter={(value) => `${formatNumber(value, 3)} kWh`} labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Line type="monotone" dataKey="weekday" name="Weekday" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="weekend" name="Weekend" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="No diurnal data" message="The selected region has no observations." />
              )}
            </article>
          </section>

          <article className="card" style={{ marginTop: 20 }}>
            <CardHeader
              title="Regional meter summary"
              text="Meter counts and anomaly indicators from the anomaly summary artifact"
            />
            {regionalRows.length ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Region</th>
                      <th>Meters</th>
                      <th>Flagged meters</th>
                      <th>High risk</th>
                      <th>Review</th>
                      <th>Normal</th>
                      <th>Anomaly observations</th>
                      <th>Total observations</th>
                      <th>Mean anomaly rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionalRows.map((row) => (
                      <tr key={row.name}>
                        <td><strong>{row.name}</strong></td>
                        <td>{formatNumber(row.meter_count)}</td>
                        <td>{formatNumber(row.flagged_count)}</td>
                        <td>{formatNumber(row.high_risk_count)}</td>
                        <td>{formatNumber(row.review_count)}</td>
                        <td>{formatNumber(row.normal_count)}</td>
                        <td>{formatNumber(row.total_anomaly_observations)}</td>
                        <td>{formatNumber(row.total_observations)}</td>
                        <td>{formatNumber((row.avg_risk || 0) * 100, 2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No regional data" message="Regional analytics are unavailable." />
            )}
          </article>
        </>
      )}
    </>
  );
}
