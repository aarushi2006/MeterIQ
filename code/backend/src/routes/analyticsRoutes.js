const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");

router.get("/consumption", protect, analyticsController.getConsumptionAnalytics);
router.get("/consumption-leaders", protect, analyticsController.getConsumptionLeaders);
router.get("/diurnal", protect, analyticsController.getDiurnalPatterns);
router.get("/regional", protect, analyticsController.getRegionalStats);
router.get("/data-quality", protect, analyticsController.getDataQuality);

module.exports = router;
