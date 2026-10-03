// IndexedDB offline storage for live recorded audio tracks (DVR)
export interface StoredRecording {
  id: string;
  stationName: string;
  trackTitle?: string;
  timestamp: number;
  durationSec: number;
  blobSize: number;
  mimeType: string;
  blob: Blob;
}

const DB_NAME = "radiofr_recordings_db";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

function openRecordingsDB(): Promise<IDBDatabase> {
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

export async function saveRecordingToDB(item: StoredRecording): Promise<void> {
  const db = await openRecordingsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRecordingsFromDB(): Promise<StoredRecording[]> {
  try {
    const db = await openRecordingsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: StoredRecording[] = req.result || [];
        // Sort newest first
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteRecordingFromDB(id: string): Promise<void> {
  try {
    const db = await openRecordingsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
