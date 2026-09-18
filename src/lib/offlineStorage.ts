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

export async function saveOfflineEpisode(
  ep: { title: string; audioUrl: string; duration: string; pubDate: string; fileSize?: number; isVideo?: boolean },
  pod: { trackName: string; artworkUrl600?: string; artworkUrl100?: string },
  onProgress?: (percent: number) => void
): Promise<void> {
  // Fetch audio blob (direct or proxied)
  let blob: Blob;
  try {
    const res = await fetch(ep.audioUrl, { mode: "cors" });
    if (!res.ok) throw new Error("CORS or stream error");
    blob = await res.blob();
  } catch {
    // Fallback via our server proxy
    const proxyUrl = `/api/audio?url=${encodeURIComponent(ep.audioUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error("Impossible de télécharger le fichier audio");
    blob = await res.blob();
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
