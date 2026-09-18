"use client";
import { useAudioPlayer, BASS_BOOSTER, VOICE_ISOLATION } from "@/hooks/useAudioPlayer";
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
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [activeQuality, setActiveQuality] = useState<StreamQuality | null>(null);

  const {
    isPlaying, volume, isLoading, error, eqActive,
    currentTime, duration,
    reconnecting, reconnectAttempt, offline, retry,
    analyserRef, filtersRef, mediaElRef, togglePlay, play, pause, changeVolume, seekTo,
    bands, updateBand, applyPreset, resetEQ, initAudio,
    sleepTimerRemaining, addSleepMinutes, cancelSleepTimer,
  } = playerApi;

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
  const bassOn  = matchesPreset(BASS_BOOSTER);
  const voiceOn = matchesPreset(VOICE_ISOLATION);
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

        {/* Podcast progress bar */}
        {isPodcast && duration > 0 && (
          <div className="mt-3 space-y-1">
            <input type="range" min={0} max={duration} step={1} value={currentTime}
              onChange={e => seekTo(Number(e.target.value))}
              className="w-full" style={{ accentColor: "var(--accent)" }} />
            <div className="flex justify-between text-[10px] text-white/30 font-mono">
              <span>{fmt(currentTime)}</span>
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
              style={{ background: "var(--accent)22", color: "var(--accent)" }}>● VIDÉO</span>
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
        <div className="flex items-center gap-3">
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

          {/* Volume */}
          <div className="flex items-center gap-2 flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="text-white/30 flex-shrink-0">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleMode(BASS_BOOSTER, bassOn)}
            disabled={!eqActive}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${
              bassOn ? "" : "text-white/45"
            }`}
            style={bassOn ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
            title={!eqActive ? "Indisponible (CORS stream)" : "Bass Booster"}
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
            onClick={() => toggleMode(VOICE_ISOLATION, voiceOn)}
            disabled={!eqActive}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${
              voiceOn ? "" : "text-white/45"
            }`}
            style={voiceOn ? { color: "var(--accent)", background: "var(--accent)22", border: "1px solid var(--accent)55" } : {}}
            title={!eqActive ? "Indisponible (CORS stream)" : "Voice Isolation"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <span>Voix Nette</span>
            {voiceOn && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
            )}
          </button>
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
