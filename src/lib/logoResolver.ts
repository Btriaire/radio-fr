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
