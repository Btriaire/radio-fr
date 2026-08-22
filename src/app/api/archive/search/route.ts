import { NextRequest, NextResponse } from "next/server";

// Internet Archive (archive.org) audio search — a second free & legal source
// alongside Audius. The Archive hosts a vast public-domain / Creative-Commons
// audio collection with no API key required. We hit advancedsearch for matching
// audio items, then resolve each item's first playable file via the metadata
// endpoint. The client plays the resulting URL through /api/audio (Range + CORS).

// IMPORTANT: Node runtime, NOT edge. archive.org's advancedsearch.php replies
// 400 to requests originating from Vercel's Edge network (the route then 502'd
// and Internet-Archive results never appeared — Audius looked like the only
// source). The identical request from the Node runtime succeeds, and this is a
// quick JSON search (no streaming) so Edge buys us nothing here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ArchiveTrack {
  id: string; title: string; artist: string; artwork: string;
  duration: number; genre: string; playCount: number; streamUrl: string;
  source: "archive";
}

// Prefer compressed, broadly-supported formats first.
const AUDIO_RE = /\.(mp3|ogg|oga|m4a|flac)$/i;
const PREF = ["VBR MP3", "MP3", "Ogg Vorbis", "128Kbps MP3", "64Kbps MP3"];

function pickFile(files: any[]): { name: string; length?: string } | null {
  const audio = files.filter((f) => f?.name && AUDIO_RE.test(f.name));
  if (!audio.length) return null;
  // Rank by preferred derivative format, else first audio file.
  for (const fmt of PREF) {
    const hit = audio.find((f) => (f.format || "").toLowerCase() === fmt.toLowerCase());
    if (hit) return { name: hit.name, length: hit.length };
  }
  return { name: audio[0].name, length: audio[0].length };
}

function toSeconds(len?: string): number {
  if (!len) return 0;
  if (/^\d+(\.\d+)?$/.test(len)) return Math.round(parseFloat(len));
  const parts = len.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  try {
    // Bias toward actual music: archive.org's top audio results for generic
    // terms ("Lofi", "Jazz"…) are otherwise dominated by LibriVox spoken-word
    // audiobooks. netlabels + audio_music are large Creative-Commons MUSIC
    // collections, so the DJ/SongPOD picker gets playable tracks, not narration.
    const sq = encodeURIComponent(`(${q}) AND mediatype:audio AND collection:(netlabels OR audio_music)`);
    const fl = ["identifier", "title", "creator"].map((f) => `fl[]=${f}`).join("&");
    // NOTE: the sort value MUST be URL-encoded. A raw space in "downloads desc"
    // makes archive.org reject the request with HTTP 400 (→ our route 502'd and
    // Internet-Archive results never showed, leaving Audius as the only source).
    const sort = `sort[]=${encodeURIComponent("downloads desc")}`;
    const searchUrl =
      `https://archive.org/advancedsearch.php?q=${sq}&${fl}` +
      `&${sort}&rows=20&page=1&output=json`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ error: `archive ${res.status}` }, { status: 502 });
    const data = await res.json();
    const docs: any[] = data?.response?.docs ?? [];
    if (!docs.length) return NextResponse.json({ tracks: [] });

    // Resolve each item's first playable file (in parallel, best-effort).
    const settled = await Promise.allSettled(
      docs.map(async (d): Promise<ArchiveTrack | null> => {
        const id = d.identifier;
        const metaRes = await fetch(`https://archive.org/metadata/${id}`, { signal: AbortSignal.timeout(7000) });
        if (!metaRes.ok) return null;
        const meta = await metaRes.json();
        const file = pickFile(meta?.files ?? []);
        if (!file) return null;
        const artwork = `https://archive.org/services/img/${id}`;
        const title = Array.isArray(d.title) ? d.title[0] : d.title || file.name;
        const artist = Array.isArray(d.creator) ? d.creator[0] : d.creator || "Internet Archive";
        // IMPORTANT: build the DIRECT datanode URL (server + dir from metadata),
        // NOT archive.org/download/…  The /download/ path 302-redirects, and
        // archive.org itself replies 400 to requests from Vercel's network — so
        // our /api/audio proxy (which fetches the URL server-side) got "upstream
        // 400" and the track played silent. The dnNNN/iaNNN datanode host serves
        // the file directly (HTTP 206, audio/mpeg) with no redirect, so the proxy
        // streams it fine. Fall back to /download/ only if metadata lacks host.
        const server: string = meta?.server || meta?.d1 || meta?.d2 || "";
        const dir: string = meta?.dir || "";
        const streamUrl = server && dir
          ? `https://${server}${dir}/${encodeURIComponent(file.name)}`
          : `https://archive.org/download/${id}/${encodeURIComponent(file.name)}`;
        return {
          id: `arc_${id}`,
          title: String(title || "").slice(0, 140),
          artist: String(artist || "Internet Archive").slice(0, 80),
          artwork,
          duration: toSeconds(file.length),
          genre: "Archive",
          playCount: 0,
          streamUrl,
          source: "archive",
        };
      })
    );

    const tracks = settled
      .filter((s): s is PromiseFulfilledResult<ArchiveTrack | null> => s.status === "fulfilled")
      .map((s) => s.value)
      .filter((t): t is ArchiveTrack => !!t);

    return NextResponse.json({ tracks });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "timeout" : e?.message ?? "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
