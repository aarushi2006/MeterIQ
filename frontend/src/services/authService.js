/**
 * Authentication & Session Service — FRONTEND PROTOTYPE ONLY
 * ------------------------------------------------------------------
 * There is no backend auth server yet. Accounts are registered and
 * checked entirely in the browser (localStorage), and passwords are
 * only lightly obscured (base64), NOT hashed or encrypted. This is
 * fine for a Software Engineering course prototype but must never be
 * treated as production-grade authentication.
 *
 * The public functions below (login, signup, logout, getCurrentUser)
 * are the seam where a real backend (e.g. POST /api/auth/login,
 * POST /api/auth/signup returning a JWT) can be dropped in later
 * without touching the rest of the app — callers only see
 * { ok, user } / { ok: false, error } either way.
 */

const SESSION_KEY = "meteriq_user_session";
const USERS_KEY = "meteriq_registered_users";

const ROLES = ["supervisor", "analyst"];

// Demo accounts so graders/reviewers can sign in without registering first.
const DEMO_USERS = [
  {
    name: "Yashit Arora",
    email: "yashit.supervisor@meteriq.energy",
    password: "meteriq123",
    role: "supervisor",
  },
  {
    name: "Aarushi Gahlawat",
    email: "aarushi.analyst@meteriq.energy",
    password: "meteriq123",
    role: "analyst",
  },
];

function encode(password) {
  // NOT real security — only prevents plaintext passwords sitting in
  // localStorage in an easily-greppable form during the demo.
  try {
    return btoa(unescape(encodeURIComponent(password)));
  } catch {
    return password;
  }
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to seed
  }
  const seeded = DEMO_USERS.map((u) => ({ ...u, password: encode(u.password) }));
  localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const authService = {
  ROLES,

  getCurrentUser() {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore corrupt session
    }
    return null;
  },

  /**
   * Prototype login against locally registered accounts.
   * Returns { ok: true, user } or { ok: false, error }.
   */
  login(email, password, rememberMe = false) {
    const trimmedEmail = (email || "").trim().toLowerCase();

    if (!trimmedEmail || !password) {
      return { ok: false, error: "Enter both your email and password." };
    }

    const users = loadUsers();
    const match = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (!match || match.password !== encode(password)) {
      return { ok: false, error: "Invalid email or password." };
    }

    const user = {
      name: match.name,
      email: match.email,
      role: match.role,
      loginTime: new Date().toISOString(),
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    if (rememberMe) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }

    return { ok: true, user };
  },

  /**
   * Prototype sign-up. Validates the form, checks for a duplicate
   * email against locally registered accounts, and stores the new
   * account in localStorage. Returns { ok: true, user } or
   * { ok: false, error }.
   */
  signup({ name, email, password, confirmPassword, role }) {
    const trimmedName = (name || "").trim();
    const trimmedEmail = (email || "").trim().toLowerCase();

    if (!trimmedName) return { ok: false, error: "Full name is required." };
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (!password || password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    if (!ROLES.includes(role)) {
      return { ok: false, error: "Select a role." };
    }

    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const newUser = { name: trimmedName, email: trimmedEmail, password: encode(password), role };
    users.push(newUser);
    saveUsers(users);

    return {
      ok: true,
      user: { name: newUser.name, email: newUser.email, role: newUser.role },
    };
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  },

  hasRole(requiredRole) {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === "supervisor") return true; // supervisors have broad scope
    return user.role === requiredRole;
  },
};
