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
  audioUrl: string;   // direct MP3/audio (or MP4 video) URL for in-app playback
  fileSize: number;   // bytes, from enclosure length=""
  isVideo: boolean;   // enclosure MIME starts with video/ (e.g. video/mp4)
  mediaType: string;  // raw enclosure type attribute
}

// ── iTunes RSS episode fetcher ──────────────────────────────────────────
export async function getRSSEpisodes(feedUrl: string): Promise<RSSEpisode[]> {
  if (!feedUrl) return [];
  try {
    // AbortSignal.timeout may not exist in older browsers — fall back to no timeout
    const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(10000)
      : undefined;
    // Use our own server-side proxy — much faster than allorigins.win, avoids CORS
    const res = await fetch(`/api/rss?url=${encodeURIComponent(feedUrl)}`, { signal });
    if (!res.ok) return [];
    const xml = await res.text();
    // DOMParser is browser-only; guard for safety
    if (typeof DOMParser === "undefined") return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, 12);
    return items.map(item => {
      const enc = item.querySelector("enclosure");
      const mediaType = enc?.getAttribute("type") ?? "";
      const url = enc?.getAttribute("url") ?? "";
      const isVideo = /^video\//i.test(mediaType) || /\.(mp4|m4v|mov|webm)(\?|$)/i.test(url);
      return {
        title:       item.querySelector("title")?.textContent ?? "",
        pubDate:     item.querySelector("pubDate")?.textContent?.slice(0, 16) ?? "",
        duration:    item.querySelector("duration")?.textContent ?? "",
        description: item.querySelector("description")?.textContent?.replace(/<[^>]*>/g, "").slice(0, 140) ?? "",
        audioUrl:    url,
        fileSize:    parseInt(enc?.getAttribute("length") ?? "0", 10),
        isVideo,
        mediaType,
      };
    }).filter(ep => ep.audioUrl);
  } catch {
    return [];
  }
}

// Route Apple's iTunes API through our own origin: itunes.apple.com/search and
// /lookup send no CORS headers, so a direct browser fetch is blocked. See
// /api/itunes. Without this, chart podcasts never resolve their feedUrl and
// episode lists stay empty (so there's nothing to auto-chain).
export function itunesProxy(itunesUrl: string): string {
  return `/api/itunes?url=${encodeURIComponent(itunesUrl)}`;
}

// ── iTunes lookup (resolves feedUrl for chart-feed podcasts) ─────────────
export async function lookupPodcast(collectionId: number): Promise<iTunesPodcast | null> {
  const res = await fetch(itunesProxy(`https://itunes.apple.com/lookup?id=${collectionId}&entity=podcast`));
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// ── Resolve a playable RSS feed from a podcast NAME (Spotify→RSS bridge) ──
// Spotify doesn't expose RSS URLs, so to actually play a Spotify show we look
// it up by name in the iTunes catalog (which does carry feedUrl).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export async function resolveFeedByName(name: string): Promise<string> {
  if (!name) return "";
  try {
    const params = new URLSearchParams({
      term: name, media: "podcast", entity: "podcast", country: "FR", limit: "5",
    });
    const res = await fetch(itunesProxy(`https://itunes.apple.com/search?${params}`));
    if (!res.ok) return "";
    const data = await res.json();
    const items: iTunesPodcast[] = data.results ?? [];
    if (!items.length) return "";
    const target = norm(name);
    const exact = items.find((p) => norm((p as any).collectionName || p.trackName || "") === target);
    const starts = items.find((p) => norm((p as any).collectionName || p.trackName || "").startsWith(target));
    return (exact || starts || items[0]).feedUrl ?? "";
  } catch {
    return "";
  }
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
  // Spotify-sourced shows have no iTunes id → resolve the feed by name.
  if (!feedUrl && podcast.trackName) {
    feedUrl = await resolveFeedByName(podcast.trackName);
  }
  if (!feedUrl) return [];

  const eps = await getRSSEpisodes(feedUrl);
  if (eps.length > 0) episodeCache.set(cacheKey, eps);
  return eps;
}
