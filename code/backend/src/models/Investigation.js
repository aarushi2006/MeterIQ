const mongoose = require("mongoose");

const InvestigationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    meter_id: { type: String, required: true, index: true },
    region: { type: String, default: "Unknown" },
    area: { type: String },
    riskScore: { type: Number },
    riskLevel: { type: String },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["OPEN", "IN PROGRESS", "SUBMITTED FOR REVIEW", "RESOLVED"],
      default: "OPEN",
      index: true,
    },
    detectedDate: { type: String },
    reason: { type: String, required: true },
    evidence: { type: String },
    assignmentInstructions: { type: String },
    dueDate: { type: Date },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    assignedTo: { type: String },
    assignedRole: { type: String },
    createdBy: { type: String },
    notes: [
      {
        author: String,
        text: String,
        time: String,
      },
    ],
    history: [
      {
        action: String,
        detail: String,
        by: String,
        at: String,
      },
    ],
    resolution: { type: String },
    updatedAt: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investigation", InvestigationSchema);
