const mlService = require("../services/mlService");
const asyncHandler = require("../utils/asyncHandler");

exports.getMeterForecast = asyncHandler(async (req, res) => {
  const { meterId } = req.params;
  const { horizon = 24, start } = req.query;
  const data = await mlService.fetchFromML(
    `/meters/${encodeURIComponent(meterId)}/forecast`,
    { horizon, start }
  );
  res.json(data);
});

exports.getForecastMeta = asyncHandler(async (req, res) => {
  const data = await mlService.fetchFromML("/forecast/meta");
  res.json(data);
});
