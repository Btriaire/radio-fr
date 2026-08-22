import { NextRequest, NextResponse } from "next/server";

// YouTube search (titles only) via the OFFICIAL YouTube Data API v3. Playback is
// done client-side through the official IFrame Player API (hidden, audio-only) —
// we never extract or proxy the underlying media stream (that would violate
// YouTube's ToS). This route just returns searchable titles + video ids.
//
// Auth: needs a free API key. Set YOUTUBE_API_KEY in the env (Vercel). Without it
// the route returns an empty list so nothing else breaks.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = process.env.YOUTUBE_API_KEY || "";

interface YouTubeTrack {
  id: string; title: string; artist: string; artwork: string;
  duration: number; genre: string; playCount: number; streamUrl: string;
  source: "youtube";
}

// Minimal HTML-entity decode — the search API returns titles like "A &amp; B".
function decode(s: string): string {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// ISO-8601 (PT#H#M#S) → seconds.
function isoToSec(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });
  if (!KEY) return NextResponse.json({ tracks: [], note: "no_key" });

  try {
    // 1) Search (Music category = 10) for matching videos.
    const sUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&videoCategoryId=10&maxResults=20&q=${encodeURIComponent(q)}&key=${KEY}`;
    const sRes = await fetch(sUrl, { signal: AbortSignal.timeout(8000) });
    if (!sRes.ok) return NextResponse.json({ error: `youtube ${sRes.status}` }, { status: 502 });
    const sData = await sRes.json();
    const items: any[] = sData?.items ?? [];
    const ids = items.map((it) => it?.id?.videoId).filter(Boolean);
    if (!ids.length) return NextResponse.json({ tracks: [] });

    // 2) Resolve durations (+ view counts) in one batched call.
    const durById: Record<string, { dur: number; views: number }> = {};
    try {
      const vUrl =
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics` +
        `&id=${ids.join(",")}&key=${KEY}`;
      const vRes = await fetch(vUrl, { signal: AbortSignal.timeout(8000) });
      if (vRes.ok) {
        const vData = await vRes.json();
        for (const v of vData?.items ?? []) {
          durById[v.id] = {
            dur: isoToSec(v?.contentDetails?.duration),
            views: Number(v?.statistics?.viewCount || 0),
          };
        }
      }
    } catch { /* durations are best-effort */ }

    const tracks: YouTubeTrack[] = items
      .filter((it) => it?.id?.videoId)
      .map((it): YouTubeTrack => {
        const vid = it.id.videoId;
        const sn = it.snippet || {};
        const th = sn.thumbnails || {};
        return {
          id: `yt_${vid}`,
          title: decode(sn.title).slice(0, 140),
          artist: decode(sn.channelTitle).slice(0, 80) || "YouTube",
          artwork: th.high?.url || th.medium?.url || th.default?.url || "",
          duration: durById[vid]?.dur ?? 0,
          genre: "YouTube",
          playCount: durById[vid]?.views ?? 0,
          streamUrl: vid, // the video id; the IFrame player loads it client-side
          source: "youtube",
        };
      });
    return NextResponse.json({ tracks });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "timeout" : e?.message ?? "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
