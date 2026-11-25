import { useCallback, useEffect, useState } from "react";
import Badge from "../components/Badge";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import {
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
} from "../components/StateViews";
import { anomalyService } from "../services/anomalyService";
import { authService } from "../services/authService";
import { investigationService } from "../services/investigationService";

const PAGE_SIZE = 25;

const RISK_OPTIONS = [
  { value: "all", label: "All risk levels" },
  { value: "HIGH_RISK", label: "High risk" },
  { value: "REVIEW", label: "Review" },
];

const SORT_OPTIONS = [
  { value: "severity_desc", label: "Highest severity" },
  { value: "timestamp_desc", label: "Newest first" },
  { value: "timestamp_asc", label: "Oldest first" },
];

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits
    ? number.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : new Intl.NumberFormat("en-IN").format(number);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toFixed(2)}%`;
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

const INDICATOR_LABELS = {
  deviation_z: "Deviation z-score",
  pct_change_prev: "Change vs previous interval",
  deviation_from_same_hour_last_week: "Deviation vs same hour last week",
  baseline_severity: "Baseline model severity",
  isolation_forest_severity: "Isolation forest severity",
};

export default function AnomalyDetection({
  currentUser,
  onSelectMeterById,
  onNavigateToInvestigations,
  onShowToast,
}) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  const [records, setRecords] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [risk, setRisk] = useState("all");
  const [region, setRegion] = useState("all");
  const [sort, setSort] = useState("severity_desc");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedCase, setDispatchedCase] = useState(null);

  const canDispatch = authService.isSupervisor(currentUser);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [risk, region, sort]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await anomalyService.getSummary();
      setSummary(data);
    } catch (error) {
      setSummaryError(error.message || "Unable to load the anomaly summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const data = await anomalyService.getAnomalies({
        risk,
        region,
        search: debouncedSearch,
        sort,
        page,
        pageSize: PAGE_SIZE,
      });
      setRecords(data);
    } catch (error) {
      setRecordsError(error.message || "Unable to load anomaly records.");
      setRecords(null);
    } finally {
      setRecordsLoading(false);
    }
  }, [risk, region, debouncedSearch, sort, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleDispatch = async () => {
    if (!selected || !canDispatch || dispatching) return;

    setDispatching(true);
    try {
      const reason = selected.reasons?.[0] || "Flagged by the anomaly detection pipeline.";
      const created = await investigationService.create({
        meter_id: selected.meter_id,
        region: selected.region,
        riskScore: selected.severity,
        riskLevel: selected.risk_level,
        priority: selected.risk_level === "HIGH_RISK" ? "HIGH" : "MEDIUM",
        reason,
        evidence: (selected.reasons || []).join(" | ") || undefined,
        detectedDate: selected.timestamp || new Date().toISOString(),
      });
      setDispatchedCase(created);
      setSelected(null);
      onShowToast?.(`Investigation ${created.id} created for meter ${created.meter_id}`, "success");
      onNavigateToInvestigations?.();
    } catch (error) {
      onShowToast?.(error.message || "Unable to create the investigation case.", "error");
    } finally {
      setDispatching(false);
    }
  };

  const recordsAvailable = records?.available !== false;
  const rows = records?.records || [];
  const regions = summary?.regions ? Object.keys(summary.regions).sort() : [];

  const riskDistribution = summary?.riskDistribution || {};

  if (summaryLoading) {
    return <LoadingState label="Loading anomaly summary from the ML service…" />;
  }

  if (summaryError) {
    return (
      <ErrorState
        title="Anomaly intelligence unavailable"
        message={summaryError}
        onRetry={loadSummary}
      />
    );
  }

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>DECISION-SUPPORT INTELLIGENCE</label>
          <h1>Explainable Anomaly Detection</h1>
          <p>
            Meter-level and observation-level anomaly indicators generated by the ML
            pipeline. A flag is a review indicator, not a confirmed finding.
          </p>
        </div>
      </section>

      {!recordsAvailable && records && (
        <InlineNotice tone="warning" title="Observation-level records are unavailable">
          {records.message}
          Meter-level aggregates below still come from the generated anomaly summary.
        </InlineNotice>
      )}

      {dispatchedCase && (
        <InlineNotice tone="success" title={`Case ${dispatchedCase.id} created`}>
          The case for meter {dispatchedCase.meter_id} is now visible on
          the Investigations page.
        </InlineNotice>
      )}

      <section className="stats kpi-grid-4">
        <Stat
          icon="📡"
          label="Total meters scored"
          value={formatNumber(summary?.totalMeters)}
          sub={`${formatNumber(summary?.totalObservations)} observations`}
        />
        <Stat
          icon="⚠️"
          label="Flagged meters"
          value={formatNumber(summary?.flaggedMeters)}
          sub={`${formatPercent(summary?.flagRate)} of the fleet`}
          color="danger"
        />
        <Stat
          icon="🚨"
          label="High-risk meters"
          value={formatNumber(riskDistribution.high ?? summary?.highRiskMeters)}
          sub={`${formatNumber(summary?.totalHighRiskObservations)} high-risk observations`}
          color="danger"
        />
        <Stat
          icon="🔎"
          label="Review meters"
          value={formatNumber(riskDistribution.review ?? summary?.reviewMeters)}
          sub={`${formatNumber(summary?.totalReviewObservations)} review observations`}
        />
      </section>

      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              placeholder="Search meter, region, or indicator…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search anomaly records"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch("")} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>

          <div className="select-wrap">
            <label htmlFor="anomaly-region">Region</label>
            <select
              id="anomaly-region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            >
              <option value="all">All regions</option>
              {regions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="anomaly-risk">Risk level</label>
            <select
              id="anomaly-risk"
              value={risk}
              onChange={(event) => setRisk(event.target.value)}
            >
              {RISK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label htmlFor="anomaly-sort">Sort by</label>
            <select
              id="anomaly-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-summary-row">
          <span>
            <strong>{formatNumber(summary?.totalAnomalyObservations)}</strong> flagged observations
          </span>
          <span>
            <strong>{formatNumber(summary?.totalDataQualityFlags)}</strong> data-quality flags
          </span>
          <span>
            Mean anomaly rate <strong>{formatPercent((summary?.averageAnomalyRate || 0) * 100)}</strong>
          </span>
        </div>
      </section>

      <section className="grid2 anomaly-summary-grid">
        <article className="card">
          <CardHeader
            title="Top model indicators"
            text="Reasons most frequently recorded across flagged meters"
          />
          {summary?.topReasons?.length ? (
            <ol className="indicator-list">
              {summary.topReasons.map((item) => (
                <li key={item.reason}>
                  <span>{item.reason}</span>
                  <strong>{formatNumber(item.meters)} meters</strong>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No indicator summary" message="The anomaly summary has no recorded reasons." />
          )}
        </article>

        <article className="card">
          <CardHeader
            title="Regional distribution"
            text="Meter counts and flagged observations by region"
          />
          {summary?.regions && Object.keys(summary.regions).length ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Meters</th>
                    <th>Flagged</th>
                    <th>High risk</th>
                    <th>Anomaly obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.regions).map(([name, values]) => (
                    <tr key={name}>
                      <td><strong>{name}</strong></td>
                      <td>{formatNumber(values.meter_count)}</td>
                      <td>{formatNumber(values.flagged_count)}</td>
                      <td>{formatNumber(values.high_risk_count)}</td>
                      <td>{formatNumber(values.total_anomaly_observations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No regional data" message="Regional aggregates are unavailable." />
          )}
        </article>
      </section>

      {recordsError ? (
        <ErrorState
          title="Anomaly records unavailable"
          message={recordsError}
          onRetry={loadRecords}
        />
      ) : recordsLoading && !records ? (
        <LoadingState label="Loading flagged anomaly records…" />
      ) : (
        <article className="card table-card">
          <CardHeader
            title="Flagged observation records"
            text={
              recordsAvailable
                ? `Showing ${formatNumber(rows.length)} of ${formatNumber(records?.total)} records${
                    records?.totalPages > 1
                      ? ` · page ${records.page} of ${records.totalPages}`
                      : ""
                  }`
                : "Observation artifact not generated"
            }
            right={
              recordsLoading
                ? <span className="muted-text">Refreshing…</span>
                : recordsAvailable
                  ? <span className="live-label">● ML artifact</span>
                  : <span className="muted-text">Aggregate-only</span>
            }
          />

          {!recordsAvailable ? (
            <EmptyState
              title="No observation-level records"
              message={
                records?.message ||
                "The anomaly observations artifact has not been generated."
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No records match these filters"
              message="Adjust the search text, region, or risk level."
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Meter</th>
                    <th>Region</th>
                    <th>Risk</th>
                    <th>Severity</th>
                    <th>Consumption</th>
                    <th>Derived category</th>
                    <th>Primary indicator</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record, index) => (
                    <tr
                      key={`${record.meter_id}-${record.timestamp}-${index}`}
                      className="interactive-row"
                      onClick={() => setSelected(record)}
                    >
                      <td>{formatDateTime(record.timestamp)}</td>
                      <td>
                        <button
                          className="meter-link-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectMeterById?.(record.meter_id);
                          }}
                        >
                          {record.meter_id}
                        </button>
                      </td>
                      <td>{record.region}</td>
                      <td><Badge risk={record.risk_level} /></td>
                      <td>{formatNumber(record.severity, 2)}</td>
                      <td>{formatNumber(record.consumption, 3)} kWh</td>
                      <td>{record.anomaly_type || "—"}</td>
                      <td>
                        <span
                          className="indicator-snippet"
                          title={(record.reasons || []).join(" • ")}
                        >
                          {record.reasons?.[0] || "—"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(record);
                          }}
                        >
                          Explain →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recordsAvailable && records?.totalPages > 1 && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={records.page <= 1 || recordsLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ← Previous
              </button>
              <span>
                Page <strong>{records.page}</strong> of <strong>{records.totalPages}</strong>
              </span>
              <button
                className="secondary"
                disabled={records.page >= records.totalPages || recordsLoading}
                onClick={() =>
                  setPage((current) => Math.min(records.totalPages, current + 1))
                }
              >
                Next →
              </button>
            </div>
          )}
        </article>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card modal-wide"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Anomaly detail for meter ${selected.meter_id}`}
          >
            <div className="modal-header">
              <div>
                <h3>Anomaly explanation · {selected.meter_id}</h3>
                <span className="modal-sub">
                  {selected.region} · {formatDateTime(selected.timestamp)}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="spec-item">
                  <span className="spec-label">Risk classification</span>
                  <strong className="spec-value">
                    <Badge risk={selected.risk_level} />
                  </strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Severity score (0–100)</span>
                  <strong className="spec-value">{formatNumber(selected.severity, 2)}</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Consumption</span>
                  <strong className="spec-value">{formatNumber(selected.consumption, 3)} kWh</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Derived category</span>
                  <strong className="spec-value">{selected.anomaly_type || "—"}</strong>
                </div>
              </div>

              <div className="explain-section">
                <h4>Why was this observation flagged?</h4>
                {selected.reasons?.length ? (
                  <ul className="reason-list">
                    {selected.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No reason strings were recorded for this observation.</p>
                )}
              </div>

              <div className="explain-section">
                <h4>Recorded indicators</h4>
                {selected.indicators && Object.keys(selected.indicators).length ? (
                  <div className="indicator-table">
                    {Object.entries(selected.indicators).map(([key, value]) => (
                      <div key={key} className="indicator-row">
                        <span>{INDICATOR_LABELS[key] || key}</span>
                        <strong>{formatNumber(value, 4)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No numeric indicators were stored for this record.</p>
                )}
              </div>

              <InlineNotice tone="info">
                The derived category is inferred from the recorded reason strings. Final
                determination requires human operational review and, where appropriate,
                field verification.
              </InlineNotice>
            </div>

            <div className="modal-footer">
              <button
                className="secondary"
                onClick={() => onSelectMeterById?.(selected.meter_id)}
              >
                Open meter diagnostics →
              </button>
              <button
                className="primary"
                onClick={handleDispatch}
                disabled={!canDispatch || dispatching}
                title={
                  canDispatch
                    ? "Create an investigation case"
                    : "Only supervisors and administrators can create cases"
                }
              >
                {dispatching ? "Creating case…" : "Dispatch to investigations →"}
              </button>
            </div>
            {!canDispatch && (
              <p className="modal-permission-note">
                Your analyst role can review anomaly records; only a supervisor or
                administrator can open a new investigation.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="panel-footnote">
        Summary generated {formatDateTime(summary?.generated_at)}. Observation artifact:{" "}
        {summary?.records_available ? "available" : "not generated"}.
      </p>
    </>
  );
}
