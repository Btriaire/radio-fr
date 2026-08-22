"use client";
import { useState, useEffect, useCallback } from "react";

// Tracks which podcast episodes the user has already listened to, keyed by the
// episode's audio URL (unique & stable per episode). Persisted to localStorage
// so the "déjà écouté" state survives reloads. Stored as { url: timestamp }.
const KEY = "radiofr_played_episodes_v1";

type PlayedMap = Record<string, number>;

function load(): PlayedMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function usePlayedEpisodes() {
  const [played, setPlayed] = useState<PlayedMap>({});

  // Hydrate from localStorage on mount (client only).
  useEffect(() => { setPlayed(load()); }, []);

  const save = useCallback((next: PlayedMap) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }, []);

  const isPlayed = useCallback((id: string) => !!played[id], [played]);

  // Idempotent: marking an already-played episode is a no-op (keeps first date).
  const markPlayed = useCallback((id: string) => {
    if (!id) return;
    setPlayed((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: Date.now() };
      save(next);
      return next;
    });
  }, [save]);

  // Manual toggle for the "déjà écouté" button.
  const togglePlayed = useCallback((id: string) => {
    if (!id) return;
    setPlayed((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = Date.now();
      save(next);
      return next;
    });
  }, [save]);

  return { isPlayed, markPlayed, togglePlayed };
}
