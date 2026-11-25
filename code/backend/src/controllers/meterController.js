const Meter = require("../models/Meter");
const mlService = require("../services/mlService");
const asyncHandler = require("../utils/asyncHandler");

const RISK_ALIASES = {
  HIGH: "HIGH_RISK",
  HIGH_RISK: "HIGH_RISK",
  CRITICAL: "HIGH_RISK",
  MEDIUM: "REVIEW",
  MEDIUM_RISK: "REVIEW",
  REVIEW: "REVIEW",
  LOW: "NORMAL",
  LOW_RISK: "NORMAL",
  NORMAL: "NORMAL",
};

function normalizeRisk(value) {
  return RISK_ALIASES[String(value || "").trim().toUpperCase()] || null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildSummary(meters) {
  const summary = {
    totalMeters: meters.length,
    // A meter is actionable only when its aggregate model tier asks for a
    // review.  Keep historical-signal coverage separate: with long time
    // series, nearly every meter will eventually have at least one outlier.
    flaggedMeters: 0,
    metersWithSignals: 0,
    highRiskMeters: 0,
    reviewMeters: 0,
    normalMeters: 0,
    totalObservations: 0,
    totalAnomalyObservations: 0,
    totalHighRiskObservations: 0,
    totalReviewObservations: 0,
    totalDataQualityFlags: 0,
    averageAnomalyRate: 0,
  };

  let anomalyRateSum = 0;

  for (const meter of meters) {
    const risk = normalizeRisk(meter.risk_level) || "NORMAL";
    if (risk === "HIGH_RISK") summary.highRiskMeters += 1;
    else if (risk === "REVIEW") summary.reviewMeters += 1;
    else summary.normalMeters += 1;

    const anomalyCount = toNumber(meter.anomaly_count);
    if (anomalyCount > 0) summary.metersWithSignals += 1;
    if (risk !== "NORMAL") summary.flaggedMeters += 1;

    summary.totalObservations += toNumber(meter.total_observations);
    summary.totalAnomalyObservations += anomalyCount;
    summary.totalHighRiskObservations += toNumber(meter.high_risk_count);
    summary.totalReviewObservations += toNumber(meter.review_count);
    summary.totalDataQualityFlags += toNumber(meter.data_quality_flag_count);
    anomalyRateSum += toNumber(meter.anomaly_rate);
  }

  summary.averageAnomalyRate =
    meters.length > 0
      ? Number((anomalyRateSum / meters.length).toFixed(4))
      : 0;

  summary.flagRate =
    summary.totalMeters > 0
      ? Number(
          ((summary.flaggedMeters / summary.totalMeters) * 100).toFixed(2)
        )
      : 0;

  return summary;
}

function enrichMeter(meter) {
  const riskLevel = normalizeRisk(meter.risk_level) || "NORMAL";
  const anomalyCount = toNumber(meter.anomaly_count);
  return {
    meter_id: String(meter.meter_id),
    region: meter.region || "Unknown",
    coverage_start: meter.coverage_start || null,
    coverage_end: meter.coverage_end || null,
    total_observations: toNumber(meter.total_observations),
    normal_count: toNumber(meter.normal_count),
    review_count: toNumber(meter.review_count),
    high_risk_count: toNumber(meter.high_risk_count),
    anomaly_count: anomalyCount,
    anomaly_rate: toNumber(meter.anomaly_rate),
    max_severity: meter.max_severity ?? null,
    mean_severity: meter.mean_severity ?? null,
    data_quality_flag_count: toNumber(meter.data_quality_flag_count),
    most_common_reasons: Array.isArray(meter.most_common_reasons)
      ? meter.most_common_reasons
      : [],
    risk_level: riskLevel,
    status:
      riskLevel === "HIGH_RISK"
        ? "Priority Review"
        : riskLevel === "REVIEW"
          ? "Under Review"
          : "Normal",
    // This boolean is intentionally aligned with the fleet review queue,
    // rather than the presence of any historical outlier.
    flagged: riskLevel !== "NORMAL",
    has_historical_signal: anomalyCount > 0,
    updatedAt: meter.updatedAt || null,
  };
}

/**
 * The ML service owns the analytical truth. MongoDB stores the catalogue
 * metadata (which is also what investigations/report joins need). We sync the
 * two rather than silently falling back to one when the other is unavailable.
 */
async function fetchMeterCatalog() {
  const response = await mlService.fetchFromML("/meters");
  const meters = Array.isArray(response)
    ? response
    : Array.isArray(response?.meters)
      ? response.meters
      : [];

  if (!meters.length) {
    return { meters: [], summary: buildSummary([]), regions: [] };
  }

  const enriched = meters.map(enrichMeter);

  try {
    const operations = enriched.map((meter) => ({
      updateOne: {
        filter: { meter_id: meter.meter_id },
        update: {
          $set: {
            region: meter.region,
            anomaly_count: meter.anomaly_count,
            risk_level: meter.risk_level,
            coverage_start: meter.coverage_start
              ? new Date(meter.coverage_start)
              : undefined,
            coverage_end: meter.coverage_end
              ? new Date(meter.coverage_end)
              : undefined,
          },
        },
        upsert: true,
      },
    }));

    await Meter.bulkWrite(operations, { ordered: false });
  } catch (error) {
    // A Mongo outage must not hide live ML data; log and continue.
    console.error("Meter catalogue sync failed:", error.message);
  }

  const regions = [...new Set(enriched.map((m) => m.region))]
    .filter(Boolean)
    .sort();

  return { meters: enriched, summary: buildSummary(enriched), regions };
}

function applyFilters(meters, query) {
  const {
    search = "",
    region = "all",
    risk = "all",
    status = "all",
    minAnomalyRate,
  } = query;

  const needle = String(search).trim().toLowerCase();
  const riskFilter = normalizeRisk(risk);
  const statusFilter = String(status).trim().toUpperCase();

  return meters.filter((meter) => {
    if (
      region &&
      region !== "all" &&
      String(meter.region).toLowerCase() !== String(region).toLowerCase()
    ) {
      return false;
    }

    if (riskFilter && normalizeRisk(meter.risk_level) !== riskFilter) {
      return false;
    }

    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "FLAGGED" && !meter.flagged) return false;
      if (statusFilter === "NORMAL" && meter.flagged) return false;
      if (
        ["HIGH_RISK", "REVIEW"].includes(statusFilter) &&
        normalizeRisk(meter.risk_level) !== statusFilter
      ) {
        return false;
      }
    }

    if (minAnomalyRate !== undefined && minAnomalyRate !== "") {
      const minimum = Number(minAnomalyRate);
      if (Number.isFinite(minimum) && meter.anomaly_rate < minimum) {
        return false;
      }
    }

    if (needle) {
      const haystack = [
        meter.meter_id,
        meter.region,
        ...(meter.most_common_reasons || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

function sortMeters(meters, sort = "anomaly_rate_desc") {
  const sorted = [...meters];
  const riskWeight = { HIGH_RISK: 3, REVIEW: 2, NORMAL: 1 };

  switch (sort) {
    case "anomaly_count_desc":
      sorted.sort((a, b) => b.anomaly_count - a.anomaly_count);
      break;
    case "anomaly_rate_asc":
      sorted.sort((a, b) => a.anomaly_rate - b.anomaly_rate);
      break;
    case "meter_id_asc":
      sorted.sort((a, b) => a.meter_id.localeCompare(b.meter_id));
      break;
    case "meter_id_desc":
      sorted.sort((a, b) => b.meter_id.localeCompare(a.meter_id));
      break;
    case "risk_desc":
      sorted.sort(
        (a, b) =>
          (riskWeight[b.risk_level] || 0) - (riskWeight[a.risk_level] || 0)
      );
      break;
    case "risk_asc":
      sorted.sort(
        (a, b) =>
          (riskWeight[a.risk_level] || 0) - (riskWeight[b.risk_level] || 0)
      );
      break;
    case "anomaly_rate_desc":
    default:
      sorted.sort((a, b) => b.anomaly_rate - a.anomaly_rate);
  }

  return sorted;
}

exports.fetchMeterCatalog = fetchMeterCatalog;
exports.applyFilters = applyFilters;
exports.sortMeters = sortMeters;
exports.buildSummary = buildSummary;
exports.normalizeRisk = normalizeRisk;

exports.getMeters = asyncHandler(async (req, res) => {
  const { meters, summary, regions } = await fetchMeterCatalog();

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20)
  );

  const filtered = sortMeters(
    applyFilters(meters, req.query),
    req.query.sort
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  res.json({
    meters: pageItems,
    total,
    page: safePage,
    pageSize,
    totalPages,
    regions,
    summary,
  });
});

exports.getMeterById = asyncHandler(async (req, res) => {
  const { meterId } = req.params;
  const { meters } = await fetchMeterCatalog();
  const meter = meters.find(
    (item) => item.meter_id.toLowerCase() === String(meterId).toLowerCase()
  );

  if (!meter) {
    return res.status(404).json({ message: `Meter ${meterId} was not found` });
  }

  res.json(meter);
});

exports.getConsumption = asyncHandler(async (req, res) => {
  const { meterId } = req.params;
  const { start, end, resolution } = req.query;
  const data = await mlService.fetchFromML(
    `/meters/${encodeURIComponent(meterId)}/consumption`,
    { start, end, resolution }
  );
  res.json(data);
});

exports.getPipelineStatus = asyncHandler(async (req, res) => {
  const status = await mlService.fetchFromML("/pipeline/status");
  res.json(status);
});

exports.getMeterHealth = asyncHandler(async (req, res) => {
  const health = await mlService.fetchFromML("/meters/health");
  res.json(health);
});
