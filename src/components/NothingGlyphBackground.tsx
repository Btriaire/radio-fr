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
      {/* ── Ultra-crisp, razor-sharp Dot Grid (1px dots on 32px grid, strictly non-blurry) ── */}
      <div
        className="absolute inset-0 opacity-[0.22] dark:opacity-[0.16]"
        style={{
          backgroundImage: isLight
            ? "radial-gradient(circle, #000000 0.75px, transparent 0.75px)"
            : "radial-gradient(circle, #ffffff 0.75px, transparent 0.75px)",
          backgroundSize: "32px 32px",
          backgroundPosition: "0 0",
        }}
      />

      {/* ── Razor-sharp Glyph Architecture (Exact 1px/1.5px lines, no thick blobs) ── */}
      <svg
        className="absolute right-[-40px] top-1/2 -translate-y-1/2 opacity-[0.18] dark:opacity-[0.24]"
        width="540"
        height="540"
        viewBox="0 0 540 540"
        fill="none"
      >
        {/* Outer segmented circular ring */}
        <circle
          cx="270"
          cy="270"
          r="220"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="1"
          strokeDasharray="4 8"
        />
        {/* Inner precise C-glyph */}
        <path
          d="M 430 150 A 180 180 0 0 0 160 380"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Central charging ring (Phone 2 iconology) */}
        <circle
          cx="270"
          cy="270"
          r="90"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <circle
          cx="270"
          cy="270"
          r="80"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="0.75"
        />
        {/* Red precision indicator line */}
        <line
          x1="270"
          y1="270"
          x2="350"
          y2="210"
          stroke="#d71921"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="350" cy="210" r="2.5" fill="#d71921" />
        {/* Vertical alignment line */}
        <line
          x1="270"
          y1="400"
          x2="270"
          y2="460"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="1"
        />
        <circle cx="270" cy="470" r="2" fill="#d71921" />
      </svg>

      {/* ── Left Precision Mechanical Guide ── */}
      <svg
        className="absolute left-[-20px] bottom-12 opacity-[0.14] dark:opacity-[0.18]"
        width="300"
        height="300"
        viewBox="0 0 300 300"
        fill="none"
      >
        <rect
          x="40"
          y="40"
          width="220"
          height="220"
          rx="40"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="1"
          strokeDasharray="8 8"
        />
        <circle
          cx="150"
          cy="150"
          r="50"
          stroke={isLight ? "#000000" : "#ffffff"}
          strokeWidth="0.75"
        />
        <circle cx="150" cy="150" r="3" fill="#d71921" />
        <line x1="150" y1="90" x2="150" y2="100" stroke={isLight ? "#000000" : "#ffffff"} strokeWidth="1" />
        <line x1="150" y1="200" x2="150" y2="210" stroke={isLight ? "#000000" : "#ffffff"} strokeWidth="1" />
        <line x1="90" y1="150" x2="100" y2="150" stroke={isLight ? "#000000" : "#ffffff"} strokeWidth="1" />
        <line x1="200" y1="150" x2="210" y2="150" stroke={isLight ? "#000000" : "#ffffff"} strokeWidth="1" />
      </svg>
    </div>
  );
}
