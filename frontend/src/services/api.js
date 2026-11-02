/**
 * MeterIQ Base API Client
 * Provides a unified async interface that can either return cached/local smart-meter
 * dataset objects or connect to a live backend REST API (e.g., Express or FastAPI).
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const USE_LIVE_API = import.meta.env.VITE_USE_LIVE_API === "true";

export async function apiClient(endpoint, options = {}) {
  if (USE_LIVE_API) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.warn(`[MeterIQ API] Fallback to local dataset for ${endpoint} due to:`, err.message);
      throw err;
    }
  }

  // Simulating network delay for realistic UI loading and skeleton states
  await new Promise((resolve) => setTimeout(resolve, 150));
  return null;
}

export const isLiveApiConfigured = () => USE_LIVE_API;
