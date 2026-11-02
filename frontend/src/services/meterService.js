import { apiClient } from "./api";

export const meterService = {
  async getMeters() {
    return await apiClient("/meters");
  },

  async getConsumption(meterId, start, end) {
    const params = new URLSearchParams();
    if (start) params.append("start", start);
    if (end) params.append("end", end);
    return await apiClient(`/meters/${meterId}/consumption?${params.toString()}`);
  },

  async getPipelineStatus() {
    return await apiClient("/pipeline/status");
  },
};
