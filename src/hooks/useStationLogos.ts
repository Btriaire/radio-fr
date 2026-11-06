"use client";
import { useState, useEffect } from "react";
import { Station } from "@/lib/stations";

const CACHE_KEY = "radiofr_logos_v2";
const BASE = "https://de1.api.radio-browser.info/json";

async function fetchLogoForStation(name: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      name,
      country: "France",
      limit: "3",
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
    });
    const res = await fetch(`${BASE}/stations/search?${params}`, {
      headers: { "User-Agent": "RadioFR/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const favicon = data?.find((s: any) => s.favicon)?.favicon;
    return favicon || null;
  } catch {
    return null;
  }
}

export function useStationLogos(stations: Station[]) {
  const [logos, setLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    // Try to load from cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setLogos(JSON.parse(cached));
        return; // Use cache, skip fetch
      }
    } catch {}

    // Uniquement pour les stations sans logo intégré (le résultat ne sert que
    // de repli) — évite des dizaines de requêtes inutiles au premier lancement
    // sur réseau mobile. Concurrence limitée pour ne pas concurrencer le flux audio.
    const missing = stations.filter((s) => !s.logo);
    if (missing.length === 0) return;

    const fetchAll = async () => {
      const results: Record<string, string> = {};
      const queue = [...missing];
      const worker = async () => {
        for (let st = queue.shift(); st; st = queue.shift()) {
          const logo = await fetchLogoForStation(st.name);
          if (logo) results[st.id] = logo;
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
      setLogos(results);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(results)); } catch {}
    };
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return logos;
}
