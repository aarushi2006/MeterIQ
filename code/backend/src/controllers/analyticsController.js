const mlService = require("../services/mlService");
const asyncHandler = require("../utils/asyncHandler");

exports.getConsumptionAnalytics = asyncHandler(async (req, res) => {
  const { range = "7D", region = "all", meterId = "all" } = req.query;
  const data = await mlService.fetchFromML("/analytics/consumption", {
    range,
    region,
    meter_id: meterId,
  });
  res.json(data);
});

exports.getDiurnalPatterns = asyncHandler(async (req, res) => {
  const { region = "all" } = req.query;
  const data = await mlService.fetchFromML("/analytics/diurnal", { region });
  res.json(data);
});

exports.getRegionalStats = asyncHandler(async (req, res) => {
  const data = await mlService.fetchFromML("/analytics/regional");
  res.json(data);
});

exports.getDataQuality = asyncHandler(async (req, res) => {
  const data = await mlService.fetchFromML("/analytics/data-quality");
  res.json(data);
});
