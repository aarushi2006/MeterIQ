import { clearSession, getToken } from "./session";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050/api"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function readBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  const text = await response.text().catch(() => "");
  return text || null;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders(),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new ApiError(
      "Cannot reach the MeterIQ API. Check that the backend is running.",
      0,
      error.message
    );
  }

  if (!response.ok) {
    const payload = await readBody(response);
    const message =
      (payload && (payload.message || payload.detail)) ||
      `Request failed with status ${response.status}`;

    if (response.status === 401 && token && !endpoint.startsWith("/auth/")) {
      clearSession();
      window.dispatchEvent(new CustomEvent("meteriq:unauthorized"));
    }

    throw new ApiError(
      typeof message === "string" ? message : JSON.stringify(message),
      response.status,
      payload
    );
  }

  if (response.status === 204) return null;
  return readBody(response);
}

export function apiClient(endpoint, options = {}) {
  return request(endpoint, options);
}

export async function apiDownload(endpoint) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: authHeaders(),
    });
  } catch (error) {
    throw new ApiError("Cannot reach the MeterIQ API.", 0, error.message);
  }

  if (!response.ok) {
    const payload = await readBody(response);
    const message =
      (payload && (payload.message || payload.detail)) ||
      `Export failed with status ${response.status}`;

    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent("meteriq:unauthorized"));
    }

    throw new ApiError(message, response.status, payload);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const blob = await response.blob();

  return {
    blob,
    filename: match ? match[1] : "meteriq-export.csv",
  };
}

export { API_BASE_URL };
