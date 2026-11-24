const express = require("express");
const router = express.Router();
const anomalyController = require("../controllers/anomalyController");
const { protect } = require("../middleware/authMiddleware");

router.get("/summary", protect, anomalyController.getGlobalSummary);
router.get("/status", protect, anomalyController.getAnomalyStatus);
router.get("/meters/:meterId", protect, anomalyController.getMeterAnomalies);
router.get("/", protect, anomalyController.getAnomalies);

module.exports = router;
