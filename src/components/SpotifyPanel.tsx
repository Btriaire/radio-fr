"use client";
import { useState, useEffect } from "react";
import { getSpotifyAuthUrl, searchFrenchPodcasts, SpotifyShow } from "@/lib/spotify";
import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  onPlayEpisode?: (uri: string, showName: string) => void;
}

export default function SpotifyPanel({ onPlayEpisode }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [shows, setShows] = useState<SpotifyShow[]>([]);
  const [query, setQuery] = useState("france culture");
  const [loading, setLoading] = useState(false);
  const [selectedShow, setSelectedShow] = useState<SpotifyShow | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/spotify_access_token=([^;]+)/);
    if (match) setToken(decodeURIComponent(match[1]));
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    searchFrenchPodcasts(token, query)
      .then(setShows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const search = () => {
    if (!token || !query.trim()) return;
    setLoading(true);
    searchFrenchPodcasts(token, query)
      .then(setShows)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  if (!token) {
    return (
      <div className="glass rounded-3xl p-8 flex flex-col items-center gap-5 text-center relative overflow-hidden">
        {/* Decorative SVG background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
          {/* Sound waves emanating from center */}
          {[30,55,80,110,145,185].map((r, i) => (
            <circle key={r} cx="200" cy="140" r={r}
              stroke="#1DB954" strokeWidth={i === 0 ? 2 : 1}
              strokeDasharray={i > 1 ? "6 5" : "none"}
              opacity={1 - i * 0.14} />
          ))}
          {/* Horizontal EQ bars at bottom */}
          {[20,35,50,28,42,38,55,30,45,25,40,32].map((h, i) => (
            <rect key={i} x={80 + i * 22} y={260 - h} width="14" height={h} rx="3"
              fill="#1DB954" opacity={0.5 + (i % 3) * 0.15} />
          ))}
          {/* Headphones outline at top left */}
          <path d="M 40 80 C 40 50 80 30 120 30 C 160 30 200 50 200 80"
            stroke="#1DB954" strokeWidth="3" fill="none" />
          <rect x="30" y="75" width="18" height="30" rx="6" fill="none" stroke="#1DB954" strokeWidth="2" />
          <rect x="192" y="75" width="18" height="30" rx="6" fill="none" stroke="#1DB954" strokeWidth="2" />
        </svg>

        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Pulsing rings */}
          {[68, 52].map((size, i) => (
            <div key={size} className="absolute rounded-full border border-green-500/30"
              style={{ width: size, height: size, opacity: 0.4 - i * 0.1 }} />
          ))}
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(29,185,84,0.18)", border: "1px solid rgba(29,185,84,0.4)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l12-2v13" stroke="#1DB954" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="18" r="3" stroke="#1DB954" strokeWidth="1.5"/>
              <circle cx="18" cy="16" r="3" stroke="#1DB954" strokeWidth="1.5"/>
            </svg>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold text-lg mb-1">Connecte Spotify</h3>
          <p className="text-white/50 text-sm max-w-xs">
            Accède à des milliers de podcasts français avec ton compte Premium.
          </p>
        </div>
        <a
          href={getSpotifyAuthUrl()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg"
          style={{ background: "#1DB954", color: "#000", boxShadow: "0 0 20px rgba(29,185,84,0.35)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Se connecter avec Spotify
        </a>
        <p className="text-white/25 text-xs">Compte Premium requis pour la lecture</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Cherche un podcast..."
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-all"
        />
        <button
          onClick={search}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-blue-600 hover:bg-blue-500 text-white"
        >
          {loading ? "…" : "Chercher"}
        </button>
      </div>

      {/* Quick tags */}
      <div className="flex flex-wrap gap-1.5">
        {["France Culture", "Le Monde", "Arte Radio", "Nova", "RFI", "RTL"].map((tag) => (
          <button
            key={tag}
            onClick={() => { setQuery(tag); }}
            className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/60 hover:text-white"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {shows.map((show) => (
            <motion.div
              key={show.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass glass-hover rounded-2xl p-3 flex gap-3 cursor-pointer"
              onClick={() => setSelectedShow(show)}
            >
              {show.images?.[0] && (
                <img
                  src={show.images[0].url}
                  alt={show.name}
                  width={52}
                  height={52}
                  className="w-13 h-13 rounded-xl object-cover flex-shrink-0"
                  style={{ width: 52, height: 52 }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{show.name}</p>
                <p className="text-white/40 text-xs truncate">{show.publisher}</p>
                <p className="text-white/30 text-xs mt-0.5">{show.total_episodes} épisodes</p>
              </div>
              <div className="flex items-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Show detail overlay */}
      {selectedShow && (
        <ShowDetail
          show={selectedShow}
          token={token}
          onClose={() => setSelectedShow(null)}
          onPlayEpisode={onPlayEpisode}
        />
      )}
    </div>
  );
}

function ShowDetail({
  show, token, onClose, onPlayEpisode,
}: {
  show: SpotifyShow;
  token: string;
  onClose: () => void;
  onPlayEpisode?: (uri: string, name: string) => void;
}) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/lib/spotify").then(({ getShowEpisodes }) =>
      getShowEpisodes(token, show.id)
        .then(setEpisodes)
        .finally(() => setLoading(false))
    );
  }, [show.id, token]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backdropFilter: "blur(10px)", background: "rgba(2,8,23,0.8)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="glass-dark rounded-3xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-glass-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex gap-3 mb-4">
          {show.images?.[0] && (
            <img src={show.images[0].url} alt={show.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold">{show.name}</h3>
            <p className="text-white/50 text-sm">{show.publisher}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none mt-1">✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Derniers épisodes</p>
            {episodes.map((ep) => (
              <div key={ep.id} className="glass rounded-xl p-3 flex gap-3 items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{ep.name}</p>
                  <p className="text-white/40 text-xs">{ep.release_date}</p>
                </div>
                <a
                  href={ep.external_urls?.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#1DB954" }}
                  title="Ouvrir dans Spotify"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
