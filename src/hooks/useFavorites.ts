"use client";
import { useState, useEffect, useCallback } from "react";
import { Station } from "@/lib/stations";

const KEY = "radiofr_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Station[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const save = useCallback((list: Station[]) => {
    setFavorites(list);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  }, []);

  const addFavorite = useCallback((station: Station) => {
    setFavorites((prev) => {
      if (prev.find((s) => s.id === station.id)) return prev;
      const next = [station, ...prev];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((s) => s.id !== id);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) =>
    favorites.some((s) => s.id === id), [favorites]);

  const toggleFavorite = useCallback((station: Station) => {
    if (isFavorite(station.id)) removeFavorite(station.id);
    else addFavorite(station);
  }, [isFavorite, addFavorite, removeFavorite]);

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
