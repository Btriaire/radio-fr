"use client";
import { useState } from "react";

// ── 7-segment digit renderer ──────────────────────────────────────────
// Authentic LCD/VFD look: lit segments glow, unlit segments stay faintly
// ghosted (like a real fluorescent display). Drives the time read-out.
const SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
};

const SEG_POLY: Record<string, string> = {
  a: "7,4 9,2 19,2 21,4 19,6 9,6",
  g: "7,22 9,20 19,20 21,22 19,24 9,24",
  d: "7,40 9,38 19,38 21,40 19,42 9,42",
  f: "5,5 7,7 7,18 5,20 3,18 3,7",
  b: "23,5 25,7 25,18 23,20 21,18 21,7",
  e: "5,24 7,26 7,37 5,39 3,37 3,26",
  c: "23,24 25,26 25,37 23,39 21,37 21,26",
};

function SevenSeg({ ch, color, h = 30 }: { ch: string; color: string; h?: number }) {
  const on = SEGMENTS[ch] ?? [];
  return (
    <svg viewBox="0 0 28 44" height={h} style={{ display: "block" }} aria-hidden>
      {Object.entries(SEG_POLY).map(([seg, pts]) => {
        const lit = on.includes(seg);
        return (
          <polygon
            key={seg}
            points={pts}
            fill={lit ? color : "rgba(255,176,0,0.07)"}
            style={lit ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}
          />
        );
      })}
    </svg>
  );
}

function Colon({ color, on }: { color: string; on: boolean }) {
  return (
    <svg viewBox="0 0 8 44" height={30} style={{ display: "block" }} aria-hidden>
      {[15, 31].map((cy) => (
        <circle
          key={cy}
          cx="4"
          cy={cy}
          r="2.2"
          fill={on ? color : "rgba(255,176,0,0.07)"}
          style={on ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}
        />
      ))}
    </svg>
  );
}

function fmt(s: number): { m: string; s: string } {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return { m: String(m).padStart(2, "0"), s: String(sec).padStart(2, "0") };
}

interface Props {
  title: string;
  artist: string;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (s: number) => void;
  accent?: string;
}

export default function TascamPlayer({
  title, artist, isPlaying, isLoading, currentTime, duration, onPlay, onPause, onSeek, accent = "var(--accent)",
}: Props) {
  const [pressed, setPressed] = useState<string | null>(null);
  const [showRemain, setShowRemain] = useState(false);
  // Double-clic sur la façade → plein écran (façon iPod), re-double-clic réduit.
  const [expanded, setExpanded] = useState(false);

  const AMBER = "#ffb000";
  const shown = showRemain && duration > 0 ? Math.max(0, duration - currentTime) : currentTime;
  const t = fmt(shown);
  const total = fmt(duration);
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  // Blinking colon while playing (1 Hz feel), steady when paused.
  const colonOn = isPlaying ? Math.floor(Date.now() / 500) % 2 === 0 : true;

  const status = isLoading ? "READ" : isPlaying ? "PLAY" : currentTime > 0 ? "PAUSE" : "STOP";

  const press = (id: string, action: () => void) => ({
    onMouseDown: () => setPressed(id),
    onMouseUp: () => { setPressed(null); action(); },
    onMouseLeave: () => setPressed((p) => (p === id ? null : p)),
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); setPressed(id); },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); setPressed(null); action(); },
  });

  // Transport actions
  const doStop = () => { onPause(); onSeek(0); };
  const doScan = (dir: -1 | 1) => onSeek(Math.max(0, Math.min(duration || currentTime + 15, currentTime + dir * 15)));

  // ── LED indicator dot ──
  // Invoked as Led({...}) rather than <Led/> — see renderBtn note below.
  const Led = ({ on, color, label }: { on: boolean; color: string; label: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span
        style={{
          width: 9, height: 9, borderRadius: "50%",
          background: on ? color : "rgba(255,255,255,0.08)",
          boxShadow: on ? `0 0 7px ${color}, inset 0 0 2px rgba(255,255,255,0.6)` : "inset 0 1px 2px rgba(0,0,0,0.6)",
          transition: "all 0.15s",
        }}
      />
      <span style={{ fontSize: 7, letterSpacing: 0.5, color: on ? color : "rgba(255,255,255,0.3)", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
        {label}
      </span>
    </div>
  );

  // ── Physical transport button ──
  // Invoked as renderBtn({...}), NOT <TButton/>. As a JSX element it would take
  // a fresh component identity on every render, and `currentTime` re-renders
  // this player several times a second during playback — React would then
  // unmount+remount each button every tick, swallowing the mousedown→mouseup
  // (and touchstart→touchend) sequence so taps appeared to do nothing. Calling
  // it inlines the JSX and keeps the button DOM stable across renders.
  const renderBtn = ({ id, action, children, wide, glow }: {
    id: string; action: () => void; children: React.ReactNode; wide?: boolean; glow?: string;
  }) => {
    const down = pressed === id;
    return (
      <button
        {...press(id, action)}
        aria-label={id}
        style={{
          flex: wide ? 1.4 : 1,
          height: 30,
          borderRadius: 5,
          border: "1px solid rgba(0,0,0,0.6)",
          background: down
            ? "linear-gradient(180deg, #1a1a1d, #2a2a2e)"
            : "linear-gradient(180deg, #4a4a50, #2c2c30)",
          boxShadow: down
            ? "inset 0 2px 4px rgba(0,0,0,0.7)"
            : "0 1px 0 rgba(255,255,255,0.12) inset, 0 2px 3px rgba(0,0,0,0.5)",
          color: glow ?? "rgba(255,255,255,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.06s", WebkitTapHighlightColor: "transparent",
          transform: down ? "translateY(1px)" : "none",
        }}
      >
        {children}
      </button>
    );
  };

  const faceplate = (
    <div
      onDoubleClick={() => setExpanded((v) => !v)}
      title={expanded ? "Double-clic pour réduire" : "Double-clic pour agrandir"}
      style={{
        borderRadius: 12,
        padding: "12px 12px 13px",
        // Brushed metal faceplate
        background:
          "linear-gradient(180deg, #3a3a3e 0%, #2a2a2d 12%, #232326 50%, #1d1d20 88%, #2a2a2d 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.45)",
        border: "1px solid rgba(0,0,0,0.7)",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {/* Brushed-metal vertical streaks */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)",
      }} />

      {/* ── Top row: branding + rack screws + LEDs ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Spinning disc */}
          <div style={{ position: "relative", width: 24, height: 24, flexShrink: 0 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "conic-gradient(from 0deg, #5a5a60, #cfcfd6, #5a5a60, #cfcfd6, #5a5a60)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)",
              animation: isPlaying ? "tascamSpin 2.4s linear infinite" : "none",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: 7, height: 7, borderRadius: "50%", background: "#1a1a1d",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
            }} />
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{
              fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 13,
              letterSpacing: 1.5, color: "#e8e8ec",
              textShadow: "0 1px 1px rgba(0,0,0,0.8)",
            }}>
              TASCAM
            </div>
            <div style={{ fontSize: 7.5, letterSpacing: 1, color: accent, fontWeight: 700, marginTop: 2 }}>
              CD-200 · COMPACT DISC
            </div>
          </div>
        </div>
        {/* LED cluster */}
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          {Led({ on: isPlaying, color: "#34d399", label: "PLAY" })}
          {Led({ on: !isPlaying && currentTime > 0, color: AMBER, label: "PAUSE" })}
          {Led({ on: isLoading, color: "#ef4444", label: "DISC" })}
        </div>
      </div>

      {/* ── LCD/VFD display panel ── */}
      <div
        style={{
          background: "linear-gradient(180deg, #0a0a06 0%, #0d0d08 100%)",
          borderRadius: 7,
          border: "1px solid rgba(0,0,0,0.8)",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.08)",
          padding: "8px 10px",
          marginBottom: 10,
          position: "relative",
        }}
      >
        {/* Track name scroll line (dot-matrix vibe) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
          <span style={{
            fontFamily: "ui-monospace, monospace", fontSize: 9, color: AMBER, letterSpacing: 0.5,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
            textShadow: `0 0 4px ${AMBER}88`,
          }}>
            {(title || "—").toUpperCase()}
          </span>
          <span style={{ fontSize: 8, color: AMBER, fontFamily: "ui-monospace, monospace", fontWeight: 700, letterSpacing: 1, flexShrink: 0, opacity: 0.85 }}>
            {status}
          </span>
        </div>

        {/* Big 7-segment time */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: 6.5, color: "rgba(255,176,0,0.55)", fontFamily: "ui-monospace, monospace", letterSpacing: 1, fontWeight: 700 }}>
              TRACK
            </span>
            <SevenSeg ch="0" color={AMBER} h={26} />
          </div>
          <button
            onClick={() => setShowRemain((v) => !v)}
            title="Basculer écoulé / restant"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
          >
            <SevenSeg ch={t.m[0]} color={AMBER} />
            <SevenSeg ch={t.m[1]} color={AMBER} />
            <Colon color={AMBER} on={colonOn} />
            <SevenSeg ch={t.s[0]} color={AMBER} />
            <SevenSeg ch={t.s[1]} color={AMBER} />
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span style={{ fontSize: 6.5, color: "rgba(255,176,0,0.55)", fontFamily: "ui-monospace, monospace", letterSpacing: 1, fontWeight: 700 }}>
              {showRemain ? "REMAIN" : "TOTAL"}
            </span>
            <span style={{ fontSize: 12, color: AMBER, fontFamily: "ui-monospace, monospace", fontWeight: 700, textShadow: `0 0 4px ${AMBER}66` }}>
              {total.m}:{total.s}
            </span>
          </div>
        </div>

        {/* Progress / position meter (click to seek) */}
        <div
          onClick={(e) => {
            if (!duration) return;
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            onSeek(((e.clientX - r.left) / r.width) * duration);
          }}
          style={{
            marginTop: 8, height: 8, borderRadius: 2, cursor: duration ? "pointer" : "default",
            background: "rgba(255,176,0,0.08)", position: "relative", overflow: "hidden",
            border: "1px solid rgba(255,176,0,0.15)",
          }}
        >
          {/* Segmented bar-graph fill */}
          <div style={{
            position: "absolute", inset: 0, width: `${pct}%`,
            background: `repeating-linear-gradient(90deg, ${AMBER} 0px, ${AMBER} 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 5px)`,
            boxShadow: `0 0 6px ${AMBER}aa`, transition: "width 0.25s linear",
          }} />
        </div>
      </div>

      {/* ── Transport buttons ── */}
      <div style={{ display: "flex", gap: 5, position: "relative" }}>
        {renderBtn({ id: "scan-back", action: () => doScan(-1), children: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
        ) })}
        {renderBtn({ id: "play", action: onPlay, wide: true, glow: isPlaying ? "#34d399" : "rgba(255,255,255,0.9)", children: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
        ) })}
        {renderBtn({ id: "pause", action: onPause, glow: !isPlaying && currentTime > 0 ? AMBER : "rgba(255,255,255,0.9)", children: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) })}
        {renderBtn({ id: "stop", action: doStop, children: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
        ) })}
        {renderBtn({ id: "scan-fwd", action: () => doScan(1), children: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v12l8.5-6L13 6zM4 6v12l8.5-6L4 6z" /></svg>
        ) })}
      </div>

      {/* Footnote: artist + brushed plate edge */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.4)", fontFamily: "ui-monospace, monospace", letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
          {artist || ""}
        </span>
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", letterSpacing: 1, fontWeight: 700 }}>
          ▶ PROFESSIONAL
        </span>
      </div>

      <style>{`@keyframes tascamSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!expanded) return faceplate;

  // ── Plein écran (façon iPod) : la platine prend toute la place, seule ──
  return (
    <div
      onClick={() => setExpanded(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 140,
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 16, gap: 12,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(100%, 540px)" }}>
        {faceplate}
        <button
          onClick={() => setExpanded(false)}
          style={{
            marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 800, letterSpacing: 1,
            cursor: "pointer", fontFamily: "ui-monospace, monospace",
          }}
        >
          ⤡ RÉDUIRE
        </button>
      </div>
    </div>
  );
}
