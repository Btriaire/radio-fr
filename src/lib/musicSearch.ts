// Unified music search across the app's free & legal streaming sources:
//   • Audius  — decentralised, full-length, no DRM
//   • Internet Archive — public-domain / Creative-Commons audio (keyless)
//   • Jamendo — 600k+ Creative-Commons tracks, full-length, direct MP3
// All return the same MusicTrack shape so callers (SongPOD list, DJ decks)
// can treat them uniformly. Streams are played through /api/audio for Range +
// CORS so they work in the Web Audio graph (EQ, DJ mixer).

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  genre: string;
  playCount: number;
  streamUrl: string; // for youtube: the bare videoId (played via IFrame API)
  source: "audius" | "archive" | "jamendo" | "youtube";
}

export async function searchAudius(query: string): Promise<MusicTrack[]> {
  const res = await fetch(`/api/audius/search?q=${encodeURIComponent(query)}`);
  if (res.status === 503) throw new Error("SongPOD momentanément indisponible.");
  if (!res.ok) throw new Error(`SongPOD ${res.status}`);
  const data = await res.json();
  return (data.tracks ?? []).map((t: MusicTrack) => ({ ...t, source: "audius" as const }));
}

export async function searchArchive(query: string): Promise<MusicTrack[]> {
  try {
    const res = await fetch(`/api/archive/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks ?? []).map((t: MusicTrack) => ({ ...t, source: "archive" as const }));
  } catch {
    return [];
  }
}

export async function searchJamendo(query: string): Promise<MusicTrack[]> {
  try {
    const res = await fetch(`/api/jamendo/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks ?? []).map((t: MusicTrack) => ({ ...t, source: "jamendo" as const }));
  } catch {
    return [];
  }
}

export async function searchYouTube(query: string): Promise<MusicTrack[]> {
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks ?? []).map((t: MusicTrack) => ({ ...t, source: "youtube" as const }));
  } catch {
    return [];
  }
}

// Round-robin interleave across all sources so each stays visible even when one
// returns many more rows than the others. YouTube is opt-in (DJ mode only) since
// it can only be played via the IFrame player, not the regular media element.
export async function searchAllMusic(
  query: string,
  opts?: { youtube?: boolean },
): Promise<MusicTrack[]> {
  const [a, b, c, y] = await Promise.allSettled([
    searchAudius(query), searchArchive(query), searchJamendo(query),
    opts?.youtube ? searchYouTube(query) : Promise.resolve([] as MusicTrack[]),
  ]);
  const au = a.status === "fulfilled" ? a.value : [];
  const ar = b.status === "fulfilled" ? b.value : [];
  const ja = c.status === "fulfilled" ? c.value : [];
  const yt = y.status === "fulfilled" ? y.value : [];
  // Only surface Audius's error if every source came up empty.
  if (a.status === "rejected" && !ar.length && !ja.length && !yt.length) throw a.reason;
  const lists = [yt, au, ja, ar]; // YouTube first (favorisé), then Audius, Jamendo, Archive
  const merged: MusicTrack[] = [];
  const max = Math.max(au.length, ar.length, ja.length, yt.length);
  for (let i = 0; i < max; i++) {
    for (const list of lists) if (list[i]) merged.push(list[i]);
  }
  return merged;
}

// ── AI auto-playlist generator (YouTube) ───────────────────────────────────
// "un peu comme Spotify mais automatiquement" — from a single theme/seed we
// fan out into several varied YouTube queries, then round-robin-merge & dedupe
// the results into one ordered playlist. NOTE: this is a deterministic query-
// expansion heuristic (no LLM key is configured), but it genuinely assembles a
// fresh, broad playlist of real, existing YouTube titles for the given theme.
export async function generateYouTubePlaylist(
  theme: string,
  opts?: { size?: number },
): Promise<MusicTrack[]> {
  const size = opts?.size ?? 24;
  const t = theme.trim();
  if (!t) return [];
  // Varied angles on the same seed → broader, less repetitive catalogue.
  const expansions = [
    t,
    `${t} best songs`,
    `${t} top hits`,
    `${t} playlist`,
    `${t} mix`,
    `meilleur ${t}`,
    `${t} classics`,
    `${t} hits`,
  ];
  const settled = await Promise.allSettled(expansions.map((q) => searchYouTube(q)));
  const lists = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  const seen = new Set<string>();
  const out: MusicTrack[] = [];
  const max = lists.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < max && out.length < size; i++) {
    for (const list of lists) {
      const tr = list[i];
      if (!tr || seen.has(tr.id)) continue;
      seen.add(tr.id);
      out.push(tr);
      if (out.length >= size) break;
    }
  }
  return out;
}

// Per-source pill styling (label + colours) for the track lists.
export function sourceBadge(source: MusicTrack["source"]): { label: string; bg: string; color: string } {
  switch (source) {
    case "archive": return { label: "ARCHIVE", bg: "rgba(168,85,247,0.18)", color: "#c084fc" };
    case "jamendo": return { label: "JAMENDO", bg: "rgba(249,115,22,0.18)", color: "#fb923c" };
    case "youtube": return { label: "YOUTUBE", bg: "rgba(239,68,68,0.18)", color: "#f87171" };
    default: return { label: "AUDIUS", bg: "rgba(34,197,94,0.16)", color: "#4ade80" };
  }
}

// Build the playable, EQ-friendly URL for a stream.
// Normally we proxy through /api/audio so Range + CORS are uniform. EXCEPTION:
// archive.org blocks Vercel's server IPs (the proxy gets HTTP 400 on /download
// and 460 on the datanodes → Archive tracks played silent). But the archive.org
// datanodes DO send `Access-Control-Allow-Origin: *` + Range to browsers, so we
// let the client fetch them DIRECTLY — that still feeds the Web Audio EQ/DJ graph
// and bypasses the IP block entirely.
export function playableUrl(streamUrl: string): string {
  if (!/^https?:\/\//i.test(streamUrl)) return streamUrl;
  try {
    if (/(^|\.)archive\.org$/i.test(new URL(streamUrl).hostname)) return streamUrl;
  } catch { /* fall through to proxy */ }
  return `/api/audio?url=${encodeURIComponent(streamUrl)}`;
}
