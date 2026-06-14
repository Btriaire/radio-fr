export const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "";

export function getSpotifyRedirectUri(): string {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/spotify/callback`;
  }
  return "http://localhost:3002/api/spotify/callback";
}

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
].join(" ");

export function getSpotifyAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(),
    scope: SCOPES,
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function spotifyFetch(endpoint: string, token: string) {
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify ${res.status}: ${body}`);
  }
  return res.json();
}

export interface SpotifyShow {
  id: string;
  name: string;
  description: string;
  publisher: string;
  images: { url: string }[];
  total_episodes: number;
  external_urls: { spotify: string };
  languages: string[];
}

export interface SpotifyEpisode {
  id: string;
  name: string;
  description: string;
  duration_ms: number;
  release_date: string;
  images: { url: string }[];
  uri: string;
  external_urls: { spotify: string };
  audio_preview_url: string | null;
}

// Search shows — market=FR to get French results, no language filter (too restrictive)
export async function searchFrenchPodcasts(token: string, query: string): Promise<SpotifyShow[]> {
  const params = new URLSearchParams({
    q: query,
    type: "show",
    market: "FR",
    limit: "20",
  });
  const data = await spotifyFetch(`/search?${params}`, token);
  return data?.shows?.items ?? [];
}

export async function getShowEpisodes(token: string, showId: string): Promise<SpotifyEpisode[]> {
  const data = await spotifyFetch(`/shows/${showId}/episodes?market=FR&limit=10`, token);
  return data?.items ?? [];
}

export async function getFeaturedFrenchShows(token: string): Promise<SpotifyShow[]> {
  // Use curated French podcast query terms
  const queries = ["france culture podcast", "france inter", "france info podcast"];
  const results = await Promise.all(
    queries.map((q) => searchFrenchPodcasts(token, q).catch(() => []))
  );
  const seen = new Set<string>();
  return results
    .flat()
    .filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
    .slice(0, 20);
}

export function formatDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h${m.toString().padStart(2,"0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}
