import { useCallback, useEffect, useMemo, useState } from "react";
import CardHeader from "../components/CardHeader";
import Badge from "../components/Badge";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { meterService } from "../services/meterService";
import { getPreferences } from "../services/preferences";

const RISK_OPTIONS = [
  { value: "all", label: "All risk levels" },
  { value: "HIGH_RISK", label: "High risk" },
  { value: "REVIEW", label: "Review" },
  { value: "NORMAL", label: "Normal" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "FLAGGED", label: "Flagged (≥1 anomaly)" },
  { value: "NORMAL", label: "No anomalies" },
  { value: "HIGH_RISK", label: "High-risk classification" },
  { value: "REVIEW", label: "Review classification" },
];

const SORT_OPTIONS = [
  { value: "anomaly_rate_desc", label: "Highest anomaly rate" },
  { value: "anomaly_rate_asc", label: "Lowest anomaly rate" },
  { value: "anomaly_count_desc", label: "Most anomaly observations" },
  { value: "risk_desc", label: "Highest risk classification" },
  { value: "meter_id_asc", label: "Meter ID (A–Z)" },
  { value: "meter_id_desc", label: "Meter ID (Z–A)" },
];

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits ? number.toFixed(digits) : new Intl.NumberFormat("en-IN").format(number);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${(number * 100).toFixed(2)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MetersPage({ onSelectMeter }) {
  const preferences = useMemo(() => getPreferences(), []);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [region, setRegion] = useState(preferences.defaultRegion || "all");
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("anomaly_rate_desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(preferences.pageSize || 20);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [region, risk, status, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await meterService.getMeters({
        search: debouncedSearch,
        region,
        risk,
        status,
        sort,
        page,
        pageSize,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || "Unable to load meter records.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, region, risk, status, sort, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const regions = result?.regions || [];
  const meters = result?.meters || [];
  const summary = result?.summary;

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>METER MANAGEMENT</label>
          <h1>Meter Analysis</h1>
          <p>
            Search and inspect the live meter catalogue. Risk classification is computed by
            the ML anomaly pipeline from actual observation counts.
          </p>
        </div>
      </section>

      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              placeholder="Search meter ID, region, or indicator…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search meters"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch("")} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>

          <div className="select-wrap">
            <label htmlFor="meter-region">Region</label>
            <select id="meter-region" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="all">All regions</option>
              {regions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="meter-risk">Risk level</label>
            <select id="meter-risk" value={risk} onChange={(event) => setRisk(event.target.value)}>
              {RISK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="meter-status">Status</label>
            <select id="meter-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="meter-sort">Sort by</label>
            <select id="meter-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {summary && (
          <div className="filter-summary-row">
            <span><strong>{formatNumber(summary.totalMeters)}</strong> meters</span>
            <span><strong>{formatNumber(summary.flaggedMeters)}</strong> flagged</span>
            <span><strong>{formatNumber(summary.highRiskMeters)}</strong> high risk</span>
            <span><strong>{formatNumber(summary.totalAnomalyObservations)}</strong> anomaly observations</span>
          </div>
        )}
      </section>

      {error ? (
        <ErrorState title="Meter catalogue unavailable" message={error} onRetry={load} />
      ) : loading && !result ? (
        <LoadingState label="Loading meter catalogue…" />
      ) : (
        <article className="card table-card">
          <CardHeader
            title="Smart Meter Records"
            text={
              result
                ? `Showing ${meters.length} of ${formatNumber(result.total)} meters${result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}`
                : "Loading…"
            }
            right={loading ? <span className="muted-text">Refreshing…</span> : <span className="live-label">● API data</span>}
          />

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Meter ID</th>
                  <th>Region</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Anomalies</th>
                  <th>Anomaly rate</th>
                  <th>Observations</th>
                  <th>Data-quality flags</th>
                  <th>Coverage end</th>
                  <th>Top indicator</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((meter) => (
                  <tr
                    key={meter.meter_id}
                    className="interactive-row"
                    onClick={() => onSelectMeter?.(meter)}
                  >
                    <td><span className="meter-id-badge">{meter.meter_id}</span></td>
                    <td>{meter.region || "—"}</td>
                    <td><Badge risk={meter.risk_level} /></td>
                    <td>
                      <span className={`status-pill ${String(meter.status).toLowerCase().replace(/\s+/g, "-")}`}>
                        {meter.status}
                      </span>
                    </td>
                    <td>{formatNumber(meter.anomaly_count)}</td>
                    <td>{formatPercent(meter.anomaly_rate)}</td>
                    <td>{formatNumber(meter.total_observations)}</td>
                    <td>{formatNumber(meter.data_quality_flag_count)}</td>
                    <td>{formatDate(meter.coverage_end)}</td>
                    <td>
                      <span className="indicator-snippet" title={meter.most_common_reasons?.join(" • ")}>
                        {meter.most_common_reasons?.[0] || "—"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="inspect-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectMeter?.(meter);
                        }}
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))}
                {meters.length === 0 && (
                  <tr>
                    <td colSpan="11" className="empty-table-cell">
                      No meters match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={result.page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ← Previous
              </button>
              <span>
                Page <strong>{result.page}</strong> of <strong>{result.totalPages}</strong>
              </span>
              <button
                className="secondary"
                disabled={result.page >= result.totalPages || loading}
                onClick={() => setPage((current) => Math.min(result.totalPages, current + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </article>
      )}
    </>
  );
}
