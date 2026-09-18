"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { useStationLogos } from "@/hooks/useStationLogos";
import { useTheme } from "@/context/ThemeContext";
import { STATIONS, GENRES, Station, isEqCompatible, preferredStreamUrl } from "@/lib/stations";
import { playableUrl, MusicTrack } from "@/lib/musicSearch";
import { getOfflineBlobUrl } from "@/lib/offlineStorage";
import Player from "@/components/Player";
import StationCard from "@/components/StationCard";
import SpotifyPanel, { SpotifyPanelHandle, AudiusView, RSSEpisode, iTunesPodcast } from "@/components/SpotifyPanel";
import { usePlayedEpisodes } from "@/hooks/usePlayedEpisodes";
import ClipVisualizer from "@/components/ClipVisualizer";
import RadioSearch from "@/components/RadioSearch";
import ConfigPanel from "@/components/ConfigPanel";
import WebRadioPanel from "@/components/WebRadioPanel";
import IpodOverlay from "@/components/IpodOverlay";
import DjMode from "@/components/DjMode";
import YouTubeMiniPlayer from "@/components/YouTubeMiniPlayer";
import ZenBackground from "@/components/ZenBackground";
import StationLogo from "@/components/StationLogo";
import SplashScreen from "@/components/SplashScreen";
import HubScreen, { HubChoice } from "@/components/HubScreen";
import { useMediaSession } from "@/hooks/useMediaSession";
import MobileMiniPlayer from "@/components/MobileMiniPlayer";
import { useNowPlaying } from "@/hooks/useNowPlaying";

type Tab = "radio" | "webradio" | "search" | "favoris" | "podcasts" | "audius";

const TABS: { id: Tab; label: string }[] = [
  { id: "favoris",  label: "Favoris" },
  { id: "radio",    label: "Radio" },
  { id: "webradio", label: "Web Radio" },
  { id: "search",   label: "Chercher" },
  { id: "podcasts", label: "Podcasts" },
  { id: "audius",   label: "SongPOD" },
];

export interface PodcastNowPlaying {
  episodeTitle: string;
  audioUrl: string;
  podcastName: string;
  artwork: string;
  isVideo?: boolean;
  kind?: "music" | "podcast";
}

// ── Crisp SVG icons for the nav tabs (replaces the emoji set) ──────────────
function TabIcon({ id, size = 18 }: { id: Tab; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.9,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "radio": // boombox / radio set
      return (<svg {...p}><path d="M3 11 18 4" /><rect x="2" y="9" width="20" height="12" rx="2" />
        <circle cx="8" cy="15" r="3" /><line x1="16" y1="13" x2="19" y2="13" /><line x1="16" y1="17" x2="19" y2="17" /></svg>);
    case "webradio": // globe
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></svg>);
    case "search": // magnifier
      return (<svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>);
    case "favoris": // star
      return (<svg {...p}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9z" /></svg>);
    case "podcasts": // mic
      return (<svg {...p}><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" />
        <line x1="12" y1="18" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>);
    case "audius": // music note + waves
      return (<svg {...p}><path d="M9 17V5l10-2v12" /><circle cx="6" cy="17" r="3" /><circle cx="16" cy="15" r="3" /></svg>);
  }
}

export default function Home() {
  const [tab, setTab]                           = useState<Tab>("radio");
  const [selectedStation, setSelectedStation]   = useState<Station | null>(null);
  const [currentPodcast, setCurrentPodcast]     = useState<PodcastNowPlaying | null>(null);
  const [youtubeTrack, setYoutubeTrack]         = useState<MusicTrack | null>(null);
  const [genre, setGenre]                       = useState("Tous");
  const [stationView, setStationView]           = useState<"list" | "grid">("list");
  const [stationQuery, setStationQuery]         = useState("");
  const [stationSort, setStationSort]           = useState<"default" | "name" | "freq">("default");
  const [zappingFeedback, setZappingFeedback]   = useState<string | null>(null);
  const [configOpen, setConfigOpen]             = useState(false);
  const [ipodOpen, setIpodOpen]                 = useState(false);
  const [djOpen, setDjOpen]                      = useState(false);
  const [hubOpen, setHubOpen]                   = useState(true);
  const [mobilePlayerExpanded, setMobilePlayerExpanded] = useState(false);
  const spotifyPanelRef                         = useRef<SpotifyPanelHandle>(null);

  const playerApi                               = useAudioPlayer();
  const nowPlaying                              = useNowPlaying(selectedStation, playerApi.isPlaying);
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const logoMap                                 = useStationLogos(STATIONS);
  const { defaultStationId, theme }             = useTheme();
  const { markPlayed }                          = usePlayedEpisodes();

  // Podcast play-queue for automatic episode chaining (enchaînement auto).
  const episodeQueueRef = useRef<{ episodes: RSSEpisode[]; podcast: iTunesPodcast; index: number } | null>(null);

  // Honour tab from URL params (e.g. after Spotify OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "podcasts") { setTab("podcasts"); setHubOpen(false); }
    try {
      const sv = localStorage.getItem("radiofr_station_view");
      if (sv === "grid" || sv === "list") setStationView(sv);
      // Show the hub only once per browser session.
      if (sessionStorage.getItem("radiofr_hub_seen")) setHubOpen(false);
    } catch {}
  }, []);

  // Jump from the hub landing into the chosen view.
  const handleHubChoice = useCallback((c: HubChoice) => {
    try { sessionStorage.setItem("radiofr_hub_seen", "1"); } catch {}
    setHubOpen(false);
    if (c === "radio") setTab("radio");
    else if (c === "podcasts") setTab("podcasts");
    else if (c === "audius") setTab("audius");
    else if (c === "ipod") setIpodOpen(true);
  }, []);

  // Persist station list view preference
  useEffect(() => {
    try { localStorage.setItem("radiofr_station_view", stationView); } catch {}
  }, [stationView]);

  // Auto-play default station on first load
  useEffect(() => {
    if (!defaultStationId) return;
    const station = STATIONS.find((s) => s.id === defaultStationId);
    if (station && !selectedStation) {
      setSelectedStation(station);
      // Small delay to ensure AudioContext is allowed after user gesture on revisit
      const id = setTimeout(() => playerApi.initAudio(preferredStreamUrl(station)), 300);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStationId]);

  // Curated Google-favicon logo is authoritative (consistent & crisp). The
  // radio-browser fetch is only a fallback for any future station without one.
  const withLogo = (s: Station): Station => ({
    ...s,
    logo: s.logo || logoMap[s.id],
  });

  let baseStationList = genre === "Tous" ? STATIONS : STATIONS.filter((s) => s.genre === genre);

  if (stationQuery.trim()) {
    const q = stationQuery.toLowerCase().trim();
    baseStationList = baseStationList.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.tagline && s.tagline.toLowerCase().includes(q)) ||
      (s.genre && s.genre.toLowerCase().includes(q)) ||
      (s.freq && s.freq.toLowerCase().includes(q))
    );
  }

  if (stationSort === "name") {
    baseStationList = [...baseStationList].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  } else if (stationSort === "freq") {
    baseStationList = [...baseStationList].sort((a, b) => {
      const fa = parseFloat(a.freq || "999");
      const fb = parseFloat(b.freq || "999");
      return fa - fb;
    });
  }

  const filteredStations = baseStationList.map(withLogo);

  // YouTube tracks can't run through the media-element pipeline (cross-origin),
  // so they play in a separate hidden IFrame mini-player. Starting one stops any
  // other media, and starting any other media (below) clears the YouTube track.
  const handlePlayYouTube = (t: MusicTrack) => {
    playerApi.pause();
    setSelectedStation(null);
    setCurrentPodcast(null);
    setYoutubeTrack(t);
  };

  const handlePlay = useCallback((station: Station) => {
    setCurrentPodcast(null);
    setYoutubeTrack(null);
    if (selectedStation?.id === station.id) {
      playerApi.togglePlay();
    } else {
      setSelectedStation(station);
      playerApi.initAudio(preferredStreamUrl(station));
    }
  }, [selectedStation?.id, playerApi]);

  const handleRandomZapping = useCallback(() => {
    const pool = (filteredStations.length > 0 ? filteredStations : STATIONS.map(withLogo))
      .filter((s) => s.id !== selectedStation?.id);
    const candidates = pool.length > 0 ? pool : STATIONS.map(withLogo);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (!chosen) return;

    setZappingFeedback(chosen.name);
    setTimeout(() => setZappingFeedback(null), 2500);
    handlePlay(chosen);
  }, [filteredStations, selectedStation?.id, handlePlay, withLogo]);

  const handlePlayEpisode = useCallback((ep: { title: string; audioUrl: string; duration: string; pubDate: string; fileSize: number; isVideo?: boolean }, pod: { trackName: string; artistName: string; artworkUrl600: string; artworkUrl100: string }, opts?: { kind?: "music" | "podcast"; queue?: { episodes: RSSEpisode[]; index: number } }) => {
    setCurrentPodcast({
      episodeTitle: ep.title,
      audioUrl: ep.audioUrl,
      podcastName: pod.trackName,
      artwork: pod.artworkUrl600 || pod.artworkUrl100,
      isVideo: ep.isVideo,
      kind: opts?.kind ?? "podcast",
    });
    setSelectedStation(null);
    setYoutubeTrack(null);
    // Remember the episode queue so playback can auto-advance to the next one.
    // A play without a queue (e.g. a single SongPOD track) clears it → no chaining.
    episodeQueueRef.current = opts?.queue
      ? { episodes: opts.queue.episodes, podcast: pod as iTunesPodcast, index: opts.queue.index }
      : null;
    // Route audio through our same-origin proxy: fixes http:// mixed-content
    // blocks and missing CORS headers on podcast CDNs (the reason in-browser
    // playback fails where native podcast apps succeed). EXCEPTION (handled by
    // playableUrl): archive.org blocks Vercel's IPs, so its CORS-enabled
    // datanodes are fetched directly by the browser. data:/blob: pass through.
    (async () => {
      let playUrl = playableUrl(ep.audioUrl);
      try {
        const offlineBlob = await getOfflineBlobUrl(ep.audioUrl);
        if (offlineBlob) playUrl = offlineBlob;
      } catch {}
      playerApi.initAudio(playUrl, { live: false, video: !!ep.isVideo });
    })();
  }, [playerApi]);

  // Latest play handler kept in a ref so the (once-registered) ended callback
  // and lock-screen next/prev always invoke the current closure.
  const playEpisodeRef = useRef(handlePlayEpisode);
  playEpisodeRef.current = handlePlayEpisode;

  // Jump to another episode in the current queue (used by auto-advance + keys).
  const playQueueEpisode = useCallback((dir: 1 | -1) => {
    const q = episodeQueueRef.current;
    if (!q) return false;
    const idx = q.index + dir;
    if (idx < 0 || idx >= q.episodes.length) return false;
    playEpisodeRef.current(q.episodes[idx], q.podcast, { kind: "podcast", queue: { episodes: q.episodes, index: idx } });
    return true;
  }, []);

  // Auto-advance when an episode finishes (enchaînement automatique).
  useEffect(() => {
    playerApi.setOnEnded(() => {
      const q = episodeQueueRef.current;
      if (!q) return;
      markPlayed(q.episodes[q.index]?.audioUrl);     // the finished episode → écouté
      let on = true;
      try { on = localStorage.getItem("radiofr_autoplay_next") !== "0"; } catch {}
      if (on) playQueueEpisode(1);
    });
    return () => playerApi.setOnEnded(null);
  }, [playerApi, markPlayed, playQueueEpisode]);

  const currentStation = selectedStation ? withLogo(selectedStation) : null;

  // Skip to the adjacent station (used by lock-screen / headphone next-prev).
  const playAdjacentStation = useCallback((dir: 1 | -1) => {
    setSelectedStation((prev) => {
      const base = prev ?? STATIONS[0];
      const idx = STATIONS.findIndex((s) => s.id === base.id);
      const next = STATIONS[(idx + dir + STATIONS.length) % STATIONS.length];
      setCurrentPodcast(null);
      playerApi.initAudio(preferredStreamUrl(next));
      return withLogo(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerApi]);

  // OS Media Session — lock screen / notification / hardware media keys.
  const mediaTitle = currentPodcast
    ? currentPodcast.episodeTitle
    : (nowPlaying.songTitle || currentStation?.name || null);

  const mediaArtist = currentPodcast
    ? currentPodcast.podcastName
    : (nowPlaying.songArtist
        ? `${nowPlaying.songArtist} • ${currentStation?.name ?? "RadioFR"}`
        : (currentStation?.tagline ?? "RadioFR"));

  useMediaSession({
    title: mediaTitle,
    artist: mediaArtist,
    album: currentStation?.name ?? "RadioFR",
    artwork: currentPodcast ? currentPodcast.artwork : currentStation?.logo,
    isPlaying: playerApi.isPlaying,
    // Position/scrub only for finite content (podcasts & SongPOD music); live
    // radio leaves these undefined so the lock screen shows no fake progress bar.
    currentTime: currentPodcast ? playerApi.currentTime : undefined,
    duration: currentPodcast ? playerApi.duration : undefined,
    onPlay: () => playerApi.play(),
    onPause: () => playerApi.pause(),
    onNext: currentStation
      ? () => playAdjacentStation(1)
      : (currentPodcast ? () => playQueueEpisode(1) : undefined),
    onPrev: currentStation
      ? () => playAdjacentStation(-1)
      : (currentPodcast ? () => playQueueEpisode(-1) : undefined),
    onSeek: currentPodcast ? (t: number) => playerApi.seekTo(t) : undefined,
  });

  // ── Global keyboard shortcuts (Desktop & iPad) ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        playerApi.togglePlay();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (playerApi.volume > 0) {
          (window as any)._prevVol = playerApi.volume;
          playerApi.changeVolume(0);
        } else {
          playerApi.changeVolume((window as any)._prevVol || 0.8);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentPodcast || playerApi.duration > 0) {
          playerApi.seekRelative(30);
        } else {
          playAdjacentStation(1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentPodcast || playerApi.duration > 0) {
          playerApi.seekRelative(-15);
        } else {
          playAdjacentStation(-1);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        playerApi.changeVolume(Math.min(1, Number((playerApi.volume + 0.05).toFixed(2))));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        playerApi.changeVolume(Math.max(0, Number((playerApi.volume - 0.05).toFixed(2))));
      } else if (e.key === "f" || e.key === "F") {
        if (selectedStation) {
          e.preventDefault();
          toggleFavorite(selectedStation);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerApi, currentPodcast, selectedStation, playAdjacentStation, toggleFavorite]);

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Animated SVG splash (first load) ── */}
      <SplashScreen />

      {/* ── Landing hub (Radio / Podcasts / iPod) ── */}
      <AnimatePresence>
        {hubOpen && (
          <motion.div key="hub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }} className="fixed inset-0 z-[150]">
            <HubScreen onChoose={handleHubChoice} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cosmic starfield (only in cosmic theme) ── */}
      {theme === "cosmic" && (
        <div className="cosmic-starfield fixed inset-0 pointer-events-none z-0" aria-hidden />
      )}

      {/* ── Synthwave sun + perspective grid (only in synthwave theme) ── */}
      {theme === "synthwave" && (
        <div className="synthwave-grid fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden />
      )}

      {/* ── Decorative SVG background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        {genre === "Zen" && <ZenBackground />}
        {genre !== "Zen" && (<>
        {/* Large radio-wave arcs — bottom left */}
        <svg className="absolute -bottom-32 -left-32 opacity-[0.06]" width="600" height="600" viewBox="0 0 600 600" fill="none">
          {[80,160,240,320,400,480].map((r, i) => (
            <circle key={r} cx="100" cy="500" r={r}
              stroke="url(#waveGrad)" strokeWidth="1.5"
              strokeDasharray={i % 2 === 0 ? "8 6" : "none"} />
          ))}
          <defs>
            <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Frequency grid — top right */}
        <svg className="absolute -top-10 -right-10 opacity-[0.04]" width="500" height="400" viewBox="0 0 500 400" fill="none">
          {Array.from({length: 12}).map((_,i) => (
            <line key={`h${i}`} x1="0" y1={i*35} x2="500" y2={i*35} stroke="var(--accent)" strokeWidth="0.8" />
          ))}
          {Array.from({length: 14}).map((_,i) => (
            <line key={`v${i}`} x1={i*38} y1="0" x2={i*38} y2="400" stroke="var(--accent)" strokeWidth="0.8" />
          ))}
          {/* Diagonal accent */}
          <line x1="0" y1="400" x2="500" y2="0" stroke="var(--accent-2)" strokeWidth="1" strokeDasharray="4 8" />
        </svg>

        {/* Antenna tower — right mid */}
        <svg className="absolute right-8 top-1/3 opacity-[0.05]" width="120" height="260" viewBox="0 0 120 260" fill="none">
          <line x1="60" y1="0" x2="60" y2="260" stroke="var(--accent)" strokeWidth="2" />
          <line x1="60" y1="0" x2="10" y2="100" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="60" y1="0" x2="110" y2="100" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="60" y1="40" x2="25" y2="110" stroke="var(--accent)" strokeWidth="1" />
          <line x1="60" y1="40" x2="95" y2="110" stroke="var(--accent)" strokeWidth="1" />
          {[100,130,160,190,220].map((y, i) => (
            <line key={y} x1={60-(i%2===0?30:20)} y1={y} x2={60+(i%2===0?30:20)} y2={y}
              stroke="var(--accent)" strokeWidth="1.2" />
          ))}
          {/* Signal pulses */}
          {[40,70,100].map((r, i) => (
            <circle key={r} cx="60" cy="0" r={r}
              stroke="var(--accent-2)" strokeWidth="1" opacity={0.6 - i*0.15}
              strokeDasharray="5 4" />
          ))}
        </svg>

        {/* Waveform strip — center bottom */}
        <svg className="absolute bottom-0 left-0 right-0 w-full opacity-[0.05]" height="80" preserveAspectRatio="none" viewBox="0 0 1200 80" fill="none">
          <polyline
            points={Array.from({length:120},(_,i)=>`${i*10},${40+Math.sin(i*0.7)*20*Math.sin(i*0.13)}`).join(' ')}
            stroke="var(--accent)" strokeWidth="1.5" fill="none" />
          <polyline
            points={Array.from({length:120},(_,i)=>`${i*10},${40+Math.cos(i*0.5)*15*Math.cos(i*0.19)}`).join(' ')}
            stroke="var(--accent-2)" strokeWidth="1" fill="none" />
        </svg>

        {/* Small circuit-like dot grid */}
        <svg className="absolute left-1/2 top-1/4 -translate-x-1/2 opacity-[0.04]" width="400" height="220" viewBox="0 0 400 220" fill="none">
          {/* Dots — alternating opacity via index pattern */}
          {Array.from({length: 5}).map((_,row) =>
            Array.from({length: 10}).map((_,col) => (
              <circle key={`${row}-${col}`} cx={col*44+22} cy={row*44+22} r="2"
                fill="var(--accent)" opacity={(row + col) % 3 === 0 ? 1 : 0.4} />
            ))
          )}
          {/* Horizontal lines */}
          {Array.from({length: 5}).map((_,row) =>
            Array.from({length: 9}).map((_,col) => (
              <line key={`l${row}-${col}`}
                x1={col*44+22} y1={row*44+22} x2={col*44+66} y2={row*44+22}
                stroke="var(--accent)" strokeWidth="0.6" opacity="0.5" />
            ))
          )}
          {/* Vertical connectors — some */}
          {[1,3,5,7].map((col) =>
            [0,2].map((row) => (
              <line key={`v${row}-${col}`}
                x1={col*44+22} y1={row*44+22} x2={col*44+22} y2={row*44+66}
                stroke="var(--accent-2)" strokeWidth="0.6" opacity="0.5" />
            ))
          )}
        </svg>
        </>)}
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 glass-dark border-b metal-texture relative"
        style={{ borderColor: "var(--glass-border)", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-2.5">

          {/* ── Line 1 — brand + glassy control banner ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Brand */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                {/* Signal arcs */}
                <svg className="absolute -right-2 -top-2 pointer-events-none" width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M2 16 Q2 2 16 2" stroke="var(--accent)" strokeWidth="1.4" fill="none" opacity="0.6" />
                  <path d="M5 16 Q5 5 16 5" stroke="var(--accent-2)" strokeWidth="1" fill="none" opacity="0.4" />
                  <circle cx="16" cy="2" r="1.6" fill="var(--accent)" opacity="0.8" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-xl sm:text-2xl leading-none text-gradient">RadioFR</h1>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70 tracking-wide">
                    Radio-PaLaMa
                  </span>
                </div>
                <p className="text-white/40 text-[11px] leading-none mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Radios & Podcasts Live
                </p>
              </div>
              {/* Mini EQ bars decoration */}
              <div className="hidden md:flex items-end gap-0.5 h-6 ml-1.5">
                {[40,70,55,80,45,65,35,75,50,60].map((h, i) => (
                  <div key={i} className="w-[3px] rounded-sm flex-shrink-0"
                    style={{
                      height: `${h}%`,
                      background: `var(--accent)`,
                      opacity: 0.25 + i * 0.03,
                    }} />
                ))}
              </div>
            </div>

            {/* Glassy control banner — bigger icons */}
            <div className="flex items-center gap-1 sm:gap-2 glass rounded-2xl p-1.5 sm:p-2"
              style={{ border: "1px solid var(--glass-border)" }}>
              {/* Home / hub button */}
              <button
                onClick={() => setHubOpen(true)}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl glass-hover flex items-center justify-center transition-all active:scale-90"
                title="Accueil" aria-label="Revenir à l'accueil"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                  <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                  <path d="M9.5 21v-6h5v6" />
                </svg>
              </button>
              {/* iPod button */}
              <button
                onClick={() => setIpodOpen(true)}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl glass-hover flex items-center justify-center transition-all active:scale-90"
                title="Mode iPod" aria-label="Ouvrir le mode iPod"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                  <rect x="6" y="1" width="12" height="22" rx="3" />
                  <rect x="8" y="3" width="8" height="6" rx="1" />
                  <circle cx="12" cy="16" r="4" />
                  <circle cx="12" cy="16" r="1.5" />
                </svg>
              </button>
              {/* DJ button */}
              <button
                onClick={() => { playerApi.pause(); setDjOpen(true); }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl glass-hover flex items-center justify-center transition-all active:scale-90"
                title="Mode DJ" aria-label="Ouvrir le mode DJ"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                  <circle cx="7" cy="12" r="3" /><circle cx="7" cy="12" r="0.5" fill="currentColor" />
                  <circle cx="17" cy="12" r="3" /><circle cx="17" cy="12" r="0.5" fill="currentColor" />
                  <path d="M2 19h20M4 19v-3M20 19v-3" />
                </svg>
              </button>
              {/* Config button */}
              <button
                onClick={() => setConfigOpen(true)}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl glass-hover flex items-center justify-center transition-all active:scale-90"
                title="Configuration" aria-label="Ouvrir la configuration"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Line 2 — nav tabs with animated sliding pill indicator ── */}
          <div className="flex flex-wrap glass rounded-2xl p-1 gap-0.5 relative">
            {TABS.map((t) => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  aria-label={t.label} aria-current={isActive ? "page" : undefined}
                  className={`relative flex-1 min-w-fit px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 whitespace-nowrap flex items-center justify-center gap-1.5 z-10 ${
                    isActive ? "text-white" : "text-white/50 hover:text-white/85"
                  }`}>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: "var(--accent)",
                        boxShadow: "0 0 16px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
                      }}
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <TabIcon id={t.id} size={18} />
                    <span>{t.label}</span>
                    {t.id === "favoris" && favorites.length > 0 && (
                      <span className="text-[9px] rounded-full px-1.5 py-0.5 leading-none font-bold"
                        style={{
                          background: isActive ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)",
                          color: isActive ? "#ffffff" : "var(--accent)"
                        }}>
                        {favorites.length}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 relative z-10 items-start pb-28 lg:pb-8">

        {/* ── Player desktop (hidden on mobile, sticky on lg) ── */}
        <div className="hidden lg:block lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24 space-y-4">
          {youtubeTrack && (
            <YouTubeMiniPlayer track={youtubeTrack} onClose={() => setYoutubeTrack(null)} />
          )}
          {!youtubeTrack && (
            <Player
              station={currentStation}
              podcast={currentPodcast}
              playerApi={playerApi}
              ipodOpen={ipodOpen}
              isFavorite={selectedStation ? isFavorite(selectedStation.id) : false}
              onToggleFavorite={selectedStation ? () => toggleFavorite(selectedStation) : undefined}
              nowPlaying={nowPlaying}
            />
          )}
          {(currentStation || currentPodcast) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <ClipVisualizer
                analyserRef={playerApi.analyserRef}
                isPlaying={playerApi.isPlaying}
                color={currentStation?.color ?? "var(--accent)"}
              />
            </motion.div>
          )}
        </div>

        {/* ── Left — tabs content ── */}
        <div className="lg:col-start-1 lg:row-start-1">
          <AnimatePresence mode="wait">

            {tab === "radio" && (
              <motion.div key="radio"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}>

                {/* ── Radio Search & Random Zapping Bar ── */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={stationQuery}
                      onChange={(e) => setStationQuery(e.target.value)}
                      placeholder="Rechercher une radio (nom, FM, genre)…"
                      className="w-full glass rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-white/35 outline-none border border-white/10 focus:border-[var(--accent)] transition-all"
                    />
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    {stationQuery && (
                      <button
                        onClick={() => setStationQuery("")}
                        aria-label="Effacer la recherche"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 text-white/80 flex items-center justify-center transition-all"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Zapping Aléatoire Button */}
                  <button
                    onClick={handleRandomZapping}
                    title="Lancer une radio au hasard"
                    className="px-3 py-2 rounded-xl text-xs font-semibold glass glass-hover text-white flex items-center gap-1.5 transition-all active:scale-95 border border-white/10 flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))"
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" />
                    </svg>
                    <span>Zapper</span>
                  </button>
                </div>

                {/* Zapping Feedback Notification */}
                <AnimatePresence>
                  {zappingFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      className="mb-3 p-2 rounded-xl text-center text-xs font-semibold text-white glass border border-[var(--accent)]/40 shadow-lg flex items-center justify-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Zapping vers : <strong className="text-[var(--accent)]">{zappingFeedback}</strong></span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Genres ── */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {GENRES.map((g) => {
                    const isZen = g === "Zen";
                    const on = genre === g;
                    return (
                      <button key={g} onClick={() => setGenre(g)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all ${
                          on ? "text-white" : isZen
                            ? "glass glass-hover text-emerald-300/80 hover:text-emerald-200"
                            : "glass glass-hover text-white/60 hover:text-white"
                        }`}
                        style={on ? (isZen ? {
                          background: "linear-gradient(135deg,#10b981,#5eead4)",
                          boxShadow: "0 0 12px rgba(94,234,212,0.5)",
                        } : {
                          background: "var(--accent)",
                          boxShadow: "0 0 10px rgba(59,130,246,0.4)",
                        }) : {}}>
                        {isZen ? "Zen" : g}
                      </button>
                    );
                  })}
                </div>

                {/* Section header decoration + Sort & View toggles */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-medium opacity-40 uppercase" style={{ color: "var(--accent)" }}>
                    {filteredStations.length} STATION{filteredStations.length > 1 ? "S" : ""}
                  </span>
                  <div className="flex-1 h-px opacity-40" style={{ background: "linear-gradient(to right, var(--accent), transparent)" }} />

                  {/* Sort Controls */}
                  <div className="flex items-center gap-1 glass rounded-lg p-0.5 text-[10px] font-medium text-white/50">
                    <button
                      onClick={() => setStationSort("default")}
                      className={`px-2 py-1 rounded-md transition-all ${stationSort === "default" ? "bg-white/15 text-white font-semibold" : "hover:text-white"}`}
                      title="Ordre recommandé"
                    >
                      Top
                    </button>
                    <button
                      onClick={() => setStationSort("name")}
                      className={`px-2 py-1 rounded-md transition-all ${stationSort === "name" ? "bg-white/15 text-white font-semibold" : "hover:text-white"}`}
                      title="Trier de A à Z"
                    >
                      A-Z
                    </button>
                    <button
                      onClick={() => setStationSort("freq")}
                      className={`px-2 py-1 rounded-md transition-all ${stationSort === "freq" ? "bg-white/15 text-white font-semibold" : "hover:text-white"}`}
                      title="Trier par fréquence FM"
                    >
                      FM
                    </button>
                  </div>

                  {/* List / Grid toggle */}
                  <div className="flex items-center gap-1 glass rounded-lg p-0.5">
                    <button onClick={() => setStationView("list")} title="Liste détaillée"
                      className={`p-1.5 rounded-md transition-all ${stationView === "list" ? "text-white" : "text-white/40 hover:text-white/70"}`}
                      style={stationView === "list" ? { background: "var(--accent)" } : {}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </button>
                    <button onClick={() => setStationView("grid")} title="Grille de logos"
                      className={`p-1.5 rounded-md transition-all ${stationView === "grid" ? "text-white" : "text-white/40 hover:text-white/70"}`}
                      style={stationView === "grid" ? { background: "var(--accent)" } : {}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                    </button>
                  </div>
                </div>

                {filteredStations.length === 0 ? (
                  <div className="glass rounded-2xl p-10 text-center space-y-3">
                    <p className="text-white/60 text-sm font-medium">Aucune station trouvée pour « {stationQuery} »</p>
                    <button
                      onClick={() => { setStationQuery(""); setGenre("Tous"); }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-[var(--accent)] transition-all"
                    >
                      Réinitialiser la recherche
                    </button>
                  </div>
                ) : stationView === "grid" ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {filteredStations.map((station) => {
                      const active = selectedStation?.id === station.id;
                      const playing = active && playerApi.isPlaying;
                      return (
                        <button key={station.id} onClick={() => handlePlay(station)} title={station.name}
                          className="relative aspect-square rounded-2xl glass glass-hover flex items-center justify-center transition-all active:scale-95"
                          style={active ? { boxShadow: `0 0 0 2px ${station.color}, 0 0 18px ${station.color}66` } : {}}>
                          <StationLogo logo={station.logo} name={station.name} color={station.color} size="lg" />
                          {isEqCompatible(station.streamUrl) && (
                            <span title="Égaliseur disponible"
                              className="absolute bottom-1.5 left-1.5 flex items-center justify-center rounded-md"
                              style={{ background: `${station.color}dd`, color: "#fff", padding: "1px 3px" }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                                <line x1="6" y1="3" x2="6" y2="21" /><line x1="12" y1="8" x2="12" y2="21" /><line x1="18" y1="14" x2="18" y2="21" />
                                <line x1="3" y1="9" x2="9" y2="9" /><line x1="9" y1="14" x2="15" y2="14" /><line x1="15" y1="6" x2="21" y2="6" />
                              </svg>
                            </span>
                          )}
                          {playing && (
                            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredStations.map((station) => {
                      const isActive = selectedStation?.id === station.id;
                      const activeTrack = isActive ? (nowPlaying.songTitle ? `${nowPlaying.songTitle}${nowPlaying.songArtist ? " • " + nowPlaying.songArtist : ""}` : null) : null;
                      return (
                        <StationCard key={station.id} station={station}
                          isActive={isActive}
                          isPlaying={isActive && playerApi.isPlaying}
                          nowPlayingTrack={activeTrack}
                          analyserRef={playerApi.analyserRef}
                          isFavorite={isFavorite(station.id)}
                          onClick={() => handlePlay(station)}
                          onToggleFavorite={() => toggleFavorite(station)} />
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {tab === "webradio" && (
              <motion.div key="webradio"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                <WebRadioPanel
                  onPlay={(s) => { setCurrentPodcast(null); setSelectedStation(s); playerApi.initAudio(preferredStreamUrl(s)); }}
                  currentUrl={playerApi.currentUrl}
                  isPlaying={playerApi.isPlaying}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              </motion.div>
            )}

            {tab === "search" && (
              <motion.div key="search"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                <RadioSearch
                  onPlay={(s) => { setCurrentPodcast(null); setSelectedStation(s); playerApi.initAudio(preferredStreamUrl(s)); }}
                  onToggleFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                  currentUrl={playerApi.currentUrl}
                  isPlaying={playerApi.isPlaying}
                />
              </motion.div>
            )}

            {tab === "favoris" && (
              <motion.div key="favoris"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-14 text-center">
                    {/* SVG star constellation illustration */}
                    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="opacity-30" aria-hidden>
                      {/* Radio waves */}
                      {[20, 36, 52].map((r) => (
                        <path key={r}
                          d={`M ${60-r*0.7} ${50+r*0.5} A ${r} ${r} 0 0 1 ${60+r*0.7} ${50+r*0.5}`}
                          stroke="var(--accent)" strokeWidth="1.2" fill="none" strokeDasharray="4 3" />
                      ))}
                      {/* Center star */}
                      <polygon points="60,20 63.5,30 74,30 65.5,36 68.5,46 60,40 51.5,46 54.5,36 46,30 56.5,30"
                        fill="var(--accent)" opacity="0.7" />
                      {/* Small stars */}
                      <polygon points="20,15 21.5,20 26,20 22.5,23 24,28 20,25 16,28 17.5,23 14,20 18.5,20"
                        fill="var(--accent-2)" opacity="0.5" />
                      <polygon points="100,35 101,38 104,38 102,40 102.5,43 100,41.5 97.5,43 98,40 96,38 99,38"
                        fill="var(--accent)" opacity="0.4" />
                      {/* Horizontal line */}
                      <line x1="0" y1="80" x2="120" y2="80" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="3 5" />
                    </svg>
                    <p className="text-white/40 text-sm font-medium">Aucun favori pour l'instant</p>
                    <p className="text-white/20 text-xs max-w-xs leading-relaxed">
                      Touche l'icône étoile d'une station pour la retrouver ici en un instant.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-4 font-medium">
                      Ma liste · {favorites.length} station{favorites.length > 1 ? "s" : ""}
                    </p>
                    {favorites.map((s) => {
                      const isActive = selectedStation?.id === s.id;
                      const activeTrack = isActive ? (nowPlaying.songTitle ? `${nowPlaying.songTitle}${nowPlaying.songArtist ? " • " + nowPlaying.songArtist : ""}` : null) : null;
                      return (
                        <StationCard key={s.id} station={withLogo(s)}
                          isActive={isActive}
                          isPlaying={isActive && playerApi.isPlaying}
                          nowPlayingTrack={activeTrack}
                          analyserRef={playerApi.analyserRef}
                          isFavorite={true}
                          onClick={() => handlePlay(withLogo(s))}
                          onToggleFavorite={() => toggleFavorite(s)} />
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {tab === "podcasts" && (
              <motion.div key="podcasts"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <SpotifyPanel
                  ref={spotifyPanelRef}
                  currentEpisodeUrl={currentPodcast?.audioUrl ?? null}
                  isPlaying={playerApi.isPlaying}
                  onPlayEpisode={handlePlayEpisode}
                />
              </motion.div>
            )}

            {tab === "audius" && (
              <motion.div key="audius"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <AudiusView
                  currentEpisodeUrl={currentPodcast?.audioUrl ?? null}
                  isPlaying={playerApi.isPlaying}
                  onPlayEpisode={handlePlayEpisode}
                  onPlayYouTube={handlePlayYouTube}
                  youtubeTrackId={youtubeTrack?.id ?? null}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      <footer className="text-center py-4 text-xs border-t"
        style={{ color: "rgba(255,255,255,0.12)", borderColor: "var(--glass-border)" }}>
        RadioFR · Radios & Podcasts Français · 2026
      </footer>

      {/* ── Mobile Floating Mini Player (docked at bottom) ── */}
      <AnimatePresence>
        {(currentStation || currentPodcast) && !mobilePlayerExpanded && (
          <MobileMiniPlayer
            station={currentStation}
            podcast={currentPodcast}
            isPlaying={playerApi.isPlaying}
            isLoading={playerApi.isLoading}
            onTogglePlay={playerApi.togglePlay}
            onExpand={() => setMobilePlayerExpanded(true)}
            isFavorite={selectedStation ? isFavorite(selectedStation.id) : false}
            onToggleFavorite={selectedStation ? () => toggleFavorite(selectedStation) : undefined}
            nowPlaying={nowPlaying}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile Expandable Bottom Sheet / Drawer ── */}
      <AnimatePresence>
        {mobilePlayerExpanded && (currentStation || currentPodcast) && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobilePlayerExpanded(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="relative z-10 max-h-[92vh] overflow-y-auto rounded-t-[32px] bg-[#0c1322] border-t border-white/15 p-3 pb-8 shadow-2xl space-y-4"
            >
              <Player
                station={currentStation}
                podcast={currentPodcast}
                playerApi={playerApi}
                ipodOpen={ipodOpen}
                isFavorite={selectedStation ? isFavorite(selectedStation.id) : false}
                onToggleFavorite={selectedStation ? () => toggleFavorite(selectedStation) : undefined}
                nowPlaying={nowPlaying}
                onClose={() => setMobilePlayerExpanded(false)}
              />
              <ClipVisualizer
                analyserRef={playerApi.analyserRef}
                isPlaying={playerApi.isPlaying}
                color={currentStation?.color ?? "var(--accent)"}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Config panel */}
      <ConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />

      {/* iPod overlay */}
      <IpodOverlay
        open={ipodOpen}
        onClose={() => setIpodOpen(false)}
        playerApi={playerApi}
        station={currentStation}
        currentPodcast={currentPodcast}
        stations={STATIONS}
        onSelectStation={(s) => {
          setCurrentPodcast(null);
          setSelectedStation(s);
          playerApi.initAudio(preferredStreamUrl(s));
        }}
        onPlayEpisode={handlePlayEpisode}
      />

      {/* DJ mode */}
      <DjMode open={djOpen} onClose={() => setDjOpen(false)} />
    </div>
  );
}
