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
  const [wheelAngle, setWheelAngle]   = useState<number | null>(null);
  const [scrollDelta, setScrollDelta] = useState(0);
  const [pressed, setPressed]         = useState<string | null>(null);

  // Track touch/mouse angle on the click wheel
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  const accDelta  = useRef(0);

  const listLen = screen === "menu" ? MENU_ITEMS.length : stations.length;

  const getAngle = (e: MouseEvent | TouchEvent, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let x: number, y: number;
    if ("touches" in e) {
      x = e.touches[0].clientX - cx;
      y = e.touches[0].clientY - cy;
    } else {
      x = (e as MouseEvent).clientX - cx;
      y = (e as MouseEvent).clientY - cy;
    }
    return Math.atan2(y, x) * (180 / Math.PI);
  };

  const handleWheelMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!wheelRef.current || lastAngle.current === null) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const angle = getAngle(e, rect);
    let delta = angle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngle.current = angle;
    accDelta.current += delta;

    const step = 18; // degrees per step
    if (Math.abs(accDelta.current) >= step) {
      const steps = Math.floor(accDelta.current / step);
      accDelta.current -= steps * step;

      if (screen === "menu") {
        setMenuIdx(i => Math.min(MENU_ITEMS.length - 1, Math.max(0, i + steps)));
      } else if (screen === "stations") {
        setStationIdx(i => Math.min(stations.length - 1, Math.max(0, i + steps)));
      } else {
        // now playing: adjust volume
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
    // Check if click is on the inner circle (center button area) — skip
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let dx: number, dy: number;
    if ("touches" in e) {
      dx = e.touches[0].clientX - cx;
      dy = e.touches[0].clientY - cy;
    } else {
      dx = (e as React.MouseEvent).clientX - cx;
      dy = (e as React.MouseEvent).clientY - cy;
    }
    const dist = Math.sqrt(dx * dx + dy * dy);
    const innerR = rect.width * 0.28; // center button radius ratio
    if (dist < innerR) return; // let center button handle it

    const nativeE = "nativeEvent" in e ? e.nativeEvent : e;
    lastAngle.current = getAngle(nativeE as MouseEvent | TouchEvent, rect);
    accDelta.current = 0;
    document.addEventListener("mousemove", handleWheelMove);
    document.addEventListener("mouseup", handleWheelUp);
    document.addEventListener("touchmove", handleWheelMove, { passive: false });
    document.addEventListener("touchend", handleWheelUp);
  }, [handleWheelMove, handleWheelUp]);

  // Button handlers
  const handleMenu = () => {
    if (screen === "nowplaying") setScreen("menu");
    else if (screen === "stations") setScreen("menu");
    else setScreen("nowplaying");
  };

  const handleCenter = () => {
    if (screen === "menu") {
      const item = MENU_ITEMS[menuIdx];
      if (item.id === "nowplaying") setScreen("nowplaying");
      else if (item.id === "stations") setScreen("stations");
      else if (item.id === "volume") {
        setShowVol(true);
        setScreen("nowplaying");
      }
    } else if (screen === "stations") {
      const s = stations[stationIdx];
      if (s) {
        onSelectStation(s);
        setScreen("nowplaying");
      }
    } else {
      playerApi.togglePlay();
    }
  };

  const handlePlay = () => {
    playerApi.togglePlay();
  };

  const handleNext = () => {
    if (!station) return;
    const idx = stations.findIndex(s => s.id === station.id);
    const next = stations[(idx + 1) % stations.length];
    if (next) onSelectStation(next);
  };

  const handlePrev = () => {
    if (!station) return;
    const idx = stations.findIndex(s => s.id === station.id);
    const prev = stations[(idx - 1 + stations.length) % stations.length];
    if (prev) onSelectStation(prev);
  };

  // Hide volume bar after 2s
  useEffect(() => {
    if (!showVol) return;
    const t = setTimeout(() => setShowVol(false), 2000);
    return () => clearTimeout(t);
  }, [showVol, playerApi.volume]);

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowUp")   setMenuIdx(i => Math.max(0, i - 1));
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

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
            onClick={onClose}
          />

          {/* iPod body */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="fixed z-50 select-none"
            style={{
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 220,
              touchAction: "none",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* iPod shell */}
            <div style={{
              background: "linear-gradient(160deg, #f5f5f0 0%, #e8e8e2 40%, #d0d0ca 100%)",
              borderRadius: 32,
              padding: "14px 14px 20px",
              boxShadow: `
                0 40px 80px rgba(0,0,0,0.6),
                0 0 0 1px rgba(255,255,255,0.3),
                inset 0 1px 0 rgba(255,255,255,0.8),
                inset 0 -2px 4px rgba(0,0,0,0.15)
              `,
              position: "relative",
            }}>

              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  position: "absolute", top: 10, right: 10,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(0,0,0,0.12)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#555", fontSize: 10, lineHeight: 1,
                }}
              >✕</button>

              {/* Screen bezel */}
              <div style={{
                background: "#1a1a1a",
                borderRadius: 10,
                padding: 3,
                marginBottom: 16,
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.3)",
              }}>
                {/* Screen */}
                <div style={{
                  background: "linear-gradient(180deg, #b8cfe8 0%, #c8dff5 30%, #d5e8ff 100%)",
                  borderRadius: 8,
                  height: 120,
                  overflow: "hidden",
                  position: "relative",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  {/* Screen header bar */}
                  <div style={{
                    background: "linear-gradient(180deg, #4a7fb8 0%, #3a6fa8 100%)",
                    height: 18,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 6px",
                  }}>
                    <span style={{ color: "white", fontSize: 8, fontWeight: 700, letterSpacing: 0.5 }}>
                      {screen === "nowplaying" ? "Now Playing" : screen === "menu" ? "RadioFR" : "Stations"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      {/* Battery icon */}
                      <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
                        {[1,1,1,1].map((_, i) => (
                          <div key={i} style={{ width: 3, height: 5, background: "rgba(255,255,255,0.9)", borderRadius: 0.5 }} />
                        ))}
                        <div style={{ width: 1.5, height: 3, background: "rgba(255,255,255,0.7)", borderRadius: 0.5, marginLeft: 0.5 }} />
                      </div>
                    </div>
                  </div>

                  {/* Screen content */}
                  <div style={{ padding: "6px 8px", position: "relative" }}>

                    {screen === "nowplaying" && (
                      <div style={{ textAlign: "center" }}>
                        {/* Album art area */}
                        <div style={{
                          width: 44, height: 44, margin: "0 auto 6px",
                          background: station?.color
                            ? `linear-gradient(135deg, ${station.color}40, ${station.color}80)`
                            : "linear-gradient(135deg, #3a6fa8 0%, #5a8fc8 100%)",
                          borderRadius: 4,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          overflow: "hidden",
                          position: "relative",
                        }}>
                          {station?.logo ? (
                            <img src={station.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          )}
                          {playerApi.isPlaying && (
                            <div style={{
                              position: "absolute", inset: 0,
                              background: "rgba(0,0,0,0.15)",
                              display: "flex", alignItems: "flex-end", justifyContent: "center",
                              paddingBottom: 3, gap: 1.5,
                            }}>
                              {[1,2,3].map((_, i) => (
                                <div key={i} style={{
                                  width: 2.5, borderRadius: 1,
                                  background: "white",
                                  height: `${30 + i * 25}%`,
                                  animation: `ipodEq 0.${6+i}s ease-in-out infinite alternate`,
                                }} />
                              ))}
                            </div>
                          )}
                        </div>

                        <p style={{ fontSize: 9, fontWeight: 700, color: "#1a1a2e", margin: 0, lineHeight: 1.3 }}>
                          {station?.name ?? "Aucune station"}
                        </p>
                        <p style={{ fontSize: 7.5, color: "#446", margin: "2px 0 0", lineHeight: 1 }}>
                          {station?.genre ?? ""}
                        </p>
                        {playerApi.isLoading && (
                          <p style={{ fontSize: 7, color: "#668", margin: "3px 0 0" }}>Chargement…</p>
                        )}

                        {/* Volume bar (shown briefly after wheel turn) */}
                        {showVol && (
                          <div style={{ marginTop: 5 }}>
                            <div style={{ display: "flex", gap: 1.5, justifyContent: "center", alignItems: "flex-end", height: 10 }}>
                              {Array.from({ length: volBars }, (_, i) => (
                                <div key={i} style={{
                                  width: 4, borderRadius: 1,
                                  height: `${40 + i * 6}%`,
                                  background: i / volBars <= vol ? "#3a6fa8" : "rgba(0,0,0,0.15)",
                                  transition: "background 0.1s",
                                }} />
                              ))}
                            </div>
                            <p style={{ fontSize: 7, color: "#446", margin: "2px 0 0", textAlign: "center" }}>Volume</p>
                          </div>
                        )}

                        {/* Progress bar (fake for live radio) */}
                        {!showVol && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{
                              height: 2.5, borderRadius: 2,
                              background: "rgba(0,0,0,0.15)",
                              overflow: "hidden",
                            }}>
                              <div style={{
                                height: "100%",
                                background: "linear-gradient(to right, #3a6fa8, #5a9fd8)",
                                width: playerApi.isPlaying ? "100%" : "0%",
                                transition: "width 0.5s",
                                animation: playerApi.isPlaying ? "ipodProgress 60s linear infinite" : undefined,
                              }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
                              <span style={{ fontSize: 6.5, color: "#446" }}>LIVE</span>
                              <span style={{ fontSize: 6.5, color: "#446" }}>
                                {playerApi.isPlaying ? "▶ En direct" : "⏸ Pause"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {screen === "menu" && (
                      <div>
                        {MENU_ITEMS.map((item, i) => (
                          <div
                            key={item.id}
                            onClick={() => { setMenuIdx(i); handleCenter(); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "4px 5px",
                              borderRadius: 3,
                              background: i === menuIdx
                                ? "linear-gradient(135deg, #3a6fa8, #5a8fc8)"
                                : "transparent",
                              cursor: "pointer",
                              marginBottom: 1,
                            }}>
                            <span style={{ fontSize: 9 }}>{item.icon}</span>
                            <span style={{
                              fontSize: 9, fontWeight: i === menuIdx ? 700 : 500,
                              color: i === menuIdx ? "white" : "#1a1a2e",
                              flex: 1,
                            }}>{item.label}</span>
                            {i === menuIdx && (
                              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.8)" }}>›</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {screen === "stations" && (
                      <div style={{ overflowY: "hidden" }}>
                        {stations.slice(Math.max(0, stationIdx - 1), stationIdx + 4).map((s, i) => {
                          const absIdx = Math.max(0, stationIdx - 1) + i;
                          return (
                            <div
                              key={s.id}
                              onClick={() => { setStationIdx(absIdx); onSelectStation(s); setScreen("nowplaying"); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "3px 5px",
                                borderRadius: 3,
                                background: absIdx === stationIdx
                                  ? "linear-gradient(135deg, #3a6fa8, #5a8fc8)"
                                  : "transparent",
                                cursor: "pointer",
                                marginBottom: 1,
                              }}>
                              <div style={{
                                width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                                background: s.color ? `${s.color}40` : "rgba(0,0,0,0.1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 7, fontWeight: 700, color: s.color || "#446",
                              }}>{s.name[0]}</div>
                              <span style={{
                                fontSize: 8, fontWeight: absIdx === stationIdx ? 700 : 500,
                                color: absIdx === stationIdx ? "white" : "#1a1a2e",
                                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>{s.name}</span>
                              {s.id === station?.id && (
                                <span style={{ fontSize: 7, color: absIdx === stationIdx ? "rgba(255,255,255,0.8)" : "#3a6fa8" }}>♪</span>
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
                  width: 160, height: 160,
                  borderRadius: "50%",
                  margin: "0 auto",
                  position: "relative",
                  background: "linear-gradient(145deg, #e8e8e2 0%, #d0d0ca 50%, #c0c0ba 100%)",
                  boxShadow: `
                    0 4px 12px rgba(0,0,0,0.25),
                    inset 0 2px 4px rgba(255,255,255,0.6),
                    inset 0 -2px 4px rgba(0,0,0,0.15)
                  `,
                  cursor: "grab",
                  userSelect: "none",
                  touchAction: "none",
                }}>

                {/* Wheel track ring */}
                <div style={{
                  position: "absolute", inset: 8,
                  borderRadius: "50%",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "linear-gradient(145deg, #dcdcd6 0%, #cacac4 100%)",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                }} />

                {/* MENU button - top */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("menu"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handleMenu(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("menu"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handleMenu(); }}
                  style={{
                    position: "absolute", top: 14, left: "50%",
                    transform: "translateX(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 8, fontWeight: 700, color: "#444",
                    letterSpacing: 1, fontFamily: "system-ui",
                    padding: "4px 8px",
                    opacity: pressed === "menu" ? 0.5 : 1,
                    transition: "opacity 0.1s",
                  }}>
                  MENU
                </button>

                {/* Skip back - left */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("prev"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handlePrev(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("prev"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handlePrev(); }}
                  style={{
                    position: "absolute", left: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, color: "#444",
                    padding: "4px 6px",
                    opacity: pressed === "prev" ? 0.5 : 1,
                    transition: "opacity 0.1s",
                  }}>
                  ⏮
                </button>

                {/* Skip forward - right */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("next"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handleNext(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("next"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handleNext(); }}
                  style={{
                    position: "absolute", right: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, color: "#444",
                    padding: "4px 6px",
                    opacity: pressed === "next" ? 0.5 : 1,
                    transition: "opacity 0.1s",
                  }}>
                  ⏭
                </button>

                {/* Play/pause - bottom */}
                <button
                  onMouseDown={e => { e.stopPropagation(); setPressed("play"); }}
                  onMouseUp={e => { e.stopPropagation(); setPressed(null); handlePlay(); }}
                  onTouchStart={e => { e.stopPropagation(); setPressed("play"); }}
                  onTouchEnd={e => { e.stopPropagation(); setPressed(null); handlePlay(); }}
                  style={{
                    position: "absolute", bottom: 14, left: "50%",
                    transform: "translateX(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, color: "#444",
                    padding: "4px 8px",
                    opacity: pressed === "play" ? 0.5 : 1,
                    transition: "opacity 0.1s",
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
                    width: 58, height: 58,
                    borderRadius: "50%",
                    background: "linear-gradient(145deg, #f0f0ea 0%, #dcdcd6 100%)",
                    border: "none", cursor: "pointer",
                    boxShadow: `
                      0 2px 8px rgba(0,0,0,0.2),
                      inset 0 1px 2px rgba(255,255,255,0.8),
                      inset 0 -1px 2px rgba(0,0,0,0.1)
                    `,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.1s",
                  }}>
                  {/* Center click visual */}
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "linear-gradient(145deg, #e8e8e2, #d8d8d2)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
                  }} />
                </button>
              </div>

              {/* Bottom text */}
              <p style={{
                textAlign: "center", marginTop: 10,
                fontSize: 7, color: "#888",
                letterSpacing: 0.5, fontFamily: "system-ui",
              }}>
                RadioFR iPod
              </p>
            </div>
          </motion.div>

          {/* EQ bar animation keyframes */}
          <style>{`
            @keyframes ipodEq {
              from { height: 30%; }
              to   { height: 90%; }
            }
            @keyframes ipodProgress {
              from { transform: scaleX(0); transform-origin: left; }
              to   { transform: scaleX(1); transform-origin: left; }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
