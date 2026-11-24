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

export const anomalyService = {
  async getSummary() {
    return apiClient("/anomalies/summary");
  },

  async getStatus() {
    return apiClient("/anomalies/status");
  },

  async getAnomalies(params = {}) {
    return apiClient(`/anomalies${query(params)}`);
  },

  async getMeterAnomalies(meterId, params = {}) {
    return apiClient(
      `/anomalies/meters/${encodeURIComponent(meterId)}${query(params)}`
    );
  },
};
