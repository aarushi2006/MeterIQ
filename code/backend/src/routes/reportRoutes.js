const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

router.get("/summary", protect, reportController.getSummary);
router.get("/meters.csv", protect, reportController.exportMeters);
router.get("/anomalies.csv", protect, reportController.exportAnomalies);
router.get("/regional.csv", protect, reportController.exportRegional);
router.get(
  "/investigations.csv",
  protect,
  reportController.exportInvestigations
);

module.exports = router;
