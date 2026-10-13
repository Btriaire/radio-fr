import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LyricsResponse {
  artist: string;
  title: string;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  source: string;
}

const cache = new Map<string, { data: LyricsResponse; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artist = searchParams.get("artist")?.trim();
  const title = searchParams.get("title")?.trim();

  if (!artist || !title) {
    return NextResponse.json({ error: "Missing artist or title" }, { status: 400 });
  }

  const cacheKey = `${artist.toLowerCase()}:::${title.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  }

  // 1. Try LRCLIB direct get
  try {
    const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const res = await fetch(lrcUrl, {
      headers: { "User-Agent": "RadioFR/1.0 (https://radio-fr.vercel.app)" },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.plainLyrics || data.syncedLyrics) {
        const payload: LyricsResponse = {
          artist,
          title,
          plainLyrics: data.plainLyrics || null,
          syncedLyrics: data.syncedLyrics || null,
          source: "lrclib",
        };
        cache.set(cacheKey, { data: payload, expiresAt: now + CACHE_TTL_MS });
        return NextResponse.json(payload, {
          headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
      }
    }
  } catch {}

  // 2. Try LRCLIB search fallback (for tracks with feat, remix or slight variation)
  try {
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "RadioFR/1.0" },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const match = list.find((item) => item.plainLyrics || item.syncedLyrics) || list[0];
        if (match && (match.plainLyrics || match.syncedLyrics)) {
          const payload: LyricsResponse = {
            artist,
            title,
            plainLyrics: match.plainLyrics || null,
            syncedLyrics: match.syncedLyrics || null,
            source: "lrclib-search",
          };
          cache.set(cacheKey, { data: payload, expiresAt: now + CACHE_TTL_MS });
          return NextResponse.json(payload, {
            headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
          });
        }
      }
    }
  } catch {}

  // 3. Fallback to Lyrics.ovh
  try {
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(ovhUrl, {
      headers: { "User-Agent": "RadioFR/1.0" },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.lyrics) {
        const payload: LyricsResponse = {
          artist,
          title,
          plainLyrics: data.lyrics,
          syncedLyrics: null,
          source: "lyrics.ovh",
        };
        cache.set(cacheKey, { data: payload, expiresAt: now + CACHE_TTL_MS });
        return NextResponse.json(payload, {
          headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
        });
      }
    }
  } catch {}

  return NextResponse.json({ error: "Lyrics not found", artist, title }, { status: 404 });
}
