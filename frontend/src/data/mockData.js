export const meters = [
  { id: "MTR1001", city: "Mathura", area: "Krishna Nagar", risk: "Medium", score: 0.73, kwh: 18.6, delta: -16, time: "3 hours ago", reason: "Unusual overnight use pattern", why: ["Consumption dropped significantly compared with historical baseline.", "Night-time consumption is higher than the usual pattern.", "Current usage differs from similar nearby meters."], status: "Flagged", installed: "2021-09-22", type: "1-Phase", provider: "CESC Mathura", health: "Online", lastPing: "2 min ago", firmware: "v3.2.1" },
  { id: "MTR1002", city: "Bareilly", area: "Civil Lines", risk: "Low", score: 0.28, kwh: 26.1, delta: 5, time: "7 hours ago", reason: "Stable daily consumption", why: ["Consumption is within the normal historical range.", "Night-time usage is consistent with similar nearby meters."], status: "Normal", installed: "2022-07-04", type: "1-Phase", provider: "CESC Bareilly", health: "Online", lastPing: "1 min ago", firmware: "v3.2.1" },
  { id: "MTR1003", city: "Mathura", area: "Govind Nagar", risk: "High", score: 0.86, kwh: 9.4, delta: -42, time: "8 min ago", reason: "Sharp three-day consumption decline", why: ["Consumption has reduced sharply over the last three days.", "Usage is substantially lower than its historical baseline.", "The pattern differs from comparable nearby meters.", "The anomaly score is above the review threshold."], status: "Under Review", installed: "2022-03-15", type: "3-Phase", provider: "CESC Mathura", health: "Online", lastPing: "30 sec ago", firmware: "v3.2.1" },
  { id: "MTR1005", city: "Mathura", area: "Vrindavan Road", risk: "High", score: 0.91, kwh: 4.2, delta: -68, time: "12 min ago", reason: "Near-zero consumption after consistent high usage", why: ["Consumption dropped from ~30 kWh/day to near zero overnight.", "This pattern is inconsistent with seasonal norms.", "Similar meters in the area show normal consumption.", "Meter tampering indicators flagged by smart sensor."], status: "Priority Review", installed: "2020-11-18", type: "3-Phase", provider: "CESC Mathura", health: "Online", lastPing: "1 min ago", firmware: "v3.1.8" },
  { id: "MTR1008", city: "Bareilly", area: "Clock Tower", risk: "Medium", score: 0.67, kwh: 31.5, delta: 22, time: "1 hour ago", reason: "Unexpected consumption spike", why: ["Consumption increased by 22% without seasonal explanation.", "Peak-hour usage pattern deviates from historical norms.", "Neighboring meters do not show a similar increase."], status: "Flagged", installed: "2021-05-30", type: "3-Phase", provider: "CESC Bareilly", health: "Online", lastPing: "45 sec ago", firmware: "v3.2.1" },
  { id: "MTR1012", city: "Mathura", area: "Dhamnode", risk: "Low", score: 0.12, kwh: 15.3, delta: -2, time: "6 hours ago", reason: "Normal consumption within expected range", why: ["Usage is within the normal historical range.", "No anomalies detected in day/night consumption split."], status: "Normal", installed: "2023-06-20", type: "1-Phase", provider: "CESC Mathura", health: "Online", lastPing: "3 min ago", firmware: "v3.2.1" },
  { id: "MTR1014", city: "Bareilly", area: "Rajendra Nagar", risk: "Low", score: 0.19, kwh: 22.8, delta: 3, time: "5 hours ago", reason: "Pattern returned to expected range", why: ["Recent usage remains consistent with historical consumption.", "No material deviation from comparable nearby meters was found."], status: "Normal", installed: "2023-01-10", type: "3-Phase", provider: "CESC Bareilly", health: "Online", lastPing: "2 min ago", firmware: "v3.2.1" },
  { id: "MTR1015", city: "Bareilly", area: "Aftab Colony", risk: "High", score: 0.82, kwh: 7.1, delta: -55, time: "25 min ago", reason: "Consistent downward trend over 5 days", why: ["Consumption has declined steadily over the past 5 days.", "Current usage is 55% below the 30-day average.", "Day-time consumption is disproportionately low.", "Similar meters in the area show stable patterns."], status: "Priority Review", installed: "2022-01-12", type: "3-Phase", provider: "CESC Bareilly", health: "Online", lastPing: "1 min ago", firmware: "v3.2.0" },
  { id: "MTR1020", city: "Mathura", area: "Chhatikara", risk: "Low", score: 0.08, kwh: 19.7, delta: 1, time: "4 hours ago", reason: "Normal consumption pattern", why: ["Usage is within expected historical range.", "No deviations from similar nearby meters."], status: "Normal", installed: "2023-08-15", type: "1-Phase", provider: "CESC Mathura", health: "Online", lastPing: "5 min ago", firmware: "v3.2.1" },
  { id: "MTR1021", city: "Bareilly", area: "Nainital Road", risk: "Low", score: 0.15, kwh: 24.3, delta: -3, time: "2 hours ago", reason: "Stable consumption within range", why: ["Recent usage is consistent with historical data.", "No abnormal patterns detected."], status: "Normal", installed: "2023-04-20", type: "1-Phase", provider: "CESC Bareilly", health: "Online", lastPing: "1 min ago", firmware: "v3.2.1" },
  { id: "MTR1022", city: "Mathura", area: "Auth", risk: "Medium", score: 0.58, kwh: 12.1, delta: -28, time: "45 min ago", reason: "Gradual decline over 4 days", why: ["Consumption decreased 28% over 4 days.", "Pattern differs from seasonal expectations.", "Nearby meters show stable consumption."], status: "Flagged", installed: "2021-12-01", type: "3-Phase", provider: "CESC Mathura", health: "Online", lastPing: "2 min ago", firmware: "v3.2.0" },
  { id: "MTR1023", city: "Bareilly", area: "Bhojipura", risk: "Low", score: 0.22, kwh: 21.5, delta: 4, time: "3 hours ago", reason: "Consumption within normal range", why: ["Usage is consistent with historical patterns.", "No anomalies detected."], status: "Normal", installed: "2023-02-14", type: "1-Phase", provider: "CESC Bareilly", health: "Online", lastPing: "4 min ago", firmware: "v3.2.1" },
  { id: "MTR1025", city: "Mathura", area: "Farah", risk: "High", score: 0.88, kwh: 3.8, delta: -72, time: "5 min ago", reason: "Severe consumption drop", why: ["Consumption dropped 72% in 48 hours.", "Meter shows near-zero usage.", "Similar meters in the area are normal.", "Smart sensor flagged potential tampering."], status: "Priority Review", installed: "2020-06-10", type: "3-Phase", provider: "CESC Mathura", health: "Faulty", lastPing: "12 min ago", firmware: "v3.1.5" },
  { id: "MTR1030", city: "Bareilly", area: "Izatnagar", risk: "Low", score: 0.11, kwh: 28.9, delta: 2, time: "1 hour ago", reason: "Normal consumption", why: ["Usage is within expected range.", "No deviations detected."], status: "Normal", installed: "2023-05-18", type: "1-Phase", provider: "CESC Bareilly", health: "Offline", lastPing: "2 hours ago", firmware: "v3.2.0" },
  { id: "MTR1035", city: "Mathura", area: "Mathura Cantt", risk: "Medium", score: 0.62, kwh: 16.4, delta: -19, time: "2 hours ago", reason: "Moderate consumption decline", why: ["Usage declined 19% from baseline.", "Pattern differs from similar meters."], status: "Flagged", installed: "2022-08-25", type: "3-Phase", provider: "CESC Mathura", health: "Online", lastPing: "3 min ago", firmware: "v3.2.1" },
];

export const alerts = [
  { id: "ALT001", meter: "MTR1005", type: "Critical", message: "Near-zero consumption detected", time: "12 min ago", priority: "High", assignedTo: null, status: "Open" },
  { id: "ALT002", meter: "MTR1025", type: "Critical", message: "Severe consumption drop + sensor tamper flag", time: "5 min ago", priority: "High", assignedTo: "Rajesh Kumar", status: "Investigating" },
  { id: "ALT003", meter: "MTR1003", type: "Warning", message: "Sharp 3-day consumption decline", time: "8 min ago", priority: "High", assignedTo: null, status: "Open" },
  { id: "ALT004", meter: "MTR1015", type: "Warning", message: "5-day downward trend detected", time: "25 min ago", priority: "High", assignedTo: "Priya Singh", status: "Investigating" },
  { id: "ALT005", meter: "MTR1001", type: "Warning", message: "Unusual overnight consumption pattern", time: "3 hours ago", priority: "Medium", assignedTo: null, status: "Open" },
  { id: "ALT006", meter: "MTR1008", type: "Info", message: "22% consumption spike detected", time: "1 hour ago", priority: "Medium", assignedTo: null, status: "Open" },
  { id: "ALT007", meter: "MTR1022", type: "Info", message: "Gradual 4-day decline", time: "45 min ago", priority: "Medium", assignedTo: "Rajesh Kumar", status: "Investigating" },
  { id: "ALT008", meter: "MTR1035", type: "Info", message: "Moderate consumption decline", time: "2 hours ago", priority: "Low", assignedTo: null, status: "Open" },
  { id: "ALT009", meter: "MTR1030", type: "System", message: "Meter offline for 2+ hours", time: "2 hours ago", priority: "Medium", assignedTo: null, status: "Open" },
  { id: "ALT010", meter: "MTR1025", type: "System", message: "Firmware update required (v3.1.5 → v3.2.1)", time: "1 day ago", priority: "Low", assignedTo: "IT Team", status: "Resolved" },
];

export const investigators = [
  { name: "Rajesh Kumar", role: "Senior Analyst", assigned: 2, resolved: 14 },
  { name: "Priya Singh", role: "Analyst", assigned: 1, resolved: 9 },
  { name: "IT Team", role: "System Admin", assigned: 0, resolved: 22 },
];

export const consumptionHistory = [
  { time: "00:00", kwh: 12.4 }, { time: "02:00", kwh: 8.1 }, { time: "04:00", kwh: 6.3 },
  { time: "06:00", kwh: 9.7 }, { time: "08:00", kwh: 18.2 }, { time: "10:00", kwh: 24.5 },
  { time: "12:00", kwh: 28.1 }, { time: "14:00", kwh: 26.3 }, { time: "16:00", kwh: 22.8 },
  { time: "18:00", kwh: 19.4 }, { time: "20:00", kwh: 15.6 }, { time: "22:00", kwh: 13.2 },
];

export const forecastData = [
  { time: "00:00", kwh: 12.4, type: "actual" }, { time: "02:00", kwh: 8.1, type: "actual" },
  { time: "04:00", kwh: 6.3, type: "actual" }, { time: "06:00", kwh: 9.7, type: "actual" },
  { time: "08:00", kwh: 18.2, type: "actual" }, { time: "10:00", kwh: 24.5, type: "actual" },
  { time: "12:00", kwh: 28.1, type: "actual" }, { time: "14:00", kwh: 22.0, type: "forecast" },
  { time: "16:00", kwh: 19.5, type: "forecast" }, { time: "18:00", kwh: 17.2, type: "forecast" },
  { time: "20:00", kwh: 14.8, type: "forecast" }, { time: "22:00", kwh: 11.3, type: "forecast" },
];

export const weeklyConsumption = [
  { day: "Mon", kwh: 82.4 }, { day: "Tue", kwh: 78.1 }, { day: "Wed", kwh: 85.7 },
  { day: "Thu", kwh: 91.2 }, { day: "Fri", kwh: 88.6 }, { day: "Sat", kwh: 76.3 },
  { day: "Sun", kwh: 86.4 },
];

export const cityStats = {
  Mathura: { meters: 6320, mwh: 61.8, analyzed: 47, flagged: 14 },
  Bareilly: { meters: 6160, mwh: 54.6, analyzed: 38, flagged: 13 },
};

export const areaRiskMap = [
  { area: "Krishna Nagar", city: "Mathura", risk: 0.73, meters: 340 },
  { area: "Govind Nagar", city: "Mathura", risk: 0.86, meters: 280 },
  { area: "Vrindavan Road", city: "Mathura", risk: 0.91, meters: 420 },
  { area: "Dhamnode", city: "Mathura", risk: 0.12, meters: 190 },
  { area: "Chhatikara", city: "Mathura", risk: 0.08, meters: 310 },
  { area: "Auth", city: "Mathura", risk: 0.58, meters: 260 },
  { area: "Farah", city: "Mathura", risk: 0.88, meters: 180 },
  { area: "Mathura Cantt", city: "Mathura", risk: 0.62, meters: 350 },
  { area: "Civil Lines", city: "Bareilly", risk: 0.28, meters: 410 },
  { area: "Clock Tower", city: "Bareilly", risk: 0.67, meters: 320 },
  { area: "Rajendra Nagar", city: "Bareilly", risk: 0.19, meters: 290 },
  { area: "Aftab Colony", city: "Bareilly", risk: 0.82, meters: 250 },
  { area: "Nainital Road", city: "Bareilly", risk: 0.15, meters: 380 },
  { area: "Bhojipura", city: "Bareilly", risk: 0.22, meters: 300 },
  { area: "Izatnagar", city: "Bareilly", risk: 0.11, meters: 270 },
];
