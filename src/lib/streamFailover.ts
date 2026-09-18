/**
 * Audio stream resilience and automatic failover engine.
 * Designed and sequenced in collaboration with Falken-Smart.
 */

export interface StreamCandidateStation {
  id: string;
  name: string;
  streamUrl: string;
  streams?: Array<{ label: string; url: string; bitrate?: string }>;
}

/**
 * Returns all ordered stream alternatives for a given station.
 * Prioritizes secure HTTPS streams and primary configured qualities.
 */
export function getAllStationStreams(station: StreamCandidateStation): string[] {
  const list: string[] = [];

  const addUrl = (url: string | undefined | null) => {
    if (!url || typeof url !== "string") return;
    const clean = url.trim();
    if (clean && !list.includes(clean)) {
      list.push(clean);
    }
  };

  // 1. Primary streamUrl
  addUrl(station.streamUrl);

  // 2. Alternate qualities from streams array
  if (Array.isArray(station.streams)) {
    for (const s of station.streams) {
      addUrl(s.url);
    }
  }

  // 3. If primary was http, add https candidate (and vice versa)
  if (station.streamUrl.startsWith("http://")) {
    addUrl(station.streamUrl.replace("http://", "https://"));
  } else if (station.streamUrl.startsWith("https://")) {
    addUrl(station.streamUrl.replace("https://", "http://"));
  }

  return list;
}

/**
 * Given a failed stream URL, returns the next candidate URL to attempt.
 * Returns null if all alternatives for the station have been exhausted.
 */
export function getNextStreamFallback(
  station: StreamCandidateStation,
  failedUrl: string
): string | null {
  const candidates = getAllStationStreams(station);
  const failedClean = failedUrl.trim();
  const currentIdx = candidates.findIndex((u) => u === failedClean);

  if (currentIdx >= 0 && currentIdx < candidates.length - 1) {
    return candidates[currentIdx + 1];
  }

  if (currentIdx === -1 && candidates.length > 0) {
    return candidates[0] !== failedClean ? candidates[0] : (candidates[1] ?? null);
  }

  return null;
}
