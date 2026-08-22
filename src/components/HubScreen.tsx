"use client";

// Landing "hub" — the first thing you see. Big, glassy, animated SVG cards:
// Radio, Podcasts, Audius (music), iPod. Tapping one jumps straight to that part
// of the app. Pure SVG + CSS so it paints instantly; framer-motion for entrance.
import { motion } from "framer-motion";

export type HubChoice = "radio" | "podcasts" | "audius" | "ipod";

interface HubScreenProps {
  onChoose: (c: HubChoice) => void;
}

const A = "var(--accent, #3b82f6)";
const A2 = "var(--accent-2, #22d3ee)";

export default function HubScreen({ onChoose }: HubScreenProps) {
  const cards: {
    id: HubChoice; title: string; subtitle: string; icon: React.ReactNode;
  }[] = [
    {
      id: "radio",
      title: "Radio",
      subtitle: "Le direct & le live",
      icon: (
        <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="hubRadio" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={A} /><stop offset="100%" stopColor={A2} />
            </linearGradient>
          </defs>
          {/* Emitting waves */}
          {[0, 0.7, 1.4].map((d) => (
            <circle key={d} cx="60" cy="64" r="16" stroke="url(#hubRadio)" strokeWidth="2.4"
              fill="none" style={{ animation: `hubWave 2s ease-out ${d}s infinite`, transformOrigin: "60px 64px" }} />
          ))}
          {/* Radio body */}
          <rect x="26" y="52" width="68" height="44" rx="8" stroke="url(#hubRadio)" strokeWidth="3" fill="none" />
          <line x1="78" y1="52" x2="92" y2="30" stroke="url(#hubRadio)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="92" cy="28" r="4" fill="url(#hubRadio)" />
          {/* Speaker + tuner */}
          <circle cx="46" cy="74" r="11" stroke="url(#hubRadio)" strokeWidth="2.4" fill="none" />
          {/* Live eq bars in the tuner */}
          <g transform="translate(46 74)">
            {[-5, 0, 5].map((x, i) => (
              <rect key={x} x={x - 1.4} y={-6} width="2.8" height="12" rx="1.4" fill="url(#hubRadio)"
                style={{ transformOrigin: `${x}px 0px`, animation: `hubBar ${0.7 + i * 0.15}s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
          </g>
          <rect x="64" y="68" width="22" height="3" rx="1.5" fill="url(#hubRadio)" opacity="0.7" />
          <rect x="64" y="78" width="14" height="3" rx="1.5" fill="url(#hubRadio)" opacity="0.45" />
        </svg>
      ),
    },
    {
      id: "podcasts",
      title: "Podcasts",
      subtitle: "À la demande",
      icon: (
        <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="hubPod" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={A} /><stop offset="100%" stopColor={A2} />
            </linearGradient>
          </defs>
          {/* Mic capsule */}
          <rect x="46" y="24" width="28" height="48" rx="14" stroke="url(#hubPod)" strokeWidth="3" fill="none" />
          {/* Sound grilles */}
          {[34, 44, 54].map((y) => (
            <line key={y} x1="52" y1={y} x2="68" y2={y} stroke="url(#hubPod)" strokeWidth="2" opacity="0.55" />
          ))}
          {/* Arc cradle */}
          <path d="M36 58 a24 24 0 0 0 48 0" stroke="url(#hubPod)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <line x1="60" y1="82" x2="60" y2="96" stroke="url(#hubPod)" strokeWidth="3" strokeLinecap="round" />
          <line x1="46" y1="96" x2="74" y2="96" stroke="url(#hubPod)" strokeWidth="3" strokeLinecap="round" />
          {/* Pulsing waves around the mic */}
          {[0, 0.8].map((d) => (
            <path key={d} d="M30 40 a40 40 0 0 0 0 36" stroke="url(#hubPod)" strokeWidth="2" fill="none"
              strokeLinecap="round" style={{ animation: `hubBlink 2s ease-in-out ${d}s infinite` }} />
          ))}
          {[0, 0.8].map((d) => (
            <path key={`r${d}`} d="M90 40 a40 40 0 0 1 0 36" stroke="url(#hubPod)" strokeWidth="2" fill="none"
              strokeLinecap="round" style={{ animation: `hubBlink 2s ease-in-out ${d}s infinite` }} />
          ))}
        </svg>
      ),
    },
    {
      id: "audius",
      title: "SongPOD",
      subtitle: "Streaming gratuit",
      icon: (
        <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="hubAudius" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={A} /><stop offset="100%" stopColor={A2} />
            </linearGradient>
          </defs>
          {/* Spinning vinyl record */}
          <g style={{ animation: "hubSpin 8s linear infinite", transformOrigin: "60px 60px" }}>
            <circle cx="60" cy="60" r="38" stroke="url(#hubAudius)" strokeWidth="3" fill="none" />
            <circle cx="60" cy="60" r="27" stroke="url(#hubAudius)" strokeWidth="1.5" fill="none" opacity="0.45" />
            <circle cx="60" cy="60" r="18" stroke="url(#hubAudius)" strokeWidth="1.5" fill="none" opacity="0.45" />
            <circle cx="60" cy="60" r="6.5" fill="url(#hubAudius)" />
            {/* highlight dot to reveal rotation */}
            <circle cx="60" cy="26" r="2.6" fill="url(#hubAudius)" />
          </g>
          {/* Pulsing sound arcs, top-right */}
          <g transform="translate(96 26)">
            {[0, 0.7].map((d) => (
              <path key={d} d="M-7 9 a11 11 0 0 1 16 -16" stroke="url(#hubAudius)" strokeWidth="2.2"
                fill="none" strokeLinecap="round"
                style={{ animation: `hubBlink 1.8s ease-in-out ${d}s infinite` }} />
            ))}
          </g>
        </svg>
      ),
    },
    {
      id: "ipod",
      title: "iPod",
      subtitle: "Mode rétro",
      icon: (
        <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="hubIpod" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={A} /><stop offset="100%" stopColor={A2} />
            </linearGradient>
          </defs>
          {/* Body */}
          <rect x="34" y="14" width="52" height="92" rx="12" stroke="url(#hubIpod)" strokeWidth="3" fill="none" />
          {/* Screen */}
          <rect x="42" y="22" width="36" height="28" rx="3" stroke="url(#hubIpod)" strokeWidth="2.4" fill="none" />
          {/* Mini eq on screen */}
          <g transform="translate(60 36)">
            {[-9, -3, 3, 9].map((x, i) => (
              <rect key={x} x={x - 1.2} y={-7} width="2.4" height="14" rx="1.2" fill="url(#hubIpod)"
                style={{ transformOrigin: `${x}px 0px`, animation: `hubBar ${0.65 + i * 0.12}s ease-in-out ${i * 0.08}s infinite` }} />
            ))}
          </g>
          {/* Click wheel */}
          <circle cx="60" cy="80" r="18" stroke="url(#hubIpod)" strokeWidth="2.6" fill="none"
            style={{ animation: "hubSpin 9s linear infinite", transformOrigin: "60px 80px" }} />
          <circle cx="60" cy="80" r="6" fill="url(#hubIpod)" opacity="0.85" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "calc(env(safe-area-inset-top) + 24px) 20px calc(env(safe-area-inset-bottom) + 24px)",
        background: "radial-gradient(120% 100% at 50% 20%, #0b1220 0%, #060a14 55%, #03060d 100%)",
      }}
    >
      <style>{`
        @keyframes hubWave  { 0%{ r:16; opacity:.85 } 100%{ r:46; opacity:0 } }
        @keyframes hubBar   { 0%,100%{ transform:scaleY(.35) } 50%{ transform:scaleY(1) } }
        @keyframes hubBlink { 0%,100%{ opacity:.2 } 50%{ opacity:.9 } }
        @keyframes hubSpin  { from{ transform:rotate(0) } to{ transform:rotate(360deg) } }
      `}</style>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: 36 }}
      >
        <h1 style={{
          margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <span style={{ color: "#fff" }}>Radio</span>
          <span style={{
            background: `linear-gradient(135deg, ${A}, ${A2})`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>FR</span>
        </h1>
        <p style={{
          margin: "10px 0 0", fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}>
          Choisis ton écoute
        </p>
      </motion.div>

      {/* Cards — 2×2 on mobile, single row on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl">
        {cards.map((c, i) => (
          <motion.button
            key={c.id}
            onClick={() => onChoose(c.id)}
            aria-label={c.title}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.12 + i * 0.09, type: "spring", stiffness: 240, damping: 22 }}
            whileHover={{ y: -6, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="glass glass-hover w-full rounded-3xl flex flex-col items-center justify-center gap-3 px-5 py-7 sm:py-9 cursor-pointer relative overflow-hidden"
            style={{
              border: "1px solid var(--glass-border)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
              minHeight: 180,
            }}
          >
            {/* Glow behind icon */}
            <div className="absolute -z-10 rounded-full blur-3xl"
              style={{ width: 140, height: 140, top: 24, background: `${A}22` }} />
            <div style={{ filter: `drop-shadow(0 6px 18px ${A}44)` }}>{c.icon}</div>
            <div className="text-center">
              <p className="text-white font-bold text-lg leading-none">{c.title}</p>
              <p className="text-white/45 text-xs mt-1.5">{c.subtitle}</p>
            </div>
            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full"
              style={{ width: 48, background: `linear-gradient(90deg, ${A}, ${A2})` }} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
