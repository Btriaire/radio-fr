import { NextRequest, NextResponse } from "next/server";

// Server-side Spotify search using the Client-Credentials flow. No user login,
// no OAuth redirect, no dev-mode allow-list — works for every visitor. We cache
// the app token in memory until it (almost) expires. Returns shows + tracks.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
  const id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.value;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    // Spotify token endpoint shouldn't be cached by the platform.
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const type = req.nextUrl.searchParams.get("type") || "show,track";
  if (!q) return NextResponse.json({ shows: [], tracks: [] });

  const token = await getAppToken();
  if (!token) {
    return NextResponse.json(
      { error: "spotify_not_configured" },
      { status: 503 }
    );
  }

  // Spotify apps in Development mode cap the search limit low (~10), so stay at
  // 10 to avoid an "Invalid limit" 400 regardless of how many types we query.
  const params = new URLSearchParams({
    q,
    type,
    market: "FR",
    limit: "10",
  });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: "search_failed", detail }, { status: res.status });
  }
  const data = await res.json();

  // Trim the payload to what the client actually renders.
  const shows = (data.shows?.items ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    publisher: s.publisher,
    description: s.description,
    image: s.images?.[0]?.url ?? "",
    totalEpisodes: s.total_episodes,
    url: s.external_urls?.spotify ?? "",
  }));
  const tracks = (data.tracks?.items ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artist: (t.artists ?? []).map((a: any) => a.name).join(", "),
    album: t.album?.name ?? "",
    image: t.album?.images?.[0]?.url ?? "",
    previewUrl: t.preview_url ?? null,
    url: t.external_urls?.spotify ?? "",
    durationMs: t.duration_ms ?? 0,
  }));

  return NextResponse.json({ shows, tracks });
}
