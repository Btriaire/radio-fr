/**
 * Station logo multi-source resolver and initials generator.
 * Designed and coded with Falken-Smart.
 */

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const domainMatch = /[?&]domain=([^&]+)/.exec(url) || /ip3\/([^/]+)\.ico/.exec(url);
    if (domainMatch) return decodeURIComponent(domainMatch[1]);
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function getStationInitials(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function getLogoCandidates(logoUrl: string, domain?: string | null): string[] {
  const d = domain || extractDomain(logoUrl);
  const candidates: string[] = [];

  if (logoUrl) candidates.push(logoUrl);

  if (d) {
    const highResGoogle = `https://www.google.com/s2/favicons?domain=${d}&sz=128`;
    const ddg = `https://icons.duckduckgo.com/ip3/${d}.ico`;
    const unavatar = `https://unavatar.io/${d}?fallback=false`;

    if (!candidates.includes(highResGoogle)) candidates.push(highResGoogle);
    if (!candidates.includes(ddg)) candidates.push(ddg);
    if (!candidates.includes(unavatar)) candidates.push(unavatar);
  }

  return candidates.filter(Boolean);
}

/**
 * Martha Generative Artwork SVG Fallback Generator.
 * Creates an elegant gradient artwork with station initials when remote logos fail.
 */
export function generateGenerativeArtworkSvg(name: string, genre?: string): string {
  const init = getStationInitials(name);
  const hash = (name || "Radio").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 75) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(${hue1}, 85%, 45%)"/><stop offset="100%" stop-color="hsl(${hue2}, 90%, 25%)"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)" rx="24"/><circle cx="128" cy="128" r="64" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="6"/><text x="128" y="145" font-family="sans-serif" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">${init}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

