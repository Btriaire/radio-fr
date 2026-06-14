"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── iTunes Podcast API ────────────────────────────────────────────────
interface iTunesPodcast {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl600: string;
  artworkUrl100: string;
  primaryGenreName: string;
  trackCount: number;
  feedUrl: string;
  trackViewUrl: string;
  collectionId: number;
}

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

async function getTopFrenchPodcasts(): Promise<iTunesPodcast[]> {
  const res = await fetch("https://itunes.apple.com/fr/rss/toppodcasts/limit=25/explicit=true/json");
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

// Lookup full podcast info (incl. feedUrl) from iTunes by collectionId
async function lookupPodcast(collectionId: number): Promise<iTunesPodcast | null> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=podcast`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// ── RSS episode fetcher ───────────────────────────────────────────────
interface RSSEpisode {
  title: string;
  pubDate: string;
  duration: string;
  description: string;
  audioUrl: string;  // direct MP3/audio URL for in-app playback
}

async function getRSSEpisodes(feedUrl: string): Promise<RSSEpisode[]> {
  if (!feedUrl) return [];
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(proxy);
  if (!res.ok) return [];
  const json = await res.json();
  const parser = new DOMParser();
  const doc = parser.parseFromString(json.contents, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 12);
  return items.map(item => ({
    title: item.querySelector("title")?.textContent ?? "",
    pubDate: item.querySelector("pubDate")?.textContent?.slice(0, 16) ?? "",
    duration: item.querySelector("duration")?.textContent ?? "",
    description: item.querySelector("description")?.textContent?.replace(/<[^>]*>/g, "").slice(0, 140) ?? "",
    audioUrl: item.querySelector("enclosure")?.getAttribute("url") ?? "",
  })).filter(ep => ep.audioUrl);   // only keep playable episodes
}

function fmt(secs: number) {
  if (!isFinite(secs) || secs <= 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const QUICK_TAGS = ["France Culture", "France Inter", "Le Monde", "Binge Audio",
  "Nova", "RFI", "Slate", "Arte Radio", "Mouv", "Culturebox"];

// ═══════════════════════════════════════════════════════════════════════
export default function SpotifyPanel() {
  const [podcasts, setPodcasts]       = useState<iTunesPodcast[]>([]);
  const [query, setQuery]             = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selected, setSelected]       = useState<iTunesPodcast | null>(null);

  // ── In-app audio player state ──────────────────────────────────────
  const audioRef                       = useRef<HTMLAudioElement | null>(null);
  const [playingEp, setPlayingEp]     = useState<RSSEpisode | null>(null);
  const [playingPod, setPlayingPod]   = useState<iTunesPodcast | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true); setError(null);
    try {
      const results = q.trim() ? await searchPodcasts(q) : await getTopFrenchPodcasts();
      setPodcasts(results);
      if (!results.length) setError("Aucun résultat.");
    } catch (e: any) {
      setError(`Erreur : ${e?.message ?? "inconnue"}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { doSearch(""); }, []); // eslint-disable-line

  // Audio element event wiring
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime     = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onPlay     = () => { setIsPlaying(true); setAudioLoading(false); };
    const onPause    = () => setIsPlaying(false);
    const onWaiting  = () => setAudioLoading(true);
    const onEnded    = () => { setIsPlaying(false); setCurrentTime(0); };
    const onCanPlay  = () => setAudioLoading(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  const playEpisode = useCallback((ep: RSSEpisode, pod: iTunesPodcast) => {
    const audio = audioRef.current;
    if (!audio || !ep.audioUrl) return;
    audio.pause();
    audio.src = ep.audioUrl;
    audio.load();
    setAudioLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setPlayingEp(ep);
    setPlayingPod(pod);
    audio.play().catch(() => setAudioLoading(false));
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !playingEp) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => {});
  }, [isPlaying, playingEp]);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const handleSearch = () => doSearch(query);
  const handleTag    = (tag: string) => { setQuery(tag); doSearch(tag); };
  const progress     = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" style={{ color: "var(--accent)" }}>
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <span className="text-xs font-semibold tracking-widest uppercase text-white/50">Podcasts</span>
        <span className="text-[10px] text-white/20 ml-1">· lecture intégrée</span>
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

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TAGS.map(tag => (
          <button key={tag} onClick={() => handleTag(tag)}
            className={`text-xs px-2.5 py-1 rounded-full transition-all font-medium ${
              query === tag ? "text-white" : "glass glass-hover text-white/55 hover:text-white"
            }`}
            style={query === tag ? { background: "var(--accent)" } : {}}>
            {tag}
          </button>
        ))}
        {query && (
          <button onClick={() => { setQuery(""); doSearch(""); }}
            className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/40">
            ✕ Top FR
          </button>
        )}
      </div>

      {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

      {/* ── Persistent mini-player (visible when an episode is loaded) ── */}
      <AnimatePresence>
        {playingEp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="glass rounded-2xl p-3 space-y-2"
            style={{ borderColor: "var(--accent)40" }}>
            {/* Row 1: artwork + title + play button */}
            <div className="flex items-center gap-3">
              {playingPod && (playingPod.artworkUrl100 || playingPod.artworkUrl600) && (
                <img src={playingPod.artworkUrl100 || playingPod.artworkUrl600}
                  alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{playingEp.title}</p>
                <p className="text-white/40 text-[10px] truncate">{playingPod?.trackName}</p>
              </div>
              {/* Play / pause */}
              <button onClick={togglePlay}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: "var(--accent)", boxShadow: "0 0 14px var(--accent)60" }}>
                {audioLoading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Row 2: progress bar */}
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-[10px] font-mono w-8 text-right">{fmt(currentTime)}</span>
              <input
                type="range" min={0} max={duration || 1} step={1}
                value={currentTime} onChange={seek}
                className="flex-1"
                style={{ accentColor: "var(--accent)", height: 3 }}
              />
              <span className="text-white/30 text-[10px] font-mono w-8">{fmt(duration)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Podcast grid */}
      {loading && !podcasts.length ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({length: 6}).map((_,i) => (
            <div key={i} className="glass rounded-2xl p-3 flex gap-2 animate-pulse">
              <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}/>
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 rounded w-3/4" style={{ background: "rgba(255,255,255,0.05)" }}/>
                <div className="h-2 rounded w-1/2" style={{ background: "rgba(255,255,255,0.04)" }}/>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {podcasts.map((p, i) => (
            <motion.div key={p.trackId || i}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
              className="glass glass-hover rounded-2xl p-2.5 flex flex-col gap-2 cursor-pointer"
              onClick={() => setSelected(p)}>
              <div className="relative">
                {p.artworkUrl100 || p.artworkUrl600
                  ? <img src={p.artworkUrl100 || p.artworkUrl600} alt={p.trackName}
                      className="w-full aspect-square rounded-xl object-cover" />
                  : <div className="w-full aspect-square rounded-xl flex items-center justify-center text-2xl"
                      style={{ background: "rgba(255,255,255,0.05)" }}>🎙</div>
                }
                {/* Playing indicator */}
                {playingPod?.trackId === p.trackId && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}>
                    <span style={{ fontSize: 8 }}>{isPlaying ? "▮▮" : "▶"}</span>
                  </div>
                )}
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
          ))}
        </div>
      )}

      {/* Podcast detail sheet */}
      <AnimatePresence>
        {selected && (
          <PodcastDetail
            podcast={selected}
            playingEp={playingEp}
            isPlaying={isPlaying}
            onPlay={(ep) => playEpisode(ep, selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Podcast detail sheet ─────────────────────────────────────────────
interface DetailProps {
  podcast: iTunesPodcast;
  playingEp: RSSEpisode | null;
  isPlaying: boolean;
  onPlay: (ep: RSSEpisode) => void;
  onClose: () => void;
}

function PodcastDetail({ podcast, playingEp, isPlaying, onPlay, onClose }: DetailProps) {
  const [episodes, setEpisodes] = useState<RSSEpisode[]>([]);
  const [loading, setLoading]   = useState(true);
  const [feedError, setFeedError] = useState(false);

  useEffect(() => {
    setLoading(true); setFeedError(false); setEpisodes([]);

    async function load() {
      let feedUrl = podcast.feedUrl;

      // Top charts don't include feedUrl — lookup via iTunes
      if (!feedUrl && podcast.collectionId) {
        const full = await lookupPodcast(podcast.collectionId);
        feedUrl = full?.feedUrl ?? "";
      }

      if (!feedUrl) { setFeedError(true); setLoading(false); return; }

      const eps = await getRSSEpisodes(feedUrl);
      if (eps.length === 0) setFeedError(true);
      setEpisodes(eps);
      setLoading(false);
    }

    load();
  }, [podcast.feedUrl, podcast.collectionId]);

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
              const active = playingEp?.audioUrl === ep.audioUrl;
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
                    </div>
                    {ep.description && (
                      <p className="text-white/25 text-[10px] mt-1 line-clamp-2">{ep.description}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
