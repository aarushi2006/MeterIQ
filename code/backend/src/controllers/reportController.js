const Investigation = require("../models/Investigation");
const mlService = require("../services/mlService");
const asyncHandler = require("../utils/asyncHandler");
const { toCsv, sendCsv } = require("../utils/csv");
const {
  fetchMeterCatalog,
  applyFilters,
  sortMeters,
} = require("./meterController");

function investigationAccess(req) {
  if (["supervisor", "admin"].includes(req.user?.role)) return {};
  return {
    $or: [
      { assignedUser: req.user?.id },
      { assignedUser: { $exists: false }, assignedTo: req.user?.fullName },
      { assignedUser: { $exists: false }, assignedTo: req.user?.email },
    ],
  };
}

async function getFilteredMeters(query) {
  const { meters } = await fetchMeterCatalog();
  return sortMeters(applyFilters(meters, query), query.sort);
}

async function fetchAllAnomalies(query) {
  const pageSize = 500;
  const maxPages = 40; // hard cap of 20,000 rows per export
  const rows = [];
  let page = 1;
  let available = true;
  let message = null;

  while (page <= maxPages) {
    const data = await mlService.fetchFromML("/anomalies", {
      ...query,
      page,
      pageSize,
      sort: query.sort || "severity_desc",
    });

    available = data.available !== false;
    message = data.message || null;
    if (!available) break;

    const records = Array.isArray(data.records) ? data.records : [];
    rows.push(...records);
    if (records.length < pageSize || rows.length >= (data.total || 0)) break;
    page += 1;
  }

  return { rows, available, message };
}

exports.getSummary = asyncHandler(async (req, res) => {
  const { meters, summary, regions } = await fetchMeterCatalog();

  let regional = null;
  let dataQuality = null;
  let anomalyStatus = null;
  const warnings = [];

  try {
    regional = await mlService.fetchFromML("/analytics/regional");
  } catch (error) {
    warnings.push(`Regional analytics unavailable: ${error.message}`);
  }

  try {
    dataQuality = await mlService.fetchFromML("/analytics/data-quality");
  } catch (error) {
    warnings.push(`Data quality metrics unavailable: ${error.message}`);
  }

  try {
    anomalyStatus = await mlService.fetchFromML("/anomalies/status");
  } catch (error) {
    warnings.push(`Anomaly status unavailable: ${error.message}`);
  }

  const [caseCounts, openCases] = await Promise.all([
    Investigation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Investigation.countDocuments({ status: { $ne: "RESOLVED" } }),
  ]);

  res.json({
    meters: summary,
    regions,
    regional,
    dataQuality,
    anomalies: {
      available: anomalyStatus ? anomalyStatus.available === true : false,
      message: anomalyStatus ? anomalyStatus.message : "Anomaly status unavailable",
      path: anomalyStatus ? anomalyStatus.path : null,
    },
    investigations: {
      byStatus: caseCounts.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
      open: openCases,
    },
    meterCount: meters.length,
    warnings,
    generated_at: new Date().toISOString(),
  });
});

exports.exportMeters = asyncHandler(async (req, res) => {
  const meters = await getFilteredMeters(req.query);
  const content = toCsv(
    [
      { key: "meter_id", label: "Meter_ID" },
      { key: "region", label: "Region" },
      { key: "risk_level", label: "Risk_Level" },
      { key: "status", label: "Status" },
      { key: "anomaly_count", label: "Anomaly_Count" },
      { key: "anomaly_rate", label: "Anomaly_Rate" },
      { key: "total_observations", label: "Total_Observations" },
      { key: "review_count", label: "Review_Count" },
      { key: "high_risk_count", label: "High_Risk_Count" },
      { key: "max_severity", label: "Max_Severity" },
      { key: "mean_severity", label: "Mean_Severity" },
      { key: "data_quality_flag_count", label: "Data_Quality_Flags" },
      { key: "coverage_start", label: "Coverage_Start" },
      { key: "coverage_end", label: "Coverage_End" },
      { key: "top_reason", label: "Top_Indicator" },
    ],
    meters.map((meter) => ({
      ...meter,
      top_reason: meter.most_common_reasons?.[0] || "",
    }))
  );

  sendCsv(res, `meteriq-meters-${new Date().toISOString().slice(0, 10)}.csv`, content);
});

exports.exportAnomalies = asyncHandler(async (req, res) => {
  const { rows, available, message } = await fetchAllAnomalies(req.query);

  if (!available) {
    return res.status(503).json({
      message:
        message ||
        "Observation-level anomaly records are not available. Run the anomaly pipeline to generate anomaly_observations.parquet.",
    });
  }

  const content = toCsv(
    [
      { key: "timestamp", label: "Timestamp" },
      { key: "meter_id", label: "Meter_ID" },
      { key: "region", label: "Region" },
      { key: "risk_level", label: "Severity" },
      { key: "severity", label: "Severity_Score" },
      { key: "consumption", label: "Consumption_kWh" },
      { key: "reason", label: "Primary_Indicator" },
      { key: "indicators", label: "All_Indicators" },
    ],
    rows.map((row) => ({
      ...row,
      reason: row.reasons?.[0] || "",
      indicators: (row.reasons || []).join(" | "),
    }))
  );

  sendCsv(res, `meteriq-anomalies-${new Date().toISOString().slice(0, 10)}.csv`, content);
});

exports.exportRegional = asyncHandler(async (req, res) => {
  const data = await mlService.fetchFromML("/analytics/regional");
  const regions = data.regions || data;

  const rows = Object.entries(regions).map(([region, values]) => ({
    region,
    ...values,
  }));

  const content = toCsv(
    [
      { key: "region", label: "Region" },
      { key: "meter_count", label: "Meters" },
      { key: "flagged_count", label: "Flagged_Meters" },
      { key: "high_risk_count", label: "High_Risk_Meters" },
      { key: "review_count", label: "Review_Meters" },
      { key: "normal_count", label: "Normal_Meters" },
      { key: "total_anomaly_observations", label: "Anomaly_Observations" },
      { key: "total_observations", label: "Total_Observations" },
      { key: "avg_risk", label: "Average_Anomaly_Rate" },
    ],
    rows
  );

  sendCsv(res, `meteriq-regional-${new Date().toISOString().slice(0, 10)}.csv`, content);
});

exports.exportInvestigations = asyncHandler(async (req, res) => {
  const { status = "all", region = "all", search = "" } = req.query;
  const filters = [investigationAccess(req)];
  const query = {};
  if (status !== "all") filters.push({ status });
  if (region !== "all") filters.push({ region });
  if (search) {
    filters.push({ $or: [
      { id: { $regex: search, $options: "i" } },
      { meter_id: { $regex: search, $options: "i" } },
      { reason: { $regex: search, $options: "i" } },
    ] });
  }

  const scopedQuery = filters.length === 1 && Object.keys(filters[0]).length === 0 ? query : { $and: filters };

  const investigations = await Investigation.find(scopedQuery)
    .sort({ createdAt: -1 })
    .lean();

  const content = toCsv(
    [
      { key: "id", label: "Case_ID" },
      { key: "meter_id", label: "Meter_ID" },
      { key: "region", label: "Region" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "riskLevel", label: "Risk_Level" },
      { key: "riskScore", label: "Risk_Score" },
      { key: "reason", label: "Reason" },
      { key: "assignedTo", label: "Assigned_To" },
      { key: "dueDate", label: "Due_Date" },
      { key: "assignmentInstructions", label: "Assignment_Instructions" },
      { key: "createdBy", label: "Created_By" },
      { key: "createdAt", label: "Created_At" },
      { key: "updatedAt", label: "Updated_At" },
      { key: "resolution", label: "Resolution" },
    ],
    investigations.map((row) => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
    }))
  );

  sendCsv(
    res,
    `meteriq-investigations-${new Date().toISOString().slice(0, 10)}.csv`,
    content
  );
});
