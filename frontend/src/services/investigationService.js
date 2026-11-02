import { apiClient } from "./api";
import { investigationsList } from "../data/mockData";

let localInvestigations = [...investigationsList];

export const investigationService = {
  async getInvestigations({ status = "all", region = "all", search = "" } = {}) {
    try {
      const data = await apiClient(`/investigations?status=${status}&region=${region}&search=${encodeURIComponent(search)}`);
      if (data) return data;
    } catch {
      // Fallback
    }

    return localInvestigations.filter((inv) => {
      const matchSearch =
        !search ||
        inv.id.toLowerCase().includes(search.toLowerCase()) ||
        inv.meterId.toLowerCase().includes(search.toLowerCase()) ||
        inv.reason.toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === "all" || inv.status.toLowerCase() === status.toLowerCase();
      const matchRegion = region === "all" || inv.region.toLowerCase() === region.toLowerCase();

      return matchSearch && matchStatus && matchRegion;
    });
  },

  async updateStatus(id, newStatus, resolution = null) {
    try {
      await apiClient(`/investigations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, resolution })
      });
    } catch {
      // Fallback
    }

    localInvestigations = localInvestigations.map((inv) => {
      if (inv.id === id) {
        return {
          ...inv,
          status: newStatus,
          resolution: resolution !== null ? resolution : inv.resolution,
          updatedAt: "Just now"
        };
      }
      return inv;
    });

    return localInvestigations.find((i) => i.id === id);
  },

  async addNote(id, author, text) {
    const newNote = {
      author,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    try {
      await apiClient(`/investigations/${id}/notes`, {
        method: "POST",
        body: JSON.stringify(newNote)
      });
    } catch {
      // Fallback
    }

    localInvestigations = localInvestigations.map((inv) => {
      if (inv.id === id) {
        return {
          ...inv,
          notes: [...inv.notes, newNote],
          updatedAt: "Just now"
        };
      }
      return inv;
    });

    return localInvestigations.find((i) => i.id === id);
  },

  async createInvestigationFromAnomaly(anomaly) {
    const newId = `INV-2026-${String(localInvestigations.length + 1).padStart(3, "0")}`;
    const newInv = {
      id: newId,
      meterId: anomaly.meterId || anomaly.id,
      region: anomaly.region || "Mathura",
      area: anomaly.area || "Grid Feeder",
      riskScore: anomaly.score || anomaly.riskScore || 0.75,
      riskLevel: anomaly.risk || anomaly.riskLevel || "High",
      status: "OPEN",
      detectedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      reason: anomaly.reason || anomaly.anomalyType || "Unusual consumption deviation",
      evidence: anomaly.contributingFactors
        ? typeof anomaly.contributingFactors === "string"
          ? anomaly.contributingFactors
          : anomaly.contributingFactors.map((c) => `${c.factor}: ${c.value}`).join("; ")
        : "Automated anomaly trigger",
      assignedTo: null,
      assignedRole: null,
      notes: [{ author: "System AI", text: "Investigation case manually opened from telemetry alert.", time: "Just now" }],
      resolution: null,
      updatedAt: "Just now"
    };

    localInvestigations.unshift(newInv);
    return newInv;
  }
};
