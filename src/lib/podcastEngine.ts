/**
 * Podcast Engine & Offline Storage System
 * Conceived by Dr Falken (VPS OmniRoute / Nemotron 3 Ultra 550B)
 * Pure TypeScript, IndexedDB persistence, network awareness, zero emoji.
 */

export interface PodcastEpisode {
  id: string;
  title: string;
  showTitle: string;
  stationId: string;
  audioUrl: string;
  duration: number; // in seconds
  publishedAt: string;
  blob?: Blob;
  isDownloaded: boolean;
  progress: number; // in seconds
  fileSize?: number;
  downloadedAt?: number;
}

export const STATION_PODCAST_FEEDS: Record<string, { showTitle: string; rssUrl: string }[]> = {
  'france-inter': [
    { showTitle: 'Le 7/9', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10010.xml' },
    { showTitle: 'Affaires Sensibles', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10012.xml' },
    { showTitle: 'La Terre au Carré', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10011.xml' },
    { showTitle: 'Le Téléphone Sonne', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10013.xml' },
  ],
  'france-culture': [
    { showTitle: 'Les Chemins de la Philosophie', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10020.xml' },
    { showTitle: 'Le Cours de l\'Histoire', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10027.xml' },
    { showTitle: 'LSD, La Série Documentaire', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10026.xml' },
  ],
  'rtl': [
    { showTitle: 'RTL Matin', rssUrl: 'https://rss.rtl.fr/rtl/podcasts/rtl-matin' },
    { showTitle: 'Les Grosses Têtes', rssUrl: 'https://rss.rtl.fr/rtl/podcasts/les-grosses-tetes' },
    { showTitle: 'L\'Heure du Crime', rssUrl: 'https://rss.rtl.fr/rtl/podcasts/l-heure-du-crime' },
  ],
  'europe1': [
    { showTitle: 'Europe 1 Matin', rssUrl: 'https://www.europe1.fr/rss/podcasts/europe1-matin.xml' },
    { showTitle: 'Historiquement Vôtre', rssUrl: 'https://www.europe1.fr/rss/podcasts/historiquement-votre.xml' },
    { showTitle: 'Culture Médias', rssUrl: 'https://www.europe1.fr/rss/podcasts/culture-medias.xml' },
  ],
  'rmc': [
    { showTitle: 'Apolline Matin', rssUrl: 'https://rmc.bfmtv.com/rss/podcasts/apolline-matin.xml' },
    { showTitle: 'Les Grandes Gueules', rssUrl: 'https://rmc.bfmtv.com/rss/podcasts/les-grandes-gueules.xml' },
    { showTitle: 'L\'After Foot', rssUrl: 'https://rmc.bfmtv.com/rss/podcasts/l-after-foot.xml' },
  ],
  'fip': [
    { showTitle: 'FIP dans le Club', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10031.xml' },
    { showTitle: 'FIP Pop', rssUrl: 'https://radiofrance-podcast.net/podcast09/rss_10032.xml' },
  ],
};

const DB_NAME = 'radiofr_podcasts_db';
const STORE_NAME = 'episodes';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non supporté'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('stationId', 'stationId', { unique: false });
        store.createIndex('isDownloaded', 'isDownloaded', { unique: false });
      }
    };
  });
}

export async function getDownloadedEpisodes(stationId?: string): Promise<PodcastEpisode[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        let results = req.result as PodcastEpisode[];
        if (stationId) {
          results = results.filter((ep) => ep.stationId === stationId);
        }
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function downloadEpisode(
  episode: PodcastEpisode,
  onProgress?: (pct: number) => void
): Promise<void> {
  const response = await fetch(episode.audioUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Erreur lors du téléchargement: ${response.statusText}`);
  }

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (onProgress && total > 0) {
      onProgress(Math.round((loaded / total) * 100));
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
  const episodeToStore: PodcastEpisode = {
    ...episode,
    blob,
    isDownloaded: true,
    fileSize: loaded,
    downloadedAt: Date.now(),
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(episodeToStore);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteEpisode(episodeId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(episodeId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

export async function saveEpisodeProgress(episodeId: string, seconds: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(episodeId);
      getReq.onsuccess = () => {
        const ep = getReq.result as PodcastEpisode | undefined;
        if (!ep) {
          resolve();
          return;
        }
        ep.progress = seconds;
        const putReq = store.put(ep);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {}
}

export async function checkStorageAndNetwork(): Promise<{
  canDownload: boolean;
  freeSpaceMb: number;
  isWifiOrFast: boolean;
}> {
  let freeSpaceMb = 500;
  let canDownload = true;

  if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage) {
        freeSpaceMb = Math.floor((estimate.quota - estimate.usage) / (1024 * 1024));
        canDownload = freeSpaceMb > 50;
      }
    } catch {}
  }

  let isWifiOrFast = true;
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string; saveData?: boolean } }).connection;
    if (connection) {
      if (connection.saveData) {
        isWifiOrFast = false;
        canDownload = false;
      } else {
        isWifiOrFast = connection.type === 'wifi' || connection.effectiveType === '4g';
      }
    }
  }

  return { canDownload, freeSpaceMb, isWifiOrFast };
}

export function createEpisodeAudioUrl(episode: PodcastEpisode): string {
  if (episode.isDownloaded && episode.blob) {
    return URL.createObjectURL(episode.blob);
  }
  return episode.audioUrl;
}
