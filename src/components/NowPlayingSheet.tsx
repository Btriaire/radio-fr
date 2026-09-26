"use client";
import { useEffect, useState, type ReactNode } from "react";
import { motion, useDragControls } from "framer-motion";
import StationLogo from "./StationLogo";
import { Station } from "@/lib/stations";
import type { NowPlayingInfo } from "@/hooks/useNowPlaying";
import type { useAudioPlayer } from "@/hooks/useAudioPlayer";

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
  podcast: PodcastNowPlaying | null;
  playerApi: ReturnType<typeof useAudioPlayer>;
  nowPlaying?: NowPlayingInfo;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onClose: () => void;
  /** The full desktop Player (EQ, quality, presets…) — tucked behind a disclosure. */
  advanced: ReactNode;
}

const SLEEP_STEPS = [5, 10, 15, 30, 45, 60];

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const Icon = {
  chevronDown: <path d="m6 9 6 6 6-6" />,
  prev: <><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" /><line x1="5" y1="19" x2="5" y2="5" /></>,
  next: <><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" /><line x1="19" y1="5" x2="19" y2="19" /></>,
  back15: <><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" /><text x="8.2" y="15.5" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">15</text></>,
  fwd30: <><path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 4 21 9 16 9" /><text x="7.6" y="15.5" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">30</text></>,
};

export default function NowPlayingSheet({
  station, podcast, playerApi, nowPlaying, isFavorite, onToggleFavorite, onNext, onPrev, onClose, advanced,
}: Props) {
  const {
    isPlaying, isLoading, togglePlay, currentTime, duration, seekTo, volume, changeVolume,
    reconnecting, reconnectAttempt, offline, error, retry,
    sleepTimerRemaining, addSleepMinutes, cancelSleepTimer,
  } = playerApi;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const dragControls = useDragControls();

  const isPodcast = !!podcast && !station;
  const accent = station?.color ?? "#3b82f6";
  const title = isPodcast ? podcast!.episodeTitle : station!.name;
  const subtitle = isPodcast
    ? podcast!.podcastName
    : nowPlaying?.songTitle
      ? `${nowPlaying.songTitle}${nowPlaying.songArtist ? " · " + nowPlaying.songArtist : ""}`
      : station!.tagline;
  const seekable = isPodcast && isFinite(duration) && duration > 0;

  // Esc closes; page behind doesn't scroll while the sheet is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const roundBtn = "flex items-center justify-center rounded-full text-white transition-transform active:scale-90 min-w-[48px] min-h-[48px]";

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label="En lecture"
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      drag="y" dragControls={dragControls} dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => { if (info.offset.y > 140 || info.velocity.y > 700) onClose(); }}
      className="fixed inset-0 z-50 lg:hidden flex flex-col overflow-y-auto overscroll-contain bg-[#070d1a]"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Ambient station-coloured glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        style={{ background: `radial-gradient(90% 60% at 50% 0%, ${accent}66, ${accent}18 55%, transparent 75%)` }} />

      {/* Grab handle + top bar — the drag-to-dismiss zone */}
      <div className="relative z-10 px-3 pt-2 pb-1 select-none" style={{ touchAction: "none" }}
        onPointerDown={(e) => dragControls.start(e)}>
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-white/30" />
        <div className="flex items-center justify-between">
          <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Réduire le lecteur" autoFocus
            className={`${roundBtn} bg-white/10 hover:bg-white/15`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{Icon.chevronDown}</svg>
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">En lecture</p>
          {!isPodcast && onToggleFavorite ? (
            <button onClick={onToggleFavorite} onPointerDown={(e) => e.stopPropagation()}
              aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={!!isFavorite}
              className={`${roundBtn} bg-white/10 hover:bg-white/15`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isFavorite ? "#fbbf24" : "none"} stroke={isFavorite ? "#fbbf24" : "currentColor"} strokeWidth="2" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ) : <span className="min-w-[48px]" aria-hidden />}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-4 pb-6 gap-6">
        {/* Artwork — breathes while playing, shrinks when paused */}
        <div className="flex justify-center">
          <motion.div animate={{ scale: isPlaying ? 1 : 0.9 }} transition={{ type: "spring", damping: 20, stiffness: 180 }}
            className="relative" style={{ filter: `drop-shadow(0 24px 40px ${accent}66)` }}>
            {isPodcast ? (
              podcast!.artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={podcast!.artwork} alt={podcast!.podcastName} width={220} height={220}
                  className="rounded-[36px] object-cover" style={{ width: 220, height: 220 }} />
              ) : (
                <div className="rounded-[36px] bg-white/10" style={{ width: 220, height: 220 }} />
              )
            ) : (
              <StationLogo logo={station!.logo} name={station!.name} color={station!.color} size="xl" />
            )}
          </motion.div>
        </div>

        {/* Title block */}
        <div className="text-center space-y-1.5 min-w-0">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-bold text-white leading-tight line-clamp-2">{title}</h2>
          </div>
          <p className="text-base text-white/70 leading-snug line-clamp-2">{subtitle}</p>
          {!isPodcast && (
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-widest bg-red-500/15 text-red-300">
              <span className={`w-1.5 h-1.5 rounded-full bg-red-400 ${isPlaying ? "animate-pulse" : "opacity-50"}`} />
              DIRECT{station!.freq ? ` · ${station!.freq}` : ""}
            </span>
          )}
          {/* Connection status */}
          <div aria-live="polite" className="min-h-[20px]">
            {offline ? (
              <p className="text-sm text-amber-300/90">Connexion perdue…</p>
            ) : reconnecting ? (
              <p className="text-sm text-amber-300/90">Reconnexion…{reconnectAttempt > 0 ? ` (${reconnectAttempt})` : ""}</p>
            ) : error ? (
              <p className="text-sm text-red-300/90">
                {error}{" "}
                <button onClick={retry} className="underline underline-offset-2 font-semibold min-h-[44px] px-2">Réessayer</button>
              </p>
            ) : null}
          </div>
        </div>

        {/* Progress — podcasts / music only (live radio has no timeline) */}
        {seekable && (
          <div className="space-y-1">
            <input type="range" min={0} max={duration} step={1} value={Math.min(currentTime, duration)}
              onChange={(e) => seekTo(Number(e.target.value))} aria-label="Position de lecture"
              className="w-full h-11" style={{ accentColor: accent }} />
            <div className="flex justify-between text-xs text-white/60 tabular-nums">
              <span>{fmt(currentTime)}</span><span>-{fmt(duration - currentTime)}</span>
            </div>
          </div>
        )}

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-5">
          {isPodcast ? (
            <button onClick={() => seekTo(Math.max(0, currentTime - 15))} aria-label="Reculer de 15 secondes"
              className={`${roundBtn} w-14 h-14 text-white/85`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{Icon.back15}</svg>
            </button>
          ) : (
            <button onClick={onPrev} disabled={!onPrev} aria-label="Station précédente"
              className={`${roundBtn} w-14 h-14 text-white/85 disabled:opacity-30`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{Icon.prev}</svg>
            </button>
          )}

          <button onClick={togglePlay} disabled={isLoading && !isPlaying}
            aria-label={isPlaying ? "Pause" : "Lecture"}
            className="flex items-center justify-center w-20 h-20 rounded-full text-white shadow-2xl active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${accent}, var(--accent-2, #22d3ee))`, boxShadow: `0 12px 36px ${accent}77` }}>
            {isLoading || reconnecting ? (
              <span className="w-7 h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            )}
          </button>

          {isPodcast ? (
            <button onClick={() => seekTo(Math.min(duration || Infinity, currentTime + 30))} aria-label="Avancer de 30 secondes"
              className={`${roundBtn} w-14 h-14 text-white/85`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{Icon.fwd30}</svg>
            </button>
          ) : (
            <button onClick={onNext} disabled={!onNext} aria-label="Station suivante"
              className={`${roundBtn} w-14 h-14 text-white/85 disabled:opacity-30`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{Icon.next}</svg>
            </button>
          )}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 text-white/60">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /></svg>
          <input type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Volume" className="flex-1 h-11" style={{ accentColor: accent }} />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
        </div>

        {/* Sleep timer */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3" aria-label="Minuterie de sommeil">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/85">Minuterie de sommeil</h3>
            {sleepTimerRemaining != null && (
              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--accent-2, #22d3ee)" }}>
                Arrêt dans {fmt(sleepTimerRemaining)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {SLEEP_STEPS.map((m) => (
              <button key={m} onClick={() => addSleepMinutes(m)}
                className="min-h-[44px] px-4 rounded-full text-sm font-medium text-white/80 bg-white/8 hover:bg-white/15 active:scale-95 transition-all border border-white/10">
                +{m} min
              </button>
            ))}
            {sleepTimerRemaining != null && (
              <button onClick={cancelSleepTimer}
                className="min-h-[44px] px-4 rounded-full text-sm font-medium text-red-300 bg-red-500/15 hover:bg-red-500/25 active:scale-95 transition-all">
                Annuler
              </button>
            )}
          </div>
        </section>

        {/* Everything else (EQ, quality, presets…) stays one tap away */}
        <div>
          <button onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}
            className="w-full min-h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-white/80 flex items-center justify-center gap-2 transition-all">
            Options avancées · égaliseur, qualité
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {showAdvanced && <div className="mt-3">{advanced}</div>}
        </div>
      </div>
    </motion.div>
  );
}
