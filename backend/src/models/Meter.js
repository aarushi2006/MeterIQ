const mongoose = require('mongoose');

const MeterSchema = new mongoose.Schema({
  meter_id: { type: String, required: true, unique: true },
  region: { type: String, default: 'Unknown' },
  coverage_start: { type: Date },
  coverage_end: { type: Date },
  anomaly_count: { type: Number, default: 0 },
  risk_level: { type: String, enum: ['NORMAL', 'REVIEW', 'HIGH_RISK'], default: 'NORMAL' },
}, { timestamps: true });

module.exports = mongoose.model('Meter', MeterSchema);
