import { meters, anomaliesList, cityStats } from "../data/mockData";

export const reportService = {
  generateCsv(type = "all_meters") {
    let headers = [];
    let rows = [];

    if (type === "all_meters" || type === "high_risk") {
      headers = ["Meter_ID", "Region", "Area", "Status", "Risk_Level", "Risk_Score", "Current_kWh", "Avg_Daily_kWh", "Peak_kWh", "Provider", "Health"];
      const data = type === "high_risk" ? meters.filter((m) => m.risk === "High") : meters;
      rows = data.map((m) => [
        m.id,
        m.region,
        m.area,
        m.status,
        m.risk,
        m.score,
        m.currentKwh,
        m.avgDailyKwh,
        m.peakKwh,
        `"${m.provider}"`,
        m.health
      ]);
    } else if (type === "anomalies") {
      headers = ["Anomaly_ID", "Meter_ID", "Region", "Risk_Level", "Score", "Type", "Detected", "Status", "Action"];
      rows = anomaliesList.map((a) => [
        a.id,
        a.meterId,
        a.region,
        a.riskLevel,
        a.riskScore,
        `"${a.anomalyType}"`,
        `"${a.detectedAt}"`,
        a.status,
        `"${a.action}"`
      ]);
    } else if (type === "regional") {
      headers = ["Region", "Total_Meters", "Active_Reporting", "MWh_Today", "Avg_Daily_Per_Meter", "Peak_MW", "Load_Factor"];
      rows = Object.entries(cityStats).map(([city, s]) => [
        city,
        s.meters,
        s.activeReporting,
        s.mwhToday,
        s.avgDailyPerMeter,
        s.peakLoadMw,
        s.loadFactor
      ]);
    }

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return csvContent;
  },

  downloadCsv(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
