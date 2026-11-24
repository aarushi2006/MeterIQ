const express = require("express");
const router = express.Router();
const investigationController = require("../controllers/investigationController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", protect, investigationController.getInvestigations);
router.get("/:id", protect, investigationController.getInvestigation);
router.post(
  "/",
  protect,
  authorize("supervisor", "admin"),
  investigationController.createInvestigation
);
router.patch(
  "/:id/status",
  protect,
  authorize("supervisor", "admin"),
  investigationController.updateStatus
);
router.patch(
  "/:id",
  protect,
  authorize("supervisor", "admin"),
  investigationController.updateStatus
);
router.post("/:id/notes", protect, investigationController.addNote);

module.exports = router;
