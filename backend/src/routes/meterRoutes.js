const express = require("express");
const router = express.Router();
const meterController = require("../controllers/meterController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, meterController.getMeters);
router.get("/pipeline/status", protect, meterController.getPipelineStatus);
router.get("/health", protect, meterController.getMeterHealth);
router.get("/:meterId", protect, meterController.getMeterById);
router.get("/:meterId/consumption", protect, meterController.getConsumption);

module.exports = router;
