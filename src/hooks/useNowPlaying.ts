"use client";
import { useState, useEffect, useRef } from "react";
import { Station, preferredStreamUrl, isConstrainedNetwork } from "@/lib/stations";

export interface NowPlayingInfo {
  songTitle: string | null;
  songArtist: string | null;
  rawTitle: string | null;
  stationTitle: string | null;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 12000;
// Sur réseau lent / économiseur de données : moins de requêtes, la bande
// passante va d'abord au flux audio.
const POLL_INTERVAL_CONSTRAINED_MS = 30000;

export function useNowPlaying(station: Station | null, isPlaying: boolean): NowPlayingInfo {
  const [info, setInfo] = useState<NowPlayingInfo>({
    songTitle: null,
    songArtist: null,
    rawTitle: null,
    stationTitle: null,
    isLoading: false,
  });

  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!station || !isPlaying) {
      setInfo({
        songTitle: null,
        songArtist: null,
        rawTitle: null,
        stationTitle: null,
        isLoading: false,
      });
      activeUrlRef.current = null;
      return;
    }

    const streamUrl = preferredStreamUrl(station);
    activeUrlRef.current = streamUrl;
    let isCancelled = false;

    const fetchMetadata = async (isFirst = false) => {
      if (isCancelled || activeUrlRef.current !== streamUrl) return;
      if (isFirst) {
        setInfo((prev) => ({ ...prev, isLoading: true }));
      }

      try {
        const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(10000)
          : undefined;
        const res = await fetch(`/api/now-playing?url=${encodeURIComponent(streamUrl)}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!isCancelled && activeUrlRef.current === streamUrl) {
          setInfo({
            songTitle: data.title || null,
            songArtist: data.artist || null,
            rawTitle: data.raw || null,
            stationTitle: data.station || null,
            isLoading: false,
          });
        }
      } catch {
        if (!isCancelled && activeUrlRef.current === streamUrl) {
          setInfo((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    // First fetch immediately
    fetchMetadata(true);

    // Polling (12 s, 30 s sur réseau contraint) — uniquement écran visible
    let interval: ReturnType<typeof setTimeout>;
    const schedule = () => {
      interval = setTimeout(() => {
        if (document.visibilityState === "visible") fetchMetadata(false);
        schedule();
      }, isConstrainedNetwork() ? POLL_INTERVAL_CONSTRAINED_MS : POLL_INTERVAL_MS);
    };
    schedule();

    // Also fetch on tab becoming visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMetadata(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isCancelled = true;
      clearTimeout(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [station?.id, isPlaying]);

  return info;
}
