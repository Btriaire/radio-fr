"use client";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Station } from "@/lib/stations";
import AudioVisualizer from "./AudioVisualizer";
import Equalizer from "./Equalizer";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  station: Station | null;
  playerApi: ReturnType<typeof useAudioPlayer>;
}

export default function Player({ station, playerApi }: Props) {
  const [showEQ, setShowEQ] = useState(false);
  const {
    isPlaying, volume, isLoading, error,
    analyserRef, togglePlay, changeVolume,
    bands, updateBand, resetEQ,
  } = playerApi;

  if (!station) {
    return (
      <div className="glass-dark rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <div className="w-12 h-12 rounded-full glass flex items-center justify-center text-2xl opacity-40">🎙️</div>
        <p className="text-white/30 text-sm">Sélectionne une station pour écouter</p>
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-3xl overflow-hidden shadow-glass-lg">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-4">
          {/* Logo / emoji */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-lg"
            style={{ background: `${station.color}22`, border: `1px solid ${station.color}44` }}
          >
            {station.logo}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-lg leading-tight truncate">{station.name}</h2>
            <p className="text-white/50 text-sm truncate">{station.tagline}</p>
            {station.freq && (
              <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ background: `${station.color}22`, color: station.color }}>
                {station.freq}
              </span>
            )}
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass">
            <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
            <span className="text-xs text-white/60 font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Visualizer */}
      <div className="px-5 py-2">
        <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={station.color} />
      </div>

      {/* Controls */}
      <div className="px-5 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-glow"
            style={{ background: `linear-gradient(135deg, ${station.color}, ${station.color}aa)` }}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 flex-shrink-0">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <input
              type="range" min={0} max={1} step={0.02} value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
          </div>

          {/* EQ toggle */}
          <button
            onClick={() => setShowEQ((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all glass glass-hover ${showEQ ? "text-blue-400 border-blue-500/40" : "text-white/50"}`}
          >
            EQ
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400/80 text-center">{error}</p>
        )}
      </div>

      {/* Equalizer */}
      <AnimatePresence>
        {showEQ && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden px-4 pb-4"
          >
            <Equalizer bands={bands} onBandChange={updateBand} onReset={resetEQ} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
