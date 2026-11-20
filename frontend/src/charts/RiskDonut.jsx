
import React from "react";

export default function RiskDonut({
  high = 0,
  medium = 0,
  low = 0,
}) {
  const safeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  };

  const highCount = safeNumber(high);
  const mediumCount = safeNumber(medium);
  const lowCount = safeNumber(low);

  const total = highCount + mediumCount + lowCount;

  const highPct = total > 0 ? (highCount / total) * 100 : 0;
  const mediumPct = total > 0 ? (mediumCount / total) * 100 : 0;
  const lowPct = total > 0 ? (lowCount / total) * 100 : 0;

  const gradient =
    total === 0
      ? "#e2e8f0"
      : `conic-gradient(
          #ef4444 0% ${highPct}%,
          #f59e0b ${highPct}% ${highPct + mediumPct}%,
          #10b981 ${highPct + mediumPct}% 100%
        )`;

  return (
    <div style={styles.container}>
      {/* Donut Chart */}
      <div style={styles.chartWrapper}>
        <div
          style={{
            ...styles.donut,
            background: gradient,
          }}
        >
          <div style={styles.center}>
            <strong style={styles.centerNumber}>
              {total}
            </strong>

            <span style={styles.centerLabel}>
              meters
            </span>
          </div>
        </div>
      </div>

      {/* Risk Legend */}
      <div style={styles.legend}>
        <Legend
          color="#ef4444"
          label="High risk"
          count={highCount}
          percentage={highPct}
        />

        <Legend
          color="#f59e0b"
          label="Review"
          count={mediumCount}
          percentage={mediumPct}
        />

        <Legend
          color="#10b981"
          label="Normal"
          count={lowCount}
          percentage={lowPct}
        />
      </div>
    </div>
  );
}

function Legend({ color, label, count, percentage }) {
  return (
    <div style={styles.legendRow}>
      <span
        style={{
          ...styles.dot,
          backgroundColor: color,
        }}
      />

      <span style={styles.legendLabel}>
        {label}
      </span>

      <strong style={styles.count}>
        {count}
      </strong>

      <span style={styles.percentage}>
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    flexWrap: "wrap",
  },

  chartWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  donut: {
    width: 136,
    height: 136,
    minWidth: 136,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  center: {
    width: 94,
    height: 94,
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  centerNumber: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
  },

  centerLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 3,
  },

  legend: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minWidth: 180,
  },

  legendRow: {
    display: "grid",
    gridTemplateColumns: "12px 1fr auto auto",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },

  legendLabel: {
    color: "#64748b",
  },

  count: {
    color: "#1e293b",
    fontSize: 13,
  },

  percentage: {
    color: "#94a3b8",
    fontSize: 11,
    minWidth: 42,
    textAlign: "right",
  },
};
