import { apiClient, apiDownload } from "./api";

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

function triggerDownload({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const reportService = {
  async getSummary() {
    return apiClient("/reports/summary");
  },

  async download(type, filters = {}) {
    const routes = {
      meters: "/reports/meters.csv",
      anomalies: "/reports/anomalies.csv",
      regional: "/reports/regional.csv",
      investigations: "/reports/investigations.csv",
    };

    const route = routes[type];
    if (!route) throw new Error(`Unknown report type: ${type}`);

    const file = await apiDownload(`${route}${query(filters)}`);
    triggerDownload(file);
    return file.filename;
  },
};
