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

    saveSession({ token: response.token, user: response.user }, rememberMe);
    return response.user;
  },

  async signup({ name, email, password, confirmPassword }) {
    if (password !== confirmPassword) {
      throw new ApiError("Passwords do not match.", 400);
    }
    if (password.length < 8) {
      throw new ApiError("Password must be at least 8 characters.", 400);
    }

    const response = await apiClient("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ fullName: name, email, password }),
    });

    if (!response?.token || !response?.user) {
      throw new ApiError("Account was created but no session was returned.", 500);
    }

    // Public signup is always an analyst; the server decides the role.
    saveSession({ token: response.token, user: response.user }, true);
    return response.user;
  },

  async validateSession() {
    const session = getSession();
    if (!session?.token) return null;

    try {
      const response = await apiClient("/auth/me");
      return updateSessionUser(response.user)?.user || null;
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        return null;
      }
      // A transient network failure should not destroy a valid stored token.
      return session.user;
    }
  },

  async logout() {
    try {
      if (this.getToken()) {
        await apiClient("/auth/logout", { method: "POST" });
      }
    } catch {
      // Local logout must still succeed if the API is unreachable.
    } finally {
      clearSession();
    }
  },

  isSupervisor(user = this.getCurrentUser()) {
    return ["supervisor", "admin"].includes(user?.role);
  },

  hasRole(role, user = this.getCurrentUser()) {
    if (!user) return false;
    return user.role === role || user.role === "admin";
  },
};
