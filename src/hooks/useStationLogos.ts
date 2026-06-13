"use client";
import { useState, useEffect } from "react";
import { Station } from "@/lib/stations";

const CACHE_KEY = "radiofr_logos_v1";
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

    // Fetch logos for all stations
    const fetchAll = async () => {
      const results: Record<string, string> = {};
      await Promise.allSettled(
        stations.map(async (station) => {
          const logo = await fetchLogoForStation(station.name);
          if (logo) results[station.id] = logo;
        })
      );
      setLogos(results);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(results)); } catch {}
    };
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return logos;
}
