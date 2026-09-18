/**
 * Listening history manager with circular buffer and local persistence.
 * Designed and sequenced in collaboration with Falken-Smart.
 */

export interface HistoryItem {
  id: string;
  stationId: string;
  stationName: string;
  title: string;
  artist?: string | null;
  timestamp: number;
}

const STORAGE_KEY = "radiofr_track_history";
const DEFAULT_MAX_ITEMS = 60;

/**
 * Parses raw metadata string (e.g. "Artist - Title" or "Title") into structured parts.
 */
export function parseTrackString(raw: string): { title: string; artist?: string } {
  if (!raw || typeof raw !== "string") {
    return { title: "" };
  }

  // Clean common noise
  const cleaned = raw
    .replace(/^AD\s*\|\s*/i, "")
    .replace(/\s*-\s*radio\s*$/i, "")
    .trim();

  // Look for " - " delimiter
  const parts = cleaned.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    return { artist, title: title || artist };
  }

  return { title: cleaned };
}

/**
 * Returns saved track history from localStorage.
 */
export function getTrackHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Adds an item to the track history, deduplicating consecutive titles per station.
 */
export function saveTrackHistory(
  item: Omit<HistoryItem, "id" | "timestamp">,
  maxItems = DEFAULT_MAX_ITEMS
): HistoryItem[] {
  if (typeof window === "undefined") return [];
  if (!item.title || item.title.trim().length === 0) return getTrackHistory();

  try {
    const current = getTrackHistory();

    // Deduplicate if previous track on same station has the same title within 5 minutes
    const latest = current[0];
    if (
      latest &&
      latest.stationId === item.stationId &&
      latest.title.trim().toLowerCase() === item.title.trim().toLowerCase()
    ) {
      return current;
    }

    const parsed = parseTrackString(item.title);
    const newItem: HistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stationId: item.stationId,
      stationName: item.stationName,
      title: parsed.title,
      artist: item.artist || parsed.artist,
      timestamp: Date.now(),
    };

    const updated = [newItem, ...current].slice(0, maxItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears the history from storage.
 */
export function clearTrackHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Case-insensitive search across track title, artist and station name.
 */
export function searchTrackHistory(query: string): HistoryItem[] {
  if (!query || !query.trim()) return getTrackHistory();
  const q = query.trim().toLowerCase();
  return getTrackHistory().filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(q);
    const artistMatch = item.artist?.toLowerCase().includes(q) ?? false;
    const stationMatch = item.stationName.toLowerCase().includes(q);
    return titleMatch || artistMatch || stationMatch;
  });
}
