"use client";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  isPlaying?: boolean;
}

export default function NothingGlyphBackground({ isPlaying = false }: Props) {
  const { theme } = useTheme();

  if (theme !== "nothing" && theme !== "nothing-dark") return null;

  const isLight = theme === "nothing";

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* ── Subtle Technical Dot Matrix Grid ── */}
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: isLight
            ? "radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px)"
            : "radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0",
        }}
      />

      {/* ── Fine Technical Coordinate Marks & Crosshairs ── */}
      <div className="absolute top-24 left-8 font-mono text-[9px] tracking-widest uppercase opacity-25 hidden sm:block">
        + SYS.GLYPH // NTHG.IO-01
      </div>
      <div className="absolute top-24 right-8 font-mono text-[9px] tracking-widest uppercase opacity-25 hidden sm:block">
        [RADIO.FR.CORE] // 48.8566° N
      </div>
      <div className="absolute bottom-28 left-8 font-mono text-[9px] tracking-widest uppercase opacity-25 hidden sm:block">
        MATRIX.BUS // 48kHz PCM
      </div>
      <div className="absolute bottom-28 right-8 font-mono text-[9px] tracking-widest uppercase opacity-25 hidden sm:block">
        LOC.FR // (c) NOTHING.STYLE
      </div>

      {/* ── Signature Nothing Red Accent Dot (Top-Right) ── */}
      <div className="absolute top-20 right-20 sm:top-28 sm:right-28 flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full bg-[#d71921] ${
            isPlaying ? "animate-ping" : "opacity-80"
          }`}
          style={{ boxShadow: "0 0 12px #d71921" }}
        />
        <span className="font-mono text-[9px] tracking-widest text-[#d71921] opacity-75 font-semibold">
          {isPlaying ? "REC // LIVE" : "STBY"}
        </span>
      </div>

      {/* ── Transparent Glyph Interface SVG Arcs (Inspired by Phone 1 & 2 Glyph Matrix) ── */}
      <svg
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 opacity-[0.08] sm:opacity-[0.12]"
        width="680"
        height="680"
        viewBox="0 0 680 680"
        fill="none"
      >
        {/* Outer C-strip glyph */}
        <path
          d="M 540 140 A 280 280 0 0 0 200 480"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={isPlaying ? "none" : "20 14"}
        />
        {/* Center camera/charging ring glyph */}
        <circle
          cx="340"
          cy="340"
          r="140"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="10"
          strokeDasharray="14 10"
        />
        {/* Diagonal slash glyph */}
        <line
          x1="300"
          y1="180"
          x2="480"
          y2="240"
          stroke="#d71921"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Bottom straight line indicator */}
        <line
          x1="340"
          y1="510"
          x2="340"
          y2="600"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle
          cx="340"
          cy="620"
          r="6"
          fill="#d71921"
        />
      </svg>

      {/* ── Left Subtle Geometric Accent ── */}
      <svg
        className="absolute -left-20 bottom-16 opacity-[0.07] sm:opacity-[0.10]"
        width="400"
        height="400"
        viewBox="0 0 400 400"
        fill="none"
      >
        <rect
          x="60"
          y="60"
          width="280"
          height="280"
          rx="56"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="10"
        />
        <circle
          cx="200"
          cy="200"
          r="60"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="6"
          strokeDasharray="6 6"
        />
        <circle cx="200" cy="200" r="10" fill="#d71921" opacity="0.6" />
      </svg>
    </div>
  );
}
