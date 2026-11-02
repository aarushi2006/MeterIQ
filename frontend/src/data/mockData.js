/**
 * MeterIQ Central Dataset & Operational Mock Data
 * Derived from the CEEW Mathura and Bareilly smart-meter datasets.
 * Formatted for enterprise decision-support analytics and seamless API transition.
 */

export const meters = [
  {
    id: "MTR1005",
    region: "Mathura",
    area: "Vrindavan Road",
    status: "Priority Review",
    risk: "High",
    score: 0.91,
    currentKwh: 4.2,
    avgDailyKwh: 31.4,
    peakKwh: 38.6,
    minKwh: 0.3,
    delta: -68.2,
    lastReading: "12 min ago",
    anomalyStatus: "Active Flag",
    anomalyType: "Unexpected Zero Usage",
    installed: "2020-11-18",
    type: "3-Phase Commercial",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.1.8",
    why: [
      "Consumption dropped from ~31.4 kWh/day to 4.2 kWh over the last 48 hours.",
      "Night-time consumption is near zero, deviating from continuous baseline.",
      "Peer commercial meters in Vrindavan Road exhibit steady baseline demand.",
      "Anomaly score (0.91) exceeds the human investigation threshold (0.65)."
    ],
    contributingFactors: [
      { factor: "Deviation from 30-day baseline", value: "-68.2%", impact: "high" },
      { factor: "Night-to-day consumption ratio", value: "0.04 (Expected 0.38)", impact: "high" },
      { factor: "Peer meter divergence", value: "3.2σ", impact: "high" },
      { factor: "Sudden change duration", value: "Past 48 hours", impact: "medium" }
    ],
    recommendedAction: "Dispatch field technician to verify physical CT connection and inspect terminal block.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.1, baseline: 1.1 },
      { hour: "02:00", actual: 0.1, baseline: 0.9 },
      { hour: "04:00", actual: 0.05, baseline: 0.8 },
      { hour: "06:00", actual: 0.2, baseline: 1.4 },
      { hour: "08:00", actual: 0.4, baseline: 2.1 },
      { hour: "10:00", actual: 0.6, baseline: 2.8 },
      { hour: "12:00", actual: 0.5, baseline: 3.1 },
      { hour: "14:00", actual: 0.4, baseline: 2.9 },
      { hour: "16:00", actual: 0.6, baseline: 2.6 },
      { hour: "18:00", actual: 0.5, baseline: 2.4 },
      { hour: "20:00", actual: 0.4, baseline: 2.0 },
      { hour: "22:00", actual: 0.35, baseline: 1.6 }
    ]
  },
  {
    id: "MTR1003",
    region: "Mathura",
    area: "Govind Nagar",
    status: "Under Review",
    risk: "High",
    score: 0.86,
    currentKwh: 9.4,
    avgDailyKwh: 22.8,
    peakKwh: 29.4,
    minKwh: 4.1,
    delta: -42.0,
    lastReading: "8 min ago",
    anomalyStatus: "Investigating",
    anomalyType: "Consumption Drop",
    installed: "2022-03-15",
    type: "3-Phase Residential",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Sharp three-day consumption drop without corresponding weather shift.",
      "Usage is 42% below 30-day rolling moving average.",
      "Divergence from Govind Nagar residential peer cluster.",
      "Score 0.86 warrants prioritized human review."
    ],
    contributingFactors: [
      { factor: "Deviation from 30-day baseline", value: "-42.0%", impact: "high" },
      { factor: "Rolling 72-hour gradient", value: "-14.2 kWh/day", impact: "high" },
      { factor: "Peer meter divergence", value: "2.6σ", impact: "medium" }
    ],
    recommendedAction: "Review smart-meter interval logs and cross-check with local transformer load records.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.4, baseline: 0.8 },
      { hour: "02:00", actual: 0.3, baseline: 0.7 },
      { hour: "04:00", actual: 0.3, baseline: 0.6 },
      { hour: "06:00", actual: 0.5, baseline: 1.0 },
      { hour: "08:00", actual: 0.9, baseline: 1.8 },
      { hour: "10:00", actual: 1.1, baseline: 2.2 },
      { hour: "12:00", actual: 1.0, baseline: 2.4 },
      { hour: "14:00", actual: 0.9, baseline: 2.1 },
      { hour: "16:00", actual: 0.8, baseline: 1.9 },
      { hour: "18:00", actual: 1.1, baseline: 2.5 },
      { hour: "20:00", actual: 1.2, baseline: 2.7 },
      { hour: "22:00", actual: 0.9, baseline: 1.8 }
    ]
  },
  {
    id: "MTR1015",
    region: "Bareilly",
    area: "Aftab Colony",
    status: "Priority Review",
    risk: "High",
    score: 0.82,
    currentKwh: 7.1,
    avgDailyKwh: 24.5,
    peakKwh: 32.0,
    minKwh: 2.8,
    delta: -55.0,
    lastReading: "25 min ago",
    anomalyStatus: "Investigating",
    anomalyType: "Baseline Deviation",
    installed: "2022-01-12",
    type: "3-Phase Commercial",
    provider: "MVVNL / CESC Bareilly",
    health: "Online",
    firmware: "v3.2.0",
    why: [
      "Consistent 5-day downward consumption trend.",
      "Current usage is 55% below historical 30-day mean.",
      "Daytime commercial hours show unexpected flatline.",
      "Peer meters in Aftab Colony maintain standard load."
    ],
    contributingFactors: [
      { factor: "Deviation from baseline", value: "-55.0%", impact: "high" },
      { factor: "Peak hour load factor drop", value: "0.22", impact: "high" },
      { factor: "5-day consecutive decline", value: "Detected", impact: "medium" }
    ],
    recommendedAction: "Perform visual site audit of meter seal and verify phase current balance.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.3, baseline: 0.9 },
      { hour: "02:00", actual: 0.2, baseline: 0.8 },
      { hour: "04:00", actual: 0.2, baseline: 0.7 },
      { hour: "06:00", actual: 0.4, baseline: 1.2 },
      { hour: "08:00", actual: 0.6, baseline: 2.1 },
      { hour: "10:00", actual: 0.8, baseline: 2.9 },
      { hour: "12:00", actual: 0.8, baseline: 3.0 },
      { hour: "14:00", actual: 0.7, baseline: 2.8 },
      { hour: "16:00", actual: 0.9, baseline: 2.6 },
      { hour: "18:00", actual: 0.8, baseline: 2.4 },
      { hour: "20:00", actual: 0.7, baseline: 2.1 },
      { hour: "22:00", actual: 0.5, baseline: 1.5 }
    ]
  },
  {
    id: "MTR1025",
    region: "Mathura",
    area: "Farah",
    status: "Priority Review",
    risk: "High",
    score: 0.88,
    currentKwh: 3.8,
    avgDailyKwh: 21.0,
    peakKwh: 26.5,
    minKwh: 0.1,
    delta: -72.0,
    lastReading: "5 min ago",
    anomalyStatus: "Active Flag",
    anomalyType: "Unexpected Zero Usage",
    installed: "2020-06-10",
    type: "3-Phase Commercial",
    provider: "PVVNL / CESC Mathura",
    health: "Faulty",
    firmware: "v3.1.5",
    why: [
      "Consumption dropped 72% over 48 hours.",
      "Intermittent zero-current readings detected on Phase B.",
      "Nearby feeder meters show normal voltage levels.",
      "Hardware diagnostic sensor triggered tamper/disconnect signal."
    ],
    contributingFactors: [
      { factor: "Sudden consumption drop", value: "-72.0%", impact: "high" },
      { factor: "Phase B current imbalance", value: "0.02 A", impact: "high" },
      { factor: "Voltage stability", value: "248.2 V (Normal)", impact: "low" }
    ],
    recommendedAction: "Schedule emergency physical inspection for phase bypass or sensor failure.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.05, baseline: 0.8 },
      { hour: "02:00", actual: 0.05, baseline: 0.7 },
      { hour: "04:00", actual: 0.05, baseline: 0.6 },
      { hour: "06:00", actual: 0.1, baseline: 1.1 },
      { hour: "08:00", actual: 0.2, baseline: 1.8 },
      { hour: "10:00", actual: 0.4, baseline: 2.3 },
      { hour: "12:00", actual: 0.4, baseline: 2.5 },
      { hour: "14:00", actual: 0.3, baseline: 2.2 },
      { hour: "16:00", actual: 0.4, baseline: 2.0 },
      { hour: "18:00", actual: 0.5, baseline: 2.2 },
      { hour: "20:00", actual: 0.4, baseline: 2.1 },
      { hour: "22:00", actual: 0.2, baseline: 1.4 }
    ]
  },
  {
    id: "MTR1001",
    region: "Mathura",
    area: "Krishna Nagar",
    status: "Flagged",
    risk: "Medium",
    score: 0.73,
    currentKwh: 18.6,
    avgDailyKwh: 22.4,
    peakKwh: 28.0,
    minKwh: 6.2,
    delta: -16.0,
    lastReading: "3 hours ago",
    anomalyStatus: "Active Flag",
    anomalyType: "Night-time Pattern",
    installed: "2021-09-22",
    type: "1-Phase Residential",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Night-time consumption is 45% higher than historical residential pattern.",
      "Overall daytime load decreased by 16%.",
      "Inversion of expected diurnal curve."
    ],
    contributingFactors: [
      { factor: "Night load increase", value: "+45.2%", impact: "medium" },
      { factor: "Diurnal inversion index", value: "0.68", impact: "medium" }
    ],
    recommendedAction: "Monitor load pattern over next 48 hours for recurring night shifts.",
    hourlyHistory: [
      { hour: "00:00", actual: 1.8, baseline: 0.8 },
      { hour: "02:00", actual: 1.9, baseline: 0.7 },
      { hour: "04:00", actual: 1.7, baseline: 0.6 },
      { hour: "06:00", actual: 1.2, baseline: 1.1 },
      { hour: "08:00", actual: 0.9, baseline: 1.8 },
      { hour: "10:00", actual: 0.8, baseline: 2.1 },
      { hour: "12:00", actual: 0.9, baseline: 2.3 },
      { hour: "14:00", actual: 0.7, baseline: 2.0 },
      { hour: "16:00", actual: 0.8, baseline: 1.8 },
      { hour: "18:00", actual: 1.1, baseline: 2.1 },
      { hour: "20:00", actual: 1.4, baseline: 2.4 },
      { hour: "22:00", actual: 1.6, baseline: 1.5 }
    ]
  },
  {
    id: "MTR1008",
    region: "Bareilly",
    area: "Clock Tower",
    status: "Flagged",
    risk: "Medium",
    score: 0.67,
    currentKwh: 31.5,
    avgDailyKwh: 24.2,
    peakKwh: 36.4,
    minKwh: 8.1,
    delta: 22.0,
    lastReading: "1 hour ago",
    anomalyStatus: "Active Flag",
    anomalyType: "Consumption Spike",
    installed: "2021-05-30",
    type: "3-Phase Commercial",
    provider: "MVVNL / CESC Bareilly",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Sudden 22% consumption surge during off-peak hours.",
      "Peak demand exceeded registered sanctioned load (5 kW) by 18%.",
      "Surrounding commercial meters show steady consumption."
    ],
    contributingFactors: [
      { factor: "Off-peak surge", value: "+22.0%", impact: "medium" },
      { factor: "Sanctioned load exceedance", value: "5.9 kW peak", impact: "high" }
    ],
    recommendedAction: "Send automated advisory regarding sanctioned load threshold breach.",
    hourlyHistory: [
      { hour: "00:00", actual: 1.4, baseline: 0.9 },
      { hour: "02:00", actual: 1.2, baseline: 0.8 },
      { hour: "04:00", actual: 1.1, baseline: 0.7 },
      { hour: "06:00", actual: 1.8, baseline: 1.2 },
      { hour: "08:00", actual: 2.8, baseline: 2.1 },
      { hour: "10:00", actual: 3.8, baseline: 2.9 },
      { hour: "12:00", actual: 4.1, baseline: 3.1 },
      { hour: "14:00", actual: 3.9, baseline: 2.8 },
      { hour: "16:00", actual: 3.6, baseline: 2.6 },
      { hour: "18:00", actual: 3.2, baseline: 2.3 },
      { hour: "20:00", actual: 2.7, baseline: 2.0 },
      { hour: "22:00", actual: 2.0, baseline: 1.4 }
    ]
  },
  {
    id: "MTR1022",
    region: "Mathura",
    area: "Auth",
    status: "Flagged",
    risk: "Medium",
    score: 0.58,
    currentKwh: 12.1,
    avgDailyKwh: 16.8,
    peakKwh: 21.0,
    minKwh: 4.2,
    delta: -28.0,
    lastReading: "45 min ago",
    anomalyStatus: "Active Flag",
    anomalyType: "Sudden Pattern Change",
    installed: "2021-12-01",
    type: "3-Phase Residential",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.2.0",
    why: [
      "Gradual downward drift of 28% over 4 consecutive days.",
      "Pattern deviates from seasonal benchmark in Mathura.",
      "Score 0.58 indicates moderate divergence."
    ],
    contributingFactors: [
      { factor: "4-day trend slope", value: "-2.1 kWh/day", impact: "medium" },
      { factor: "Baseline ratio", value: "0.72", impact: "medium" }
    ],
    recommendedAction: "Review subsequent billing cycle meter reading against smart-grid telemetries.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.5, baseline: 0.7 },
      { hour: "02:00", actual: 0.4, baseline: 0.6 },
      { hour: "04:00", actual: 0.4, baseline: 0.5 },
      { hour: "06:00", actual: 0.7, baseline: 0.9 },
      { hour: "08:00", actual: 1.1, baseline: 1.5 },
      { hour: "10:00", actual: 1.3, baseline: 1.8 },
      { hour: "12:00", actual: 1.2, baseline: 1.9 },
      { hour: "14:00", actual: 1.1, baseline: 1.7 },
      { hour: "16:00", actual: 1.0, baseline: 1.6 },
      { hour: "18:00", actual: 1.3, baseline: 1.9 },
      { hour: "20:00", actual: 1.5, baseline: 2.1 },
      { hour: "22:00", actual: 0.9, baseline: 1.3 }
    ]
  },
  {
    id: "MTR1035",
    region: "Mathura",
    area: "Mathura Cantt",
    status: "Flagged",
    risk: "Medium",
    score: 0.62,
    currentKwh: 16.4,
    avgDailyKwh: 20.3,
    peakKwh: 26.0,
    minKwh: 5.5,
    delta: -19.0,
    lastReading: "2 hours ago",
    anomalyStatus: "Active Flag",
    anomalyType: "Baseline Deviation",
    installed: "2022-08-25",
    type: "3-Phase Commercial",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Moderate consumption decline of 19% vs 30-day moving average.",
      "Variance observed in weekend consumption levels."
    ],
    contributingFactors: [
      { factor: "Deviation from baseline", value: "-19.0%", impact: "medium" },
      { factor: "Weekend ratio variance", value: "+14%", impact: "low" }
    ],
    recommendedAction: "Keep in automated watch list for 7 days.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.8, baseline: 0.9 },
      { hour: "02:00", actual: 0.7, baseline: 0.8 },
      { hour: "04:00", actual: 0.6, baseline: 0.7 },
      { hour: "06:00", actual: 0.9, baseline: 1.1 },
      { hour: "08:00", actual: 1.5, baseline: 1.9 },
      { hour: "10:00", actual: 1.8, baseline: 2.3 },
      { hour: "12:00", actual: 1.9, baseline: 2.4 },
      { hour: "14:00", actual: 1.7, baseline: 2.1 },
      { hour: "16:00", actual: 1.6, baseline: 2.0 },
      { hour: "18:00", actual: 1.7, baseline: 2.2 },
      { hour: "20:00", actual: 1.8, baseline: 2.3 },
      { hour: "22:00", actual: 1.1, baseline: 1.4 }
    ]
  },
  {
    id: "MTR1002",
    region: "Bareilly",
    area: "Civil Lines",
    status: "Normal",
    risk: "Low",
    score: 0.28,
    currentKwh: 26.1,
    avgDailyKwh: 25.8,
    peakKwh: 31.2,
    minKwh: 8.4,
    delta: 5.0,
    lastReading: "7 hours ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2022-07-04",
    type: "1-Phase Residential",
    provider: "MVVNL / CESC Bareilly",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Consumption remains fully within normal historical range.",
      "Diurnal patterns match neighboring Civil Lines households."
    ],
    contributingFactors: [
      { factor: "Deviation from baseline", value: "+5.0%", impact: "low" },
      { factor: "Peer correlation", value: "0.94", impact: "low" }
    ],
    recommendedAction: "No action required.",
    hourlyHistory: [
      { hour: "00:00", actual: 1.1, baseline: 1.1 },
      { hour: "02:00", actual: 0.9, baseline: 0.9 },
      { hour: "04:00", actual: 0.8, baseline: 0.8 },
      { hour: "06:00", actual: 1.3, baseline: 1.2 },
      { hour: "08:00", actual: 2.4, baseline: 2.3 },
      { hour: "10:00", actual: 2.8, baseline: 2.7 },
      { hour: "12:00", actual: 2.9, baseline: 2.9 },
      { hour: "14:00", actual: 2.6, baseline: 2.5 },
      { hour: "16:00", actual: 2.4, baseline: 2.4 },
      { hour: "18:00", actual: 2.9, baseline: 2.8 },
      { hour: "20:00", actual: 3.2, baseline: 3.1 },
      { hour: "22:00", actual: 1.8, baseline: 1.8 }
    ]
  },
  {
    id: "MTR1012",
    region: "Mathura",
    area: "Dhamnode",
    status: "Normal",
    risk: "Low",
    score: 0.12,
    currentKwh: 15.3,
    avgDailyKwh: 15.6,
    peakKwh: 19.8,
    minKwh: 4.8,
    delta: -2.0,
    lastReading: "6 hours ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2023-06-20",
    type: "1-Phase Residential",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Usage consistent with long-term seasonal benchmark.",
      "Day/night consumption ratio within 5% of peer median."
    ],
    contributingFactors: [
      { factor: "Deviation from baseline", value: "-2.0%", impact: "low" }
    ],
    recommendedAction: "No action required.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.6, baseline: 0.6 },
      { hour: "02:00", actual: 0.5, baseline: 0.5 },
      { hour: "04:00", actual: 0.5, baseline: 0.5 },
      { hour: "06:00", actual: 0.8, baseline: 0.8 },
      { hour: "08:00", actual: 1.4, baseline: 1.4 },
      { hour: "10:00", actual: 1.7, baseline: 1.7 },
      { hour: "12:00", actual: 1.8, baseline: 1.8 },
      { hour: "14:00", actual: 1.5, baseline: 1.5 },
      { hour: "16:00", actual: 1.4, baseline: 1.4 },
      { hour: "18:00", actual: 1.8, baseline: 1.8 },
      { hour: "20:00", actual: 2.1, baseline: 2.0 },
      { hour: "22:00", actual: 1.2, baseline: 1.2 }
    ]
  },
  {
    id: "MTR1014",
    region: "Bareilly",
    area: "Rajendra Nagar",
    status: "Normal",
    risk: "Low",
    score: 0.19,
    currentKwh: 22.8,
    avgDailyKwh: 22.1,
    peakKwh: 27.5,
    minKwh: 6.9,
    delta: 3.0,
    lastReading: "5 hours ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2023-01-10",
    type: "3-Phase Residential",
    provider: "MVVNL / CESC Bareilly",
    health: "Online",
    firmware: "v3.2.1",
    why: [
      "Consistent load profile without spikes or uncharacteristic drops.",
      "High correlation with feeder aggregate."
    ],
    contributingFactors: [
      { factor: "Deviation from baseline", value: "+3.0%", impact: "low" }
    ],
    recommendedAction: "No action required.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.9, baseline: 0.9 },
      { hour: "02:00", actual: 0.8, baseline: 0.8 },
      { hour: "04:00", actual: 0.7, baseline: 0.7 },
      { hour: "06:00", actual: 1.1, baseline: 1.1 },
      { hour: "08:00", actual: 2.1, baseline: 2.0 },
      { hour: "10:00", actual: 2.5, baseline: 2.4 },
      { hour: "12:00", actual: 2.6, baseline: 2.5 },
      { hour: "14:00", actual: 2.3, baseline: 2.2 },
      { hour: "16:00", actual: 2.1, baseline: 2.1 },
      { hour: "18:00", actual: 2.6, baseline: 2.5 },
      { hour: "20:00", actual: 2.9, baseline: 2.8 },
      { hour: "22:00", actual: 1.5, baseline: 1.5 }
    ]
  },
  {
    id: "MTR1020",
    region: "Mathura",
    area: "Chhatikara",
    status: "Normal",
    risk: "Low",
    score: 0.08,
    currentKwh: 19.7,
    avgDailyKwh: 19.5,
    peakKwh: 24.2,
    minKwh: 5.8,
    delta: 1.0,
    lastReading: "4 hours ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2023-08-15",
    type: "1-Phase Residential",
    provider: "PVVNL / CESC Mathura",
    health: "Online",
    firmware: "v3.2.1",
    why: ["Stable historical profile."],
    contributingFactors: [{ factor: "Deviation", value: "+1.0%", impact: "low" }],
    recommendedAction: "No action required.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.8, baseline: 0.8 },
      { hour: "04:00", actual: 0.6, baseline: 0.6 },
      { hour: "08:00", actual: 1.8, baseline: 1.8 },
      { hour: "12:00", actual: 2.2, baseline: 2.2 },
      { hour: "16:00", actual: 1.9, baseline: 1.9 },
      { hour: "20:00", actual: 2.5, baseline: 2.5 }
    ]
  },
  {
    id: "MTR1021",
    region: "Bareilly",
    area: "Nainital Road",
    status: "Normal",
    risk: "Low",
    score: 0.15,
    currentKwh: 24.3,
    avgDailyKwh: 25.0,
    peakKwh: 30.1,
    minKwh: 7.2,
    delta: -3.0,
    lastReading: "2 hours ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2023-04-20",
    type: "1-Phase Commercial",
    provider: "MVVNL / CESC Bareilly",
    health: "Online",
    firmware: "v3.2.1",
    why: ["Expected commercial weekday load curve."],
    contributingFactors: [{ factor: "Deviation", value: "-3.0%", impact: "low" }],
    recommendedAction: "No action required.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.9, baseline: 0.9 },
      { hour: "06:00", actual: 1.2, baseline: 1.2 },
      { hour: "12:00", actual: 2.8, baseline: 2.8 },
      { hour: "18:00", actual: 2.6, baseline: 2.6 }
    ]
  },
  {
    id: "MTR1023",
    region: "Bareilly",
    area: "Bhojipura",
    status: "Normal",
    risk: "Low",
    score: 0.22,
    currentKwh: 21.5,
    avgDailyKwh: 20.7,
    peakKwh: 25.8,
    minKwh: 6.1,
    delta: 4.0,
    lastReading: "3 hours ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2023-02-14",
    type: "1-Phase Residential",
    provider: "MVVNL / CESC Bareilly",
    health: "Online",
    firmware: "v3.2.1",
    why: ["Standard residential profile."],
    contributingFactors: [{ factor: "Deviation", value: "+4.0%", impact: "low" }],
    recommendedAction: "No action required.",
    hourlyHistory: [
      { hour: "00:00", actual: 0.8, baseline: 0.8 },
      { hour: "08:00", actual: 1.9, baseline: 1.9 },
      { hour: "16:00", actual: 2.0, baseline: 2.0 }
    ]
  },
  {
    id: "MTR1030",
    region: "Bareilly",
    area: "Izatnagar",
    status: "Normal",
    risk: "Low",
    score: 0.11,
    currentKwh: 28.9,
    avgDailyKwh: 28.3,
    peakKwh: 34.2,
    minKwh: 8.8,
    delta: 2.0,
    lastReading: "1 hour ago",
    anomalyStatus: "Normal",
    anomalyType: "None",
    installed: "2023-05-18",
    type: "1-Phase Residential",
    provider: "MVVNL / CESC Bareilly",
    health: "Offline",
    firmware: "v3.2.0",
    why: ["Normal consumption prior to scheduled comms maintenance."],
    contributingFactors: [{ factor: "Deviation", value: "+2.0%", impact: "low" }],
    recommendedAction: "Verify cellular gateway heartbeat.",
    hourlyHistory: [
      { hour: "00:00", actual: 1.2, baseline: 1.2 },
      { hour: "12:00", actual: 3.1, baseline: 3.1 }
    ]
  }
];

// Helper to calculate summary metrics
export const cityStats = {
  Mathura: {
    meters: 6320,
    activeReporting: 6298,
    mwhToday: 61.8,
    avgDailyPerMeter: 9.78,
    peakLoadMw: 8.4,
    peakHour: "19:00 - 21:00",
    loadFactor: 0.76,
    flaggedMeters: 14,
    highRiskMeters: 3,
    investigationsOpen: 2
  },
  Bareilly: {
    meters: 6160,
    activeReporting: 6142,
    mwhToday: 54.6,
    avgDailyPerMeter: 8.86,
    peakLoadMw: 7.2,
    peakHour: "20:00 - 22:00",
    loadFactor: 0.72,
    flaggedMeters: 13,
    highRiskMeters: 2,
    investigationsOpen: 2
  }
};

export const anomaliesList = [
  {
    id: "ANM-2026-0901",
    meterId: "MTR1005",
    region: "Mathura",
    area: "Vrindavan Road",
    riskScore: 0.91,
    riskLevel: "High",
    anomalyType: "Unexpected Zero Usage",
    detectedAt: "Today, 14:08",
    status: "Under Review",
    deltaPercent: -68.2,
    contributingFactors: "Drop to 4.2 kWh/day (Baseline 31.4 kWh), night zero-usage, 3.2σ peer divergence",
    assignedTo: "Rajesh Kumar",
    action: "Physical CT connection audit"
  },
  {
    id: "ANM-2026-0902",
    meterId: "MTR1025",
    region: "Mathura",
    area: "Farah",
    riskScore: 0.88,
    riskLevel: "High",
    anomalyType: "Unexpected Zero Usage",
    detectedAt: "Today, 14:15",
    status: "Open",
    deltaPercent: -72.0,
    contributingFactors: "72% drop in 48 hrs, Phase B current imbalance (0.02 A), hardware tamper flag",
    assignedTo: null,
    action: "Emergency site verification"
  },
  {
    id: "ANM-2026-0903",
    meterId: "MTR1003",
    region: "Mathura",
    area: "Govind Nagar",
    riskScore: 0.86,
    riskLevel: "High",
    anomalyType: "Consumption Drop",
    detectedAt: "Today, 14:12",
    status: "Under Review",
    deltaPercent: -42.0,
    contributingFactors: "Consistent 3-day drop, -42% vs 30d baseline, divergence from Govind Nagar peer cluster",
    assignedTo: "Priya Singh",
    action: "Review interval logs"
  },
  {
    id: "ANM-2026-0904",
    meterId: "MTR1015",
    region: "Bareilly",
    area: "Aftab Colony",
    riskScore: 0.82,
    riskLevel: "High",
    anomalyType: "Baseline Deviation",
    detectedAt: "Today, 13:55",
    status: "Under Review",
    deltaPercent: -55.0,
    contributingFactors: "5-day steady descent, 55% below historical average, commercial peak hour flatline",
    assignedTo: "Rajesh Kumar",
    action: "Meter seal verification"
  },
  {
    id: "ANM-2026-0905",
    meterId: "MTR1001",
    region: "Mathura",
    area: "Krishna Nagar",
    riskScore: 0.73,
    riskLevel: "Medium",
    anomalyType: "Night-time Pattern",
    detectedAt: "Today, 11:20",
    status: "Open",
    deltaPercent: -16.0,
    contributingFactors: "+45% night-time surge combined with daytime load decline",
    assignedTo: null,
    action: "Watch for 48h repetition"
  },
  {
    id: "ANM-2026-0906",
    meterId: "MTR1008",
    region: "Bareilly",
    area: "Clock Tower",
    riskScore: 0.67,
    riskLevel: "Medium",
    anomalyType: "Consumption Spike",
    detectedAt: "Today, 13:10",
    status: "Open",
    deltaPercent: 22.0,
    contributingFactors: "Off-peak surge +22%, exceeded sanctioned load (5 kW) by 18%",
    assignedTo: null,
    action: "Sanctioned load advisory"
  },
  {
    id: "ANM-2026-0907",
    meterId: "MTR1035",
    region: "Mathura",
    area: "Mathura Cantt",
    riskScore: 0.62,
    riskLevel: "Medium",
    anomalyType: "Baseline Deviation",
    detectedAt: "Today, 12:25",
    status: "Resolved",
    deltaPercent: -19.0,
    contributingFactors: "Moderate 19% drop linked to verified customer commercial shutdown",
    assignedTo: "Priya Singh",
    action: "Logged as verified maintenance"
  },
  {
    id: "ANM-2026-0908",
    meterId: "MTR1022",
    region: "Mathura",
    area: "Auth",
    riskScore: 0.58,
    riskLevel: "Medium",
    anomalyType: "Sudden Pattern Change",
    detectedAt: "Today, 13:35",
    status: "Open",
    deltaPercent: -28.0,
    contributingFactors: "Gradual 4-day decline of 28% without seasonal explanation",
    assignedTo: null,
    action: "Correlate with billing cycle"
  }
];

export const investigationsList = [
  {
    id: "INV-2026-001",
    meterId: "MTR1005",
    region: "Mathura",
    area: "Vrindavan Road",
    riskScore: 0.91,
    riskLevel: "High",
    status: "UNDER REVIEW",
    detectedDate: "Sep 13, 2026",
    reason: "Near-zero consumption after sustained 31 kWh/day commercial usage",
    evidence: "Sudden 68.2% drop, 3.2σ peer divergence, no outage recorded on 11kV feeder.",
    assignedTo: "Rajesh Kumar",
    assignedRole: "Senior Analyst",
    notes: [
      { author: "System AI", text: "Anomaly flag triggered by Isolation Forest (score: 0.91).", time: "Sep 13, 14:08" },
      { author: "Rajesh Kumar", text: "Reviewed feeder telemetry; neighboring meters show normal voltage and load. Scheduled field verification.", time: "Sep 13, 14:22" }
    ],
    resolution: null,
    updatedAt: "10 min ago"
  },
  {
    id: "INV-2026-002",
    meterId: "MTR1025",
    region: "Mathura",
    area: "Farah",
    riskScore: 0.88,
    riskLevel: "High",
    status: "OPEN",
    detectedDate: "Sep 13, 2026",
    reason: "72% drop in 48 hours with Phase B current collapse",
    evidence: "Phase B current dropped to 0.02 A while Phase A/C carry 1.2 A. Hardware alert active.",
    assignedTo: null,
    assignedRole: null,
    notes: [
      { author: "System AI", text: "Flagged: Severe consumption drop + sensor tamper indicator.", time: "Sep 13, 14:15" }
    ],
    resolution: null,
    updatedAt: "5 min ago"
  },
  {
    id: "INV-2026-003",
    meterId: "MTR1003",
    region: "Mathura",
    area: "Govind Nagar",
    riskScore: 0.86,
    riskLevel: "High",
    status: "UNDER REVIEW",
    detectedDate: "Sep 13, 2026",
    reason: "Consistent downward step-change over 3 consecutive days",
    evidence: "Daily load reduced from 22.8 kWh to 9.4 kWh. Weather variance ruled out.",
    assignedTo: "Priya Singh",
    assignedRole: "Operations Analyst",
    notes: [
      { author: "System AI", text: "Flagged: Step-change baseline deviation.", time: "Sep 13, 14:12" },
      { author: "Priya Singh", text: "Comparing with past 6 months consumption history to check for annual seasonal leave.", time: "Sep 13, 14:25" }
    ],
    resolution: null,
    updatedAt: "18 min ago"
  },
  {
    id: "INV-2026-004",
    meterId: "MTR1015",
    region: "Bareilly",
    area: "Aftab Colony",
    riskScore: 0.82,
    riskLevel: "High",
    status: "UNDER REVIEW",
    detectedDate: "Sep 13, 2026",
    reason: "5-day downward trend in commercial establishment",
    evidence: "Peak commercial operating hours show minimal draw. Feeder level normal.",
    assignedTo: "Rajesh Kumar",
    assignedRole: "Senior Analyst",
    notes: [
      { author: "Rajesh Kumar", text: "Contacted local sub-station manager. Work ticket issued to inspect meter box terminal.", time: "Sep 13, 14:05" }
    ],
    resolution: null,
    updatedAt: "35 min ago"
  },
  {
    id: "INV-2026-005",
    meterId: "MTR1035",
    region: "Mathura",
    area: "Mathura Cantt",
    riskScore: 0.62,
    riskLevel: "Medium",
    status: "RESOLVED",
    detectedDate: "Sep 12, 2026",
    reason: "19% drop in consumption",
    evidence: "Customer submitted prior notification of facility renovation shutdown.",
    assignedTo: "Priya Singh",
    assignedRole: "Operations Analyst",
    notes: [
      { author: "Priya Singh", text: "Verified official building renovation letter with CESC Mathura customer support.", time: "Sep 12, 16:30" }
    ],
    resolution: "Verified legitimate temporary business shutdown. Case closed without physical violation.",
    updatedAt: "Yesterday"
  },
  {
    id: "INV-2026-006",
    meterId: "MTR1018",
    region: "Bareilly",
    area: "Civil Lines",
    riskScore: 0.69,
    riskLevel: "Medium",
    status: "FALSE POSITIVE",
    detectedDate: "Sep 11, 2026",
    reason: "Temporary zero usage for 18 hours",
    evidence: "Local branch line maintenance caused planned power cut affecting 4 connected premises.",
    assignedTo: "Rajesh Kumar",
    assignedRole: "Senior Analyst",
    notes: [
      { author: "Rajesh Kumar", text: "Confirmed planned local substation maintenance from dispatch log.", time: "Sep 11, 18:00" }
    ],
    resolution: "Grid-side planned outage. Meter functioned correctly upon restoration.",
    updatedAt: "2 days ago"
  }
];

export const consumptionTrends = {
  "7D": [
    { label: "Mon", mathuraMwh: 60.2, bareillyMwh: 53.1, totalMwh: 113.3, tempC: 32 },
    { label: "Tue", mathuraMwh: 59.4, bareillyMwh: 52.8, totalMwh: 112.2, tempC: 31 },
    { label: "Wed", mathuraMwh: 61.8, bareillyMwh: 54.2, totalMwh: 116.0, tempC: 33 },
    { label: "Thu", mathuraMwh: 63.5, bareillyMwh: 55.6, totalMwh: 119.1, tempC: 34 },
    { label: "Fri", mathuraMwh: 62.1, bareillyMwh: 54.9, totalMwh: 117.0, tempC: 33 },
    { label: "Sat", mathuraMwh: 58.7, bareillyMwh: 51.4, totalMwh: 110.1, tempC: 30 },
    { label: "Sun", mathuraMwh: 61.8, bareillyMwh: 54.6, totalMwh: 116.4, tempC: 32 }
  ],
  "30D": Array.from({ length: 30 }, (_, i) => {
    const dayNum = i + 1;
    const base = 112 + Math.sin(i / 3) * 6 + (i % 7 === 5 || i % 7 === 6 ? -5 : 2);
    return {
      label: `Day ${dayNum}`,
      mathuraMwh: parseFloat((base * 0.53).toFixed(1)),
      bareillyMwh: parseFloat((base * 0.47).toFixed(1)),
      totalMwh: parseFloat(base.toFixed(1))
    };
  }),
  "3M": [
    { label: "Jul W1", mathuraMwh: 412, bareillyMwh: 368, totalMwh: 780 },
    { label: "Jul W2", mathuraMwh: 425, bareillyMwh: 379, totalMwh: 804 },
    { label: "Jul W3", mathuraMwh: 430, bareillyMwh: 385, totalMwh: 815 },
    { label: "Jul W4", mathuraMwh: 421, bareillyMwh: 372, totalMwh: 793 },
    { label: "Aug W1", mathuraMwh: 438, bareillyMwh: 391, totalMwh: 829 },
    { label: "Aug W2", mathuraMwh: 445, bareillyMwh: 398, totalMwh: 843 },
    { label: "Aug W3", mathuraMwh: 440, bareillyMwh: 394, totalMwh: 834 },
    { label: "Aug W4", mathuraMwh: 432, bareillyMwh: 386, totalMwh: 818 },
    { label: "Sep W1", mathuraMwh: 428, bareillyMwh: 380, totalMwh: 808 },
    { label: "Sep W2", mathuraMwh: 431, bareillyMwh: 382, totalMwh: 813 }
  ],
  "6M": [
    { label: "Apr", mathuraMwh: 1720, bareillyMwh: 1540, totalMwh: 3260 },
    { label: "May", mathuraMwh: 1940, bareillyMwh: 1720, totalMwh: 3660 },
    { label: "Jun", mathuraMwh: 2050, bareillyMwh: 1810, totalMwh: 3860 },
    { label: "Jul", mathuraMwh: 1880, bareillyMwh: 1670, totalMwh: 3550 },
    { label: "Aug", mathuraMwh: 1840, bareillyMwh: 1630, totalMwh: 3470 },
    { label: "Sep (Proj)", mathuraMwh: 1790, bareillyMwh: 1590, totalMwh: 3380 }
  ],
  "12M": [
    { label: "Oct", totalMwh: 3100 }, { label: "Nov", totalMwh: 2850 },
    { label: "Dec", totalMwh: 2600 }, { label: "Jan", totalMwh: 2550 },
    { label: "Feb", totalMwh: 2700 }, { label: "Mar", totalMwh: 2950 },
    { label: "Apr", totalMwh: 3260 }, { label: "May", totalMwh: 3660 },
    { label: "Jun", totalMwh: 3860 }, { label: "Jul", totalMwh: 3550 },
    { label: "Aug", totalMwh: 3470 }, { label: "Sep", totalMwh: 3380 }
  ]
};

export const diurnalPatterns = [
  { hour: "00:00", weekday: 3.2, weekend: 2.8, industrial: 1.8 },
  { hour: "02:00", weekday: 2.4, weekend: 2.2, industrial: 1.6 },
  { hour: "04:00", weekday: 2.1, weekend: 1.9, industrial: 1.6 },
  { hour: "06:00", weekday: 3.8, weekend: 2.6, industrial: 2.4 },
  { hour: "08:00", weekday: 6.4, weekend: 4.8, industrial: 4.5 },
  { hour: "10:00", weekday: 7.8, weekend: 6.5, industrial: 5.8 },
  { hour: "12:00", weekday: 8.2, weekend: 7.2, industrial: 6.1 },
  { hour: "14:00", weekday: 7.6, weekend: 6.9, industrial: 5.9 },
  { hour: "16:00", weekday: 7.1, weekend: 6.5, industrial: 5.4 },
  { hour: "18:00", weekday: 8.4, weekend: 7.8, industrial: 4.8 },
  { hour: "20:00", weekday: 9.6, weekend: 9.1, industrial: 3.9 },
  { hour: "22:00", weekday: 6.2, weekend: 5.9, industrial: 2.8 }
];

export const forecastModels = {
  "Baseline": {
    mae: "2.10 kWh",
    rmse: "2.68",
    mape: "9.4%",
    trainSamples: "n/a (same-hour-last-week rule)",
    validationMethod: "Same-hour-last-week reference, no training"
  },
  "Linear Regression": {
    mae: "1.42 kWh",
    rmse: "1.86",
    mape: "6.8%",
    trainSamples: "148,200 intervals",
    validationMethod: "Rolling Chronological (Avoids leakage)"
  },
  "Random Forest": {
    mae: "1.08 kWh",
    rmse: "1.44",
    mape: "5.1%",
    trainSamples: "148,200 intervals",
    validationMethod: "Rolling Chronological (Avoids leakage)"
  },
  "Gradient Boosted Trees": {
    mae: "0.98 kWh",
    rmse: "1.32",
    mape: "4.7%",
    trainSamples: "148,200 intervals",
    validationMethod: "Rolling Chronological (Avoids leakage)"
  }
};

export const forecastSeries = [
  { time: "00:00", actual: 12.4, predicted: 12.2, upper: 13.5, lower: 10.9 },
  { time: "02:00", actual: 8.1, predicted: 8.4, upper: 9.6, lower: 7.2 },
  { time: "04:00", actual: 6.3, predicted: 6.6, upper: 7.8, lower: 5.4 },
  { time: "06:00", actual: 9.7, predicted: 9.4, upper: 10.8, lower: 8.0 },
  { time: "08:00", actual: 18.2, predicted: 17.9, upper: 19.8, lower: 16.0 },
  { time: "10:00", actual: 24.5, predicted: 24.1, upper: 26.2, lower: 22.0 },
  { time: "12:00", actual: 28.1, predicted: 27.8, upper: 30.1, lower: 25.5 },
  { time: "14:00", actual: 26.3, predicted: 26.0, upper: 28.4, lower: 23.6 },
  { time: "16:00", actual: 22.8, predicted: 23.2, upper: 25.5, lower: 20.9 },
  { time: "18:00", actual: null, predicted: 21.4, upper: 23.8, lower: 19.0 },
  { time: "20:00", actual: null, predicted: 18.6, upper: 21.0, lower: 16.2 },
  { time: "22:00", actual: null, predicted: 14.1, upper: 16.5, lower: 11.7 },
  { time: "+2h", actual: null, predicted: 10.8, upper: 13.2, lower: 8.4 },
  { time: "+4h", actual: null, predicted: 8.2, upper: 10.7, lower: 5.7 },
  { time: "+6h", actual: null, predicted: 7.4, upper: 9.9, lower: 4.9 },
  { time: "+8h", actual: null, predicted: 12.1, upper: 14.8, lower: 9.4 }
];

/**
 * Project scope is 15-minute to 24-hour ahead forecasting (UC2). This
 * generates a demo actual-vs-predicted series sized to the selected
 * horizon: some recent history (with "actual") followed by a forecast
 * window (predicted only). It is a deterministic pseudo-random mock
 * series for UI development — not a trained model's output — but it
 * varies with the horizon control so the page is actually functional,
 * and it deliberately keeps actual/predicted from lining up perfectly.
 */
const HORIZON_CONFIG = {
  "15m": { stepMinutes: 5, historyPoints: 6, futurePoints: 3 },
  "1h": { stepMinutes: 10, historyPoints: 6, futurePoints: 6 },
  "6h": { stepMinutes: 30, historyPoints: 8, futurePoints: 12 },
  "12h": { stepMinutes: 60, historyPoints: 8, futurePoints: 12 },
  "24h": { stepMinutes: 120, historyPoints: 8, futurePoints: 12 }
};

function pseudoRandom(seed) {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x); // deterministic 0..1
}

function baseLoadKw(hourFraction) {
  const h = ((hourFraction % 24) + 24) % 24;
  const angle = ((h - 13) / 24) * 2 * Math.PI;
  return 17 - 10 * Math.cos(angle); // peak ~midday, trough ~early morning
}

function formatClock(minutesFromMidnight) {
  const m = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = Math.round(m % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function generateForecastSeries(horizon = "24h") {
  const cfg = HORIZON_CONFIG[horizon] || HORIZON_CONFIG["24h"];
  const { stepMinutes, historyPoints, futurePoints } = cfg;
  const nowMinutes = 13 * 60; // anchor "now" near midday for a believable demo curve
  const totalPoints = historyPoints + futurePoints;
  const series = [];

  for (let i = 0; i < totalPoints; i++) {
    const minutesFromMidnight = nowMinutes - (historyPoints - 1 - i) * stepMinutes;
    const hourFraction = minutesFromMidnight / 60;
    const base = baseLoadKw(hourFraction);
    const isFuture = i >= historyPoints;

    const predicted = +(base + (pseudoRandom(i + 50) - 0.5) * 1.6 + Math.sin(i * 0.7) * 0.4).toFixed(2);
    const actual = isFuture
      ? null
      : +(base + (pseudoRandom(i) - 0.5) * 3.2).toFixed(2);

    series.push({
      time: formatClock(minutesFromMidnight),
      actual,
      predicted: Math.max(0, predicted),
      upper: +(predicted + 2.4).toFixed(2),
      lower: +Math.max(0, predicted - 2.4).toFixed(2)
    });
  }

  return series;
}

export const dataQualityStats = {
  totalRecordsChecked: "4,821,640",
  missingValuesPct: 0.18,
  duplicateRowsPct: 0.02,
  invalidTimestampsPct: 0.05,
  dataReadinessPct: 91,
  negativeReadingsCleaned: 142,
  outlierRatioPct: 1.34,
  samplingIntervalMinutes: 3,
  stationarityScore: 0.89,
  lastIngestTimestamp: "2026-09-13 14:15:00 IST",
  dataSources: [
    { name: "CEEW Mathura 2019-2020", status: "Indexed & Cleaned", records: "2,410,800" },
    { name: "CEEW Bareilly 2020-2021", status: "Indexed & Cleaned", records: "2,410,840" }
  ]
};

/**
 * Honest status of the prototype itself — intentionally NOT a fake
 * "system health" / infrastructure dashboard. There is no live backend,
 * database or ML service running yet, so we don't pretend there is one.
 */
export const prototypeStatus = {
  dataSource: "Local prototype dataset (CEEW Mathura & Bareilly smart-meter data)",
  anomalyDetection: "Rule/threshold-based mock scoring — ML model not yet trained",
  forecasting: "Demo series for UI development — ML model not yet trained",
  backend: "Not yet connected (planned: Phase 3 — Backend / API development)",
  lastDatasetUpdate: "Sep 2026 (static prototype snapshot)"
};

/** Forecast model metrics below are prototype/demo values for UI development —
 *  NOT results from a trained model. They will be replaced once the ML
 *  pipeline (baseline -> forecasting model -> MAE/MAPE/RMSE) is complete. */
export const forecastEvaluationNote =
  "Prototype / demo values for UI development — not from a trained model yet.";
