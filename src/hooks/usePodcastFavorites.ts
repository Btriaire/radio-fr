"use client";
import { useState, useEffect, useCallback } from "react";
import { iTunesPodcast } from "@/lib/podcastUtils";

const KEY = "radiofr_pod_favorites";

// A podcast's stable identity across the iTunes chart / search / Spotify bridge.
export function podKey(p: iTunesPodcast): string {
  return String(p.collectionId || p.trackId || p.feedUrl || p.trackName);
}

export function usePodcastFavorites() {
  const [favorites, setFavorites] = useState<iTunesPodcast[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (list: iTunesPodcast[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  };

  const isFavorite = useCallback(
    (p: iTunesPodcast) => favorites.some((f) => podKey(f) === podKey(p)),
    [favorites]
  );

  const toggleFavorite = useCallback((p: iTunesPodcast) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => podKey(f) === podKey(p));
      const next = exists
        ? prev.filter((f) => podKey(f) !== podKey(p))
        : [{ ...p }, ...prev];
      persist(next);
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
