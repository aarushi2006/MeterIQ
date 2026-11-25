import { apiClient } from "./api";

export const forecastService = {
  async getMeta() {
    return apiClient("/forecast/meta");
  },

  async getForecast(meterId, horizon = 24, start) {
    return apiClient(
      `/forecast?meterId=${encodeURIComponent(meterId)}&horizon=${encodeURIComponent(
        horizon
      )}${start ? `&start=${encodeURIComponent(start)}` : ""}`
    );
  },
};
