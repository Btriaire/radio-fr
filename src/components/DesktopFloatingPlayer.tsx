"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StationLogo from "./StationLogo";
import { Station } from "@/lib/stations";

export interface DesktopFloatingPlayerProps {
  station: Station | null;
  podcast: any;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  onTogglePlay: () => void;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
  onNextStation?: () => void;
  onPrevStation?: () => void;
  nowPlaying?: { songTitle?: string | null; songArtist?: string | null };
}

export default function DesktopFloatingPlayer({
  station,
  podcast,
  isPlaying,
  isLoading,
  volume,
  onTogglePlay,
  onChangeVolume,
  onToggleMute,
  onNextStation,
  onPrevStation,
  nowPlaying,
}: DesktopFloatingPlayerProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 360);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isPodcast = !!podcast && !station;
  const title = isPodcast ? podcast.episodeTitle : station?.name;
  const subtitle = isPodcast
    ? podcast.podcastName
    : nowPlaying?.songTitle
      ? `${nowPlaying.songTitle}${nowPlaying.songArtist ? " • " + nowPlaying.songArtist : ""}`
      : station?.tagline;

  return (
    <AnimatePresence>
      {isScrolled && (station || podcast) && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-3rem)] max-w-2xl px-4 py-2.5 rounded-2xl glass-dark border border-white/15 shadow-2xl items-center justify-between gap-4 backdrop-blur-xl hidden lg:flex"
        >
          {/* Left: Station branding + click to scroll top */}
          <div
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 hover:opacity-90 transition-opacity"
            onClick={handleScrollToTop}
            title="Cliquer pour afficher le lecteur principal"
          >
            <div className="flex-shrink-0">
              {station ? (
                <StationLogo
                  logo={station.logo}
                  name={station.name}
                  color={station.color}
                  size="sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/70">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9 9h6v6H9z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate max-w-[200px]">
                {title}
              </h3>
              <p className="text-xs text-white/50 truncate max-w-[220px]">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Center: Controls + mini audio spectrum */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {onPrevStation && (
              <button
                onClick={onPrevStation}
                className="w-8 h-8 rounded-full glass glass-hover text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Station précédente"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="19 20 9 12 19 4 19 20" />
                  <line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>
            )}

            <button
              onClick={onTogglePlay}
              disabled={isLoading}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
              style={{ background: "var(--accent, #3b82f6)" }}
              aria-label={isPlaying ? "Pause" : "Lecture"}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" className="translate-x-0.5">
                  <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
              )}
            </button>

            {onNextStation && (
              <button
                onClick={onNextStation}
                className="w-8 h-8 rounded-full glass glass-hover text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Station suivante"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            )}

            {/* Mini SVG spectrum indicator */}
            {isPlaying && (
              <div className="flex items-end gap-0.5 h-4 ml-1 px-1" aria-hidden="true">
                <span className="w-1 bg-[var(--accent)] rounded-full animate-pulse h-2.5" />
                <span className="w-1 bg-[var(--accent)] rounded-full animate-pulse h-4 [animation-delay:150ms]" />
                <span className="w-1 bg-[var(--accent)] rounded-full animate-pulse h-2 [animation-delay:300ms]" />
              </div>
            )}
          </div>

          {/* Right: Volume & Scroll to top */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onToggleMute}
                className="text-white/50 hover:text-white transition-colors cursor-pointer"
                aria-label={volume === 0 ? "Activer le son" : "Couper le son"}
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
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                className="w-16 sm:w-20 cursor-pointer"
                style={{ accentColor: "var(--accent)" }}
                aria-label="Volume"
              />
              <span className="text-[11px] font-mono text-white/40 w-6 text-right tabular-nums">
                {Math.round(volume * 100)}
              </span>
            </div>

            <button
              onClick={handleScrollToTop}
              title="Remonter au lecteur principal"
              aria-label="Remonter au lecteur principal"
              className="w-8 h-8 rounded-full glass glass-hover text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
