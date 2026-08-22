import { NextRequest, NextResponse } from "next/server";

// Jamendo search — a third free & legal source alongside Audius and the Internet
// Archive. Jamendo hosts 600k+ Creative-Commons tracks, FULL-LENGTH, with direct
// MP3 stream URLs (no DRM) — so unlike a YouTube embed these play straight through
// our Web Audio graph (EQ, crossfade, DJ FX) via /api/audio.
//
// Auth: Jamendo needs a (free) client_id. We read JAMENDO_CLIENT_ID from the env
// and fall back to the public demo id published in Jamendo's own API docs so the
// feature works out of the box; set your own key in Vercel for production quota.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.JAMENDO_CLIENT_ID || "2c9a11b9";

interface JamendoTrack {
  id: string; title: string; artist: string; artwork: string;
  duration: number; genre: string; playCount: number; streamUrl: string;
  source: "jamendo";
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  try {
    // namesearch matches track/artist/album names; mp32 = higher-quality VBR MP3.
    const url =
      `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}` +
      `&format=json&limit=40&audioformat=mp32&include=musicinfo` +
      `&order=popularity_total&namesearch=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ error: `jamendo ${res.status}` }, { status: 502 });
    const data = await res.json();
    if (data?.headers?.status !== "success") {
      return NextResponse.json({ tracks: [] });
    }
    const tracks: JamendoTrack[] = (data.results ?? [])
      .filter((t: any) => t?.audio)
      .map((t: any): JamendoTrack => ({
        id: `jam_${t.id}`,
        title: String(t.name || "").slice(0, 140),
        artist: String(t.artist_name || "Jamendo").slice(0, 80),
        artwork: t.album_image || t.image || "",
        duration: Math.round(t.duration ?? 0),
        genre: t.musicinfo?.tags?.genres?.[0] || "Jamendo",
        playCount: 0,
        streamUrl: t.audio,
        source: "jamendo",
      }));
    return NextResponse.json({ tracks });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "timeout" : e?.message ?? "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
