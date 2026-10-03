// IndexedDB offline storage for podcasts (browser-native, unlimited quota)
export interface OfflineEpisode {
  id: string;              // audioUrl as unique key
  audioUrl: string;        // original stream URL
  title: string;
  podcastName: string;
  artwork: string;
  duration: string;
  pubDate: string;
  sizeBytes: number;
  downloadedAt: number;
  blob: Blob;
}

const DB_NAME = "radiofr_offline_podcasts_db";
const STORE_NAME = "episodes";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non disponible"));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Key for auto-download preference (e.g. auto-download new episodes of favorite podcasts)
export const AUTO_DOWNLOAD_KEY = "radiofr_auto_download_favs";

export function isAutoDownloadEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_DOWNLOAD_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoDownloadEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_DOWNLOAD_KEY, enabled ? "1" : "0");
  } catch {}
}

export async function saveOfflineEpisode(
  ep: { title: string; audioUrl: string; duration: string; pubDate: string; fileSize?: number; isVideo?: boolean },
  pod: { trackName: string; artworkUrl600?: string; artworkUrl100?: string },
  onProgress?: (percent: number) => void
): Promise<void> {
  // Fetch audio with streaming progress
  let blob: Blob;
  
  const fetchWithProgress = async (url: string): Promise<Blob> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = res.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : (ep.fileSize || 0);

    if (!res.body || totalBytes <= 0) {
      if (onProgress) onProgress(50);
      return await res.blob();
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        if (totalBytes > 0 && onProgress) {
          const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
          onProgress(pct);
        }
      }
    }

    const contentType = res.headers.get("content-type") || "audio/mpeg";
    return new Blob(chunks as BlobPart[], { type: contentType });
  };

  try {
    // Try direct fetch first
    blob = await fetchWithProgress(ep.audioUrl);
  } catch {
    // Fallback to our dedicated Edge streaming proxy
    const proxyUrl = `/api/audio?url=${encodeURIComponent(ep.audioUrl)}`;
    blob = await fetchWithProgress(proxyUrl);
  }

  const db = await openDB();
  const record: OfflineEpisode = {
    id: ep.audioUrl,
    audioUrl: ep.audioUrl,
    title: ep.title,
    podcastName: pod.trackName,
    artwork: pod.artworkUrl600 || pod.artworkUrl100 || "",
    duration: ep.duration,
    pubDate: ep.pubDate,
    sizeBytes: blob.size,
    downloadedAt: Date.now(),
    blob,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => {
      if (onProgress) onProgress(100);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineEpisodes(): Promise<OfflineEpisode[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getOfflineBlobUrl(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result as OfflineEpisode | undefined;
        if (item && item.blob) {
          resolve(URL.createObjectURL(item.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteOfflineEpisode(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllOfflineEpisodes(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
