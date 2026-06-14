// Shared podcast utilities — used by SpotifyPanel and IpodOverlay

export interface iTunesPodcast {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl600: string;
  artworkUrl100: string;
  primaryGenreName: string;
  trackCount: number;
  feedUrl: string;
  trackViewUrl: string;
  collectionId: number;
}

export interface RSSEpisode {
  title: string;
  pubDate: string;
  duration: string;
  description: string;
  audioUrl: string;   // direct MP3/audio URL for in-app playback
  fileSize: number;   // bytes, from enclosure length=""
}

// ── iTunes RSS episode fetcher ──────────────────────────────────────────
export async function getRSSEpisodes(feedUrl: string): Promise<RSSEpisode[]> {
  if (!feedUrl) return [];
  // Use our own server-side proxy — much faster than allorigins.win, avoids CORS
  const res = await fetch(`/api/rss?url=${encodeURIComponent(feedUrl)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 12);
  return items.map(item => ({
    title:       item.querySelector("title")?.textContent ?? "",
    pubDate:     item.querySelector("pubDate")?.textContent?.slice(0, 16) ?? "",
    duration:    item.querySelector("duration")?.textContent ?? "",
    description: item.querySelector("description")?.textContent?.replace(/<[^>]*>/g, "").slice(0, 140) ?? "",
    audioUrl:    item.querySelector("enclosure")?.getAttribute("url") ?? "",
    fileSize:    parseInt(item.querySelector("enclosure")?.getAttribute("length") ?? "0", 10),
  })).filter(ep => ep.audioUrl);
}

// ── iTunes lookup (resolves feedUrl for chart-feed podcasts) ─────────────
export async function lookupPodcast(collectionId: number): Promise<iTunesPodcast | null> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=podcast`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// ── In-memory episode cache (key = feedUrl or collectionId) ──────────────
export const episodeCache = new Map<string, RSSEpisode[]>();

export async function getEpisodesForPodcast(podcast: iTunesPodcast): Promise<RSSEpisode[]> {
  const cacheKey = podcast.feedUrl || String(podcast.collectionId);
  if (episodeCache.has(cacheKey)) return episodeCache.get(cacheKey)!;

  let feedUrl = podcast.feedUrl;
  if (!feedUrl && podcast.collectionId) {
    const full = await lookupPodcast(podcast.collectionId);
    feedUrl = full?.feedUrl ?? "";
  }
  if (!feedUrl) return [];

  const eps = await getRSSEpisodes(feedUrl);
  if (eps.length > 0) episodeCache.set(cacheKey, eps);
  return eps;
}
