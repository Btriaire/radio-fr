"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Station } from "@/lib/stations";

interface PlayerApi {
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  changeVolume: (v: number) => void;
  togglePlay: () => void;
  initAudio: (url: string) => void;
  currentUrl: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  playerApi: PlayerApi;
  station: Station | null;
  stations: Station[];
  onSelectStation: (s: Station) => void;
}

type IpodScreen = "nowplaying" | "menu" | "stations";

const MENU_ITEMS = [
  { id: "nowplaying", label: "Now Playing", icon: "♪" },
  { id: "stations",   label: "Stations",    icon: "📻" },
  { id: "volume",     label: "Volume",      icon: "🔊" },
];

export default function IpodOverlay({ open, onClose, playerApi, station, stations, onSelectStation }: Props) {
  const [screen, setScreen]           = useState<IpodScreen>("nowplaying");
  const [menuIdx, setMenuIdx]         = useState(0);
  const [stationIdx, setStationIdx]   = useState(0);
  const [showVol, setShowVol]         = useState(false);
  const [pressed, setPressed]         = useState<string | null>(null);
  const [winW, setWinW]               = useState(375);

  // Responsive sizing
  useEffect(() => {
    const update = () => setWinW(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Scale everything from a base of 220px body width
  const isMobile = winW < 540;
  // On mobile use 95% of screen width (max 360), on desktop fixed 220px
  const bodyW    = isMobile ? Math.min(Math.round(winW * 0.95), 360) : 220;
  const scale    = bodyW / 220;   // relative to base design
  const wheelD   = Math.round(160 * scale);
  const screenH  = Math.round(120 * scale);
  const pad      = Math.round(14 * scale);
  const padB     = Math.round(20 * scale);

  // Click wheel tracking
  const wheelRef  = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  const accDelta  = useRef(0);

  const getAngle = (e: MouseEvent | TouchEvent, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let x: number, y: number;
    if ("touches" in e) {
      x = e.touches[0].clientX - cx; y = e.touches[0].clientY - cy;
    } else {
      x = (e as MouseEvent).clientX - cx; y = (e as MouseEvent).clientY - cy;
    }
    return Math.atan2(y, x) * (180 / Math.PI);
  };

  const handleWheelMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!wheelRef.current || lastAngle.current === null) return;
    if ("touches" in e && e.cancelable) e.preventDefault();
    const rect = wheelRef.current.getBoundingClientRect();
    const angle = getAngle(e, rect);
    let delta = angle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngle.current = angle;
    accDelta.current += delta;

    const step = 18;
    if (Math.abs(accDelta.current) >= step) {
      const steps = Math.floor(accDelta.current / step);
      accDelta.current -= steps * step;
      if (screen === "menu") {
        setMenuIdx(i => Math.min(MENU_ITEMS.length - 1, Math.max(0, i + steps)));
      } else if (screen === "stations") {
        setStationIdx(i => Math.min(stations.length - 1, Math.max(0, i + steps)));
      } else {
        const newVol = Math.min(1, Math.max(0, playerApi.volume + steps * 0.05));
        playerApi.changeVolume(newVol);
        setShowVol(true);
      }
    }
  }, [screen, stations.length, playerApi]);

  const handleWheelUp = useCallback(() => {
    lastAngle.current = null;
    accDelta.current = 0;
    document.removeEventListener("mousemove", handleWheelMove);
    document.removeEventListener("mouseup", handleWheelUp);
    document.removeEventListener("touchmove", handleWheelMove);
    document.removeEventListener("touchend", handleWheelUp);
  }, [handleWheelMove]);

  const handleWheelDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let dx: number, dy: number;
    if ("touches" in e) {
      dx = e.touches[0].clientX - cx; dy = e.touches[0].clientY - cy;
    } else {
      dx = (e as React.MouseEvent).clientX - cx; dy = (e as React.MouseEvent).clientY - cy;
    }
    if (Math.sqrt(dx * dx + dy * dy) < wheelD * 0.28) return;
    const nativeE = "nativeEvent" in e ? e.nativeEvent : e;
    lastAngle.current = getAngle(nativeE as MouseEvent | TouchEvent, rect);
    accDelta.current = 0;
    document.addEventListener("mousemove", handleWheelMove);
    document.addEventListener("mouseup", handleWheelUp);
    document.addEventListener("touchmove", handleWheelMove, { passive: false });
    document.addEventListener("touchend", handleWheelUp);
  }, [handleWheelMove, handleWheelUp, wheelD]);

  const handleMenu   = () => screen !== "nowplaying" ? setScreen(screen === "menu" ? "nowplaying" : "menu") : setScreen("menu");
  const handleCenter = () => {
    if (screen === "menu") {
      const item = MENU_ITEMS[menuIdx];
      if (item.id === "volume") { setShowVol(true); setScreen("nowplaying"); }
      else setScreen(item.id as IpodScreen);
    } else if (screen === "stations") {
      const s = stations[stationIdx];
      if (s) { onSelectStation(s); setScreen("nowplaying"); }
    } else {
      playerApi.togglePlay();
    }
  };
  const handleNext = () => {
    if (!station) return;
    const idx = stations.findIndex(s => s.id === station.id);
    onSelectStation(stations[(idx + 1) % stations.length]);
  };
  const handlePrev = () => {
    if (!station) return;
    const idx = stations.findIndex(s => s.id === station.id);
    onSelectStation(stations[(idx - 1 + stations.length) % stations.length]);
  };

  useEffect(() => {
    if (!showVol) return;
    const t = setTimeout(() => setShowVol(false), 2000);
    return () => clearTimeout(t);
  }, [showVol, playerApi.volume]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowUp") setMenuIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowDown") setMenuIdx(i => Math.min(MENU_ITEMS.length - 1, i + 1));
      if (e.key === "Enter") handleCenter();
      if (e.key === " ") { e.preventDefault(); playerApi.togglePlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen, menuIdx, stationIdx]);

  const vol = playerApi.volume;
  const volBars = 10;

  // Responsive animation: desktop = scale from center, mobile = slide from bottom
  const motionProps = isMobile ? {
    initial:    { y: "100%", opacity: 0 },
    animate:    { y: 0, opacity: 1 },
    exit:       { y: "100%", opacity: 0 },
    transition: { type: "spring" as const, damping: 28, stiffness: 320 },
  } : {
    initial:    { scale: 0.75, opacity: 0, y: 30 },
    animate:    { scale: 1, opacity: 1, y: 0 },
    exit:       { scale: 0.75, opacity: 0, y: 30 },
    transition: { type: "spring" as const, damping: 22, stiffness: 300 },
  };

  // Position: desktop = center of screen, mobile = fixed at bottom
  const wrapperStyle: React.CSSProperties = isMobile ? {
    bottom: 0, left: 0, right: 0,
    display: "flex", justifyContent: "center",
    paddingBottom: "env(safe-area-inset-bottom, 16px)",
    paddingTop: 16,
    background: "transparent",
  } : {
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
  };

  // Font sizes scale with the bodyW
  const fs  = (base: number) => Math.round(base * scale);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(14px)" }}
            onClick={onClose}
          />

          {/* iPod wrapper */}
          <motion.div
            {...motionProps}
            className="fixed z-50 select-none"
            style={{ ...wrapperStyle, touchAction: "none" }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── iPod shell ── */}
            <div style={{
              width: bodyW,
              background: "linear-gradient(160deg, #f6f6f1 0%, #e9e9e4 40%, #d2d2cc 100%)",
              borderRadius: Math.round(32 * scale),
              padding: `${pad}px ${pad}px ${padB}px`,
              boxShadow: `
                0 ${Math.round(40*scale)}px ${Math.round(80*scale)}px rgba(0,0,0,0.55),
                0 0 0 1px rgba(255,255,255,0.35),
                inset 0 1px 0 rgba(255,255,255,0.85),
                inset 0 -2px 4px rgba(0,0,0,0.12)
              `,
              position: "relative",
              flexShrink: 0,
            }}>

              {/* Close × */}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onClose(); }}
                style={{
                  position: "absolute", top: Math.round(10*scale), right: Math.round(10*scale),
                  width: Math.round(22*scale), height: Math.round(22*scale),
                  borderRadius: "50%", background: "rgba(0,0,0,0.13)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#555", fontSize: fs(9), lineHeight: 1,
                }}>✕</button>

              {/* ── Screen bezel ── */}
              <div style={{
                background: "#1c1c1c",
                borderRadius: Math.round(10*scale),
                padding: Math.round(3*scale),
                marginBottom: Math.round(14*scale),
                boxShadow: `inset 0 ${Math.round(2*scale)}px ${Math.round(6*scale)}px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
                {/* Screen */}
                <div style={{
                  background: "linear-gradient(180deg, #b2ccec 0%, #c5daf5 30%, #d2e6ff 100%)",
                  borderRadius: Math.round(7*scale),
                  height: screenH,
                  overflow: "hidden",
                  position: "relative",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  {/* Title bar */}
                  <div style={{
                    background: "linear-gradient(180deg, #4880bc 0%, #3870aa 100%)",
                    height: Math.round(18*scale),
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: `0 ${fs(5)}px`,
                  }}>
                    <span style={{ color: "white", fontSize: fs(7.5), fontWeight: 700, letterSpacing: 0.4 }}>
                      {screen === "nowplaying" ? "Now Playing" : screen === "menu" ? "RadioFR" : "Stations"}
                    </span>
                    {/* Battery */}
                    <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
                      {[1,1,1,1].map((_,i) => (
                        <div key={i} style={{ width: Math.round(3*scale), height: Math.round(5*scale), background: "rgba(255,255,255,0.9)", borderRadius: 1 }} />
                      ))}
                      <div style={{ width: Math.round(1.5*scale), height: Math.round(3*scale), background: "rgba(255,255,255,0.7)", marginLeft: 1 }} />
                    </div>
                  </div>

                  {/* Screen body */}
                  <div style={{ padding: `${fs(5)}px ${fs(7)}px` }}>

                    {/* ── Now Playing ── */}
                    {screen === "nowplaying" && (
                      <div style={{ textAlign: "center" }}>
                        {/* Artwork */}
                        <div style={{
                          width: Math.round(44*scale), height: Math.round(44*scale),
                          margin: `0 auto ${fs(5)}px`,
                          background: station?.color
                            ? `linear-gradient(135deg, ${station.color}44, ${station.color}88)`
                            : "linear-gradient(135deg, #3870aa, #5890c8)",
                          borderRadius: Math.round(4*scale),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 ${Math.round(2*scale)}px ${Math.round(8*scale)}px rgba(0,0,0,0.3)`,
                          overflow: "hidden", position: "relative",
                        }}>
                          {station?.logo
                            ? <img src={station.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            : <svg width={Math.round(20*scale)} height={Math.round(20*scale)} viewBox="0 0 24 24" fill="white">
                                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                              </svg>
                          }
                          {playerApi.isPlaying && (
                            <div style={{
                              position: "absolute", inset: 0,
                              background: "rgba(0,0,0,0.18)",
                              display: "flex", alignItems: "flex-end", justifyContent: "center",
                              paddingBottom: fs(3), gap: Math.round(1.5*scale),
                            }}>
                              {[1,2,3].map((_,i) => (
                                <div key={i} style={{
                                  width: Math.round(2.5*scale), borderRadius: 1,
                                  background: "white",
                                  height: `${28 + i * 24}%`,
                                  animation: `ipodEq 0.${5+i}s ease-in-out infinite alternate`,
                                }} />
                              ))}
                            </div>
                          )}
                        </div>

                        <p style={{ fontSize: fs(9), fontWeight: 700, color: "#18182e", margin: 0, lineHeight: 1.3 }}>
                          {station?.name ?? "Aucune station"}
                        </p>
                        <p style={{ fontSize: fs(7.5), color: "#445", margin: `${fs(2)}px 0 0`, lineHeight: 1 }}>
                          {playerApi.isLoading ? "Chargement…" : station?.genre ?? ""}
                        </p>

                        {/* Volume overlay */}
                        {showVol && (
                          <div style={{ marginTop: fs(5) }}>
                            <div style={{ display: "flex", gap: Math.round(1.5*scale), justifyContent: "center", alignItems: "flex-end", height: Math.round(10*scale) }}>
                              {Array.from({ length: volBars }, (_,i) => (
                                <div key={i} style={{
                                  width: Math.round(4*scale), borderRadius: 1,
                                  height: `${38 + i * 6}%`,
                                  background: i / volBars <= vol ? "#3870aa" : "rgba(0,0,0,0.15)",
                                  transition: "background 0.08s",
                                }} />
                              ))}
                            </div>
                            <p style={{ fontSize: fs(7), color: "#445", margin: `${fs(2)}px 0 0`, textAlign: "center" }}>Volume</p>
                          </div>
                        )}

                        {/* Progress bar */}
                        {!showVol && (
                          <div style={{ marginTop: fs(6) }}>
                            <div style={{ height: Math.round(2.5*scale), borderRadius: 2, background: "rgba(0,0,0,0.14)", overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                background: "linear-gradient(to right, #3870aa, #58a0d8)",
                                width: playerApi.isPlaying ? "100%" : "0%",
                                transition: "width 0.5s",
                              }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: fs(1) }}>
                              <span style={{ fontSize: fs(6.5), color: "#445" }}>LIVE</span>
                              <span style={{ fontSize: fs(6.5), color: "#445" }}>
                                {playerApi.isPlaying ? "▶ En direct" : "⏸ Pause"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Menu ── */}
                    {screen === "menu" && (
                      <div>
                        {MENU_ITEMS.map((item, i) => (
                          <div key={item.id}
                            onClick={() => { setMenuIdx(i); handleCenter(); }}
                            style={{
                              display: "flex", alignItems: "center", gap: fs(5),
                              padding: `${fs(4)}px ${fs(5)}px`,
                              borderRadius: Math.round(3*scale),
                              background: i === menuIdx
                                ? "linear-gradient(135deg, #3870aa, #5890c8)"
                                : "transparent",
                              cursor: "pointer", marginBottom: Math.round(1*scale),
                            }}>
                            <span style={{ fontSize: fs(9) }}>{item.icon}</span>
                            <span style={{
                              fontSize: fs(9), fontWeight: i === menuIdx ? 700 : 500,
                              color: i === menuIdx ? "white" : "#18182e", flex: 1,
                            }}>{item.label}</span>
                            {i === menuIdx && (
                              <span style={{ fontSize: fs(9), color: "rgba(255,255,255,0.8)" }}>›</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Stations list ── */}
                    {screen === "stations" && (
                      <div>
                        {stations.slice(Math.max(0, stationIdx - 1), stationIdx + 4).map((s, i) => {
                          const absIdx = Math.max(0, stationIdx - 1) + i;
                          return (
                            <div key={s.id}
                              onClick={() => { setStationIdx(absIdx); onSelectStation(s); setScreen("nowplaying"); }}
                              style={{
                                display: "flex", alignItems: "center", gap: fs(4),
                                padding: `${fs(3)}px ${fs(5)}px`,
                                borderRadius: Math.round(3*scale),
                                background: absIdx === stationIdx
                                  ? "linear-gradient(135deg, #3870aa, #5890c8)"
                                  : "transparent",
                                cursor: "pointer", marginBottom: Math.round(1*scale),
                              }}>
                              <div style={{
                                width: fs(12), height: fs(12), borderRadius: Math.round(2*scale),
                                background: s.color ? `${s.color}44` : "rgba(0,0,0,0.1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: fs(7), fontWeight: 700, color: s.color || "#445",
                                flexShrink: 0,
                              }}>{s.name[0]}</div>
                              <span style={{
                                fontSize: fs(8), fontWeight: absIdx === stationIdx ? 700 : 500,
                                color: absIdx === stationIdx ? "white" : "#18182e",
                                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{s.name}</span>
                              {s.id === station?.id && (
                                <span style={{ fontSize: fs(7), color: absIdx === stationIdx ? "rgba(255,255,255,0.8)" : "#3870aa" }}>♪</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Click Wheel ── */}
              <div
                ref={wheelRef}
                onMouseDown={handleWheelDown}
                onTouchStart={handleWheelDown}
                style={{
                  width: wheelD, height: wheelD,
                  borderRadius: "50%",
                  margin: "0 auto",
                  position: "relative",
                  background: "linear-gradient(145deg, #e9e9e4 0%, #d2d2cc 50%, #c2c2bc 100%)",
                  boxShadow: `
                    0 ${Math.round(4*scale)}px ${Math.round(12*scale)}px rgba(0,0,0,0.22),
                    inset 0 ${Math.round(2*scale)}px ${Math.round(4*scale)}px rgba(255,255,255,0.65),
                    inset 0 -${Math.round(2*scale)}px ${Math.round(4*scale)}px rgba(0,0,0,0.12)
                  `,
                  cursor: "grab",
                  userSelect: "none",
                  touchAction: "none",
                }}>

                {/* Inner ring */}
                <div style={{
                  position: "absolute", inset: Math.round(8*scale),
                  borderRadius: "50%",
                  border: `1px solid rgba(0,0,0,0.07)`,
                  background: "linear-gradient(145deg, #dcdcd7 0%, #cacacc 100%)",
                  boxShadow: `inset 0 1px ${Math.round(3*scale)}px rgba(0,0,0,0.08)`,
                }} />

                {/* MENU — top */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("menu"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handleMenu(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("menu"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handleMenu(); }}
                  style={{
                    position: "absolute", top: Math.round(14*scale), left: "50%",
                    transform: "translateX(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: fs(8), fontWeight: 700, color: "#444",
                    letterSpacing: 1, fontFamily: "system-ui",
                    padding: `${fs(4)}px ${fs(8)}px`,
                    opacity: pressed === "menu" ? 0.45 : 1,
                    transition: "opacity 0.08s",
                    WebkitTapHighlightColor: "transparent",
                  }}>MENU</button>

                {/* ⏮ left */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("prev"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handlePrev(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("prev"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handlePrev(); }}
                  style={{
                    position: "absolute", left: Math.round(14*scale), top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: fs(11), color: "#444",
                    padding: `${fs(4)}px ${fs(6)}px`,
                    opacity: pressed === "prev" ? 0.45 : 1,
                    transition: "opacity 0.08s",
                    WebkitTapHighlightColor: "transparent",
                  }}>⏮</button>

                {/* ⏭ right */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("next"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handleNext(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("next"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handleNext(); }}
                  style={{
                    position: "absolute", right: Math.round(14*scale), top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: fs(11), color: "#444",
                    padding: `${fs(4)}px ${fs(6)}px`,
                    opacity: pressed === "next" ? 0.45 : 1,
                    transition: "opacity 0.08s",
                    WebkitTapHighlightColor: "transparent",
                  }}>⏭</button>

                {/* ▶/⏸ bottom */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("play"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); playerApi.togglePlay(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("play"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); playerApi.togglePlay(); }}
                  style={{
                    position: "absolute", bottom: Math.round(14*scale), left: "50%",
                    transform: "translateX(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: fs(12), color: "#444",
                    padding: `${fs(4)}px ${fs(8)}px`,
                    opacity: pressed === "play" ? 0.45 : 1,
                    transition: "opacity 0.08s",
                    WebkitTapHighlightColor: "transparent",
                  }}>
                  {playerApi.isPlaying ? "⏸" : "▶"}
                </button>

                {/* Center button */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onMouseUp={e => { e.stopPropagation(); handleCenter(); }}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => { e.stopPropagation(); handleCenter(); }}
                  style={{
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: Math.round(58*scale), height: Math.round(58*scale),
                    borderRadius: "50%",
                    background: "linear-gradient(145deg, #f0f0eb 0%, #dcdcd7 100%)",
                    border: "none", cursor: "pointer",
                    boxShadow: `
                      0 ${Math.round(2*scale)}px ${Math.round(8*scale)}px rgba(0,0,0,0.18),
                      inset 0 1px ${Math.round(2*scale)}px rgba(255,255,255,0.85),
                      inset 0 -1px ${Math.round(2*scale)}px rgba(0,0,0,0.1)
                    `,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.08s",
                    WebkitTapHighlightColor: "transparent",
                  }}>
                  <div style={{
                    width: Math.round(38*scale), height: Math.round(38*scale),
                    borderRadius: "50%",
                    background: "linear-gradient(145deg, #e8e8e3, #d8d8d3)",
                    boxShadow: `inset 0 1px ${Math.round(3*scale)}px rgba(0,0,0,0.1)`,
                  }} />
                </button>
              </div>

              {/* Bottom label */}
              <p style={{
                textAlign: "center", marginTop: Math.round(10*scale),
                fontSize: fs(7), color: "#999",
                letterSpacing: 0.5, fontFamily: "system-ui",
              }}>RadioFR iPod</p>
            </div>
          </motion.div>

          <style>{`
            @keyframes ipodEq {
              from { height: 28%; }
              to   { height: 92%; }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
