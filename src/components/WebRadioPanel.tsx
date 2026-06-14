"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { RBStation, rbStationToStation } from "@/lib/radiobrowser";
import { Station } from "@/lib/stations";
import StationLogo from "./StationLogo";

const BASE = "https://de1.api.radio-browser.info/json";
const PAGE_SIZE = 30;

const WEB_GENRES = ["Tous", "Musique", "Info", "Culture", "Variété", "Rock", "Jazz", "Classique", "Électro", "Pop", "Tropical"];

const GENRE_QUERY: Record<string, string> = {
  Tous:      "",
  Musique:   "music",
  Info:      "news",
  Culture:   "culture",
  Variété:   "variete",
  Rock:      "rock",
  Jazz:      "jazz",
  Classique: "classical",
  Électro:   "electro",
  Pop:       "pop",
  Tropical:  "tropical",
};

async function fetchWebRadios(tag: string, offset = 0): Promise<RBStation[]> {
  const params = new URLSearchParams({
    country: "France",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    order: "clickcount",
    reverse: "true",
    hidebroken: "true",
  });
  if (tag) params.set("tag", tag);
  const res = await fetch(`${BASE}/stations/search?${params}`, {
    headers: { "User-Agent": "RadioFR/1.0" },
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

interface Props {
  onPlay: (s: Station) => void;
  currentUrl: string | null;
  isPlaying: boolean;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (s: Station) => void;
}

export default function WebRadioPanel({ onPlay, currentUrl, isPlaying, isFavorite, onToggleFavorite }: Props) {
  const [genre, setGenre]       = useState("Tous");
  const [stations, setStations] = useState<RBStation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [search, setSearch]     = useState("");
  const [error, setError]       = useState<string | null>(null);

  const load = async (tag: string, reset = true) => {
    if (reset) { setLoading(true); setStations([]); setHasMore(true); }
    else setLoadingMore(true);
    setError(null);
    try {
      const offset = reset ? 0 : stations.length;
      const data = await fetchWebRadios(GENRE_QUERY[tag] ?? "", offset);
      setStations(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError("Impossible de charger les radios. Réessaie.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(genre); }, [genre]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return stations;
    const q = search.toLowerCase();
    return stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.tags?.toLowerCase().includes(q)
    );
  }, [stations, search]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par nom ou tag…"
            className="w-full glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-transparent focus:border-blue-500/40 transition-all" />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              ✕
            </button>
          )}
        </div>
        <button onClick={() => load(genre)}
          className="px-3 py-2.5 rounded-xl glass glass-hover transition-all"
          title="Rafraîchir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: "var(--accent)" }}>
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>

      {/* Genre pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {WEB_GENRES.map(g => (
          <button key={g} onClick={() => setGenre(g)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all ${
              genre === g ? "text-white" : "glass glass-hover text-white/60 hover:text-white"
            }`}
            style={genre === g ? { background: "var(--accent)", boxShadow: "0 0 10px rgba(59,130,246,0.4)" } : {}}>
            {g}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-white/25 text-xs">
          {filtered.length}{hasMore && "+"} station{filtered.length > 1 ? "s" : ""} trouvée{filtered.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Station grid */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-3 flex gap-3 items-center animate-pulse">
              <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded-full w-2/3" style={{ background: "rgba(255,255,255,0.05)" }} />
                <div className="h-2 rounded-full w-1/2" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                Aucune station pour ce filtre.
              </div>
            ) : filtered.map((rb, i) => {
              const s = rbStationToStation(rb);
              const active = currentUrl === s.streamUrl;
              return (
                <motion.div key={rb.stationuuid}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.025 }}
                  className="flex items-center gap-3 rounded-2xl p-3 cursor-pointer glass glass-hover relative overflow-hidden transition-all"
                  style={active ? { borderColor: `${s.color}50` } : {}}
                  onClick={() => onPlay(s)}>

                  {active && (
                    <div className="absolute inset-0 pointer-events-none opacity-10"
                      style={{ background: `radial-gradient(circle at 10% 50%, ${s.color}, transparent 70%)` }} />
                  )}

                  <StationLogo logo={s.logo} name={s.name} color={s.color} size="sm" />

                  <div className="flex-1 min-w-0 relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm truncate">{s.name}</span>
                      {active && isPlaying && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-white/35 text-xs truncate">
                      {rb.tags?.split(",").slice(0, 3).join(" · ") || "Radio française"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
                    {rb.bitrate > 0 && (
                      <span className="text-[10px] text-white/25 hidden sm:block">{rb.bitrate}k</span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium hidden sm:block"
                      style={{ background: `${s.color}22`, color: s.color }}>
                      {s.genre?.slice(0, 10) || "Radio"}
                    </span>
                    <button onClick={e => { e.stopPropagation(); onToggleFavorite(s); }}
                      className="p-1 rounded-lg glass-hover">
                      <svg width="13" height="13" viewBox="0 0 24 24"
                        fill={isFavorite(s.id) ? "currentColor" : "none"}
                        stroke="currentColor" strokeWidth="2"
                        className={isFavorite(s.id) ? "text-yellow-400" : "text-white/20"}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && !search && (
            <button onClick={() => load(genre, false)} disabled={loadingMore}
              className="w-full py-2.5 rounded-xl glass glass-hover text-sm text-white/50 hover:text-white transition-all flex items-center justify-center gap-2">
              {loadingMore
                ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /> Chargement…</>
                : "Charger plus de stations"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
