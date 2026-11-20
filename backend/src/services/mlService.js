const axios = require("axios");
require("dotenv").config();

const ML_BASE_URL = (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const ML_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 60000);

class MLServiceError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.name = "MLServiceError";
    this.status = status;
    this.details = details;
  }
}

const client = axios.create({
  baseURL: ML_BASE_URL,
  timeout: ML_TIMEOUT_MS,
  headers: { Accept: "application/json" },
});

function normalizeError(error, endpoint) {
  if (error.response) {
    const data = error.response.data;
    const detail =
      (data && (data.detail || data.message)) ||
      `ML service returned ${error.response.status}`;

    return new MLServiceError(
      typeof detail === "string" ? detail : JSON.stringify(detail),
      error.response.status,
      data
    );
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new MLServiceError(
      `ML service timed out while handling ${endpoint}`,
      504
    );
  }

  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
    return new MLServiceError(
      `ML service is unreachable at ${ML_BASE_URL}`,
      503
    );
  }

  return new MLServiceError(
    error.message || `ML service request failed for ${endpoint}`,
    502
  );
}

const mlService = {
  ML_BASE_URL,

  async fetchFromML(endpoint, params = {}, options = {}) {
    try {
      const response = await client.get(endpoint, {
        params,
        timeout: options.timeout || ML_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error, endpoint);
    }
  },

  async postToML(endpoint, data = {}, options = {}) {
    try {
      const response = await client.post(endpoint, data, {
        timeout: options.timeout || ML_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error, endpoint);
    }
  },

  async checkHealth() {
    try {
      const data = await this.fetchFromML("/health", {}, { timeout: 5000 });
      return { reachable: true, ...data };
    } catch (error) {
      return { reachable: false, error: error.message, status: error.status };
    }
  },
};

module.exports = mlService;
module.exports.MLServiceError = MLServiceError;
