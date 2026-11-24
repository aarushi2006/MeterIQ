
import { apiClient, ApiError } from "./api";
import {
  clearSession,
  getSession,
  saveSession,
  updateSessionUser,
} from "./session";

export const authService = {
  getSession,

  getCurrentUser() {
    return getSession()?.user || null;
  },

  getToken() {
    return getSession()?.token || null;
  },

  async login(email, password, rememberMe = true) {
    const response = await apiClient("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!response?.token || !response?.user) {
      throw new ApiError("The server returned an invalid login response.", 500);
    }

    saveSession(
      { token: response.token, user: response.user },
      rememberMe
    );

    return response.user;
  },

  async validateSession() {
    const session = getSession();

    if (!session?.token) return null;

    try {
      const response = await apiClient("/auth/me");
      return updateSessionUser(response.user)?.user || null;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearSession();
        return null;
      }

      // Keep the session during temporary network failures.
      return session.user;
    }
  },

  async getUsers() {
    const response = await apiClient("/auth/users");

    return response?.users || [];
  },

  async createUser({ fullName, email, password, role }) {
    return apiClient("/auth/users", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        email,
        password,
        role,
      }),
    });
  },

  async updateUser(id, updates) {
    if (!id) {
      throw new ApiError("A valid user ID is required.", 400);
    }

    return apiClient(`/auth/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async logout() {
    try {
      if (this.getToken()) {
        await apiClient("/auth/logout", {
          method: "POST",
        });
      }
    } catch {
      // Local logout must still work if the API is unavailable.
    } finally {
      clearSession();
    }
  },

  isAdmin(user = this.getCurrentUser()) {
    return user?.role === "admin";
  },

  isSupervisor(user = this.getCurrentUser()) {
    return ["supervisor", "admin"].includes(user?.role);
  },

  hasRole(role, user = this.getCurrentUser()) {
    if (!user) return false;

    return user.role === role || user.role === "admin";
  },
};
