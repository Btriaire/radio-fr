"use client";
import { Station, isEqCompatible } from "@/lib/stations";
import { motion } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";
import StationLogo from "./StationLogo";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  station: Station;
  isActive: boolean;
  isPlaying: boolean;
  nowPlayingTrack?: string | null;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
}

export default function StationCard({
  station, isActive, isPlaying, nowPlayingTrack, analyserRef, isFavorite, onClick, onToggleFavorite,
}: Props) {
  const { theme } = useTheme();
  const isNothing = theme === "nothing" || theme === "nothing-dark";

  return (
    <motion.div
      whileHover={{ scale: isNothing ? 1.01 : 1.018, y: isNothing ? -1 : -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className={`group flex items-center gap-3.5 rounded-2xl p-3.5 transition-all duration-150 relative overflow-hidden cursor-pointer border ${
        isNothing
          ? isActive
            ? "border-[#d71921] shadow-none bg-[#111111] dark:bg-[#111111]"
            : "border-black/15 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 bg-transparent shadow-none"
          : isActive
          ? "glass-dark ring-1 border-white/10"
          : "glass-dark border-white/10 hover:border-[var(--accent)] hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
      }`}
      style={!isNothing && isActive ? {
        borderColor: `${station.color}c0`,
        boxShadow: `0 12px 40px -6px ${station.color}50, 0 0 15px ${station.color}25, inset 0 1px 0 rgba(255,255,255,0.35)`,
        // @ts-ignore
        "--tw-ring-color": `${station.color}4d`,
      } : {}}
      onClick={onClick}
    >
      {/* Active minimal indicator for Nothing: crisp 2px red left accent bar */}
      {isNothing && isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#d71921]"
          aria-hidden="true"
        />
      )}

      {/* Active glow only in standard themes */}
      {!isNothing && isActive && (
        <div
          className={`absolute inset-0 pointer-events-none ${isPlaying ? "opacity-25 animate-glow-breathing" : "opacity-15"}`}
          style={{ background: `radial-gradient(circle at 20% 50%, ${station.color}, transparent 70%)` }}
        />
      )}

      {/* Signal arcs decorative corner only in standard themes */}
      {!isNothing && isActive && (
        <svg className="absolute top-0 right-0 opacity-25 pointer-events-none" width="80" height="60" viewBox="0 0 80 60" fill="none">
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

      <div className="relative flex-shrink-0">
        <StationLogo logo={station.logo} name={station.name} color={station.color} size="sm" />
        {/* Hover play/pause icon overlay */}
        <div className="absolute inset-0 rounded-xl bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
          {isActive && isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2">
          <span
            className="font-medium text-white text-sm truncate"
            style={{
              letterSpacing: isNothing ? "-0.01em" : "normal",
              fontSize: "0.875rem",
            }}
          >
            {station.name}
          </span>
          {isEqCompatible(station.streamUrl) && (
            <span
              title="Egaliseur disponible (EQ compatible)"
              className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.2 rounded-sm flex-shrink-0 font-mono"
              style={{
                background: isNothing ? "rgba(215,25,33,0.12)" : `${station.color}22`,
                color: isNothing ? "#d71921" : station.color,
                border: isNothing ? "1px solid rgba(215,25,33,0.25)" : "none",
              }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="6" y1="3" x2="6" y2="21" /><line x1="12" y1="8" x2="12" y2="21" /><line x1="18" y1="14" x2="18" y2="21" />
                <line x1="3" y1="9" x2="9" y2="9" /><line x1="9" y1="14" x2="15" y2="14" /><line x1="15" y1="6" x2="21" y2="6" />
              </svg>
              EQ
            </span>
          )}
          {isActive && isPlaying && (
            <span
              title="En direct"
              className="flex items-end gap-[2px] h-3 px-1 py-0.5 rounded-sm bg-[#d71921]/15 border border-[#d71921]/30 flex-shrink-0"
            >
              <span className="w-0.5 bg-[#d71921] rounded-full animate-eq-1" />
              <span className="w-0.5 bg-[#d71921] rounded-full animate-eq-2" />
              <span className="w-0.5 bg-[#d71921] rounded-full animate-eq-3" />
            </span>
          )}
        </div>
        {isActive && isPlaying && nowPlayingTrack ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-xs font-normal truncate" style={{ color: isNothing ? "#d71921" : station.color }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#d71921] flex-shrink-0" />
            <span className="truncate font-mono text-[11px] opacity-90">{nowPlayingTrack}</span>
          </div>
        ) : (
          <p className="text-white/45 text-xs truncate mt-0.5 font-normal text-[11px]">{station.tagline}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
        {isActive && (
          <div className="w-16 h-6">
            <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} color={isNothing ? "#d71921" : station.color} small />
          </div>
        )}
        <span
          className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium uppercase hidden sm:inline-block border"
          style={{
            background: isNothing ? "rgba(255,255,255,0.04)" : `${station.color}1c`,
            color: isNothing ? (theme === "nothing" ? "#222" : "#ccc") : station.color,
            borderColor: isNothing ? "rgba(128,128,128,0.18)" : "rgba(255,255,255,0.1)",
          }}
        >
          {station.genre}
        </span>

        {/* Star */}
        <motion.button
          whileTap={{ scale: 0.72, rotate: -18 }}
          whileHover={{ scale: 1.15 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="w-11 h-11 -mr-1.5 rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-white/10"
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={isFavorite ? "#fbbf24" : "none"}
            stroke={isFavorite ? "#fbbf24" : "rgba(255,255,255,0.5)"}
            strokeWidth="2"
            className="transition-transform duration-200">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}
