import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import {
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
} from "../components/StateViews";
import { meterService } from "../services/meterService";
import { getPreferences } from "../services/preferences";

const DEFAULT_PAGE_SIZE = 25;

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits
    ? number.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : new Intl.NumberFormat("en-IN").format(number);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MeterHealth() {
  const preferences = useMemo(() => getPreferences(), []);
  const pageSize = preferences.pageSize || DEFAULT_PAGE_SIZE;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [health, setHealth] = useState("all");
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await meterService.getHealth();
      setData(result);
    } catch (err) {
      setError(err.message || "Unable to load meter health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status, health, region]);

  const meters = data?.meters || [];
  const summary = data?.summary;
  const regions = useMemo(
    () => [...new Set(meters.map((meter) => meter.region).filter(Boolean))].sort(),
    [meters]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return meters.filter((meter) => {
      if (status !== "all" && meter.status !== status) return false;
      if (health !== "all" && meter.health !== health) return false;
      if (region !== "all" && meter.region !== region) return false;
      if (needle) {
        const haystack = `${meter.meter_id} ${meter.region}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [meters, search, status, health, region]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (loading) {
    return <LoadingState label="Loading fleet health from the ML service…" />;
  }

  if (error) {
    return <ErrorState title="Meter health unavailable" message={error} onRetry={load} />;
  }

  const statusCounts = summary?.status_counts || {};
  const healthCounts = summary?.health_counts || {};
  const instrumented = data?.instrumented_fields || {};

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>FLEET COVERAGE</label>
          <h1>Meter Health</h1>
          <p>
            Reporting status and data-health classification derived from each meter's
            coverage window, quality flags, and anomaly rate.
          </p>
        </div>
        <button className="secondary action-btn" onClick={load}>
          Refresh health
        </button>
      </section>

      <InlineNotice tone="info" title="Hardware telemetry is not part of this dataset">
        {data?.meters?.[0]?.hardware_note ||
          "Battery level, signal strength, and firmware are not present in the processed smart-meter dataset, so they are not shown."}
      </InlineNotice>

      <section className="stats kpi-grid-4">
        <Stat
          icon="📡"
          label="Meters tracked"
          value={formatNumber(summary?.total_meters)}
          sub="From the anomaly summary and coverage cache"
        />
        <Stat
          icon="🟢"
          label="Reporting"
          value={formatNumber(statusCounts.REPORTING)}
          sub={`Updated within the last 7 days of the dataset`}
        />
        <Stat
          icon="🟠"
          label="Stale / inactive"
          value={formatNumber((statusCounts.STALE || 0) + (statusCounts.INACTIVE || 0))}
          sub={`${formatNumber(statusCounts.STALE)} stale · ${formatNumber(statusCounts.INACTIVE)} inactive`}
        />
        <Stat
          icon="🩺"
          label="Good health"
          value={formatNumber(healthCounts.GOOD)}
          sub={`${formatNumber(healthCounts.WATCH)} watch · ${formatNumber(healthCounts.POOR)} poor`}
        />
      </section>

      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              placeholder="Search meter ID or region…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search meter health"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch("")} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>

          <div className="select-wrap">
            <label htmlFor="health-region">Region</label>
            <select id="health-region" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="all">All regions</option>
              {regions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="health-status">Reporting status</label>
            <select id="health-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="REPORTING">Reporting</option>
              <option value="STALE">Stale</option>
              <option value="INACTIVE">Inactive</option>
              <option value="NO_DATA">No data</option>
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="health-grade">Health grade</label>
            <select id="health-grade" value={health} onChange={(event) => setHealth(event.target.value)}>
              <option value="all">All grades</option>
              <option value="GOOD">Good</option>
              <option value="WATCH">Watch</option>
              <option value="POOR">Poor</option>
            </select>
          </div>
        </div>

        <div className="filter-summary-row">
          <span><strong>{formatNumber(filtered.length)}</strong> meters in view</span>
          <span>Quality flags: <strong>{formatNumber(meters.reduce((sum, meter) => sum + (Number(meter.data_quality_flags) || 0), 0))}</strong></span>
          <span>Generated <strong>{formatDate(data?.generated_at)}</strong></span>
        </div>
      </section>

      <article className="card table-card">
        <CardHeader
          title="Meter health records"
          text={
            filtered.length
              ? `Showing ${pageRows.length} of ${formatNumber(filtered.length)} meters`
              : "No meters match the selected filters"
          }
          right={loading ? <span className="muted-text">Refreshing…</span> : <span className="live-label">● ML artifact</span>}
        />

        {pageRows.length === 0 ? (
          <EmptyState
            title="No meter health records"
            message="Adjust the region, status, health grade, or search text."
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Region</th>
                  <th>Reporting</th>
                  <th>Health</th>
                  <th>Coverage start</th>
                  <th>Days since</th>
                  <th>Observations</th>
                  <th>Quality flags</th>
                  <th>Anomaly rate</th>
                  <th>Risk</th>
                  <th>Coverage end</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((meter) => (
                  <tr key={meter.meter_id}>
                    <td><span className="meter-id-badge">{meter.meter_id}</span></td>
                    <td>{meter.region}</td>
                    <td>
                      <span className={`status-pill ${String(meter.status).toLowerCase().replace(/\s+/g, "-")}`}>
                        {meter.status}
                      </span>
                    </td>
                    <td>
                      <span className={`health-pill ${String(meter.health).toLowerCase()}`}>
                        {meter.health}
                      </span>
                    </td>
                    <td>{formatDate(meter.coverage_start)}</td>
                    <td>
                      {meter.days_since_last_reading === null ||
                      meter.days_since_last_reading === undefined
                        ? "—"
                        : formatNumber(meter.days_since_last_reading, 1)}
                    </td>
                    <td>{formatNumber(meter.total_observations)}</td>
                    <td>{formatNumber(meter.data_quality_flags)}</td>
                    <td>{formatNumber((meter.anomaly_rate || 0) * 100, 2)}%</td>
                    <td><Badge risk={meter.risk_level} /></td>
                    <td>{formatDate(meter.coverage_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="secondary"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              ← Previous
            </button>
            <span>
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              className="secondary"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </article>

      <p className="panel-footnote">
        Reporting status compares each meter's last reading with the dataset's latest
        timestamp: ≤7 days is REPORTING, ≤30 days is STALE, otherwise INACTIVE. Health
        grades use data-quality flag ratio and anomaly rate. Instrumented fields:{" "}
        {Object.entries(instrumented)
          .map(([key, value]) => `${key.replace(/_/g, " ")} ${value ? "yes" : "no"}`)
          .join(" · ")}
        .
      </p>
    </>
  );
}
