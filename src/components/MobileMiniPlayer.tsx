"use client";
import React, { useRef } from "react";
import { motion } from "framer-motion";
import StationLogo from "./StationLogo";
import { Station } from "@/lib/stations";
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
  podcast: PodcastNowPlaying | null;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  onExpand: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  nowPlaying?: NowPlayingInfo;
}

export default function MobileMiniPlayer({
  station,
  podcast,
  isPlaying,
  isLoading,
  onTogglePlay,
  onExpand,
  isFavorite,
  onToggleFavorite,
  nowPlaying,
}: Props) {
  const touchStartY = useRef<number | null>(null);

  if (!station && !podcast) return null;

  const isPodcast = !!podcast && !station;
  const accentColor = station?.color ?? "var(--accent, #3b82f6)";

  const title = isPodcast
    ? podcast!.episodeTitle
    : station!.name;

  const subtitle = isPodcast
    ? podcast!.podcastName
    : nowPlaying?.songTitle
      ? `${nowPlaying.songTitle}${nowPlaying.songArtist ? " • " + nowPlaying.songArtist : ""}`
      : station!.tagline;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;
    // Swiped up > 40px -> open full player
    if (deltaY > 40) {
      onExpand();
    }
    touchStartY.current = null;
  };

  return (
    <div
      className="lg:hidden fixed bottom-3 left-3 right-3 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={onExpand}
        className="w-full rounded-2xl p-2.5 flex items-center gap-3 cursor-pointer select-none relative overflow-hidden backdrop-blur-2xl shadow-2xl border"
        style={{
          background: "linear-gradient(135deg, rgba(16, 24, 40, 0.88), rgba(8, 12, 22, 0.94))",
          borderColor: "rgba(255, 255, 255, 0.12)",
          boxShadow: `0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 4px 20px ${accentColor}22`,
        }}
      >
        {/* Subtle accent bar at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, var(--accent-2, #22d3ee))`,
          }}
        />

        {/* Artwork / Logo with playing pulse */}
        <div className="relative flex-shrink-0">
          {isPlaying && (
            <div
              className="absolute -inset-1 rounded-xl opacity-40 animate-pulse pointer-events-none"
              style={{ background: accentColor, filter: "blur(6px)" }}
            />
          )}
          {isPodcast ? (
            podcast!.artwork ? (
              <img
                src={podcast!.artwork}
                alt={podcast!.podcastName}
                className="w-11 h-11 rounded-xl object-cover relative z-10 shadow-md"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-white/10 relative z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
            )
          ) : (
            <div className="relative z-10">
              <StationLogo logo={station!.logo} name={station!.name} color={station!.color} size="sm" />
            </div>
          )}
        </div>

        {/* Title & Live Metadata */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              {title}
            </p>
            {!isPodcast && isPlaying && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {nowPlaying?.songTitle && !isPodcast && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent flex-shrink-0">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
            <p className="text-white/60 text-xs truncate leading-tight">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Actions (do not propagate click to expand) */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Favorite button */}
          {!isPodcast && onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white active:scale-90 transition-all"
              aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isFavorite ? "#fbbf24" : "none"}
                stroke={isFavorite ? "#fbbf24" : "currentColor"}
                strokeWidth="2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )}

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            disabled={isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, var(--accent-2, #22d3ee))`,
            }}
            aria-label={isPlaying ? "Pause" : "Lecture"}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {/* Chevron expand */}
          <button
            onClick={onExpand}
            className="w-7 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white active:scale-90 transition-all"
            aria-label="Agrandir le lecteur"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
