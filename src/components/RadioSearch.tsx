"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { searchFrenchRadios, getTopFrenchRadios, rbStationToStation } from "@/lib/radiobrowser";
import { Station } from "@/lib/stations";
import StationLogo from "./StationLogo";

interface Props {
  onPlay: (station: Station) => void;
  onToggleFavorite: (station: Station) => void;
  isFavorite: (id: string) => boolean;
  currentUrl: string | null;
  isPlaying: boolean;
}

const TAGS = ["Jazz", "Classique", "Hip-hop", "Electro", "Variété", "Infos", "Rock", "Soul", "Reggae", "Latino"];

export default function RadioSearch({ onPlay, onToggleFavorite, isFavorite, currentUrl, isPlaying }: Props) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const raw = await searchFrenchRadios(q);
      setResults(raw.map(rbStationToStation));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTop = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setQuery("");
    try {
      const raw = await getTopFrenchRadios();
      setResults(raw.map(rbStationToStation));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(query)}
          placeholder="Nom d'une radio française..."
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-all"
        />
        <button
          onClick={() => search(query)}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </button>
      </div>

      {/* Genre tags */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={loadTop}
          className="text-xs px-3 py-1 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 transition-all font-medium"
        >
          🔥 Top France
        </button>
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => { setQuery(tag); search(tag); }}
            className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/60 hover:text-white transition-all"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Results */}
      <AnimatePresence>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : searched && results.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-8">Aucune radio trouvée.</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {results.map((station, i) => {
              const active = currentUrl === station.streamUrl;
              return (
                <motion.div
                  key={station.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 rounded-2xl p-3 glass glass-hover transition-all ${
                    active ? "border-blue-500/40" : ""
                  }`}
                  style={active ? { borderColor: `${station.color}50` } : {}}
                >
                  <StationLogo logo={station.logo} name={station.name} color={station.color} size="sm" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{station.name}</span>
                      {active && isPlaying && (
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-white/40 truncate">{station.tagline}</p>
                  </div>

                  {station.clickcount !== undefined && (
                    <span className="text-[10px] text-white/25 hidden sm:block flex-shrink-0">
                      {station.clickcount.toLocaleString("fr")}
                    </span>
                  )}

                  {/* Favorite toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(station); }}
                    className="p-1.5 rounded-lg glass-hover transition-all flex-shrink-0"
                    title={isFavorite(station.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24"
                      fill={isFavorite(station.id) ? "currentColor" : "none"}
                      stroke="currentColor" strokeWidth="2"
                      className={isFavorite(station.id) ? "text-yellow-400" : "text-white/30"}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>

                  {/* Play button */}
                  <button
                    onClick={() => onPlay(station)}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: active
                        ? `${station.color}`
                        : `${station.color}33`,
                    }}
                  >
                    {active && isPlaying ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={active ? "white" : station.color}>
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {!searched && (
        <div className="text-center py-8 space-y-2">
          <p className="text-white/20 text-sm">Cherche parmi des milliers de radios françaises</p>
          <p className="text-white/10 text-xs">Propulsé par Radio Browser API</p>
        </div>
      )}
    </div>
  );
}
