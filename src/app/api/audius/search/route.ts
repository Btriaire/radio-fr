import { NextRequest, NextResponse } from "next/server";

// Audius search — legal, free, full-length track streaming (no DRM → works
// through our Web Audio EQ). Audius is decentralised: we first ask the registry
// (api.audius.co) for a live discovery node, cache it, then search + build a
// direct stream URL for each track. The client plays that URL through /api/audio
// so Range/seek + CORS are handled uniformly with podcasts.

const APP = "RadioFR";
let cachedHost: { value: string; at: number } | null = null;

async function getHost(): Promise<string | null> {
  if (cachedHost && Date.now() - cachedHost.at < 10 * 60 * 1000) return cachedHost.value;
  try {
    const res = await fetch("https://api.audius.co", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return cachedHost?.value ?? null;
    const data = await res.json();
    const hosts: string[] = data.data ?? [];
    if (!hosts.length) return cachedHost?.value ?? null;
    const host = hosts[Math.floor(Math.random() * hosts.length)];
    cachedHost = { value: host, at: Date.now() };
    return host;
  } catch {
    return cachedHost?.value ?? null;
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  const host = await getHost();
  if (!host) return NextResponse.json({ error: "audius_unavailable" }, { status: 503 });

  try {
    const url = `${host}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=${APP}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ error: `audius ${res.status}` }, { status: 502 });
    const data = await res.json();
    const tracks = (data.data ?? [])
      .filter((t: any) => t?.is_streamable !== false && !t?.is_delete)
      .slice(0, 40)
      .map((t: any) => ({
        id: t.id,
        title: t.title ?? "",
        artist: t.user?.name || t.user?.handle || "",
        artwork: t.artwork?.["480x480"] || t.artwork?.["150x150"] || "",
        duration: t.duration ?? 0,
        genre: t.genre ?? "",
        playCount: t.play_count ?? 0,
        streamUrl: `${host}/v1/tracks/${t.id}/stream?app_name=${APP}`,
      }));
    return NextResponse.json({ tracks });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "timeout" : e?.message ?? "error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
