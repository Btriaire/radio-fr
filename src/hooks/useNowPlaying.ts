"use client";
import { useState, useEffect, useRef } from "react";
import { Station, preferredStreamUrl } from "@/lib/stations";

export interface NowPlayingInfo {
  songTitle: string | null;
  songArtist: string | null;
  rawTitle: string | null;
  stationTitle: string | null;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 12000;

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
        const res = await fetch(`/api/now-playing?url=${encodeURIComponent(streamUrl)}`);
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

    // Poll every 12 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMetadata(false);
      }
    }, POLL_INTERVAL_MS);

    // Also fetch on tab becoming visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMetadata(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [station?.id, isPlaying]);

  return info;
}
