"use client";
import { useState, useEffect, useCallback } from "react";
import { getSpotifyAuthUrl, searchFrenchPodcasts, getShowEpisodes, SpotifyShow } from "@/lib/spotify";
import { motion } from "framer-motion";

const QUICK_TAGS = ["France Culture", "France Inter", "Le Monde", "Arte Radio", "Nova", "RFI", "Binge Audio", "Slate"];

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/spotify/refresh", { method: "POST" });
    if (!res.ok) return null;
    // Cookie is set by server — re-read it
    const match = document.cookie.match(/spotify_access_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export default function SpotifyPanel() {
  const [token, setToken]               = useState<string | null>(null);
  const [shows, setShows]               = useState<SpotifyShow[]>([]);
  const [query, setQuery]               = useState("france culture");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectedShow, setSelectedShow] = useState<SpotifyShow | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/spotify_access_token=([^;]+)/);
    if (match) setToken(decodeURIComponent(match[1]));
  }, []);

  const doSearch = useCallback(async (q: string, tok: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchFrenchPodcasts(tok, q);
      setShows(results);
      if (results.length === 0) setError("Aucun résultat. Essaie un autre terme.");
    } catch (e: any) {
      if (e?.message === "TOKEN_EXPIRED") {
        // Try to refresh
        const newTok = await refreshToken();
        if (newTok) {
          setToken(newTok);
          try {
            const results = await searchFrenchPodcasts(newTok, q);
            setShows(results);
            if (results.length === 0) setError("Aucun résultat.");
          } catch {
            setError("Erreur après refresh. Reconnecte-toi.");
          }
        } else {
          setToken(null); // force reconnect screen
        }
      } else {
        setError("Erreur réseau. Réessaie.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search on token load
  useEffect(() => {
    if (token) doSearch(query, token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { if (token && query.trim()) doSearch(query, token); };
  const handleTag = (tag: string) => { setQuery(tag); if (token) doSearch(tag, token); };

  /* ── Not connected ─────────────────────────────────────────────── */
  if (!token) {
    return (
      <div className="glass rounded-3xl p-8 flex flex-col items-center gap-5 text-center relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]"
          viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
          {[30,55,80,110,145,185].map((r) => (
            <circle key={r} cx="200" cy="140" r={r} stroke="#1DB954" strokeWidth="1" strokeDasharray="6 5" />
          ))}
          {[20,35,50,28,42,38,55,30,45,25,40,32].map((h, i) => (
            <rect key={i} x={80 + i * 22} y={260 - h} width="14" height={h} rx="3"
              fill="#1DB954" opacity={0.4 + (i % 3) * 0.15} />
          ))}
        </svg>

        <div className="relative w-20 h-20 flex items-center justify-center">
          {[68, 52].map((size) => (
            <div key={size} className="absolute rounded-full border border-green-500/30"
              style={{ width: size, height: size }} />
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
        <a href={getSpotifyAuthUrl()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: "#1DB954", color: "#000", boxShadow: "0 0 20px rgba(29,185,84,0.35)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Se connecter avec Spotify
        </a>
        <p className="text-white/25 text-xs">Compte Premium requis pour la lecture</p>
      </div>
    );
  }

  /* ── Connected ─────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Cherche un podcast..."
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-transparent focus:border-blue-500/40 transition-all" />
        <button onClick={handleSearch}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-white flex items-center gap-2"
          style={{ background: "var(--accent)" }}>
          {loading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>}
          Chercher
        </button>
      </div>

      {/* Quick tags */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TAGS.map((tag) => (
          <button key={tag} onClick={() => handleTag(tag)}
            className={`text-xs px-2.5 py-1 rounded-full transition-all font-medium ${
              query === tag ? "text-white" : "glass glass-hover text-white/60 hover:text-white"
            }`}
            style={query === tag ? { background: "var(--accent)", opacity: 0.9 } : {}}>
            {tag}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && !loading && (
        <p className="text-sm text-red-400/80 text-center py-2">{error}</p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--accent)/30", borderTopColor: "var(--accent)" }} />
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {shows.map((show, i) => (
            <motion.div key={show.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass glass-hover rounded-2xl p-3 flex gap-3 cursor-pointer"
              onClick={() => setSelectedShow(show)}>
              {show.images?.[0]
                ? <img src={show.images[0].url} alt={show.name}
                    className="rounded-xl object-cover flex-shrink-0" style={{ width: 52, height: 52 }} />
                : <div className="rounded-xl flex-shrink-0 flex items-center justify-center text-white/40"
                    style={{ width: 52, height: 52, background: "rgba(29,185,84,0.15)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{show.name}</p>
                <p className="text-white/40 text-xs truncate">{show.publisher}</p>
                <p className="text-white/25 text-xs mt-0.5">{show.total_episodes} épisodes</p>
              </div>
              <div className="flex items-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" className="text-white/30"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reconnect link */}
      <p className="text-center">
        <a href={getSpotifyAuthUrl()} className="text-xs text-white/20 hover:text-white/50 transition-colors">
          Reconnecter Spotify
        </a>
      </p>

      {selectedShow && (
        <ShowDetail show={selectedShow} token={token}
          onClose={() => setSelectedShow(null)} />
      )}
    </div>
  );
}

function ShowDetail({ show, token, onClose }: {
  show: SpotifyShow; token: string; onClose: () => void;
}) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getShowEpisodes(token, show.id)
      .then(setEpisodes)
      .finally(() => setLoading(false));
  }, [show.id, token]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backdropFilter: "blur(10px)", background: "rgba(2,8,23,0.8)" }}
      onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="glass-dark rounded-3xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex gap-3 mb-4">
          {show.images?.[0] && (
            <img src={show.images[0].url} alt={show.name}
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{show.name}</h3>
            <p className="text-white/50 text-sm">{show.publisher}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none mt-1">✕</button>
        </div>

        {loading
          ? <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          : <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Derniers épisodes</p>
              {episodes.length === 0 && (
                <p className="text-white/30 text-sm text-center py-4">Aucun épisode disponible.</p>
              )}
              {episodes.map((ep) => (
                <div key={ep.id} className="glass rounded-xl p-3 flex gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{ep.name}</p>
                    <p className="text-white/40 text-xs">{ep.release_date}</p>
                  </div>
                  <a href={ep.external_urls?.spotify} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#1DB954" }} title="Ouvrir dans Spotify">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5.14v14l11-7-11-7z" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
        }
      </motion.div>
    </motion.div>
  );
}
