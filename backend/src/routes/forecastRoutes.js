const express = require("express");
const router = express.Router();
const forecastController = require("../controllers/forecastController");
const { protect } = require("../middleware/authMiddleware");

function byQuery(req, res, next) {
  if (!req.query.meterId) {
    return res.status(400).json({ message: "meterId query parameter is required" });
  }
  req.params.meterId = req.query.meterId;
  return forecastController.getMeterForecast(req, res, next);
}

router.get("/meta", protect, forecastController.getForecastMeta);
router.get("/", protect, byQuery);
router.get("/meters/:meterId", protect, forecastController.getMeterForecast);

module.exports = router;
