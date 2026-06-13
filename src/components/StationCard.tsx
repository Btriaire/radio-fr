"use client";
import { Station } from "@/lib/stations";
import { motion } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";

interface Props {
  station: Station;
  isActive: boolean;
  isPlaying: boolean;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  onClick: () => void;
}

export default function StationCard({ station, isActive, isPlaying, analyserRef, onClick }: Props) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full text-left rounded-2xl p-4 transition-all duration-200 glass glass-hover relative overflow-hidden group ${
        isActive ? "border-blue-500/40 shadow-glow" : ""
      }`}
      style={isActive ? { borderColor: `${station.color}60` } : {}}
    >
      {/* Active glow */}
      {isActive && (
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle at 30% 50%, ${station.color}, transparent 70%)` }}
        />
      )}

      <div className="flex items-center gap-3 relative z-10">
        {/* Logo */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${station.color}22`, border: `1px solid ${station.color}33` }}
        >
          {station.logo}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm truncate">{station.name}</span>
            {isActive && isPlaying && (
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            )}
          </div>
          <p className="text-white/40 text-xs truncate">{station.tagline}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive && (
            <div className="w-16 h-6">
              <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={station.color} small />
            </div>
          )}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${station.color}22`, color: station.color }}
          >
            {station.genre}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
