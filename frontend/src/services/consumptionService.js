import { apiClient } from "./api";

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      search.append(key, value);
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const consumptionService = {
  async getConsumption({ range = "7D", region = "all", meterId = "all" } = {}) {
    return apiClient(
      `/analytics/consumption${query({ range, region, meterId })}`
    );
  },

  async getDiurnal(region = "all") {
    return apiClient(`/analytics/diurnal${query({ region })}`);
  },

  async getRegionalStats() {
    return apiClient("/analytics/regional");
  },

  async getDataQuality() {
    return apiClient("/analytics/data-quality");
  },
};
