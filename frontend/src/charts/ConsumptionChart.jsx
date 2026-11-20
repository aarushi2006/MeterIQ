import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="tooltip-entry" style={{ color: entry.color }}>
          {entry.name || entry.dataKey}: <b>{entry.value !== null && entry.value !== undefined ? entry.value : "—"}</b>
        </p>
      ))}
    </div>
  );
};

export default function ConsumptionChart({ data = [], showForecast = false, height = 240 }) {
  // Determine the key for X Axis dynamically
  const sample = data[0] || {};
  const xKey = sample.time !== undefined ? "time" : sample.label !== undefined ? "label" : sample.day !== undefined ? "day" : "hour";

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="colorMathura" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Primary consumption or total */}
          {sample.totalMwh !== undefined && (
            <Area
              type="monotone"
              name="Total MWh"
              dataKey="totalMwh"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#colorKwh)"
              dot={false}
            />
          )}

          {sample.mathuraMwh !== undefined && (
            <Area
              type="monotone"
              name="Mathura MWh"
              dataKey="mathuraMwh"
              stroke="#0284c7"
              strokeWidth={2}
              fill="url(#colorMathura)"
              dot={false}
            />
          )}

          {sample.bareillyMwh !== undefined && (
            <Area
              type="monotone"
              name="Bareilly MWh"
              dataKey="bareillyMwh"
              stroke="#0d9488"
              strokeWidth={2}
              fill="none"
              dot={false}
            />
          )}

          {sample.kwh !== undefined && (
            <Area
              type="monotone"
              name="Actual (kWh)"
              dataKey="kwh"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#colorKwh)"
              dot={{ r: 3, fill: "#2563eb" }}
              activeDot={{ r: 5 }}
            />
          )}

          {sample.baseline !== undefined && (
            <Line
              type="monotone"
              name="Baseline Expected"
              dataKey="baseline"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          )}

          {showForecast && sample.forecast !== undefined && (
            <Area
              type="monotone"
              name="Predicted Forecast"
              dataKey="forecast"
              stroke="#06b6d4"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#colorForecast)"
              dot={false}
              connectNulls={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
