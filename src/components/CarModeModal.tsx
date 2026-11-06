"use client";
import React, { useEffect, useState, useRef } from "react";
import { Station } from "@/lib/stations";
import StationLogo from "./StationLogo";

export interface CarModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: Station | null;
  podcast: any;
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlay: () => void;
  onNextStation: () => void;
  onPrevStation: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  nowPlaying?: { songTitle?: string | null; songArtist?: string | null };
  volume: number;
  onChangeVolume: (v: number) => void;
}

export default function CarModeModal({
  isOpen,
  onClose,
  station,
  podcast,
  isPlaying,
  isLoading,
  onTogglePlay,
  onNextStation,
  onPrevStation,
  isFavorite,
  onToggleFavorite,
  nowPlaying,
  volume,
  onChangeVolume,
}: CarModeModalProps) {
  const [clock, setClock] = useState("");
  const wakeLockRef = useRef<any>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateClock = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        console.warn("Wake Lock indisponible:", err);
      }
    };
    requestWakeLock();

    return () => {
      clearInterval(interval);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        onPrevStation();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
      } else {
        onNextStation();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
      }
    }
    touchStartX.current = null;
  };

  if (!isOpen) return null;

  const isPodcast = !!podcast && !station;
  const title = isPodcast ? podcast.episodeTitle : station?.name || "RadioFR";
  const subtitle = isPodcast
    ? podcast.podcastName
    : nowPlaying?.songTitle
      ? `${nowPlaying.songTitle}${nowPlaying.songArtist ? " - " + nowPlaying.songArtist : ""}`
      : station?.tagline || "En direct";
  const accentColor = station?.color || "var(--accent, #3b82f6)";

  return (
    <div
      className="fixed inset-0 z-[120] bg-black text-white flex flex-col justify-between p-5 sm:p-8 select-none"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top, 1.5rem))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Top Bar : Clock + Mode Indicator + Exit Button ── */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black font-mono tracking-tight text-white/90">
            {clock || "--:--"}
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <path d="M9 17h6" />
              <circle cx="17" cy="17" r="2" />
            </svg>
            <span className="text-xs font-bold tracking-wider uppercase text-white/80">Voiture</span>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Quitter le mode voiture"
          className="min-h-[48px] px-4 py-2 rounded-2xl glass glass-hover text-white flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span className="font-semibold text-sm">Quitter</span>
        </button>
      </div>

      {/* ── Center : Large Branding & Track Metadata ── */}
      <div className="flex flex-col items-center justify-center text-center my-auto px-4 max-w-lg mx-auto w-full">
        <div
          className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl p-3 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden"
          style={{
            background: `radial-gradient(circle, ${accentColor}33 0%, rgba(255,255,255,0.06) 100%)`,
            border: `2px solid ${accentColor}55`,
          }}
        >
          {station ? (
            <StationLogo logo={station.logo} name={station.name} color={station.color} size="xl" />
          ) : (
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          )}
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight line-clamp-1 mb-2">
          {title}
        </h1>

        <p className="text-lg sm:text-2xl font-medium text-white/80 line-clamp-2 max-w-md">
          {subtitle}
        </p>

        {station?.freq && (
          <span className="mt-3 inline-block px-3 py-1 rounded-xl bg-white/10 text-white/60 font-mono text-sm">
            {station.freq} MHz
          </span>
        )}
      </div>

      {/* ── Bottom Controls : Giant Touch Buttons ── */}
      <div className="w-full max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          {/* Favorite Toggle */}
          <button
            onClick={() => {
              onToggleFavorite();
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25);
            }}
            aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl glass glass-hover flex items-center justify-center cursor-pointer transition-transform active:scale-90"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill={isFavorite ? "#ef4444" : "none"}
              stroke={isFavorite ? "#ef4444" : "currentColor"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Previous Station */}
          <button
            onClick={() => {
              onPrevStation();
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(35);
            }}
            aria-label="Station précédente"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl glass glass-hover flex items-center justify-center cursor-pointer transition-transform active:scale-90"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          {/* Main Huge Play / Pause Button */}
          <button
            onClick={() => {
              onTogglePlay();
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
            }}
            disabled={isLoading}
            aria-label={isPlaying ? "Pause" : "Lecture"}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-90 shadow-2xl relative"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            }}
          >
            {isLoading ? (
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white" className="translate-x-1">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            )}
          </button>

          {/* Next Station */}
          <button
            onClick={() => {
              onNextStation();
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(35);
            }}
            aria-label="Station suivante"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl glass glass-hover flex items-center justify-center cursor-pointer transition-transform active:scale-90"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>

        {/* Tactile Volume Slider */}
        <div className="flex items-center gap-3 px-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 flex-shrink-0">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            className="flex-1 h-3 rounded-full cursor-pointer"
            style={{ accentColor }}
            aria-label="Volume"
          />
          <span className="text-sm font-mono text-white/50 w-8 text-right tabular-nums">
            {Math.round(volume * 100)}
          </span>
        </div>

        <p className="text-center text-xs text-white/30 font-medium">
          Glissez l&apos;écran vers la gauche ou la droite pour zapper • Écran verrouillé actif
        </p>
      </div>
    </div>
  );
}
