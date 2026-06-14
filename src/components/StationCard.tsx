"use client";
import { Station } from "@/lib/stations";
import { motion } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";
import StationLogo from "./StationLogo";

interface Props {
  station: Station;
  isActive: boolean;
  isPlaying: boolean;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
}

export default function StationCard({
  station, isActive, isPlaying, analyserRef, isFavorite, onClick, onToggleFavorite,
}: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 glass glass-hover relative overflow-hidden cursor-pointer ${
        isActive ? "" : ""
      }`}
      style={isActive ? { borderColor: `${station.color}50` } : {}}
      onClick={onClick}
    >
      {/* Active glow */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{ background: `radial-gradient(circle at 20% 50%, ${station.color}, transparent 70%)` }}
        />
      )}

      {/* Signal arcs — decorative, top-right corner */}
      {isActive && (
        <svg className="absolute top-0 right-0 opacity-20 pointer-events-none" width="80" height="60" viewBox="0 0 80 60" fill="none">
          {[20, 36, 52].map((r, i) => (
            <path key={r}
              d={`M ${80 - r * 0.6} 0 A ${r} ${r} 0 0 0 80 ${r * 0.6}`}
              stroke={station.color} strokeWidth="1.2" opacity={1 - i * 0.25}
              strokeDasharray={i === 2 ? "3 3" : "none"}
            />
          ))}
          {isPlaying && (
            <circle cx="78" cy="4" r="3" fill={station.color} opacity="0.9" />
          )}
        </svg>
      )}

      <StationLogo logo={station.logo} name={station.name} color={station.color} size="sm" />

      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-sm truncate">{station.name}</span>
          {isActive && isPlaying && (
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          )}
        </div>
        <p className="text-white/40 text-xs">{station.tagline}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
        {isActive && (
          <div className="w-16 h-6">
            <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={station.color} small />
          </div>
        )}
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium hidden sm:block"
          style={{ background: `${station.color}22`, color: station.color }}
        >
          {station.genre}
        </span>

        {/* Star */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="p-1 rounded-lg glass-hover"
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2"
            className={isFavorite ? "text-yellow-400" : "text-white/20"}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
