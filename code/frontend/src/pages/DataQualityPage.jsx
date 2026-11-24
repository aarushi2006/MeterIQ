import { useCallback, useEffect, useState } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import { ErrorState, InlineNotice, LoadingState } from "../components/StateViews";
import { consumptionService } from "../services/consumptionService";

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits
    ? number.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : new Intl.NumberFormat("en-IN").format(number);
}

function formatPercent(value, digits = 2, alreadyPercent = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${(alreadyPercent ? number : number * 100).toFixed(digits)}%`;
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

export default function DataQualityPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await consumptionService.getDataQuality();
      setMetrics(data);
    } catch (err) {
      setError(err.message || "Unable to load data-quality metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingState label="Computing data-quality metrics from processed telemetry…" />;
  }

  if (error) {
    return (
      <ErrorState title="Data quality unavailable" message={error} onRetry={load} />
    );
  }

  const coverage = metrics?.coverage;
  const artifact = metrics?.anomaly_artifact;

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>DATASET INTEGRITY</label>
          <h1>Data Quality</h1>
          <p>
            Coverage, interval completeness, quality flags, and pipeline row counts
            computed from the processed telemetry and anomaly summary artifacts.
          </p>
        </div>
        <button className="secondary action-btn" onClick={load}>
          Refresh metrics
        </button>
      </section>

      <section className="stats kpi-grid-4">
        <Stat
          icon="✅"
          label="Completeness"
          value={formatPercent(metrics?.completeness_pct, 2, true)}
          sub={`${formatNumber(metrics?.observed_intervals)} observed / ${formatNumber(metrics?.expected_intervals)} expected intervals`}
        />
        <Stat
          icon="📡"
          label="Meters in summary"
          value={formatNumber(metrics?.meters)}
          sub={`${formatNumber(metrics?.total_observations)} scored observations`}
        />
        <Stat
          icon="🧪"
          label="Data-quality flags"
          value={formatNumber(metrics?.data_quality_flags)}
          sub={`${formatNumber(metrics?.meters_with_quality_flags)} meters affected`}
        />
        <Stat
          icon="⚠️"
          label="Anomaly observations"
          value={formatNumber(metrics?.anomaly_observations)}
          sub={`${formatPercent(metrics?.anomaly_rate)} of scored observations`}
        />
      </section>

      {artifact && !artifact.available && (
        <InlineNotice tone="warning" title="Observation-level artifact is unavailable">
          {artifact.message}
          {artifact.path && <p className="notice-path">Expected artifact: {artifact.path}</p>}
          The metrics below use the generated meter-level anomaly summary and the
          processed telemetry cache.
        </InlineNotice>
      )}

      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Coverage & sampling"
            text="What the processed dataset actually contains"
          />
          <div className="indicator-table">
            <div className="indicator-row">
              <span>Telemetry coverage start</span>
              <strong>{formatDateTime(coverage?.start)}</strong>
            </div>
            <div className="indicator-row">
              <span>Telemetry coverage end</span>
              <strong>{formatDateTime(coverage?.end)}</strong>
            </div>
            <div className="indicator-row">
              <span>Coverage span</span>
              <strong>{formatNumber(coverage?.days, 1)} days</strong>
            </div>
            <div className="indicator-row">
              <span>Sampling interval</span>
              <strong>
                {metrics?.sampling_interval_minutes
                  ? `${formatNumber(metrics.sampling_interval_minutes, 2)} minutes`
                  : "—"}
              </strong>
            </div>
            <div className="indicator-row">
              <span>Observed 3-minute intervals</span>
              <strong>{formatNumber(metrics?.observed_intervals)}</strong>
            </div>
            <div className="indicator-row">
              <span>Expected intervals from coverage</span>
              <strong>{formatNumber(metrics?.expected_intervals)}</strong>
            </div>
          </div>
          <p className="panel-footnote">
            Expected intervals are derived from each meter's first and last recorded
            timestamp and the configured sampling rate. Completeness compares observed
            intervals against that expected window.
          </p>
        </article>

        <article className="card">
          <CardHeader
            title="Pipeline processing"
            text="Row counts reported by the cleaning pipeline"
          />
          <div className="indicator-table">
            <div className="indicator-row">
              <span>Raw rows processed</span>
              <strong>{formatNumber(metrics?.raw_rows)}</strong>
            </div>
            <div className="indicator-row">
              <span>Cleaned rows retained</span>
              <strong>{formatNumber(metrics?.cleaned_rows)}</strong>
            </div>
            <div className="indicator-row">
              <span>Row dropout rate</span>
              <strong>{formatPercent(metrics?.row_dropout_rate_pct, 3, true)}</strong>
            </div>
            <div className="indicator-row">
              <span>Pipeline generated</span>
              <strong>{formatDateTime(metrics?.pipeline_generated_at)}</strong>
            </div>
            <div className="indicator-row">
              <span>Anomaly observations artifact</span>
              <strong>{artifact?.available ? "Available" : "Not generated"}</strong>
            </div>
            <div className="indicator-row">
              <span>Metrics generated</span>
              <strong>{formatDateTime(metrics?.generated_at)}</strong>
            </div>
          </div>
          <p className="panel-footnote">
            Raw and cleaned row counts come from pipeline_run.json. If the file is
            absent, these fields show “—” rather than a simulated value.
          </p>
        </article>
      </section>

      <article className="card">
        <CardHeader
          title="How these metrics are calculated"
          text="Definitions used by the ML service"
        />
        <ul className="definition-list">
          <li>
            <strong>Completeness</strong> — observed 3-minute intervals divided by the
            intervals expected between each meter's first and last timestamp, capped at
            100%.
          </li>
          <li>
            <strong>Data-quality flags</strong> — count recorded by the anomaly pipeline
            for dropout, out-of-range voltage, and similar validation failures.
          </li>
          <li>
            <strong>Anomaly rate</strong> — flagged observations divided by all scored
            observations across the meter summary.
          </li>
          <li>
            <strong>Row dropout</strong> — rows removed during cleaning divided by raw
            rows reported by the preprocessing pipeline.
          </li>
        </ul>
      </article>
    </>
  );
}
