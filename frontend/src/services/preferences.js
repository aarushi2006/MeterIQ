const STORAGE_KEY = "meteriq_preferences";

export const DEFAULT_PREFERENCES = {
  defaultRegion: "all",
  defaultRange: "7D",
  pageSize: 20,
  compactTables: false,
};

export function getPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_PREFERENCES, ...stored };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences) {
  const merged = { ...DEFAULT_PREFERENCES, ...preferences };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function resetPreferences() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_PREFERENCES };
}
