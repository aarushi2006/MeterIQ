import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

const ACTUAL_COLOR = "#1d4ed8";
const PREDICTED_COLOR = "#ea580c";
const ERROR_COLOR = "#94a3b8";

function withError(series) {
  return series.map((point) => {
    const hasActual = point.actual !== null && point.actual !== undefined;
    const error = hasActual ? +(point.actual - point.predicted).toFixed(2) : null;
    return { ...point, error };
  });
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload || {};
  const hasActual = point.actual !== null && point.actual !== undefined;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{label}</p>
      <p className="tooltip-entry" style={{ color: ACTUAL_COLOR }}>
        Actual: <b>{hasActual ? `${point.actual.toFixed(2)} kWh` : "— (not yet recorded)"}</b>
      </p>
      <p className="tooltip-entry" style={{ color: PREDICTED_COLOR }}>
        Predicted: <b>{point.predicted !== null && point.predicted !== undefined ? `${point.predicted.toFixed(2)} kWh` : "—"}</b>
      </p>
      <p className="tooltip-entry" style={{ color: ERROR_COLOR }}>
        Error: <b>{hasActual ? `${point.error > 0 ? "+" : ""}${point.error.toFixed(2)} kWh` : "n/a"}</b>
      </p>
    </div>
  );
}

/** Main Actual vs. Predicted comparison chart. */
export function ForecastComparisonChart({ data = [], height = 300 }) {
  const series = withError(data);

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={series} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            label={{ value: "Time", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            label={{ value: "kWh", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }}
          />
          <Tooltip content={<ForecastTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />

          <Line
            type="monotone"
            dataKey="actual"
            name="Actual consumption"
            stroke={ACTUAL_COLOR}
            strokeWidth={2.25}
            dot={{ r: 2.5, fill: ACTUAL_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted consumption"
            stroke={PREDICTED_COLOR}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Secondary chart: prediction error (Actual − Predicted) for points where
 *  an actual reading exists. Bars above zero mean the model under-predicted;
 *  below zero means it over-predicted. */
export function ForecastErrorChart({ data = [], height = 140 }) {
  const series = withError(data).filter((p) => p.error !== null);

  if (series.length === 0) {
    return <p className="eval-note">No overlapping actual readings yet to compute error for this horizon.</p>;
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={series} margin={{ top: 6, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} width={36} />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Tooltip
            formatter={(value) => [`${value > 0 ? "+" : ""}${value.toFixed(2)} kWh`, "Error"]}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="error" name="Actual − Predicted" fill={ERROR_COLOR} radius={[2, 2, 2, 2]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function computeForecastSummary(data = []) {
  const series = withError(data);
  const predictedValues = series.filter((p) => p.predicted !== null && p.predicted !== undefined);
  const errored = series.filter((p) => p.error !== null);

  if (predictedValues.length === 0) {
    return { range: "—", peak: "—", average: "—", maxDeviation: "—" };
  }

  const peakPoint = predictedValues.reduce((max, p) => (p.predicted > max.predicted ? p : max), predictedValues[0]);
  const avg = predictedValues.reduce((sum, p) => sum + p.predicted, 0) / predictedValues.length;
  const maxDevPoint = errored.reduce(
    (max, p) => (Math.abs(p.error) > Math.abs(max?.error ?? 0) ? p : max),
    errored[0] || null
  );

  return {
    range: `${predictedValues[0].time} – ${predictedValues[predictedValues.length - 1].time}`,
    peak: `${peakPoint.predicted.toFixed(1)} kWh at ${peakPoint.time}`,
    average: `${avg.toFixed(1)} kWh`,
    maxDeviation: maxDevPoint ? `${Math.abs(maxDevPoint.error).toFixed(2)} kWh at ${maxDevPoint.time}` : "n/a (no overlapping actuals)",
  };
}
