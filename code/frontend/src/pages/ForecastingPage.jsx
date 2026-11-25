import { useCallback, useEffect, useMemo, useState } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import {
  ForecastComparisonChart,
  ForecastErrorChart,
  computeForecastSummary,
} from "../charts/ForecastChart";
import {
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
} from "../components/StateViews";
import { forecastService } from "../services/forecastService";

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return digits
    ? number.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : new Intl.NumberFormat("en-IN").format(number);
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
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSummaryEntries(summary) {
  if (!summary || typeof summary !== "object") return [];
  return Object.entries(summary)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      value: typeof value === "number" ? formatNumber(value, 4) : value,
    }));
}

export default function ForecastingPage() {
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);

  const [meterId, setMeterId] = useState("");
  const [horizon, setHorizon] = useState(24);
  const [dayOffset, setDayOffset] = useState(0);
  const [hourSlot, setHourSlot] = useState("all");

  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const data = await forecastService.getMeta();
      setMeta(data);
      if (data.available && data.meters?.length) {
        setMeterId((current) => current || data.meters[0]);
      }
      if (data.horizons?.length) {
        setHorizon((current) =>
          data.horizons.includes(current) ? current : data.horizons[data.horizons.length - 1]
        );
      }
    } catch (error) {
      setMetaError(error.message || "Unable to load forecasting metadata.");
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const selectedCoverage = meta?.meterCoverage?.[meterId] || meta?.coverage;
  const forwardStart = useMemo(() => {
    if (meta?.mode !== "forward" || !selectedCoverage?.start) return undefined;
    const date = new Date(selectedCoverage.start);
    if (Number.isNaN(date.getTime())) return undefined;
    date.setDate(date.getDate() + Number(dayOffset));
    date.setHours(hourSlot === "all" ? 0 : Number(hourSlot), 0, 0, 0);
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00:00`;
  }, [meta?.mode, selectedCoverage?.start, dayOffset, hourSlot]);

  const requestedHorizon = meta?.mode === "forward" && hourSlot !== "all" ? 1 : horizon;
  const forecastDays = useMemo(() => {
    if (!selectedCoverage?.start) return [];
    const first = new Date(selectedCoverage.start);
    if (Number.isNaN(first.getTime())) return [];
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first);
      date.setDate(date.getDate() + index);
      return { value: index, label: index === 0 ? `Next day · ${formatDateTime(date)}` : `Day ${index + 1} · ${formatDateTime(date)}` };
    });
  }, [selectedCoverage?.start]);

  useEffect(() => {
    if (!meta?.available || !meterId) {
      setForecast(null);
      return;
    }

    let active = true;
    setForecastLoading(true);
    setForecastError(null);

    forecastService
      .getForecast(meterId, requestedHorizon, forwardStart)
      .then((data) => {
        if (active) setForecast(data);
      })
      .catch((error) => {
        if (active) {
          setForecast(null);
          setForecastError(error.message || "Unable to load the forecast.");
        }
      })
      .finally(() => {
        if (active) setForecastLoading(false);
      });

    return () => {
      active = false;
    };
  }, [meta?.available, meterId, requestedHorizon, forwardStart, reloadKey]);

  const chartData = useMemo(
    () =>
      (forecast?.points || []).map((point) => ({
        time: shortTime(point.timestamp),
        actual: point.actual === null || point.actual === undefined ? null : Number(point.actual),
        predicted: Number(point.predicted),
        baseline: Number(point.baseline),
      })),
    [forecast]
  );

  const chartSummary = useMemo(() => computeForecastSummary(chartData), [chartData]);
  const modelInfo = meta?.model_info;
  const modelEntries = renderSummaryEntries(modelInfo?.model_summary);
  const baselineEntries = renderSummaryEntries(modelInfo?.baseline_summary);
  const meterMetrics = forecast?.metrics ? renderSummaryEntries(forecast.metrics) : [];

  if (metaLoading) {
    return <LoadingState label="Loading forecasting model metadata…" />;
  }

  if (metaError) {
    return (
      <ErrorState
        title="Forecasting service unavailable"
        message={metaError}
        onRetry={loadMeta}
      />
    );
  }

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>SHORT-TERM LOAD FORECASTING</label>
          <h1>Load Forecasting</h1>
          <p>
            {meta?.mode === "forward"
              ? "Seven-day, hourly forward forecasts generated from each meter’s recent load pattern, calendar signals, and weekly seasonality."
              : "Backtested consumption predictions from the trained forecasting pipeline, compared against an actual reading and a same-hour-last-week baseline."}
          </p>
        </div>
      </section>

      <InlineNotice tone="info" title="Forecast interpretation">
        Forecasts are model-generated estimates based on available historical data and assumptions. They are not actual measured consumption, confirmed anomalies or proof of electricity theft. Predictions may be inaccurate and should be reviewed alongside historical records and field investigation evidence.
      </InlineNotice>

      {!meta?.available && (
        <InlineNotice tone="warning" title="Forecast artifact not generated">
          {meta?.message ||
            "The forecast predictions artifact is missing, so no forecasts can be displayed."}
          Forecast results will appear once model output is available for review.
        </InlineNotice>
      )}

      {meta?.available && (
        <section className="filter-card">
          <div className="filter-grid">
            <div className="select-wrap">
              <label htmlFor="forecast-meter">Meter</label>
              <select
                id="forecast-meter"
                value={meterId}
                onChange={(event) => {
                  setMeterId(event.target.value);
                  setDayOffset(0);
                  setHourSlot("all");
                }}
              >
                {(meta.meters || []).map((meter) => (
                  <option key={meter} value={meter}>{meter}</option>
                ))}
              </select>
            </div>

            {meta.mode === "forward" ? (
              <div className="select-wrap">
                <label htmlFor="forecast-day">Forecast day</label>
                <select id="forecast-day" value={dayOffset} onChange={(event) => setDayOffset(Number(event.target.value))}>
                  {forecastDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                </select>
              </div>
            ) : null}

            {meta.mode === "forward" && (
              <div className="select-wrap">
                <label htmlFor="forecast-hour">Time slot</label>
                <select id="forecast-hour" value={hourSlot} onChange={(event) => setHourSlot(event.target.value)}>
                  <option value="all">All hours (daily profile)</option>
                  {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
                </select>
              </div>
            )}

            {meta.mode !== "forward" && <div className="select-wrap">
              <label htmlFor="forecast-horizon">Horizon</label>
              <select id="forecast-horizon" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                {(meta.horizons || [1]).map((hours) => <option key={hours} value={hours}>{hours} hour{hours === 1 ? "" : "s"}</option>)}
              </select>
            </div>}

            <div className="select-wrap">
              <label>Model</label>
              <div className="static-value">
                {modelInfo?.model_name || "Forecast artifact metadata"}
              </div>
            </div>
          </div>

          <div className="filter-summary-row">
            <span><strong>{formatNumber(meta.meters?.length)}</strong> meters in artifact</span>
            <span><strong>{formatNumber(forecast?.points?.length)}</strong> points returned</span>
            {meta.mode === "forward" && <span><strong>{hourSlot === "all" ? "24-hour profile" : `${String(hourSlot).padStart(2, "0")}:00 slot`}</strong></span>}
            <span>
              Metadata generated <strong>{formatDateTime(modelInfo?.generated_at || meta.generated_at)}</strong>
            </span>
            {meta.mode === "forward" && meta.coverage?.start && (
              <span>Forecast window <strong>{formatDateTime(meta.coverage.start)}</strong> – <strong>{formatDateTime(meta.coverage.end)}</strong></span>
            )}
          </div>
        </section>
      )}

      {!meta?.available ? (
        <article className="card">
          <CardHeader
            title="Forecast output"
            text="This module will populate once forecast_predictions.parquet exists"
          />
          <EmptyState
            title="No forecast data available"
            message="MeterIQ does not substitute simulated forecasts. The chart and metrics appear only when the real artifact is generated."
          />
        </article>
      ) : forecastError ? (
        <ErrorState
          title="Forecast unavailable for this selection"
          message={forecastError}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : forecastLoading && !forecast ? (
        <LoadingState label={`Loading ${requestedHorizon}-hour forecast view…`} />
      ) : forecast ? (
        <>
          <section className="stats kpi-grid-4">
            <Stat
              icon="🔮"
              label="Predicted range"
              value={chartSummary.range}
              sub={`${formatNumber(chartData.length)} points · ${forecast.horizon}h horizon`}
            />
            <Stat
              icon="📈"
              label="Predicted peak"
              value={chartSummary.peak}
              sub="Maximum model prediction in the selected horizon"
            />
            <Stat
              icon="📊"
              label="Average prediction"
              value={chartSummary.average}
              sub="Mean across returned points"
            />
            <Stat
              icon="🎯"
              label={forecast.mode === "forward" ? "Validation MAE" : "Largest deviation"}
              value={forecast.mode === "forward" ? formatNumber(forecast.metrics?.validation_mae, 4) : chartSummary.maxDeviation}
              sub={forecast.mode === "forward" ? "Error on recent held-out hours" : "Actual minus predicted, where an actual exists"}
            />
          </section>

          <article className="card">
            <CardHeader
              title={`${forecast.mode === "forward" ? "Next-load forecast" : "Actual vs predicted"} · ${forecast.meter_id}`}
              text={`${forecast.horizon}-hour horizon · ${forecast.unit || "kWh"} · generated ${formatDateTime(
                forecast.generated_at
              )}`}
              right={forecastLoading ? <span className="muted-text">Refreshing…</span> : null}
            />
            {chartData.length ? (
              <>
                <ForecastComparisonChart data={chartData} height={320} />
                <ForecastErrorChart data={chartData} height={150} />
                <p className="panel-footnote">
                  {forecast.mode === "forward"
                    ? "The dashed baseline is the same-hour-last-week load. The forward forecast starts after the meter’s final recorded hour."
                    : "The dashed baseline is the recorded same-hour-last-week value. Points without a recorded actual are predictions only."}
                </p>
              </>
            ) : (
              <EmptyState
                title="No forecast points"
                message="The artifact contains no rows for this meter and horizon."
              />
            )}
          </article>

          <section className="grid2">
            <article className="card">
              <CardHeader
                title="Model metadata"
                text="Read-only values reported by the forecasting pipeline"
              />
              {modelEntries.length ? (
                <div className="indicator-table">
                  {modelEntries.map((entry) => (
                    <div key={entry.key} className="indicator-row">
                      <span>{entry.label}</span>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No model summary"
                  message="forecast_report.json did not include aggregate model metrics."
                />
              )}
            </article>

            <article className="card">
              <CardHeader
                title="Meter-level metrics"
                text="Evaluation for the selected meter, where recorded"
              />
              {meterMetrics.length ? (
                <div className="indicator-table">
                  {meterMetrics.map((entry) => (
                    <div key={entry.key} className="indicator-row">
                      <span>{entry.label}</span>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No per-meter metrics"
                  message="The report does not contain metrics for this meter."
                />
              )}

              {baselineEntries.length > 0 && (
                <>
                  <h4 className="subheading">Baseline summary</h4>
                  <div className="indicator-table">
                    {baselineEntries.map((entry) => (
                      <div key={entry.key} className="indicator-row">
                        <span>{entry.label}</span>
                        <strong>{entry.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>
          </section>
        </>
      ) : (
        <article className="card">
          <CardHeader title="Forecast output" text="Select a meter and horizon" />
          <EmptyState
            title="Select a meter"
            message="Choose a meter from the artifact to view its forecast."
          />
        </article>
      )}
    </>
  );
}
