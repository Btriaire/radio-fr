"use client";
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  iTunesPodcast, RSSEpisode,
  getEpisodesForPodcast,
} from "@/lib/podcastUtils";

export type { RSSEpisode, iTunesPodcast };

export interface SpotifyPanelHandle {
  /** No-op kept for API compatibility */
  pause: () => void;
}

// ── iTunes Podcast API ────────────────────────────────────────────────
async function searchPodcasts(query: string): Promise<iTunesPodcast[]> {
  const params = new URLSearchParams({
    term: query, media: "podcast", entity: "podcast",
    country: "FR", lang: "fr_fr", limit: "20",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

// iTunes genre IDs for podcasts (matching podcasts-online.org categories)
const GENRES: { label: string; id: number | null }[] = [
  { label: "🔥 Top FR",      id: null  },
  { label: "🎬 TV & Cinéma", id: 1309  },
  { label: "🎵 Musique",     id: 1310  },
  { label: "😂 Humour",      id: 1303  },
  { label: "📰 Actu",        id: 1311  },
  { label: "🎓 Culture",     id: 1316  },
  { label: "💼 Business",    id: 1321  },
  { label: "🔬 Science",     id: 1315  },
  { label: "🏃 Sport",       id: 1318  },
  { label: "🎨 Arts",        id: 1301  },
  { label: "❤️ Santé",       id: 1307  },
  { label: "👨‍💻 Tech",        id: 1318  },
];

async function getTopFrenchPodcasts(genreId?: number | null): Promise<iTunesPodcast[]> {
  const genrePart = genreId ? `/genre=${genreId}` : "";
  const res = await fetch(`https://itunes.apple.com/fr/rss/toppodcasts/limit=25${genrePart}/explicit=true/json`);
  if (!res.ok) throw new Error("chart error");
  const data = await res.json();
  return (data.feed?.entry ?? []).map((e: any) => ({
    trackId: parseInt(e.id?.attributes?.["im:id"] ?? "0"),
    trackName: e["im:name"]?.label ?? "",
    artistName: e["im:artist"]?.label ?? "",
    artworkUrl600: e["im:image"]?.[2]?.label ?? "",
    artworkUrl100: e["im:image"]?.[0]?.label ?? "",
    primaryGenreName: e.category?.attributes?.label ?? "",
    trackCount: 0,
    feedUrl: "",          // not in chart feed — resolved on detail open via lookup
    trackViewUrl: e.link?.attributes?.href ?? "",
    collectionId: parseInt(e.id?.attributes?.["im:id"] ?? "0"),
  }));
}

const QUICK_TAGS = ["France Culture", "France Inter", "Le Monde", "Binge Audio",
  "Nova", "RFI", "Slate", "Arte Radio", "Mouv", "Culturebox"];

interface SpotifyPanelProps {
  currentEpisodeUrl: string | null;
  isPlaying: boolean;
  onPlayEpisode: (ep: RSSEpisode, pod: iTunesPodcast) => void;
}

// ═══════════════════════════════════════════════════════════════════════
const SpotifyPanel = forwardRef<SpotifyPanelHandle, SpotifyPanelProps>(
function SpotifyPanel({ currentEpisodeUrl, isPlaying, onPlayEpisode }, ref) {
  const [podcasts, setPodcasts]   = useState<iTunesPodcast[]>([]);
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<iTunesPodcast | null>(null);
  const [activeGenre, setActiveGenre] = useState<number | null>(null); // null = Top FR

  useImperativeHandle(ref, () => ({ pause: () => {} }));

  const doSearch = useCallback(async (q: string, genreId?: number | null) => {
    setLoading(true); setError(null);
    try {
      const results = q.trim()
        ? await searchPodcasts(q)
        : await getTopFrenchPodcasts(genreId);
      setPodcasts(results);
      if (!results.length) setError("Aucun résultat.");
    } catch (e: any) {
      setError(`Erreur : ${e?.message ?? "inconnue"}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { doSearch("", null); }, []); // eslint-disable-line

  const handleSearch = () => doSearch(query, activeGenre);
  const handleTag    = (tag: string) => { setQuery(tag); doSearch(tag, activeGenre); };
  const handleGenre  = (id: number | null) => {
    setActiveGenre(id);
    setQuery("");
    doSearch("", id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" style={{ color: "var(--accent)" }}>
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <span className="text-xs font-semibold tracking-widest uppercase text-white/50">Podcasts</span>
      </div>

      {/* Genre tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {GENRES.map(g => {
          const active = activeGenre === g.id && !query;
          return (
            <button key={g.id ?? "top"} onClick={() => handleGenre(g.id)}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all font-medium flex-shrink-0 ${
                active ? "text-white" : "glass glass-hover text-white/55 hover:text-white"
              }`}
              style={active ? { background: "var(--accent)" } : {}}>
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Cherche un podcast français…"
            className="w-full glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-transparent focus:border-blue-500/40 transition-all" />
        </div>
        <button onClick={handleSearch}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: "var(--accent)" }}>
          {loading && !podcasts.length ? "…" : "OK"}
        </button>
      </div>

      {/* Quick tags — only shown when not searching */}
      {!query && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map(tag => (
            <button key={tag} onClick={() => handleTag(tag)}
              className="text-xs px-2.5 py-1 rounded-full transition-all font-medium glass glass-hover text-white/55 hover:text-white">
              {tag}
            </button>
          ))}
        </div>
      )}
      {query && (
        <button onClick={() => { setQuery(""); doSearch("", activeGenre); }}
          className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/40">
          ✕ effacer
        </button>
      )}

      {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

      {/* Podcast grid */}
      {loading && !podcasts.length ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({length: 6}).map((_,i) => (
            <div key={i} className="glass rounded-2xl p-3 animate-pulse aspect-square rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
          {podcasts.map((p, i) => {
            const active = currentEpisodeUrl !== null &&
              /* we don't know which ep url, just highlight the podcast card if it's the one playing */
              false; // episode-level highlight handled in detail sheet
            return (
              <motion.div key={p.trackId || i}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
                className="glass glass-hover rounded-2xl p-2.5 flex flex-col gap-2 cursor-pointer"
                onMouseEnter={() => getEpisodesForPodcast(p)}
                onTouchStart={() => getEpisodesForPodcast(p)}
                onClick={() => setSelected(p)}>
                <div className="relative">
                  {p.artworkUrl100 || p.artworkUrl600
                    ? <img src={p.artworkUrl100 || p.artworkUrl600} alt={p.trackName}
                        className="w-full aspect-square rounded-xl object-cover" />
                    : <div className="w-full aspect-square rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: "rgba(255,255,255,0.05)" }}>🎙</div>
                  }
                  {p.primaryGenreName && (
                    <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)" }}>
                      {p.primaryGenreName}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{p.trackName}</p>
                  <p className="text-white/40 text-[10px] mt-0.5 truncate">{p.artistName}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Podcast detail sheet */}
      <AnimatePresence>
        {selected && (
          <PodcastDetail
            podcast={selected}
            currentEpisodeUrl={currentEpisodeUrl}
            isPlaying={isPlaying}
            onPlay={(ep) => onPlayEpisode(ep, selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

SpotifyPanel.displayName = "SpotifyPanel";
export default SpotifyPanel;

// ── Podcast detail sheet ─────────────────────────────────────────────
interface DetailProps {
  podcast: iTunesPodcast;
  currentEpisodeUrl: string | null;
  isPlaying: boolean;
  onPlay: (ep: RSSEpisode) => void;
  onClose: () => void;
}

function PodcastDetail({ podcast, currentEpisodeUrl, isPlaying, onPlay, onClose }: DetailProps) {
  const [episodes, setEpisodes] = useState<RSSEpisode[]>([]);
  const [loading, setLoading]   = useState(true);
  const [feedError, setFeedError] = useState(false);

  useEffect(() => {
    setLoading(true); setFeedError(false); setEpisodes([]);

    getEpisodesForPodcast(podcast).then(eps => {
      if (eps.length === 0) setFeedError(true);
      setEpisodes(eps);
      setLoading(false);
    }).catch(() => {
      setFeedError(true);
      setLoading(false);
    });
  }, [podcast.feedUrl, podcast.collectionId]); // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backdropFilter: "blur(10px)", background: "rgba(2,8,23,0.82)" }}
      onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="glass-dark rounded-3xl p-5 max-w-sm w-full max-h-[82vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex gap-3 mb-4">
          {(podcast.artworkUrl600 || podcast.artworkUrl100) && (
            <img src={podcast.artworkUrl600 || podcast.artworkUrl100} alt={podcast.trackName}
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight">{podcast.trackName}</h3>
            <p className="text-white/50 text-xs mt-0.5">{podcast.artistName}</p>
            {podcast.primaryGenreName && (
              <span className="text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 font-medium"
                style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                {podcast.primaryGenreName}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none flex-shrink-0">✕</button>
        </div>

        {/* Episodes */}
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-white/30 text-xs">Chargement des épisodes…</p>
          </div>
        ) : feedError || episodes.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-6">
            Impossible de charger les épisodes pour ce podcast.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>Épisodes</span>
              <span className="text-white/20">· {episodes.length} disponibles</span>
            </p>
            {episodes.map((ep, i) => {
              const active = currentEpisodeUrl === ep.audioUrl;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-all"
                  style={active ? { borderColor: "var(--accent)60" } : {}}
                  onClick={() => onPlay(ep)}>

                  {/* Play button */}
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      background: active ? "var(--accent)" : "rgba(255,255,255,0.08)",
                      boxShadow: active ? "0 0 12px var(--accent)60" : "none",
                    }}>
                    {active && isPlaying ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={active ? "white" : "rgba(255,255,255,0.6)"}>
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium leading-tight line-clamp-2">{ep.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {ep.pubDate && (
                        <span className="text-white/30 text-[10px]">{ep.pubDate}</span>
                      )}
                      {ep.duration && (
                        <span className="text-white/25 text-[10px]">· {ep.duration}</span>
                      )}
                      {ep.fileSize > 0 && (
                        <span className="text-white/20 text-[10px]">· {Math.round(ep.fileSize / 1024 / 1024)} Mo</span>
                      )}
                    </div>
                    {ep.description && (
                      <p className="text-white/25 text-[10px] mt-1 line-clamp-2">{ep.description}</p>
                    )}
                  </div>

                  {/* Download button */}
                  <a
                    href={ep.audioUrl}
                    download={`${ep.title.slice(0, 60).replace(/[^a-zA-Z0-9\s-]/g, "")}.mp3`}
                    onClick={e => e.stopPropagation()}
                    title="Télécharger"
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.07)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
