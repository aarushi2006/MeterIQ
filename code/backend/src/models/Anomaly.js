const mongoose = require('mongoose');

const AnomalySchema = new mongoose.Schema({
  meter_id: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  consumption: { type: Number, required: true },
  risk_level: { type: String, enum: ['NORMAL', 'REVIEW', 'HIGH_RISK'], required: true },
  explanation: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Anomaly', AnomalySchema);
