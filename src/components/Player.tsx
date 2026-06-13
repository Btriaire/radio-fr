"use client";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Station } from "@/lib/stations";
import AudioVisualizer from "./AudioVisualizer";
import Equalizer from "./Equalizer";
import StationLogo from "./StationLogo";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  station: Station | null;
  playerApi: ReturnType<typeof useAudioPlayer>;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function Player({ station, playerApi, isFavorite, onToggleFavorite }: Props) {
  const [showEQ, setShowEQ] = useState(false);
  const {
    isPlaying, volume, isLoading, error,
    analyserRef, filtersRef, togglePlay, changeVolume,
    bands, updateBand, applyPreset, resetEQ,
  } = playerApi;

  if (!station) {
    return (
      <div className="glass-dark rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <div className="w-12 h-12 rounded-full glass flex items-center justify-center opacity-30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <p className="text-white/30 text-sm">Sélectionne une station</p>
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-3xl overflow-hidden shadow-glass-lg">
      {/* Station header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-4">
          <StationLogo logo={station.logo} name={station.name} color={station.color} size="lg" />

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-lg leading-tight truncate">{station.name}</h2>
            <p className="text-white/50 text-sm">{station.tagline}</p>
            {station.freq && (
              <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium"
                style={{ background: `${station.color}22`, color: station.color }}>
                {station.freq}
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
              <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
              <span className="text-xs text-white/60 font-medium">LIVE</span>
            </div>
            {onToggleFavorite && (
              <button onClick={onToggleFavorite} className="p-1.5 rounded-lg glass-hover transition-all">
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
      </div>

      {/* Visualizer */}
      <div className="px-5 py-2">
        <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={station.color} />
      </div>

      {/* Controls */}
      <div className="px-5 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-glow flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${station.color}, ${station.color}99)` }}
          >
            {isLoading ? (
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-white/30 flex-shrink-0">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <input
              type="range" min={0} max={1} step={0.02} value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-white/30 w-7 text-right tabular-nums">
              {Math.round(volume * 100)}
            </span>
          </div>

          {/* EQ toggle */}
          <button
            onClick={() => setShowEQ((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all glass glass-hover ${
              showEQ ? "text-blue-300 border-blue-500/40" : "text-white/40"
            }`}
          >
            EQ
          </button>
        </div>

        {error && <p className="text-xs text-red-400/80 text-center">{error}</p>}
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
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
