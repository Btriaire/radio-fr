export const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "";
export const SPOTIFY_REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/spotify/callback`
    : "http://localhost:3000/api/spotify/callback";

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
].join(" ");

export function getSpotifyAuthUrl() {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SCOPES,
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function fetchSpotifyAPI(
  endpoint: string,
  token: string,
  options: RequestInit = {}
) {
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  if (res.status === 204) return null;
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
}

export async function searchFrenchPodcasts(token: string, query = "france") {
  const data = await fetchSpotifyAPI(
    `/search?q=${encodeURIComponent(query)}&type=show&market=FR&limit=20`,
    token
  );
  return (data?.shows?.items ?? []) as SpotifyShow[];
}

export async function getShowEpisodes(token: string, showId: string) {
  const data = await fetchSpotifyAPI(
    `/shows/${showId}/episodes?market=FR&limit=10`,
    token
  );
  return (data?.items ?? []) as SpotifyEpisode[];
}

export function formatDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
