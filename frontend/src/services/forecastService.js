import { apiClient } from "./api";

export const forecastService = {
  async getMeterForecast(meterId) {
    return await apiClient(`/meters/${meterId}/forecast`);
  },

  async getForecastPerformance() {
    // This would typically call an evaluation endpoint
    // For now, we can infer it from the predictions
    return await apiClient("/pipeline/status");
  },
};
