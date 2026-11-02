import { apiClient } from "./api";

export const anomalyService = {
  async getMeterAnomalies(meterId) {
    return await apiClient(`/meters/${meterId}/anomalies`);
  },

  async getGlobalAnomalySummary() {
    // This uses the meters endpoint to aggregate a global summary
    const meters = await apiClient("/meters");
    const totalMeters = meters.length;
    const flaggedMeters = meters.filter(m => m.risk_level !== "NORMAL").length;
    
    return {
      totalMeters,
      flaggedMeters,
      flagRate: (flaggedMeters / totalMeters * 100).toFixed(2),
    };
  },
};
