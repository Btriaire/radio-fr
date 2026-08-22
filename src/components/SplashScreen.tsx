"use client";

// Fast, animated SVG splash shown on first load. A dynamic "RadioFR" logo:
// a broadcast tower emitting pulsing radio waves, an orbiting ring, and a live
// equalizer — everything moves. Auto-dismisses after ~1.9s, with a manual skip
// on tap/click. Pure SVG + CSS keyframes, no images, so it paints instantly.
import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [gone, setGone]   = useState(false);   // fully unmounted
  const [leave, setLeave] = useState(false);   // fade-out in progress

  useEffect(() => {
    // Skip the splash if we've shown it this session.
    try {
      if (sessionStorage.getItem("radiofr_splash_seen")) { setGone(true); return; }
      sessionStorage.setItem("radiofr_splash_seen", "1");
    } catch {}

    const hold   = setTimeout(() => setLeave(true), 1700);
    const remove = setTimeout(() => setGone(true), 2300);
    return () => { clearTimeout(hold); clearTimeout(remove); };
  }, []);

  if (gone) return null;

  const dismiss = () => { setLeave(true); setTimeout(() => setGone(true), 550); };

  const A = "var(--accent, #3b82f6)";

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        background:
          "radial-gradient(120% 100% at 50% 30%, #0b1220 0%, #060a14 55%, #03060d 100%)",
        opacity: leave ? 0 : 1,
        transform: leave ? "scale(1.06)" : "scale(1)",
        transition: "opacity .55s ease, transform .55s ease",
        pointerEvents: leave ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes spWave   { 0%{ r:34; opacity:.9 } 100%{ r:150; opacity:0 } }
        @keyframes spOrbit  { from{ transform:rotate(0deg) } to{ transform:rotate(360deg) } }
        @keyframes spOrbitR { from{ transform:rotate(360deg) } to{ transform:rotate(0deg) } }
        @keyframes spPulse  { 0%,100%{ transform:scale(1); opacity:1 } 50%{ transform:scale(1.12); opacity:.85 } }
        @keyframes spBar    { 0%,100%{ transform:scaleY(.3) } 50%{ transform:scaleY(1) } }
        @keyframes spRise   { from{ opacity:0; transform:translateY(14px) } to{ opacity:1; transform:translateY(0) } }
        @keyframes spDash   { to{ stroke-dashoffset:-220 } }
        @keyframes spBlink  { 0%,100%{ opacity:1 } 50%{ opacity:.25 } }
      `}</style>

      {/* ── Logo mark ── */}
      <div style={{ animation: "spPulse 2.4s ease-in-out infinite", filter: `drop-shadow(0 0 22px ${A}66)` }}>
        <svg width="190" height="190" viewBox="0 0 200 200" fill="none">
          <defs>
            <linearGradient id="spGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"  stopColor={A} />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <radialGradient id="spCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#ffffff" />
              <stop offset="60%" stopColor={A} />
              <stop offset="100%" stopColor="#0b1220" />
            </radialGradient>
          </defs>

          {/* Emitting radio waves */}
          {[0, 0.6, 1.2].map((d) => (
            <circle key={d} cx="100" cy="100" r="34"
              stroke="url(#spGrad)" strokeWidth="2" fill="none"
              style={{ animation: `spWave 1.8s ease-out ${d}s infinite`, transformOrigin: "100px 100px" }} />
          ))}

          {/* Orbiting dashed rings */}
          <g style={{ animation: "spOrbit 8s linear infinite", transformOrigin: "100px 100px" }}>
            <circle cx="100" cy="100" r="74" stroke="url(#spGrad)" strokeWidth="1.4"
              fill="none" strokeDasharray="6 10" opacity="0.5" />
            <circle cx="174" cy="100" r="3.4" fill="url(#spGrad)" />
          </g>
          <g style={{ animation: "spOrbitR 11s linear infinite", transformOrigin: "100px 100px" }}>
            <circle cx="100" cy="100" r="56" stroke="#22d3ee" strokeWidth="1"
              fill="none" strokeDasharray="2 9" opacity="0.45" />
            <circle cx="44" cy="100" r="2.6" fill="#22d3ee" />
          </g>

          {/* Core disc */}
          <circle cx="100" cy="100" r="34" fill="url(#spCore)" />
          <circle cx="100" cy="100" r="34" stroke="url(#spGrad)" strokeWidth="2.5" fill="none" />

          {/* Live equalizer inside the core */}
          <g transform="translate(100 100)">
            {[-14, -7, 0, 7, 14].map((x, i) => (
              <rect key={x} x={x - 2.4} y={-12} width="4.8" height="24" rx="2.4"
                fill="#0b1220"
                style={{
                  transformOrigin: `${x}px 0px`,
                  animation: `spBar ${0.7 + i * 0.12}s ease-in-out ${i * 0.08}s infinite`,
                }} />
            ))}
          </g>

          {/* Broadcast spark on top */}
          <circle cx="100" cy="48" r="3.5" fill="#fff"
            style={{ animation: "spBlink 1.1s ease-in-out infinite" }} />
        </svg>
      </div>

      {/* ── Wordmark ── */}
      <div style={{ marginTop: 18, textAlign: "center", animation: "spRise .6s ease .15s both" }}>
        <h1 style={{
          margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em",
          fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: 1,
        }}>
          <span style={{ color: "#fff" }}>Radio</span>
          <span style={{
            background: `linear-gradient(135deg, ${A}, #22d3ee)`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>FR</span>
        </h1>

        {/* Animated underline that sweeps */}
        <svg width="180" height="10" viewBox="0 0 180 10" style={{ marginTop: 6 }}>
          <line x1="6" y1="5" x2="174" y2="5" stroke="url(#spGrad)" strokeWidth="2.5"
            strokeLinecap="round" strokeDasharray="40 200"
            style={{ animation: "spDash 1.4s linear infinite" }} />
        </svg>

        <p style={{
          margin: "8px 0 0", fontSize: 12.5, letterSpacing: "0.32em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.42)", fontFamily: "system-ui",
          animation: "spRise .6s ease .35s both",
        }}>
          La radio française
        </p>
      </div>
    </div>
  );
}
