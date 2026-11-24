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

export const investigationService = {
  async getInvestigations(params = {}) {
    return apiClient(`/investigations${query(params)}`);
  },

  async getInvestigation(id) {
    return apiClient(`/investigations/${encodeURIComponent(id)}`);
  },

  async create(payload) {
    return apiClient("/investigations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateCase(id, updates) {
    return apiClient(`/investigations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async updateStatus(id, status, resolution = null) {
    return apiClient(`/investigations/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, resolution }),
    });
  },

  async addNote(id, text) {
    return apiClient(`/investigations/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
};
