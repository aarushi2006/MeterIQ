
import React from "react";

export default function RegionalRiskMap({ regionData = {} }) {
  const regions =
    regionData && typeof regionData === "object"
      ? Object.entries(regionData)
      : [];

  const getNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const totalMeters = regions.reduce(
    (sum, [, data]) => sum + getNumber(data?.meter_count),
    0
  );

  const totalFlagged = regions.reduce(
    (sum, [, data]) => sum + getNumber(data?.flagged_count),
    0
  );

  // Determine regional risk from the proportion of high-risk meters.
  const getRisk = (highRiskRate) => {
    if (highRiskRate >= 50) {
      return {
        label: "High Risk",
        color: "#ef4444",
        bg: "#fef2f2",
      };
    }

    if (highRiskRate >= 20) {
      return {
        label: "Medium Risk",
        color: "#f59e0b",
        bg: "#fffbeb",
      };
    }

    if (highRiskRate > 0) {
      return {
        label: "Elevated Risk",
        color: "#eab308",
        bg: "#fefce8",
      };
    }

    return {
      label: "Low Risk",
      color: "#10b981",
      bg: "#ecfdf5",
    };
  };

  if (!regions.length) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: 28 }}>📍</span>
        <p>No regional risk data available</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Network Summary */}
      <div style={styles.summary}>
        <div>
          <span style={styles.summaryLabel}>Regions monitored</span>
          <strong style={styles.summaryValue}>{regions.length}</strong>
        </div>

        <div>
          <span style={styles.summaryLabel}>Total meters</span>
          <strong style={styles.summaryValue}>{totalMeters}</strong>
        </div>

        <div>
          <span style={styles.summaryLabel}>Flagged meters</span>
          <strong style={{ ...styles.summaryValue, color: "#ef4444" }}>
            {totalFlagged}
          </strong>
        </div>
      </div>

      {/* Regional Cards */}
      <div style={styles.regionList}>
        {regions.map(([region, data = {}]) => {
          const meters = getNumber(data.meter_count);
          const flagged = getNumber(data.flagged_count);
          const highRisk = getNumber(data.high_risk_count);

          // Average risk score is independent of risk classification.
          const score = Math.max(
            0,
            Math.min(1, getNumber(data.avg_risk))
          );

          const flaggedRate =
            meters > 0 ? (flagged / meters) * 100 : 0;

          const highRiskRate =
            meters > 0 ? (highRisk / meters) * 100 : 0;

          const risk = getRisk(highRiskRate);

          return (
            <article key={region} style={styles.regionCard}>
              <div style={styles.header}>
                <div>
                  <h4 style={styles.regionName}>{region}</h4>
                  <span style={styles.subtitle}>
                    Regional risk assessment
                  </span>
                </div>

                <span
                  style={{
                    ...styles.badge,
                    color: risk.color,
                    background: risk.bg,
                  }}
                >
                  {risk.label}
                </span>
              </div>

              {/* Average Risk Score */}
              <div style={styles.scoreRow}>
                <span>Average risk score</span>
                <strong>{(score * 100).toFixed(2)}%</strong>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${score * 100}%`,
                    background: risk.color,
                  }}
                />
              </div>

              {/* Regional Metrics */}
              <div style={styles.metrics}>
                <div style={styles.metricBox}>
                  <span style={styles.metricLabel}>Total meters</span>
                  <strong style={styles.metricValue}>{meters}</strong>
                </div>

                <div style={styles.metricBox}>
                  <span style={styles.metricLabel}>Flagged meters</span>
                  <strong
                    style={{
                      ...styles.metricValue,
                      color: "#ef4444",
                    }}
                  >
                    {flagged}
                  </strong>
                </div>

                <div style={styles.metricBox}>
                  <span style={styles.metricLabel}>High-risk meters</span>
                  <strong
                    style={{
                      ...styles.metricValue,
                      color: "#ef4444",
                    }}
                  >
                    {highRisk}
                  </strong>
                </div>
              </div>

              {/* Footer */}
              <div style={styles.footer}>
                <span>Flagged meter rate</span>
                <strong>{flaggedRate.toFixed(1)}%</strong>
              </div>
            </article>
          );
        })}
      </div>

      {/* Risk Legend */}
      <div style={styles.legend}>
        <strong>Risk classification:</strong>

        <span>
          <i style={{ background: "#ef4444" }} /> High
        </span>

        <span>
          <i style={{ background: "#f59e0b" }} /> Medium
        </span>

        <span>
          <i style={{ background: "#eab308" }} /> Elevated
        </span>

        <span>
          <i style={{ background: "#10b981" }} /> Low
        </span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    paddingTop: 10,
    boxSizing: "border-box",
  },

  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },

  summaryLabel: {
    display: "block",
    fontSize: 10,
    color: "#64748b",
    marginBottom: 6,
  },

  summaryValue: {
    display: "block",
    fontSize: 22,
    color: "#1e293b",
  },

  regionList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  regionCard: {
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    boxShadow: "0 2px 5px rgba(15,23,42,0.04)",
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  regionName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#1e293b",
  },

  subtitle: {
    display: "block",
    marginTop: 4,
    fontSize: 11,
    color: "#94a3b8",
  },

  badge: {
    padding: "6px 9px",
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  scoreRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    fontSize: 11,
    color: "#64748b",
  },

  progressTrack: {
    height: 6,
    background: "#f1f5f9",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 8,
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
    transition: "width 0.4s ease",
  },

  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginTop: 14,
  },

  metricBox: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 7,
    padding: "10px 9px",
    borderRadius: 9,
    background: "#f8fafc",
    minWidth: 0,
    boxSizing: "border-box",
  },

  metricLabel: {
    display: "block",
    fontSize: 10,
    lineHeight: 1.4,
    color: "#64748b",
    overflowWrap: "break-word",
  },

  metricValue: {
    display: "block",
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 700,
    color: "#1e293b",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #e2e8f0",
    marginTop: 12,
    paddingTop: 10,
    fontSize: 11,
    color: "#64748b",
  },

  legend: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    fontSize: 10,
    color: "#64748b",
    paddingBottom: 4,
  },

  empty: {
    minHeight: 180,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
  },
};
