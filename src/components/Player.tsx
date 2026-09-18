"use client";
import {
  useAudioPlayer,
  BASS_BOOSTER,
  VOICE_ISOLATION,
  VOCAL_CLARITY,
  NEWS_SPEECH,
  PODCAST_PRO,
  WARM_ACOUSTIC,
  CONCERT_HALL,
  DYNAMIC_PUNCH,
} from "@/hooks/useAudioPlayer";
import { Station, StreamQuality } from "@/lib/stations";
import AudioVisualizer from "./AudioVisualizer";
import Equalizer from "./Equalizer";
import StationLogo from "./StationLogo";
import TascamPlayer from "./TascamPlayer";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { NowPlayingInfo } from "@/hooks/useNowPlaying";

interface PodcastNowPlaying {
  episodeTitle: string;
  audioUrl: string;
  podcastName: string;
  artwork: string;
  isVideo?: boolean;
  kind?: "music" | "podcast";
}

interface Props {
  station: Station | null;
  podcast?: PodcastNowPlaying | null;
  playerApi: ReturnType<typeof useAudioPlayer>;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  ipodOpen?: boolean;
  nowPlaying?: NowPlayingInfo;
  onClose?: () => void;
}

export default function Player({
  station,
  podcast,
  playerApi,
  isFavorite,
  onToggleFavorite,
  ipodOpen,
  nowPlaying,
  onClose,
}: Props) {
  const [showEQ, setShowEQ] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [activeQuality, setActiveQuality] = useState<StreamQuality | null>(null);
  const [sharedToast, setSharedToast] = useState<string | null>(null);

  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  const {
    isPlaying, volume, isLoading, error, eqActive,
    currentTime, duration,
    reconnecting, reconnectAttempt, offline, retry,
    analyserRef, filtersRef, mediaElRef, togglePlay, play, pause, changeVolume, seekTo,
    bands, updateBand, applyPreset, resetEQ, initAudio,
    playbackRate, setPlaybackRate, seekRelative,
    sleepTimerRemaining, addSleepMinutes, cancelSleepTimer,
    isLooping, toggleLoop,
    nightMode, toggleNightMode,
    stereoPan, setStereoPan,
    spatialAudio, toggleSpatialAudio,
    toggleMute,
  } = playerApi;

  const handleShare = async () => {
    const shareTitle = isPodcast ? podcast!.episodeTitle : (station?.name || "Radio-Palama");
    const shareText = isPodcast
      ? `Écoute "${podcast!.episodeTitle}" (${podcast!.podcastName}) sur Radio-Palama`
      : `Écoute ${station?.name || "la radio"} en direct sur Radio-Palama`;
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://radio-fr.vercel.app";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareText} — ${shareUrl}`);
        setSharedToast("Lien copié dans le presse-papier !");
        setTimeout(() => setSharedToast(null), 2400);
      } catch {}
    }
  };

  // "24:05" for anything under an hour, "1:04:05" past that.
  const formatSleepRemaining = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const isPodcast = !!podcast && !station;
  const isVideo   = isPodcast && !!podcast?.isVideo;
  const isMusic   = isPodcast && podcast?.kind === "music";

  // Mount the shared <video> media element into a tiny viewport for video
  // podcasts. It's the SAME element that plays the audio, so there's no double
  // playback — we just reveal its picture. Re-runs when the episode changes
  // (a fresh element is created per episode) so the new frame attaches.
  const videoBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = videoBoxRef.current;
    const el = mediaElRef.current as HTMLVideoElement | null;
    if (!box || !el || !isVideo) return;
    if (ipodOpen) return;   // iPod overlay owns the element while it's open
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.objectFit = "contain";
    el.style.display = "block";
    el.style.background = "#000";
    box.appendChild(el);
    return () => { if (el.parentNode === box) box.removeChild(el); };
  }, [isVideo, podcast?.audioUrl, mediaElRef, ipodOpen]);
  const accentColor = station?.color ?? "var(--accent)";

  const anyBandActive = bands.some((b) => b.gain !== 0);

  // Derived active state for one-tap modes (compare current bands to preset)
  const matchesPreset = (preset: number[]) => bands.every((b, i) => b.gain === preset[i]);
  const bassOn       = matchesPreset(BASS_BOOSTER);
  const voiceOn      = matchesPreset(VOICE_ISOLATION);
  const vocalClarityOn = matchesPreset(VOCAL_CLARITY);
  const newsSpeechOn   = matchesPreset(NEWS_SPEECH);
  const podcastProOn   = matchesPreset(PODCAST_PRO);
  const warmAcousticOn = matchesPreset(WARM_ACOUSTIC);
  const concertHallOn  = matchesPreset(CONCERT_HALL);
  const dynamicPunchOn = matchesPreset(DYNAMIC_PUNCH);

  const toggleMode = (preset: number[], on: boolean) =>
    on ? resetEQ() : applyPreset(preset);

  // Determine current stream (selected quality, else station default — the
  // lowest-bitrate tier when "Économie de données" is on, matching what
  // page.tsx actually loaded via preferredStreamUrl()).
  let lowBandwidth = false;
  try { lowBandwidth = localStorage.getItem("radiofr_low_bandwidth") === "1"; } catch {}
  const currentStream = activeQuality ?? (lowBandwidth
    ? (station?.streams?.[0] ?? station?.streams?.[1])
    : (station?.streams?.[1] ?? station?.streams?.[0]));

  const handleQualityChange = (q: StreamQuality) => {
    setActiveQuality(q);
    if (station) initAudio(q.url);
  };

  if (!station && !podcast) {
    return (
      <div className="glass-dark rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <div className="w-12 h-12 rounded-full glass flex items-center justify-center opacity-30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <p className="text-white/30 text-sm">Sélectionne une station ou un podcast</p>
      </div>
    );
  }

  function fmt(s: number) {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const streams = station?.streams ?? [];

  return (
    <div className="glass-dark rounded-3xl overflow-hidden shadow-glass-lg relative">
      {/* ── Decorative SVG background ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]"
        viewBox="0 0 340 260" preserveAspectRatio="none" aria-hidden>
        {/* Horizontal scan lines */}
        {Array.from({length: 10}).map((_,i) => (
          <line key={i} x1="0" y1={i * 28} x2="340" y2={i * 28}
            stroke="var(--accent)" strokeWidth="0.6" />
        ))}
        {/* Corner arc top-left */}
        <path d="M 0 0 Q 55 0 55 55" stroke="var(--accent-2)" strokeWidth="1.2" fill="none" />
        {/* Corner arc bottom-right */}
        <path d="M 340 260 Q 285 260 285 205" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
        {/* Right-side mini frequency bars */}
        {[18,28,42,22,35,18,38,24,30,16].map((h, i) => (
          <rect key={i} x={300 + i * 4} y={130 - h / 2}
            width="2.5" height={h}
            fill="var(--accent)" opacity="0.55" rx="1" />
        ))}
      </svg>

      {/* Optional top handle / close bar for mobile modal sheet */}
      {onClose && (
        <div className="flex items-center justify-between px-5 pt-3.5 pb-1 lg:hidden">
          <div className="w-8" />
          <div className="w-12 h-1 bg-white/20 rounded-full" />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full glass-hover flex items-center justify-center text-white/50 hover:text-white"
            title="Réduire"
            aria-label="Réduire le lecteur"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {/* Header — station OR podcast */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-4">
          {/* Artwork / Logo */}
          <div className="relative flex-shrink-0">
            {isPlaying && (
              <svg className="absolute inset-0 -m-3 pointer-events-none" width="78" height="78" viewBox="0 0 78 78" fill="none" aria-hidden>
                <circle cx="39" cy="39" r="34" stroke={accentColor} strokeWidth="1"
                  strokeDasharray="4 3" opacity="0.4" />
                <circle cx="39" cy="39" r="37" stroke={accentColor} strokeWidth="0.5"
                  strokeDasharray="2 6" opacity="0.2" />
              </svg>
            )}
            {isPodcast ? (
              podcast!.artwork
                ? <img src={podcast!.artwork} alt={podcast!.podcastName}
                    className="w-14 h-14 rounded-2xl object-cover"
                    style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }} />
                : <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </div>
            ) : (
              <StationLogo logo={station!.logo} name={station!.name} color={station!.color} size="lg" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {isPodcast ? (
              <>
                <h2 className="font-semibold text-white text-sm leading-tight line-clamp-2">{podcast!.episodeTitle}</h2>
                <p className="text-white/50 text-xs mt-0.5 truncate">{podcast!.podcastName}</p>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-white text-lg leading-tight truncate">{station!.name}</h2>
                <p className="text-white/50 text-sm">{station!.tagline}</p>
                {station!.freq && (
                  <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium"
                    style={{ background: `${station!.color}22`, color: station!.color }}>
                    {station!.freq}
                  </span>
                )}
                {/* Live now playing track info */}
                {!isPodcast && nowPlaying?.songTitle && (
                  <div className="mt-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.07] border border-white/10">
                    <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
                      <span className="w-0.5 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-full" style={{ background: accentColor }} />
                      <span className="w-0.5 rounded-full animate-[pulse_0.9s_ease-in-out_0.2s_infinite] h-2/3" style={{ background: accentColor }} />
                      <span className="w-0.5 rounded-full animate-[pulse_0.8s_ease-in-out_0.4s_infinite] h-4/5" style={{ background: accentColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white truncate leading-tight">
                        {nowPlaying.songTitle}
                      </p>
                      {nowPlaying.songArtist && (
                        <p className="text-[10px] text-white/60 truncate leading-tight mt-0.5">
                          {nowPlaying.songArtist}
                        </p>
                      )}
                    </div>
                    {/* Copy track name button */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const trackStr = `${nowPlaying.songTitle}${nowPlaying.songArtist ? " - " + nowPlaying.songArtist : ""}`;
                        try {
                          await navigator.clipboard.writeText(trackStr);
                          setSharedToast(`Titre copié : ${nowPlaying.songTitle}`);
                          setTimeout(() => setSharedToast(null), 2500);
                        } catch {}
                      }}
                      title="Copier le titre en cours"
                      aria-label="Copier le titre en cours"
                      className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all active:scale-90 flex-shrink-0"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {isPodcast ? (
              <span className="text-[10px] font-medium px-2 py-1 rounded-full glass text-white/60 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                </svg>
                Podcast
              </span>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
                <span className="text-xs text-white/60 font-medium">LIVE</span>
              </div>
            )}
            {/* Share button */}
            <button onClick={handleShare} className="p-1.5 rounded-lg glass-hover transition-all text-white/40 hover:text-white"
              aria-label="Partager" title="Partager">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>

            {!isPodcast && onToggleFavorite && (
              <button onClick={onToggleFavorite} className="p-1.5 rounded-lg glass-hover transition-all"
                aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                aria-pressed={isFavorite} title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
                <svg width="16" height="16" viewBox="0 0 24 24"
                  fill={isFavorite ? "currentColor" : "none"}
                  stroke="currentColor" strokeWidth="2"
                  className={isFavorite ? "text-yellow-400" : "text-white/30"}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Share toast notification */}
        <AnimatePresence>
          {sharedToast && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="mt-2 py-1 px-3 rounded-full text-center text-xs font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
            >
              {sharedToast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Podcast progress bar & playback speed */}
        {isPodcast && duration > 0 && (
          <div className="mt-3 space-y-1.5">
            <input type="range" min={0} max={duration} step={1} value={currentTime}
              onChange={e => seekTo(Number(e.target.value))}
              className="w-full" style={{ accentColor: "var(--accent)" }} />
            <div className="flex items-center justify-between text-[10px] text-white/35 font-mono">
              <span>{fmt(currentTime)}</span>
              {/* Playback speed selector */}
              <div className="flex items-center gap-1 font-sans">
                {SPEEDS.map(rate => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                      playbackRate === rate
                        ? "bg-white/20 text-white border border-white/20 shadow-sm"
                        : "text-white/35 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
              <span>{fmt(duration)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tiny video viewport — only for video podcasts */}
      {isVideo && (
        <div className="px-5 pb-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide"
              style={{ background: "var(--accent)22", color: "var(--accent)" }}>VIDÉO</span>
          </div>
          <div ref={videoBoxRef}
            className="mx-auto rounded-xl overflow-hidden glass"
            style={{ width: 132, aspectRatio: "16/9", border: "1px solid var(--glass-border)" }} />
        </div>
      )}

      {/* TASCAM CD-200 rack deck — only for music tracks */}
      {isMusic && (
        <div className="px-5 pb-1 pt-1">
          <TascamPlayer
            title={podcast!.episodeTitle}
            artist={podcast!.podcastName}
            isPlaying={isPlaying}
            isLoading={isLoading}
            currentTime={currentTime}
            duration={duration}
            onPlay={() => (isPlaying ? pause() : play())}
            onPause={pause}
            onSeek={seekTo}
            accent={accentColor}
          />
        </div>
      )}

      {/* Visualizer */}
      <div className="px-5 py-2">
        <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={station?.color} />
      </div>

      {/* Controls */}
      <div className="px-5 pb-3 space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Skip -15s for Podcasts / Tracks */}
          {(isPodcast || duration > 0) && (
            <button
              onClick={() => seekRelative(-15)}
              aria-label="Reculer de 15 secondes"
              title="Reculer de 15 secondes"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center glass glass-hover text-white/70 hover:text-white transition-all active:scale-90 flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                <text x="12" y="15" fontSize="7.5" fontWeight="bold" fill="currentColor" textAnchor="middle" stroke="none">15</text>
              </svg>
            </button>
          )}

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            aria-label={isPlaying ? "Pause" : "Lecture"}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`,
              boxShadow: `0 0 16px ${accentColor}55` }}
          >
            {(isLoading || reconnecting) ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            )}
          </button>

          {/* Quick Skip +30s for Podcasts / Tracks */}
          {(isPodcast || duration > 0) && (
            <button
              onClick={() => seekRelative(30)}
              aria-label="Avancer de 30 secondes"
              title="Avancer de 30 secondes"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center glass glass-hover text-white/70 hover:text-white transition-all active:scale-90 flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                <text x="12" y="15" fontSize="7.5" fontWeight="bold" fill="currentColor" textAnchor="middle" stroke="none">30</text>
              </svg>
            </button>
          )}

          {/* Volume with mute toggle */}
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={toggleMute}
              aria-label={volume === 0 ? "Activer le son" : "Couper le son"}
              title={volume === 0 ? "Activer le son" : "Couper le son"}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0"
            >
              {volume === 0 ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
            <input type="range" min={0} max={1} step={0.02} value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume" title={`Volume ${Math.round(volume * 100)}%`}
              className="flex-1" style={{ accentColor: "var(--accent)" }} />
            <span className="text-xs text-white/30 w-7 text-right tabular-nums">
              {Math.round(volume * 100)}
            </span>
          </div>

          {/* EQ toggle */}
          <button
            onClick={() => setShowEQ((v) => !v)}
            aria-label="Afficher l'égaliseur" aria-expanded={showEQ}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center gap-1.5 ${
              showEQ ? "" : "text-white/40"
            }`}
            style={showEQ ? { color: "var(--accent)" } : {}}
            title={!eqActive ? "EQ indisponible (CORS stream)" : "Égaliseur"}
          >
            EQ
            {anyBandActive && eqActive && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--accent)" }} />
            )}
            {!eqActive && (
              <span className="text-[9px] text-white/25">off</span>
            )}
          </button>
        </div>

        {/* One-tap audio modes */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!eqActive) {
                  setSharedToast("Égaliseur indisponible sur ce flux radio (sécurité CORS du serveur)");
                  setTimeout(() => setSharedToast(null), 3500);
                  return;
                }
                toggleMode(BASS_BOOSTER, bassOn);
              }}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center justify-center gap-1.5 ${
                !eqActive ? "opacity-40 cursor-pointer" : ""
              } ${bassOn ? "" : "text-white/45"}`}
              style={bassOn ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
              title={!eqActive ? "Cliquer pour plus d'infos : non supporté par ce flux" : "Bass Booster"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <span>Bass Boost</span>
              {bassOn && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              )}
            </button>
            <button
              onClick={() => {
                if (!eqActive) {
                  setSharedToast("Égaliseur indisponible sur ce flux radio (sécurité CORS du serveur)");
                  setTimeout(() => setSharedToast(null), 3500);
                  return;
                }
                toggleMode(VOICE_ISOLATION, voiceOn);
              }}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center justify-center gap-1.5 ${
                !eqActive ? "opacity-40 cursor-pointer" : ""
              } ${voiceOn ? "" : "text-white/45"}`}
              style={voiceOn ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
              title={!eqActive ? "Cliquer pour plus d'infos : non supporté par ce flux" : "Voice Isolation"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              <span>Voix Nette</span>
              {voiceOn && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              )}
            </button>
          </div>

          {!eqActive && (
            <p className="text-[10px] text-white/40 text-center px-2">
              Flux sans CORS : égaliseur désactivé pour éviter les coupures. Essayez France Inter, FIP, RTL ou NRJ.
            </p>
          )}
        </div>

        {/* Quality selector — radio only */}
        {!isPodcast && streams.length > 1 && (
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="text-white/30 flex-shrink-0">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span className="text-xs text-white/30 flex-shrink-0">Qualité</span>
            <div className="flex gap-1 flex-wrap">
              {streams.map((q) => {
                const isActive = (activeQuality?.url ?? station?.streams?.[1]?.url ?? station?.streamUrl) === q.url;
                return (
                  <button
                    key={q.url}
                    onClick={() => handleQualityChange(q)}
                    className={`text-xs px-2 py-0.5 rounded-full transition-all font-medium ${
                      isActive
                        ? "text-white"
                        : "glass glass-hover text-white/40 hover:text-white/70"
                    }`}
                    style={isActive ? {
                      background: `${station?.color}44`,
                      border: `1px solid ${station?.color}66`,
                      color: station?.color,
                    } : {}}
                    title={q.bitrate}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            {currentStream && (
              <span className="text-[10px] text-white/20 ml-auto tabular-nums">{currentStream.bitrate}</span>
            )}
          </div>
        )}

        {/* Advanced Playback Options Drawer */}
        <div className="space-y-1.5 pt-0.5">
          <button
            onClick={() => setShowOptions((v) => !v)}
            aria-label="Options de lecture"
            aria-expanded={showOptions}
            className={`w-full px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-between border ${
              showOptions
                ? "bg-white/[0.09] border-white/20 text-white shadow-sm"
                : (nightMode || spatialAudio || isLooping || stereoPan !== 0)
                  ? "bg-white/[0.06] border-[var(--accent)] text-white"
                  : "bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:bg-white/[0.07] hover:border-white/20"
            }`}
            style={nightMode || spatialAudio || isLooping || stereoPan !== 0 ? { color: "var(--accent)" } : {}}
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-white/10 text-white/80">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </div>
              <span className="tracking-wide">Options de lecture</span>
            </div>
            <div className="flex items-center gap-2">
              {(nightMode || spatialAudio || isLooping || stereoPan !== 0) && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15" style={{ color: "var(--accent)" }}>
                  Actif
                </span>
              )}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${showOptions ? "rotate-180" : "text-white/40"}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2 pt-1 pb-1"
              >
                {/* Toggles row */}
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Mode Nuit (Dynamic Compressor) */}
                  <button
                    onClick={toggleNightMode}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all glass glass-hover flex flex-col items-center justify-center gap-1 text-center ${
                      nightMode ? "" : "text-white/45"
                    }`}
                    style={nightMode ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
                    title="Compression dynamique pour lisser le volume (pubs et jingles atténués)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                    </svg>
                    <span>Mode Nuit</span>
                  </button>

                  {/* Audio Spatial 3D */}
                  <button
                    onClick={toggleSpatialAudio}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all glass glass-hover flex flex-col items-center justify-center gap-1 text-center ${
                      spatialAudio ? "" : "text-white/45"
                    }`}
                    style={spatialAudio ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
                    title="Élargissement spatial stéréo et clarté immersive"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>Spatial 3D</span>
                  </button>

                  {/* Boucle / Repeat */}
                  <button
                    onClick={toggleLoop}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all glass glass-hover flex flex-col items-center justify-center gap-1 text-center ${
                      isLooping ? "" : "text-white/45"
                    }`}
                    style={isLooping ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
                    title="Répéter la piste ou l'émission en continu"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <span>Boucle</span>
                  </button>
                </div>

                {/* Traitement Voix / Parole (Speech & Vocal DSP) */}
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      </svg>
                      <span>Traitement Voix / Parole</span>
                    </div>
                    {(vocalClarityOn || newsSpeechOn || podcastProOn) && (
                      <span className="text-[10px] text-emerald-400 font-medium">Actif</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => toggleMode(VOCAL_CLARITY, vocalClarityOn)}
                      disabled={!eqActive}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-center truncate ${
                        vocalClarityOn
                          ? "bg-white/20 text-white border border-white/30"
                          : "glass glass-hover text-white/50 hover:text-white"
                      }`}
                      title="Clarté vocale : détache la voix et élimine les résonances graves"
                    >
                      Clarté Voix
                    </button>
                    <button
                      onClick={() => toggleMode(NEWS_SPEECH, newsSpeechOn)}
                      disabled={!eqActive}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-center truncate ${
                        newsSpeechOn
                          ? "bg-white/20 text-white border border-white/30"
                          : "glass glass-hover text-white/50 hover:text-white"
                      }`}
                      title="Journal / Talk : focus medium radio informations"
                    >
                      Radio Talk
                    </button>
                    <button
                      onClick={() => toggleMode(PODCAST_PRO, podcastProOn)}
                      disabled={!eqActive}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-center truncate ${
                        podcastProOn
                          ? "bg-white/20 text-white border border-white/30"
                          : "glass glass-hover text-white/50 hover:text-white"
                      }`}
                      title="Studio Pro : présence broadcast chaleureuse et dynamique"
                    >
                      Studio Pro
                    </button>
                  </div>
                </div>

                {/* Traitement Musique (Music DSP) */}
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                      <span>Traitement Musique</span>
                    </div>
                    {(warmAcousticOn || concertHallOn || dynamicPunchOn) && (
                      <span className="text-[10px] text-purple-400 font-medium">Actif</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => toggleMode(WARM_ACOUSTIC, warmAcousticOn)}
                      disabled={!eqActive}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-center truncate ${
                        warmAcousticOn
                          ? "bg-white/20 text-white border border-white/30"
                          : "glass glass-hover text-white/50 hover:text-white"
                      }`}
                      title="Chaleur acoustique : basses rondes et veloutées, aigus doux"
                    >
                      Acoustique
                    </button>
                    <button
                      onClick={() => toggleMode(CONCERT_HALL, concertHallOn)}
                      disabled={!eqActive}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-center truncate ${
                        concertHallOn
                          ? "bg-white/20 text-white border border-white/30"
                          : "glass glass-hover text-white/50 hover:text-white"
                      }`}
                      title="Scène Live : effet de spatialisation et présence de concert"
                    >
                      Scène Live
                    </button>
                    <button
                      onClick={() => toggleMode(DYNAMIC_PUNCH, dynamicPunchOn)}
                      disabled={!eqActive}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-center truncate ${
                        dynamicPunchOn
                          ? "bg-white/20 text-white border border-white/30"
                          : "glass glass-hover text-white/50 hover:text-white"
                      }`}
                      title="Punch dynamique : impact percutant et précision moderne"
                    >
                      Punch Club
                    </button>
                  </div>
                </div>

                {/* Stereo Balance (L / R) */}
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>Balance stéréo</span>
                    <span className="font-mono text-[10px] text-white/70">
                      {stereoPan === 0 ? "Centre" : stereoPan < 0 ? `G ${Math.round(Math.abs(stereoPan) * 100)}%` : `D ${Math.round(stereoPan * 100)}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 font-bold">G</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={stereoPan}
                      onChange={(e) => setStereoPan(Number(e.target.value))}
                      aria-label="Balance stéréo Gauche / Droite"
                      className="flex-1"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="text-[10px] text-white/30 font-bold">D</span>
                    {stereoPan !== 0 && (
                      <button
                        onClick={() => setStereoPan(0)}
                        title="Recentrer"
                        className="text-[10px] text-white/40 hover:text-white px-1.5 py-0.5 rounded bg-white/10 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sleep timer — a one-off "stop in N minutes" countdown, distinct from
            the recurring daily "Mode Sommeil" clock-time window in Configuration. */}
        <div className="space-y-1.5">
          <button
            onClick={() => setShowSleepTimer((v) => !v)}
            aria-label="Minuterie de sommeil" aria-expanded={showSleepTimer}
            className={`w-full px-3 py-1.5 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center justify-center gap-1.5 ${
              sleepTimerRemaining != null ? "" : "text-white/40"
            }`}
            style={sleepTimerRemaining != null ? { color: "var(--accent)" } : {}}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Minuterie</span>
            {sleepTimerRemaining != null && (
              <span className="tabular-nums">— arrêt dans {formatSleepRemaining(sleepTimerRemaining)}</span>
            )}
          </button>

          <AnimatePresence>
            {showSleepTimer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                    <button key={m} onClick={() => addSleepMinutes(m)}
                      title={sleepTimerRemaining != null ? `Ajouter ${m} min` : undefined}
                      className="px-2.5 py-1 rounded-full text-xs font-medium glass glass-hover text-white/60 hover:text-white transition-all">
                      +{m} min
                    </button>
                  ))}
                  {sleepTimerRemaining != null && (
                    <button onClick={cancelSleepTimer}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-300/90 hover:bg-red-500/25 transition-all">
                      Annuler
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Connection status: offline / reconnecting / error (with Retry). */}
        {offline ? (
          <p className="text-xs text-amber-400/90 text-center">Connexion perdue…</p>
        ) : reconnecting ? (
          <p className="text-xs text-amber-400/90 text-center">
            Reconnexion…{reconnectAttempt > 0 ? ` (${reconnectAttempt})` : ""}
          </p>
        ) : error ? (
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs text-red-400/80 text-center">{error}</p>
            <button
              onClick={retry}
              className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : null}
      </div>

      {/* Equalizer — expandable */}
      <AnimatePresence>
        {showEQ && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden px-4 pb-4"
          >
            <Equalizer
              bands={bands}
              filtersRef={filtersRef}
              onBandChange={updateBand}
              onApplyPreset={applyPreset}
              onReset={resetEQ}
              eqActive={eqActive}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
