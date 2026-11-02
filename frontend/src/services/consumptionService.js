import { apiClient } from "./api";
import { consumptionTrends, diurnalPatterns, cityStats } from "../data/mockData";

export const consumptionService = {
  async getConsumptionTrend(range = "7D", region = "all") {
    try {
      const data = await apiClient(`/analytics/consumption?range=${range}&region=${region}`);
      if (data) return data;
    } catch {
      // Fallback
    }

    const trend = consumptionTrends[range] || consumptionTrends["7D"];
    return trend;
  },

  async getDiurnalPatterns() {
    try {
      const data = await apiClient(`/analytics/diurnal`);
      if (data) return data;
    } catch {
      // Fallback
    }

    return diurnalPatterns;
  },

  async getRegionalStats() {
    try {
      const data = await apiClient(`/analytics/regional`);
      if (data) return data;
    } catch {
      // Fallback
    }

    return cityStats;
  }
};
