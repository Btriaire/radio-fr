import { NextRequest, NextResponse } from "next/server";

// Server-side audio proxy for podcast episodes. Solves three problems that hit
// in-browser playback (but not native podcast apps, which is why other apps work):
//   1. Mixed content — many RSS enclosures are http://, blocked on our https site.
//   2. CORS — most podcast CDNs don't send Access-Control-Allow-Origin, which our
//      <audio crossOrigin="anonymous"> (needed for the EQ) requires.
//   3. Some feeds gate by origin/IP; routing through the server normalises it.
// We forward Range requests so seeking + iOS byte-range playback keep working,
// and stream the body straight through (never buffer a whole MP3 in memory).
//
// Edge runtime: purpose-built for streaming passthrough and has no fixed CPU
// duration cap, so it won't sever a 40-minute episode the way a serverless
// function (or an AbortSignal timeout) would.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "bad protocol" }, { status: 400 });
  }

  const range = req.headers.get("range") ?? undefined;

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RadioFR/1.0; podcast player)",
        Accept: "audio/*,*/*",
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
      // No AbortSignal timeout: it would abort mid-stream and cut playback.
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    // Pass through only the headers the audio element needs for streaming/seeking.
    const headers = new Headers();
    const copy = (h: string) => {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    };
    copy("content-length");
    copy("content-range");
    copy("accept-ranges");
    headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
    // CRITICAL: never let the edge CDN cache this. iOS Safari's first media probe
    // is a 2-byte `Range: bytes=0-1` content-sniff. With a cacheable response and
    // no per-Range variance, Vercel's CDN stored that 206 `bytes 0-1` body and then
    // replayed it for *every* later request — including the real `bytes=0-` playback
    // fetch — so the audio element only ever received 2 bytes and stayed silent
    // (radio was fine: it streams direct URLs, not this proxy). no-store forces each
    // Range request straight to upstream; Vary: Range is belt-and-suspenders.
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("Vary", "Range");
    headers.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(upstream.body, {
      status: upstream.status, // 200 full or 206 partial
      headers,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 502 });
  }
}
