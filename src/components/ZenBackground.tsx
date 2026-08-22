"use client";

// Calm, meditative decorative background shown when the "Zen" genre is active.
// Soft greens/teals, slow "breathing" animation — replaces the techy SVG layer.
export default function ZenBackground() {
  const C1 = "#5eead4"; // teal
  const C2 = "#a7f3d0"; // mint
  const C3 = "#86efac"; // soft green

  const leaves = [
    { x: "14%", y: "22%", s: 26, d: "9s" },
    { x: "78%", y: "58%", s: 20, d: "11s" },
    { x: "40%", y: "14%", s: 16, d: "13s" },
    { x: "62%", y: "30%", s: 14, d: "15s" },
  ];

  return (
    <>
      <style>{`
        @keyframes zenBreathe { 0%,100%{ transform:scale(1); opacity:.55 } 50%{ transform:scale(1.07); opacity:.85 } }
        @keyframes zenFloat   { 0%,100%{ transform:translateY(0) rotate(0deg) } 50%{ transform:translateY(-16px) rotate(8deg) } }
      `}</style>

      {/* Soft radial wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 115%, rgba(94,234,212,0.12), transparent 60%), radial-gradient(80% 60% at 82% 0%, rgba(167,243,208,0.09), transparent 55%)",
        }}
      />

      {/* Pond ripples — bottom center, breathing */}
      <svg
        className="absolute left-1/2 -translate-x-1/2 -bottom-48 opacity-[0.11]"
        width="950" height="950" viewBox="0 0 950 950" fill="none"
        style={{ transformOrigin: "475px 720px", animation: "zenBreathe 9s ease-in-out infinite" }}
      >
        {[70, 150, 230, 310, 390, 470].map((r, i) => (
          <circle key={r} cx="475" cy="720" r={r} stroke={i % 2 ? C2 : C1} strokeWidth="1.2" />
        ))}
      </svg>

      {/* Ensō — zen brush circle, center */}
      <svg
        className="absolute left-1/2 top-[28%] -translate-x-1/2 opacity-[0.08]"
        width="340" height="340" viewBox="0 0 100 100" fill="none"
        style={{ animation: "zenBreathe 11s ease-in-out infinite" }}
      >
        <path d="M52 9 a41 41 0 1 0 16 5" stroke={C3} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </svg>

      {/* Sun / moon halo — top right */}
      <svg
        className="absolute right-10 top-16 opacity-[0.09]"
        width="240" height="240" viewBox="0 0 240 240" fill="none"
        style={{ animation: "zenBreathe 13s ease-in-out infinite" }}
      >
        <circle cx="120" cy="120" r="48" fill={C2} opacity="0.5" />
        {[68, 90, 112].map((r, i) => (
          <circle key={r} cx="120" cy="120" r={r} stroke={C1} strokeWidth="1" opacity={0.5 - i * 0.12} />
        ))}
      </svg>

      {/* Rolling hills — bottom */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full opacity-[0.09]"
        height="230" preserveAspectRatio="none" viewBox="0 0 1200 230" fill="none"
      >
        <path d="M0 165 Q 300 95 600 155 T 1200 135 L1200 230 L0 230 Z" fill={C1} opacity="0.25" />
        <path d="M0 190 Q 350 135 700 185 T 1200 175 L1200 230 L0 230 Z" fill={C3} opacity="0.2" />
      </svg>

      {/* Floating leaves */}
      {leaves.map((l, i) => (
        <svg
          key={i}
          className="absolute opacity-[0.11]"
          width={l.s} height={l.s} viewBox="0 0 24 24" fill="none"
          style={{ left: l.x, top: l.y, animation: `zenFloat ${l.d} ease-in-out infinite` }}
        >
          <path d="M12 2 C 18 6 18 16 12 22 C 6 16 6 6 12 2 Z" fill={C2} />
          <path d="M12 4 V 20" stroke={C1} strokeWidth="0.8" />
        </svg>
      ))}
    </>
  );
}
