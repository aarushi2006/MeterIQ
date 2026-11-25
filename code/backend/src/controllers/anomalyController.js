const mlService = require("../services/mlService");
const asyncHandler = require("../utils/asyncHandler");
const {
  fetchMeterCatalog,
  normalizeRisk,
} = require("./meterController");

exports.getGlobalSummary = asyncHandler(async (req, res) => {
  const { meters, summary } = await fetchMeterCatalog();

  const regionMap = {};
  const reasonCounts = new Map();

  for (const meter of meters) {
    const region = meter.region || "Unknown";
    if (!regionMap[region]) {
      regionMap[region] = {
        meter_count: 0,
        flagged_count: 0,
        meters_with_signals: 0,
        high_risk_count: 0,
        review_count: 0,
        normal_count: 0,
        total_anomaly_observations: 0,
        total_observations: 0,
      };
    }

    const entry = regionMap[region];
    entry.meter_count += 1;
    if (meter.anomaly_count > 0) entry.meters_with_signals += 1;
    if (normalizeRisk(meter.risk_level) === "HIGH_RISK")
      entry.high_risk_count += 1;
    else if (normalizeRisk(meter.risk_level) === "REVIEW")
      entry.review_count += 1;
    else entry.normal_count += 1;
    if (normalizeRisk(meter.risk_level) !== "NORMAL") entry.flagged_count += 1;

    entry.total_anomaly_observations += meter.anomaly_count;
    entry.total_observations += meter.total_observations;

    for (const reason of meter.most_common_reasons || []) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }

  let observationStatus = {
    available: false,
    message:
      "Observation-level anomaly records are unavailable. Meter-level aggregates are shown.",
  };

  try {
    observationStatus = await mlService.fetchFromML("/anomalies/status");
  } catch (error) {
    observationStatus = {
      available: false,
      message: `Unable to check anomaly record artifact: ${error.message}`,
    };
  }

  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, meters]) => ({ reason, meters }));

  res.json({
    ...summary,
    totalMeters: summary.totalMeters,
    flaggedMeters: summary.flaggedMeters,
    normalMeters: summary.normalMeters,
    flagRate: summary.flagRate,
    metersWithSignals: summary.metersWithSignals,
    riskDistribution: {
      high: summary.highRiskMeters,
      review: summary.reviewMeters,
      normal: summary.normalMeters,
    },
    regions: regionMap,
    topReasons,
    records_available: Boolean(observationStatus.available),
    artifact_message: observationStatus.message || null,
    definition:
      "A flagged meter is currently in the HIGH_RISK or REVIEW queue. Meters with historical signals are reported separately because one isolated outlier over a long period does not require review. A flag is a review indicator, not a confirmed theft finding.",
    generated_at: new Date().toISOString(),
  });
});

exports.getAnomalies = asyncHandler(async (req, res) => {
  const { risk, region, meterId, search, page, pageSize, sort } = req.query;
  const data = await mlService.fetchFromML("/anomalies", {
    risk,
    region,
    meter_id: meterId,
    search,
    page,
    pageSize,
    sort,
  });
  res.json(data);
});

exports.getMeterAnomalies = asyncHandler(async (req, res) => {
  const { meterId } = req.params;
  const { page, pageSize, risk } = req.query;
  const data = await mlService.fetchFromML(
    `/meters/${encodeURIComponent(meterId)}/anomalies`,
    { page, pageSize, risk }
  );
  res.json(data);
});

exports.getAnomalyStatus = asyncHandler(async (req, res) => {
  const status = await mlService.fetchFromML("/anomalies/status");
  res.json(status);
});
