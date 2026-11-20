const SESSION_KEY = "meteriq_session";
const LEGACY_KEY = "meteriq_user_session";

export function getSession() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const migrated = parsed.token
          ? { token: parsed.token, user: parsed.user || parsed }
          : null;
        if (migrated) {
          storage.setItem(SESSION_KEY, JSON.stringify(migrated));
          storage.removeItem(LEGACY_KEY);
          return migrated;
        }
      }
    } catch {
      // Ignore corrupt storage and continue to the next store.
    }
  }
  return null;
}

export function saveSession(session, remember = true) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function updateSessionUser(user) {
  const session = getSession();
  if (!session) return null;
  const next = { ...session, user };
  const inLocal = Boolean(localStorage.getItem(SESSION_KEY));
  (inLocal ? localStorage : sessionStorage).setItem(
    SESSION_KEY,
    JSON.stringify(next)
  );
  return next;
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(SESSION_KEY);
    storage.removeItem(LEGACY_KEY);
  }
}

export function getToken() {
  return getSession()?.token || null;
}
