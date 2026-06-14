"use client";
import { useState, useEffect, useCallback } from "react";
import { getSpotifyAuthUrl } from "@/lib/spotify";
import { motion } from "framer-motion";

// ── iTunes Podcast API (free, no auth, no CORS issues) ─────────────
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
    term: query,
    media: "podcast",
    entity: "podcast",
    country: "FR",
    lang: "fr_fr",
    limit: "20",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function getTopFrenchPodcasts(): Promise<iTunesPodcast[]> {
  // Top podcasts France via iTunes charts
  const res = await fetch(
    "https://itunes.apple.com/fr/rss/toppodcasts/limit=25/explicit=true/json"
  );
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
    feedUrl: "",
    trackViewUrl: e.link?.attributes?.href ?? "",
    collectionId: parseInt(e.id?.attributes?.["im:id"] ?? "0"),
  }));
}

// ── RSS feed fetcher for episodes ──────────────────────────────────
interface RSSEpisode {
  title: string;
  pubDate: string;
  duration: string;
  description: string;
  url: string; // audio url
  link: string;
}

async function getRSSEpisodes(feedUrl: string): Promise<RSSEpisode[]> {
  if (!feedUrl) return [];
  // Use a CORS proxy for RSS
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(proxy);
  if (!res.ok) return [];
  const json = await res.json();
  const parser = new DOMParser();
  const doc = parser.parseFromString(json.contents, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 8);
  return items.map(item => ({
    title: item.querySelector("title")?.textContent ?? "",
    pubDate: item.querySelector("pubDate")?.textContent?.slice(0, 16) ?? "",
    duration: item.querySelector("duration")?.textContent ?? "",
    description: item.querySelector("description")?.textContent?.replace(/<[^>]*>/g, "").slice(0, 120) ?? "",
    url: item.querySelector("enclosure")?.getAttribute("url") ?? "",
    link: item.querySelector("link")?.textContent ?? "",
  }));
}

// ── Spotify connection status ───────────────────────────────────────
function useSpotifyToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const match = document.cookie.match(/spotify_access_token=([^;]+)/);
    if (match) setToken(decodeURIComponent(match[1]));
  }, []);
  return token;
}

const QUICK_TAGS = ["France Culture", "France Inter", "Le Monde", "Binge Audio", "Nova", "RFI", "Slate", "Arte Radio", "Mouv", "Culturebox"];

// ═══════════════════════════════════════════════════════════════════
export default function SpotifyPanel() {
  const spotifyToken = useSpotifyToken();
  const [podcasts, setPodcasts]         = useState<iTunesPodcast[]>([]);
  const [query, setQuery]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selected, setSelected]         = useState<iTunesPodcast | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const results = q.trim() ? await searchPodcasts(q) : await getTopFrenchPodcasts();
      setPodcasts(results);
      if (!results.length) setError("Aucun résultat.");
    } catch (e: any) {
      setError(`Erreur : ${e?.message ?? "inconnue"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load top podcasts on mount
  useEffect(() => { doSearch(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => doSearch(query);
  const handleTag    = (tag: string) => { setQuery(tag); doSearch(tag); };

  return (
    <div className="space-y-4">
      {/* Header + Spotify badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" style={{ color: "var(--accent)" }}>
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          <span className="text-xs font-semibold tracking-widest uppercase text-white/50">Podcasts</span>
        </div>
        {spotifyToken ? (
          <span className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full font-medium"
            style={{ background: "rgba(29,185,84,0.15)", color: "#1DB954", border: "1px solid rgba(29,185,84,0.3)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#1DB954"><circle cx="12" cy="12" r="10"/></svg>
            Spotify connecté
          </span>
        ) : (
          <a href={getSpotifyAuthUrl()}
            className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full font-medium transition-all hover:opacity-80"
            style={{ background: "#1DB954", color: "#000" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Connecter
          </a>
        )}
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

      {/* Source note */}
      <p className="text-[10px] text-white/20 flex items-center gap-1">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
        Source : Apple Podcasts / iTunes · cliquer ouvre dans l'app de podcast
      </p>

      {error && <p className="text-red-400/80 text-sm text-center">{error}</p>}

      {/* Results */}
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
        <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
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

      {/* Podcast detail overlay */}
      {selected && (
        <PodcastDetail podcast={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ── Podcast detail sheet ────────────────────────────────────────────
function PodcastDetail({ podcast, onClose }: { podcast: iTunesPodcast; onClose: () => void }) {
  const [episodes, setEpisodes] = useState<RSSEpisode[]>([]);
  const [loading, setLoading]   = useState(true);
  const spotifyToken = useSpotifyToken();

  useEffect(() => {
    if (podcast.feedUrl) {
      getRSSEpisodes(podcast.feedUrl)
        .then(setEpisodes)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [podcast.feedUrl]);

  const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(podcast.trackName)}/podcasts`;

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

        {/* Open buttons */}
        <div className="flex gap-2 mb-4">
          {podcast.trackViewUrl && (
            <a href={podcast.trackViewUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
              style={{ background: "rgba(252,60,68,0.2)", color: "#fc3c44", border: "1px solid rgba(252,60,68,0.3)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/>
              </svg>
              Apple Podcasts
            </a>
          )}
          <a href={spotifySearchUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "rgba(29,185,84,0.2)", color: "#1DB954", border: "1px solid rgba(29,185,84,0.3)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify
          </a>
        </div>

        {/* Episodes via RSS */}
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : episodes.length > 0 ? (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Derniers épisodes</p>
            {episodes.map((ep, i) => (
              <div key={i} className="glass rounded-xl p-3 space-y-1">
                <p className="text-white text-xs font-medium leading-tight line-clamp-2">{ep.title}</p>
                <p className="text-white/30 text-[10px]">{ep.pubDate}</p>
                {ep.description && (
                  <p className="text-white/25 text-[10px] line-clamp-2">{ep.description}</p>
                )}
                <div className="flex gap-1.5 pt-1">
                  {ep.url && (
                    <a href={ep.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 rounded-lg font-medium transition-all hover:opacity-80"
                      style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                      ▶ Écouter
                    </a>
                  )}
                  {ep.link && (
                    <a href={ep.link} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 rounded-lg font-medium glass text-white/40 hover:text-white transition-all">
                      Voir →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/30 text-xs text-center py-4">
            Ouvre dans Spotify ou Apple Podcasts pour écouter.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
