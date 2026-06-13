// Radio Browser API — free, open, no auth required
// Docs: https://api.radio-browser.info

const BASE = "https://de1.api.radio-browser.info/json";

export interface RBStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  language: string;
  votes: number;
  clickcount: number;
  bitrate: number;
  codec: string;
  homepage: string;
}

export async function searchFrenchRadios(query: string): Promise<RBStation[]> {
  const params = new URLSearchParams({
    name: query,
    country: "France",
    language: "french",
    limit: "30",
    order: "clickcount",
    reverse: "true",
    hidebroken: "true",
  });
  const res = await fetch(`${BASE}/stations/search?${params}`, {
    headers: { "User-Agent": "RadioFR/1.0" },
  });
  if (!res.ok) throw new Error("Radio Browser API error");
  return res.json();
}

export async function getTopFrenchRadios(): Promise<RBStation[]> {
  const params = new URLSearchParams({
    country: "France",
    limit: "50",
    order: "clickcount",
    reverse: "true",
    hidebroken: "true",
  });
  const res = await fetch(`${BASE}/stations/search?${params}`, {
    headers: { "User-Agent": "RadioFR/1.0" },
  });
  if (!res.ok) throw new Error("Radio Browser API error");
  return res.json();
}

export async function getStationLogo(stationName: string): Promise<string | null> {
  const params = new URLSearchParams({
    name: stationName,
    country: "France",
    limit: "1",
    hidebroken: "true",
  });
  const res = await fetch(`${BASE}/stations/search?${params}`, {
    headers: { "User-Agent": "RadioFR/1.0" },
  });
  if (!res.ok) return null;
  const data: RBStation[] = await res.json();
  return data?.[0]?.favicon || null;
}

export function rbStationToStation(rb: RBStation) {
  return {
    id: rb.stationuuid,
    name: rb.name,
    tagline: [rb.tags].filter(Boolean).join(" · ").slice(0, 40) || "Radio française",
    streamUrl: rb.url_resolved,
    logo: rb.favicon || "",
    color: stringToColor(rb.name),
    genre: rb.tags?.split(",")[0]?.trim() || "Radio",
    freq: undefined as string | undefined,
    votes: rb.votes,
    clickcount: rb.clickcount,
  };
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899",
    "#f59e0b", "#10b981", "#ef4444", "#f97316",
    "#6366f1", "#14b8a6", "#e11d48", "#7c3aed",
  ];
  return colors[Math.abs(hash) % colors.length];
}
