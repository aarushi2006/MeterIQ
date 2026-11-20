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

export const meterService = {
  async getMeters(params = {}) {
    return apiClient(`/meters${query(params)}`);
  },

  async getMeter(meterId) {
    return apiClient(`/meters/${encodeURIComponent(meterId)}`);
  },

  async getConsumption(meterId, { start, end, resolution = "hourly" } = {}) {
    return apiClient(
      `/meters/${encodeURIComponent(meterId)}/consumption${query({
        start,
        end,
        resolution,
      })}`
    );
  },

  async getPipelineStatus() {
    return apiClient("/meters/pipeline/status");
  },

  async getHealth() {
    return apiClient("/meters/health");
  },
};
