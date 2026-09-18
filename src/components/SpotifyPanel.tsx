"use client";
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  iTunesPodcast, RSSEpisode,
  getEpisodesForPodcast, itunesProxy,
} from "@/lib/podcastUtils";
import { usePodcastFavorites, podKey } from "@/hooks/usePodcastFavorites";
import { useOfflinePodcasts } from "@/hooks/useOfflinePodcasts";
import { usePlayedEpisodes } from "@/hooks/usePlayedEpisodes";
import { useSongLibrary, Playlist } from "@/hooks/useSongLibrary";
import { MusicTrack, searchAllMusic, sourceBadge, generateYouTubePlaylist } from "@/lib/musicSearch";

export type { RSSEpisode, iTunesPodcast };

// iTunes artwork URLs embed their pixel size (e.g. ".../100x100bb.jpg"). The
// chart/search feeds hand us low-res 100px art that looks blurry once scaled to
// a full card. Prefer the 600px field, and as a fallback rewrite any embedded
// "NNxNN" dimension up to 600x600 so the browser fetches a sharp asset.
function hiResArt(p: { artworkUrl600?: string; artworkUrl100?: string }): string {
  const up = (u?: string) => (u || "").replace(/\/\d+x\d+(bb|-100)?\./, "/600x600bb.");
  const big = (p.artworkUrl600 || "").trim();
  if (big) return up(big);
  return up(p.artworkUrl100 || "");
}

export interface SpotifyPanelHandle {
  /** No-op kept for API compatibility */
  pause: () => void;
}

// ── Spotify track (song) search via our server route ─────────────────
export interface SpotifyTrack {
  id: string; name: string; artist: string; album: string;
  image: string; previewUrl: string | null; url: string; durationMs: number;
}
async function searchSpotifyTracks(query: string): Promise<SpotifyTrack[]> {
  const res = await fetch(`/api/spotify/search?type=track&q=${encodeURIComponent(query)}`);
  if (res.status === 503) throw new Error("Spotify n'est pas configuré.");
  if (!res.ok) throw new Error(`Spotify ${res.status}`);
  const data = await res.json();
  return data.tracks ?? [];
}

// ── Spotify show (podcast) search → mapped to iTunesPodcast shape ─────
// Richer catalog than iTunes; audio is resolved later via the RSS bridge
// (resolveFeedByName in podcastUtils) when the user opens a show.
async function searchSpotifyShows(query: string): Promise<iTunesPodcast[]> {
  const res = await fetch(`/api/spotify/search?type=show&q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Spotify ${res.status}`);
  const data = await res.json();
  return (data.shows ?? []).map((s: any, i: number): iTunesPodcast => ({
    trackId: i + 1,
    trackName: s.name,
    artistName: s.publisher || "",
    artworkUrl600: s.image || "",
    artworkUrl100: s.image || "",
    primaryGenreName: "Podcast",
    trackCount: s.totalEpisodes || 0,
    feedUrl: "",                 // resolved on open via name→RSS bridge
    trackViewUrl: s.url || "",   // Spotify deep-link fallback
    collectionId: 0,
  }));
}

// ── iTunes Podcast API ────────────────────────────────────────────────
async function searchPodcasts(query: string): Promise<iTunesPodcast[]> {
  const params = new URLSearchParams({
    term: query, media: "podcast", entity: "podcast",
    country: "FR", lang: "fr_fr", limit: "20",
  });
  const res = await fetch(itunesProxy(`https://itunes.apple.com/search?${params}`));
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

// iTunes genre IDs for podcasts (matching podcasts-online.org categories)
const GENRES: { label: string; id: number | null }[] = [
  { label: "Top France",     id: null  },
  { label: "TV & Cinéma",    id: 1309  },
  { label: "Musique",        id: 1310  },
  { label: "Humour",         id: 1303  },
  { label: "Actualités",     id: 1311  },
  { label: "Culture",        id: 1316  },
  { label: "Business",       id: 1321  },
  { label: "Sciences",       id: 1315  },
  { label: "Sport",          id: 1318  },
  { label: "Arts",           id: 1301  },
  { label: "Santé",          id: 1307  },
  { label: "Tech",           id: 1318  },
];

async function getTopFrenchPodcasts(genreId?: number | null): Promise<iTunesPodcast[]> {
  const genrePart = genreId ? `/genre=${genreId}` : "";
  const res = await fetch(itunesProxy(`https://itunes.apple.com/fr/rss/toppodcasts/limit=25${genrePart}/explicit=true/json`));
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

// Optional source hint so the player can show the right UI (TASCAM deck for
// music tracks, podcast UI otherwise).
export type PlayKind = "music" | "podcast";

interface SpotifyPanelProps {
  currentEpisodeUrl: string | null;
  isPlaying: boolean;
  onPlayEpisode: (ep: RSSEpisode, pod: iTunesPodcast, opts?: { kind?: PlayKind; queue?: { episodes: RSSEpisode[]; index: number } }) => void;
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
  const [mode, setMode]           = useState<"podcasts" | "songs">("podcasts");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showOffline, setShowOffline]     = useState(false);
  const offline = useOfflinePodcasts();
  const { favorites: podFavorites, isFavorite: isPodFav, toggleFavorite: togglePodFav } = usePodcastFavorites();

  useImperativeHandle(ref, () => ({ pause: () => {} }));

  const doSearch = useCallback(async (q: string, genreId?: number | null) => {
    setLoading(true); setError(null);
    try {
      let results: iTunesPodcast[];
      if (q.trim()) {
        // Prefer Spotify's richer catalog; fall back to iTunes if it fails/empty.
        try {
          results = await searchSpotifyShows(q);
          if (!results.length) results = await searchPodcasts(q);
        } catch {
          results = await searchPodcasts(q);
        }
      } else {
        results = await getTopFrenchPodcasts(genreId);
      }
      setPodcasts(results);
      if (!results.length) setError("Aucun résultat.");
    } catch (e: any) {
      setError(`Erreur : ${e?.message ?? "inconnue"}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { doSearch("", null); }, []); // eslint-disable-line

  const handleSearch = () => { setShowFavorites(false); doSearch(query, activeGenre); };
  const handleTag    = (tag: string) => { setShowFavorites(false); setQuery(tag); doSearch(tag, activeGenre); };
  const handleGenre  = (id: number | null) => {
    setShowFavorites(false);
    setActiveGenre(id);
    setQuery("");
    doSearch("", id);
  };

  // What the grid shows: saved favorites, or the fetched/searched list.
  const displayList = showFavorites ? podFavorites : podcasts;

  return (
    <div className="space-y-4">
      {/* Mode toggle — Podcasts (iTunes, audio) vs Chansons (Spotify) */}
      <div className="flex glass rounded-xl p-1 gap-1">
        {([
          { id: "podcasts" as const, label: "Podcasts", icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
            </svg>
          )},
          { id: "songs" as const, label: "Chansons", icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          )}
        ]).map((item) => (
          <button key={item.id} onClick={() => setMode(item.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              mode === item.id ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
            style={mode === item.id ? { background: "var(--accent)", boxShadow: "0 0 12px rgba(59,130,246,0.4)" } : {}}>
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {mode === "songs" ? (
        <SongsView onPlayEpisode={onPlayEpisode} />
      ) : (
      <>
      {/* Genre tabs */}
      <div className="flex flex-wrap gap-1.5">
        {/* Hors-ligne / Téléchargements */}
        <button onClick={() => { setShowOffline(true); setShowFavorites(false); setQuery(""); }}
          className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all font-semibold flex-shrink-0 flex items-center gap-1 ${
            showOffline ? "text-white shadow-md" : "glass glass-hover text-emerald-300/80 hover:text-emerald-200"
          }`}
          style={showOffline ? { background: "linear-gradient(135deg,#059669,#10b981)" } : {}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Hors-ligne{offline.offlineEpisodes.length > 0 ? ` ${offline.offlineEpisodes.length}` : ""}</span>
        </button>

        {/* Favoris — saved podcasts */}
        <button onClick={() => { setShowFavorites(true); setShowOffline(false); setQuery(""); }}
          className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all font-semibold flex-shrink-0 flex items-center gap-1 ${
            showFavorites && !showOffline ? "text-white" : "glass glass-hover text-amber-300/80 hover:text-amber-200"
          }`}
          style={showFavorites && !showOffline ? { background: "linear-gradient(135deg,#f59e0b,#fbbf24)" } : {}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          <span>Favoris{podFavorites.length > 0 ? ` ${podFavorites.length}` : ""}</span>
        </button>
        {GENRES.map(g => {
          const active = !showFavorites && activeGenre === g.id && !query;
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
          className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/50 hover:text-white flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          <span>Effacer</span>
        </button>
      )}

      {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

      {/* Offline Episodes View */}
      {showOffline ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-white text-xs font-bold uppercase tracking-wider">Épisodes téléchargés</p>
              <p className="text-white/40 text-[11px]">
                {offline.offlineEpisodes.length} épisode{offline.offlineEpisodes.length > 1 ? "s" : ""} · {Math.round(offline.totalBytes / 1024 / 1024)} Mo en mémoire locale
              </p>
            </div>
            {offline.offlineEpisodes.length > 0 && (
              <button
                onClick={() => { if (confirm("Supprimer tous les épisodes hors-ligne ?")) offline.clearAll(); }}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-all"
              >
                Tout effacer
              </button>
            )}
          </div>

          {offline.offlineEpisodes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center glass rounded-2xl p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-emerald-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </div>
              <p className="text-white/70 text-sm font-semibold">Aucun épisode hors-ligne</p>
              <p className="text-white/35 text-xs max-w-xs leading-relaxed">
                Touche le bouton de téléchargement d’un épisode pour l’enregistrer et l’écouter sans connexion Internet.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto overscroll-contain scroll-touch pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
              {offline.offlineEpisodes.map((ep) => {
                const active = currentEpisodeUrl === ep.audioUrl;
                return (
                  <div key={ep.id}
                    onClick={() => onPlayEpisode(
                      { title: ep.title, audioUrl: ep.audioUrl, duration: ep.duration, pubDate: ep.pubDate, fileSize: ep.sizeBytes, isVideo: false, mediaType: "audio/mpeg", description: "" },
                      { trackName: ep.podcastName, artistName: ep.podcastName, artworkUrl600: ep.artwork, artworkUrl100: ep.artwork, collectionId: 0, trackId: 0, primaryGenreName: "Podcast", trackCount: 1, feedUrl: "", trackViewUrl: "" }
                    )}
                    className={`glass glass-hover rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all touch-pan-y select-none ${
                      active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-white/10"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 relative bg-white/5 border border-white/10">
                      {ep.artwork ? (
                        <img src={ep.artwork} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/40 font-bold text-xs">POD</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{ep.title}</p>
                      <p className="text-white/40 text-[11px] truncate mt-0.5">{ep.podcastName}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30">
                        <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          DISPO HORS-LIGNE
                        </span>
                        <span>·</span>
                        <span>{Math.round(ep.sizeBytes / 1024 / 1024)} Mo</span>
                        {ep.duration && <span>· {ep.duration}</span>}
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); offline.removeEpisode(ep.id); }}
                      title="Supprimer de la mémoire locale"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/10 transition-all flex-shrink-0"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : loading && !podcasts.length && !showFavorites ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({length: 6}).map((_,i) => (
            <div key={i} className="glass rounded-2xl p-3 animate-pulse aspect-square rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : showFavorites && displayList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-amber-400/60">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          </div>
          <p className="text-white/40 text-sm font-medium">Aucun podcast favori</p>
          <p className="text-white/20 text-xs max-w-xs leading-relaxed">
            Touche l’icône étoile sur un podcast pour l’ajouter à ta liste.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto overscroll-contain scroll-touch pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {displayList.map((p, i) => {
            const fav = isPodFav(p);
            return (
              <motion.div key={podKey(p) || i}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
                className="glass glass-hover rounded-2xl p-2.5 flex flex-col gap-2 cursor-pointer touch-pan-y select-none"
                onMouseEnter={() => getEpisodesForPodcast(p)}
                onTouchStart={() => getEpisodesForPodcast(p)}
                onClick={() => setSelected(p)}>
                <div className="relative">
                  {p.artworkUrl100 || p.artworkUrl600
                    ? <img src={hiResArt(p)} alt={p.trackName} loading="lazy"
                        className="w-full aspect-square rounded-xl object-cover" />
                    : <div className="w-full aspect-square rounded-xl flex items-center justify-center border border-white/10"
                        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-white/40">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      </div>
                  }
                  {/* Favorite star toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePodFav(p); }}
                    aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
                    aria-pressed={fav}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24"
                      fill={fav ? "#fbbf24" : "none"} stroke={fav ? "#fbbf24" : "rgba(255,255,255,0.7)"} strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
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
            offline={offline}
            onPlay={(ep, index, episodes) => onPlayEpisode(ep, selected, { kind: "podcast", queue: { episodes, index } })}
            onClose={() => setSelected(null)}
            isFav={isPodFav(selected)}
            onToggleFav={() => togglePodFav(selected)}
          />
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
});

SpotifyPanel.displayName = "SpotifyPanel";
export default SpotifyPanel;

// ── Songs view (Spotify search) ──────────────────────────────────────
function SongsView({ onPlayEpisode }: { onPlayEpisode: SpotifyPanelProps["onPlayEpisode"] }) {
  const [query, setQuery]     = useState("");
  const [tracks, setTracks]   = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setTouched(true);
    try {
      const res = await searchSpotifyTracks(q);
      setTracks(res);
      if (!res.length) setError("Aucune chanson trouvée.");
    } catch (e: any) {
      setError(e?.message ?? "Erreur Spotify.");
    } finally { setLoading(false); }
  }, []);

  const TAGS = ["Aya Nakamura", "Stromae", "Daft Punk", "Angèle", "Justice", "Gims", "Indila"];

  // Play a 30 s preview through the main player (rare — Spotify mostly returns null).
  const playPreview = (t: SpotifyTrack) => {
    if (!t.previewUrl) return;
    onPlayEpisode(
      { title: t.name, audioUrl: t.previewUrl, duration: "0:30", pubDate: "", fileSize: 0, description: t.album, isVideo: false, mediaType: "audio/mpeg" },
      { trackName: t.name, artistName: t.artist, artworkUrl600: t.image, artworkUrl100: t.image,
        trackId: 0, primaryGenreName: "", trackCount: 0, feedUrl: "", trackViewUrl: t.url, collectionId: 0 },
      { kind: "music" },
    );
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run(query)}
            placeholder="Cherche une chanson, un artiste…"
            className="w-full glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-transparent focus:border-blue-500/40 transition-all" />
        </div>
        <button onClick={() => run(query)}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: "var(--accent)" }}>
          {loading ? "…" : "OK"}
        </button>
      </div>

      {/* Quick tags */}
      {!touched && (
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => { setQuery(tag); run(tag); }}
              className="text-xs px-2.5 py-1 rounded-full transition-all font-medium glass glass-hover text-white/55 hover:text-white">
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Note about playback limitation */}
      <p className="text-white/30 text-[11px] leading-snug flex items-start gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>Spotify ne fournit plus d&apos;extrait audio pour la plupart des titres. Les chansons s&apos;ouvrent alors dans l&apos;application Spotify.</span>
      </p>

      {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

      {loading && !tracks.length ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-xl h-16 animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto overscroll-contain scroll-touch pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {tracks.map((t, i) => (
            <motion.div key={t.id || i}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03 }}
              className="glass glass-hover rounded-xl p-2.5 flex items-center gap-3 touch-pan-y select-none">
              {t.image
                ? <img src={t.image} alt={t.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold leading-tight truncate">{t.name}</p>
                <p className="text-white/45 text-[11px] truncate">{t.artist}</p>
                <p className="text-white/25 text-[10px] truncate">{t.album}</p>
              </div>
              {/* Preview play (only if Spotify returned one) */}
              {t.previewUrl && (
                <button onClick={() => playPreview(t)} title="Écouter l'extrait (30 s)"
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                  style={{ background: "var(--accent)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
              )}
              {/* Open in Spotify */}
              <a href={t.url} target="_blank" rel="noopener noreferrer" title="Ouvrir dans Spotify"
                onClick={e => e.stopPropagation()}
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all hover:opacity-80"
                style={{ background: "#1DB954" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.43a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.88 7.1-.5 9.72 1.1.3.18.39.57.21.86zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.23 1.33.37.22.49.7.26 1.07zm.11-2.85C14.78 8.05 9.4 7.86 6.3 8.8a.93.93 0 1 1-.54-1.78c3.56-1.08 9.5-.87 13.25 1.36a.93.93 0 1 1-.95 1.6z"/>
                </svg>
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Audius / Archive view (legal full-length streaming) ──────────────
// Search + types live in the shared lib so DJ mode reuses them.
type AudiusTrack = MusicTrack;
function fmtDur(sec: number): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudiusView({ onPlayEpisode, onPlayYouTube, youtubeTrackId, currentEpisodeUrl, isPlaying }: {
  onPlayEpisode: SpotifyPanelProps["onPlayEpisode"];
  onPlayYouTube?: (t: MusicTrack) => void;
  youtubeTrackId?: string | null;
  currentEpisodeUrl: string | null;
  isPlaying: boolean;
}) {
  const [query, setQuery]     = useState("");
  const [tracks, setTracks]   = useState<AudiusTrack[]>([]);
  const [visible, setVisible] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [mode, setMode]       = useState<"search" | "library">("search");
  // AI auto-playlist generator state.
  const [genTheme, setGenTheme]   = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError]   = useState<string | null>(null);
  const [openPl, setOpenPl]       = useState<string | null>(null);

  // Persistent saved songs + playlists (incl. AI-generated ones).
  const lib = useSongLibrary();

  const generate = useCallback(async (theme: string) => {
    const t = theme.trim();
    if (!t) return;
    setGenLoading(true); setGenError(null);
    try {
      const picked = await generateYouTubePlaylist(t, { size: 24 });
      if (!picked.length) { setGenError("Aucun titre YouTube trouvé pour ce thème."); return; }
      const id = lib.createPlaylist(`Mix ${t}`, picked, true);
      setOpenPl(id);
      setGenTheme("");
    } catch (e: any) {
      setGenError(e?.message ?? "Erreur lors de la génération.");
    } finally { setGenLoading(false); }
  }, [lib]);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setTouched(true); setVisible(20);
    try {
      const res = await searchAllMusic(q, { youtube: true });
      setTracks(res);
      if (!res.length) setError("Aucun titre trouvé sur SongPOD.");
    } catch (e: any) {
      setError(e?.message ?? "Erreur SongPOD.");
    } finally { setLoading(false); }
  }, []);

  const TAGS = ["Lofi", "Deep House", "Hip Hop", "Techno", "Jazz", "Chill", "Funk"];

  // Full-length stream → straight into the main player (gets EQ via /api/audio).
  // YouTube tracks are cross-origin (no EQ); they go to the hidden IFrame
  // mini-player instead, which still offers TREMOLO/GATE via volume-LFO.
  const play = (t: AudiusTrack) => {
    if (t.source === "youtube") { onPlayYouTube?.(t); return; }
    onPlayEpisode(
      { title: t.title, audioUrl: t.streamUrl, duration: fmtDur(t.duration), pubDate: "", fileSize: 0, description: t.genre, isVideo: false, mediaType: "audio/mpeg" },
      { trackName: t.title, artistName: t.artist, artworkUrl600: t.artwork, artworkUrl100: t.artwork,
        trackId: 0, primaryGenreName: t.genre || "", trackCount: 0, feedUrl: "", trackViewUrl: "", collectionId: 0 },
      { kind: "music" },
    );
  };

  // Shared row renderer (used by search results, saved songs, and playlists).
  // `onRemove`, when given, replaces the bookmark with a remove button.
  const renderTrack = (t: AudiusTrack, i: number, onRemove?: () => void) => {
    const active = t.source === "youtube"
      ? youtubeTrackId === t.id
      : currentEpisodeUrl === t.streamUrl;
    const saved = lib.isSaved(t.id);
    return (
      <motion.div key={t.id || i}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i, 8) * 0.03 }}
        className="glass glass-hover rounded-xl p-2.5 flex items-center gap-3 cursor-pointer"
        style={active ? { borderColor: "var(--accent)60" } : {}}
        onClick={() => play(t)}>
        {t.artwork
          ? <img src={t.artwork} alt={t.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          : <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.05)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div>}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">{t.title}</p>
          <p className="text-white/45 text-[11px] truncate">{t.artist}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {(() => { const b = sourceBadge(t.source); return (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wide flex-shrink-0"
                style={{ background: b.bg, color: b.color }}>
                {b.label}
              </span>
            ); })()}
            {t.genre && <span className="text-white/25 text-[10px] truncate">{t.genre}</span>}
            {t.duration > 0 && <span className="text-white/25 text-[10px]">· {fmtDur(t.duration)}</span>}
          </div>
        </div>
        {/* Bookmark (toggle saved) or, in a playlist, remove-from-list */}
        {onRemove ? (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Retirer de la liste"
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); lib.toggleSaved(t); }}
            title={saved ? "Retirer des favoris" : "Sauvegarder"}
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
            style={{ background: saved ? "rgba(244,63,94,0.16)" : "rgba(255,255,255,0.06)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24"
              fill={saved ? "#fb7185" : "none"} stroke={saved ? "#fb7185" : "rgba(255,255,255,0.5)"} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        )}
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            background: active ? "var(--accent)" : "rgba(255,255,255,0.08)",
            boxShadow: active ? "0 0 12px var(--accent)60" : "none",
          }}>
          {active && isPlaying ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill={active ? "white" : "rgba(255,255,255,0.7)"}>
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </div>
      </motion.div>
    );
  };

  const savedCount = lib.saved.length + lib.playlists.length;

  return (
    <div className="space-y-4">
      {/* Mode toggle: Recherche ↔ Bibliothèque */}
      <div className="flex gap-1 p-1 rounded-xl glass">
        {([["search", "Recherche"], ["library", `Bibliothèque${savedCount ? ` (${savedCount})` : ""}`]] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all"
            style={mode === m
              ? { background: "var(--accent)", color: "white" }
              : { color: "rgba(255,255,255,0.55)" }}>
            {label}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <>
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && run(query)}
                placeholder="Cherche un titre, un artiste…"
                className="w-full glass rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none border border-transparent focus:border-blue-500/40 transition-all" />
            </div>
            <button onClick={() => run(query)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: "var(--accent)" }}>
              {loading ? "…" : "OK"}
            </button>
          </div>

          {/* Quick tags */}
          {!touched && (
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(tag => (
                <button key={tag} onClick={() => { setQuery(tag); run(tag); }}
                  className="text-xs px-2.5 py-1 rounded-full transition-all font-medium glass glass-hover text-white/55 hover:text-white">
                  {tag}
                </button>
              ))}
            </div>
          )}

          <p className="text-white/30 text-[11px] leading-snug flex items-start gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>SongPOD — streaming intégral gratuit et légal (sans DRM). Le lecteur joue le titre complet ici, avec l&apos;égaliseur. Ajoute à tes favoris pour sauvegarder.</span>
          </p>

          {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

          {loading && !tracks.length ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-xl h-16 animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto overscroll-contain scroll-touch pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
              {tracks.slice(0, visible).map((t, i) => renderTrack(t, i))}
              {tracks.length > visible && (
                <button onClick={() => setVisible((v) => v + 20)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wide"
                  style={{ border: "1px solid var(--accent)55", background: "var(--accent)1a", color: "var(--accent)" }}>
                  Voir plus ({tracks.length - visible})
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* ── Bibliothèque ─────────────────────────────────────────────── */
        <div className="space-y-4 max-h-[460px] overflow-y-auto overscroll-contain scroll-touch pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* AI auto-playlist generator */}
          <div className="rounded-xl p-3 space-y-2"
            style={{ border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wide"
                style={{ background: "rgba(167,139,250,0.25)", color: "#c4b5fd" }}>IA AUTO</span>
              <span className="text-white/70 text-xs font-semibold">Génère une liste automatiquement</span>
            </div>
            <div className="flex gap-2">
              <input value={genTheme} onChange={e => setGenTheme(e.target.value)}
                onKeyDown={e => e.key === "Enter" && generate(genTheme)}
                placeholder="Un thème : « rock 80s », « chill été »…"
                className="flex-1 glass rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none border border-transparent focus:border-purple-400/40 transition-all" />
              <button onClick={() => generate(genTheme)} disabled={genLoading}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
                style={{ background: "#8b5cf6" }}>
                {genLoading ? "…" : "Générer"}
              </button>
            </div>
            {genError && <p className="text-red-400/80 text-[11px]">{genError}</p>}
            <p className="text-white/35 text-[10px] leading-snug">
              Cherche des titres existants sur YouTube et les assemble en liste de lecture.
            </p>
          </div>

          {/* Playlists */}
          {lib.playlists.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/40 text-[11px] font-bold tracking-wide uppercase">Listes de lecture</p>
              {lib.playlists.map((pl: Playlist) => (
                <div key={pl.id} className="glass rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5 cursor-pointer"
                    onClick={() => setOpenPl(openPl === pl.id ? null : pl.id)}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: pl.ai ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.06)" }}>
                      {pl.ai ? "IA" : "Mix"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{pl.name}</p>
                      <p className="text-white/40 text-[10px]">{pl.tracks.length} titres</p>
                    </div>
                    {pl.tracks.length > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); play(pl.tracks[0]); }}
                        title="Lire la liste"
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ background: "var(--accent)" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); lib.deletePlaylist(pl.id); }}
                      title="Supprimer la liste"
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      </svg>
                    </button>
                  </div>
                  {openPl === pl.id && (
                    <div className="px-2 pb-2 space-y-2">
                      {pl.tracks.length === 0
                        ? <p className="text-white/30 text-[11px] text-center py-2">Liste vide.</p>
                        : pl.tracks.map((t, i) => renderTrack(t, i, () => lib.removeFromPlaylist(pl.id, t.id)))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Saved (liked) songs */}
          <div className="space-y-2">
            <p className="text-white/40 text-[11px] font-bold tracking-wide uppercase">
              Titres sauvegardés{lib.saved.length ? ` (${lib.saved.length})` : ""}
            </p>
            {lib.saved.length === 0
              ? <p className="text-white/30 text-[12px] text-center py-4">
                  Aucun titre sauvegardé. Touche l'icône favoris sur un résultat de recherche pour l'ajouter ici.
                </p>
              : lib.saved.map((t, i) => renderTrack(t, i))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Podcast detail sheet ─────────────────────────────────────────────
interface DetailProps {
  podcast: iTunesPodcast;
  currentEpisodeUrl: string | null;
  isPlaying: boolean;
  offline: any;
  onPlay: (ep: RSSEpisode, index: number, episodes: RSSEpisode[]) => void;
  onClose: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
}

// Autoplay-next preference (shared with the page via localStorage, default ON).
const AUTOPLAY_KEY = "radiofr_autoplay_next";

function PodcastDetail({ podcast, currentEpisodeUrl, isPlaying, offline, onPlay, onClose, isFav, onToggleFav }: DetailProps) {
  const [episodes, setEpisodes] = useState<RSSEpisode[]>([]);
  const [loading, setLoading]   = useState(true);
  const [feedError, setFeedError] = useState(false);
  const { isPlayed, markPlayed, togglePlayed } = usePlayedEpisodes();

  // Autoplay-next toggle (persisted; read by the page when an episode ends).
  const [autoplay, setAutoplay] = useState(true);
  useEffect(() => {
    try { setAutoplay(localStorage.getItem(AUTOPLAY_KEY) !== "0"); } catch {}
  }, []);
  const toggleAutoplay = () => {
    setAutoplay((v) => {
      const next = !v;
      try { localStorage.setItem(AUTOPLAY_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ backdropFilter: "blur(12px)", background: "rgba(2,8,23,0.85)" }}
      onClick={onClose}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="glass-dark rounded-3xl w-full max-w-lg h-[86vh] max-h-[86vh] flex flex-col overflow-hidden shadow-2xl border border-white/15"
        onClick={e => e.stopPropagation()}>

        {/* iOS pull handle for mobile */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-2.5 sm:hidden flex-shrink-0" />

        {/* Pinned Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-white/10 flex-shrink-0 bg-white/[0.02]">
          <div className="flex gap-3">
            {(podcast.artworkUrl600 || podcast.artworkUrl100) && (
              <img src={hiResArt(podcast)} alt={podcast.trackName}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-md border border-white/10" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm sm:text-base leading-tight line-clamp-2">{podcast.trackName}</h3>
              <p className="text-white/50 text-xs mt-0.5 truncate">{podcast.artistName}</p>
              {podcast.primaryGenreName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full inline-block mt-1.5 font-medium"
                  style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                  {podcast.primaryGenreName}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all active:scale-95">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              {onToggleFav && (
                <button onClick={onToggleFav} aria-pressed={isFav}
                  aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                  title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                  className="transition-all active:scale-90 p-1">
                  <svg width="18" height="18" viewBox="0 0 24 24"
                    fill={isFav ? "#fbbf24" : "none"} stroke={isFav ? "#fbbf24" : "rgba(255,255,255,0.45)"} strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Subheader bar with episode count & autoplay toggle */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
            <p className="text-white/50 text-xs uppercase tracking-wider flex items-center gap-2 font-medium">
              <span>Épisodes</span>
              {!loading && episodes.length > 0 && (
                <span className="text-white/30 font-normal">· {episodes.length} disponibles</span>
              )}
            </p>
            <button onClick={toggleAutoplay}
              title="Lire les épisodes à la suite automatiquement"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all active:scale-95"
              style={autoplay
                ? { background: "var(--accent)22", color: "var(--accent)", border: "1px solid var(--accent)55" }
                : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="4,4 13,12 4,20"/><rect x="15" y="4" width="3" height="16"/>
              </svg>
              Enchaînement {autoplay ? "auto" : "off"}
            </button>
          </div>
        </div>

        {/* Scrollable Episodes List */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 scroll-touch"
          style={{ WebkitOverflowScrolling: "touch" }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2.5 py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
              <p className="text-white/40 text-xs font-medium">Chargement des épisodes…</p>
            </div>
          ) : feedError || episodes.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-white/40 text-xs">
                Impossible de charger les épisodes pour ce podcast.
              </p>
            </div>
          ) : (
            episodes.map((ep, i) => {
              const active = currentEpisodeUrl === ep.audioUrl;
              const played = isPlayed(ep.audioUrl);
              return (
                <div
                  key={ep.audioUrl || i}
                  className="glass rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-all hover:bg-white/[0.08] active:scale-[0.99] touch-pan-y select-none border border-white/10"
                  style={active ? { borderColor: "var(--accent)70", background: "rgba(255,255,255,0.09)" } : played ? { opacity: 0.6 } : {}}
                  onClick={() => { markPlayed(ep.audioUrl); onPlay(ep, i, episodes); }}>

                  {/* Play button */}
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all mt-0.5"
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
                    <p className="text-xs font-semibold leading-tight line-clamp-2"
                      style={{ color: played ? "rgba(255,255,255,0.6)" : "#fff" }}>{ep.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {played && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"
                          style={{ background: "rgba(34,197,94,0.18)", color: "#4ade80" }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          ÉCOUTÉ
                        </span>
                      )}
                      {ep.isVideo && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: "var(--accent)22", color: "var(--accent)" }}>VIDÉO</span>
                      )}
                      {ep.pubDate && (
                        <span className="text-white/35 text-[10px]">{ep.pubDate}</span>
                      )}
                      {ep.duration && (
                        <span className="text-white/30 text-[10px]">· {ep.duration}</span>
                      )}
                      {ep.fileSize > 0 && (
                        <span className="text-white/25 text-[10px]">· {Math.round(ep.fileSize / 1024 / 1024)} Mo</span>
                      )}
                    </div>
                    {ep.description && (
                      <p className="text-white/30 text-[10px] mt-1 line-clamp-2 leading-relaxed">{ep.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {/* Mark as listened / not listened */}
                    <button
                      onClick={e => { e.stopPropagation(); togglePlayed(ep.audioUrl); }}
                      title={played ? "Marquer comme non écouté" : "Marquer comme écouté"}
                      aria-pressed={played}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: played ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={played ? "#4ade80" : "rgba(255,255,255,0.5)"} strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>

                    {/* Offline Download button */}
                    {offline.isDownloaded(ep.audioUrl) ? (
                      <button
                        onClick={e => { e.stopPropagation(); offline.removeEpisode(ep.audioUrl); }}
                        title="Disponible hors-ligne (cliquer pour supprimer)"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    ) : offline.downloadingIds[ep.audioUrl] != null ? (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 text-[9px] font-bold text-white font-mono animate-pulse">
                        {offline.downloadingIds[ep.audioUrl]}%
                      </div>
                    ) : (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          offline.downloadEpisode(ep, podcast);
                        }}
                        title="Enregistrer pour écoute hors-ligne"
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-all active:scale-95"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
