"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Station } from "@/lib/stations";
import { getEpisodesForPodcast, iTunesPodcast, RSSEpisode } from "@/lib/podcastUtils";
import { IPOD_SKINS, useTheme } from "@/context/ThemeContext";

interface PodcastNowPlaying {
  episodeTitle: string;
  audioUrl: string;
  podcastName: string;
  artwork: string;
  isVideo?: boolean;
}

interface PlayerApi {
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  changeVolume: (v: number) => void;
  togglePlay: () => void;
  initAudio: (url: string) => void;
  currentUrl: string | null;
  mediaElRef: React.MutableRefObject<HTMLMediaElement | null>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  playerApi: PlayerApi;
  station: Station | null;
  currentPodcast: PodcastNowPlaying | null;
  stations: Station[];
  onSelectStation: (s: Station) => void;
  onPlayEpisode: (ep: RSSEpisode, pod: iTunesPodcast) => void;
}

type IpodScreen = "nowplaying" | "menu" | "stations" | "podcasts" | "episodes";

const MENU_ITEMS = [
  { id: "nowplaying", label: "Now Playing", icon: "♪" },
  { id: "stations",   label: "Stations",    icon: "📻" },
  { id: "podcasts",   label: "Podcasts",    icon: "🎧" },
  { id: "volume",     label: "Volume",      icon: "🔊" },
];

async function fetchTopPodcasts(genreId?: number): Promise<iTunesPodcast[]> {
  const genrePart = genreId ? `/genre=${genreId}` : "";
  const res = await fetch(`https://itunes.apple.com/fr/rss/toppodcasts/limit=20${genrePart}/explicit=true/json`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.feed?.entry ?? []).map((e: any) => ({
    trackId:          parseInt(e.id?.attributes?.["im:id"] ?? "0"),
    trackName:        e["im:name"]?.label ?? "",
    artistName:       e["im:artist"]?.label ?? "",
    artworkUrl600:    e["im:image"]?.[2]?.label ?? "",
    artworkUrl100:    e["im:image"]?.[0]?.label ?? "",
    primaryGenreName: e.category?.attributes?.label ?? "",
    trackCount:       0,
    feedUrl:          "",
    trackViewUrl:     e.link?.attributes?.href ?? "",
    collectionId:     parseInt(e.id?.attributes?.["im:id"] ?? "0"),
  }));
}

export default function IpodOverlay({
  open, onClose, playerApi, station, currentPodcast, stations, onSelectStation, onPlayEpisode,
}: Props) {
  const { ipodSkin } = useTheme();
  const skin = IPOD_SKINS.find((s) => s.id === ipodSkin) ?? IPOD_SKINS[0];

  const [screen, setScreen]           = useState<IpodScreen>("nowplaying");
  const [menuIdx, setMenuIdx]         = useState(0);
  const [stationIdx, setStationIdx]   = useState(0);
  const [podcastIdx, setPodcastIdx]   = useState(0);
  const [episodeIdx, setEpisodeIdx]   = useState(0);
  const [showVol, setShowVol]         = useState(false);
  const [pressed, setPressed]         = useState<string | null>(null);
  const [winW, setWinW]               = useState(375);

  // Podcast data
  const [podcasts, setPodcasts]   = useState<iTunesPodcast[]>([]);
  const [episodes, setEpisodes]   = useState<RSSEpisode[]>([]);
  const [epLoading, setEpLoading] = useState(false);
  const [selectedPod, setSelectedPod] = useState<iTunesPodcast | null>(null);

  // Responsive sizing
  useEffect(() => {
    const update = () => setWinW(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Load top podcasts when "podcasts" screen shown
  useEffect(() => {
    if (screen === "podcasts" && podcasts.length === 0) {
      fetchTopPodcasts().then(setPodcasts);
    }
  }, [screen, podcasts.length]);

  // Load episodes when a podcast is selected
  useEffect(() => {
    if (!selectedPod) return;
    setEpLoading(true);
    setEpisodes([]);
    setEpisodeIdx(0);
    getEpisodesForPodcast(selectedPod).then(eps => {
      setEpisodes(eps);
      setEpLoading(false);
    }).catch(() => setEpLoading(false));
  }, [selectedPod]);

  const isMobile = winW < 540;
  const bodyW    = isMobile ? Math.min(Math.round(winW * 0.95), 360) : 220;
  const scale    = bodyW / 220;
  const wheelD   = Math.round(160 * scale);
  const screenH  = Math.round(120 * scale);
  const pad      = Math.round(14 * scale);
  const padB     = Math.round(20 * scale);
  const fs       = (base: number) => Math.round(base * scale);

  // Click wheel
  const wheelRef  = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  const accDelta  = useRef(0);

  const getAngle = (e: MouseEvent | TouchEvent, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let x: number, y: number;
    if ("touches" in e) { x = e.touches[0].clientX - cx; y = e.touches[0].clientY - cy; }
    else { x = (e as MouseEvent).clientX - cx; y = (e as MouseEvent).clientY - cy; }
    return Math.atan2(y, x) * (180 / Math.PI);
  };

  const scrollList = useCallback((steps: number) => {
    if (screen === "menu")     setMenuIdx(i => Math.min(MENU_ITEMS.length - 1, Math.max(0, i + steps)));
    else if (screen === "stations") setStationIdx(i => Math.min(stations.length - 1, Math.max(0, i + steps)));
    else if (screen === "podcasts") setPodcastIdx(i => Math.min(podcasts.length - 1, Math.max(0, i + steps)));
    else if (screen === "episodes") setEpisodeIdx(i => Math.min(episodes.length - 1, Math.max(0, i + steps)));
    else { // nowplaying: adjust volume
      playerApi.changeVolume(Math.min(1, Math.max(0, playerApi.volume + steps * 0.05)));
      setShowVol(true);
    }
  }, [screen, stations.length, podcasts.length, episodes.length, playerApi]);

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
    if (Math.abs(accDelta.current) >= 18) {
      const steps = Math.floor(accDelta.current / 18);
      accDelta.current -= steps * 18;
      scrollList(steps);
    }
  }, [scrollList]);

  const handleWheelUp = useCallback(() => {
    lastAngle.current = null; accDelta.current = 0;
    document.removeEventListener("mousemove", handleWheelMove);
    document.removeEventListener("mouseup", handleWheelUp);
    document.removeEventListener("touchmove", handleWheelMove);
    document.removeEventListener("touchend", handleWheelUp);
  }, [handleWheelMove]);

  const handleWheelDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    let dx: number, dy: number;
    if ("touches" in e) { dx = e.touches[0].clientX - cx; dy = e.touches[0].clientY - cy; }
    else { dx = (e as React.MouseEvent).clientX - cx; dy = (e as React.MouseEvent).clientY - cy; }
    if (Math.sqrt(dx * dx + dy * dy) < wheelD * 0.28) return;
    const nativeE = "nativeEvent" in e ? e.nativeEvent : e;
    lastAngle.current = getAngle(nativeE as MouseEvent | TouchEvent, rect);
    accDelta.current = 0;
    document.addEventListener("mousemove", handleWheelMove);
    document.addEventListener("mouseup", handleWheelUp);
    document.addEventListener("touchmove", handleWheelMove, { passive: false });
    document.addEventListener("touchend", handleWheelUp);
  }, [handleWheelMove, handleWheelUp, wheelD]);

  const handleMenu = () => {
    if (screen === "episodes") setScreen("podcasts");
    else if (screen !== "nowplaying") setScreen("nowplaying");
    else setScreen("menu");
  };

  const handleCenter = () => {
    if (screen === "menu") {
      const item = MENU_ITEMS[menuIdx];
      if (item.id === "volume") { setShowVol(true); setScreen("nowplaying"); }
      else setScreen(item.id as IpodScreen);
    } else if (screen === "stations") {
      const s = stations[stationIdx];
      if (s) { onSelectStation(s); setScreen("nowplaying"); }
    } else if (screen === "podcasts") {
      const p = podcasts[podcastIdx];
      if (p) { setSelectedPod(p); setScreen("episodes"); }
    } else if (screen === "episodes") {
      const ep = episodes[episodeIdx];
      if (ep && selectedPod) { onPlayEpisode(ep, selectedPod); setScreen("nowplaying"); }
    } else {
      playerApi.togglePlay();
    }
  };

  const handleNext = () => {
    if (screen === "nowplaying") {
      if (station) {
        const idx = stations.findIndex(s => s.id === station.id);
        onSelectStation(stations[(idx + 1) % stations.length]);
      } else if (episodes.length > 0 && selectedPod) {
        const next = episodes[Math.min(episodeIdx + 1, episodes.length - 1)];
        if (next) { setEpisodeIdx(i => Math.min(episodes.length - 1, i + 1)); onPlayEpisode(next, selectedPod); }
      }
    }
  };

  const handlePrev = () => {
    if (screen === "nowplaying") {
      if (station) {
        const idx = stations.findIndex(s => s.id === station.id);
        onSelectStation(stations[(idx - 1 + stations.length) % stations.length]);
      } else if (episodes.length > 0 && selectedPod) {
        const prev = episodes[Math.max(episodeIdx - 1, 0)];
        if (prev) { setEpisodeIdx(i => Math.max(0, i - 1)); onPlayEpisode(prev, selectedPod); }
      }
    }
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
      if (e.key === "ArrowUp")   scrollList(-1);
      if (e.key === "ArrowDown") scrollList(1);
      if (e.key === "Enter") handleCenter();
      if (e.key === " ") { e.preventDefault(); playerApi.togglePlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen, menuIdx, stationIdx, podcastIdx, episodeIdx]);

  const vol = playerApi.volume;
  const isPlayingPodcast = !!currentPodcast && !station;
  const isVideoPodcast = isPlayingPodcast && !!currentPodcast?.isVideo;

  // Mount the shared <video> element into the iPod screen for video podcasts.
  // While the iPod is open it "owns" the element (the Player behind it is hidden
  // and yields ownership via its `ipodOpen` prop); on close the Player reclaims it.
  const ipodVideoBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ipodVideoBoxRef.current;
    const el = playerApi.mediaElRef?.current as HTMLVideoElement | null;
    const show = open && isVideoPodcast && screen === "nowplaying";
    if (!box || !el || !show) return;
    el.style.width = "100%"; el.style.height = "100%";
    el.style.objectFit = "cover"; el.style.display = "block";
    box.appendChild(el);
    return () => { if (el.parentNode === box) box.removeChild(el); };
  }, [open, screen, isVideoPodcast, currentPodcast?.audioUrl, playerApi.mediaElRef]);

  // ── List renderer (shared for stations / podcasts / episodes) ──────
  function renderList<T>(
    items: T[],
    activeIdx: number,
    getLabel: (item: T) => string,
    getSubLabel?: (item: T) => string,
    getIcon?: (item: T) => string,
    onTap?: (item: T, idx: number) => void,
  ) {
    const start = Math.max(0, activeIdx - 1);
    return items.slice(start, start + 5).map((item, i) => {
      const absIdx = start + i;
      return (
        <div key={absIdx}
          onClick={() => onTap?.(item, absIdx)}
          style={{
            display: "flex", alignItems: "center", gap: fs(4),
            padding: `${fs(3)}px ${fs(5)}px`,
            borderRadius: Math.round(3 * scale),
            background: absIdx === activeIdx ? "linear-gradient(135deg, #3870aa, #5890c8)" : "transparent",
            cursor: "pointer", marginBottom: Math.round(1 * scale),
          }}>
          {getIcon && (
            <span style={{ fontSize: fs(9), flexShrink: 0 }}>{getIcon(item)}</span>
          )}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{
              fontSize: fs(8), fontWeight: absIdx === activeIdx ? 700 : 500,
              color: absIdx === activeIdx ? "white" : "#18182e",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{getLabel(item)}</div>
            {getSubLabel && (
              <div style={{
                fontSize: fs(6.5), color: absIdx === activeIdx ? "rgba(255,255,255,0.7)" : "#888",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{getSubLabel(item)}</div>
            )}
          </div>
          {absIdx === activeIdx && (
            <span style={{ fontSize: fs(9), color: "rgba(255,255,255,0.8)", flexShrink: 0 }}>›</span>
          )}
        </div>
      );
    });
  }

  const motionProps = isMobile ? {
    initial: { y: "100%", opacity: 0 }, animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 }, transition: { type: "spring" as const, damping: 28, stiffness: 320 },
  } : {
    initial: { scale: 0.75, opacity: 0, y: 30 }, animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.75, opacity: 0, y: 30 }, transition: { type: "spring" as const, damping: 22, stiffness: 300 },
  };

  const wrapperStyle: React.CSSProperties = isMobile
    ? { bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", paddingBottom: "env(safe-area-inset-bottom, 16px)", paddingTop: 16 }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(14px)" }}
            onClick={onClose} />

          <motion.div {...motionProps} className="fixed z-50 select-none"
            style={{ ...wrapperStyle, touchAction: "none" }}
            onClick={e => e.stopPropagation()}>

            {/* ── iPod shell ── */}
            <div style={{
              width: bodyW,
              background: skin.shell,
              borderRadius: Math.round(32 * scale),
              padding: `${pad}px ${pad}px ${padB}px`,
              boxShadow: `0 ${Math.round(40*scale)}px ${Math.round(80*scale)}px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.35), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -2px 4px rgba(0,0,0,0.12)`,
              position: "relative", flexShrink: 0,
            }}>

              {/* Close */}
              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClose(); }}
                style={{
                  position: "absolute", top: Math.round(10*scale), right: Math.round(10*scale),
                  width: Math.round(22*scale), height: Math.round(22*scale), borderRadius: "50%",
                  background: skin.closeBg, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: skin.closeColor, fontSize: fs(9), lineHeight: 1,
                }}>✕</button>

              {/* ── Screen bezel ── */}
              <div style={{
                background: "#1c1c1c", borderRadius: Math.round(10*scale),
                padding: Math.round(3*scale), marginBottom: Math.round(14*scale),
                boxShadow: `inset 0 ${Math.round(2*scale)}px ${Math.round(6*scale)}px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
                <div style={{
                  background: "linear-gradient(180deg, #b2ccec 0%, #c5daf5 30%, #d2e6ff 100%)",
                  borderRadius: Math.round(7*scale), height: screenH,
                  overflow: "hidden", position: "relative", fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                  {/* Title bar */}
                  <div style={{
                    background: "linear-gradient(180deg, #4880bc 0%, #3870aa 100%)",
                    height: Math.round(18*scale), display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: `0 ${fs(5)}px`,
                  }}>
                    <span style={{ color: "white", fontSize: fs(7.5), fontWeight: 700, letterSpacing: 0.4 }}>
                      {screen === "nowplaying" ? "Now Playing"
                       : screen === "menu"     ? "RadioFR"
                       : screen === "stations" ? "Stations"
                       : screen === "podcasts" ? "Podcasts"
                       : selectedPod?.trackName ?? "Épisodes"}
                    </span>
                    <div style={{ display: "flex", gap: 1 }}>
                      {[1,1,1,1].map((_,i) => (
                        <div key={i} style={{ width: Math.round(3*scale), height: Math.round(5*scale), background: "rgba(255,255,255,0.9)", borderRadius: 1 }} />
                      ))}
                    </div>
                  </div>

                  {/* Screen content */}
                  <div style={{ padding: `${fs(4)}px ${fs(6)}px`, height: `calc(100% - ${Math.round(18*scale)}px)`, overflow: "hidden" }}>

                    {/* ── Now Playing ── */}
                    {screen === "nowplaying" && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{
                          width: Math.round(44*scale), height: Math.round(44*scale),
                          margin: `0 auto ${fs(4)}px`,
                          background: station?.color ? `linear-gradient(135deg, ${station.color}44, ${station.color}88)` : "linear-gradient(135deg, #3870aa, #5890c8)",
                          borderRadius: Math.round(4*scale), display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 ${Math.round(2*scale)}px ${Math.round(8*scale)}px rgba(0,0,0,0.3)`,
                          overflow: "hidden", position: "relative",
                        }}>
                          {isVideoPodcast
                            ? <div ref={ipodVideoBoxRef} style={{ width: "100%", height: "100%", background: "#000" }} />
                            : isPlayingPodcast && currentPodcast?.artwork
                            ? <img src={currentPodcast.artwork} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : station?.logo
                              ? <img src={station.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              : <span style={{ fontSize: fs(18) }}>🎙</span>
                          }
                          {playerApi.isPlaying && !isVideoPodcast && (
                            <div style={{
                              position: "absolute", inset: 0, background: "rgba(0,0,0,0.18)",
                              display: "flex", alignItems: "flex-end", justifyContent: "center",
                              paddingBottom: fs(3), gap: Math.round(1.5*scale),
                            }}>
                              {[0,1,2].map(i => (
                                <div key={i} style={{
                                  width: Math.round(2.5*scale), borderRadius: 1, background: "white",
                                  height: `${28 + i * 24}%`,
                                  animation: `ipodEq 0.${5+i}s ease-in-out infinite alternate`,
                                }} />
                              ))}
                            </div>
                          )}
                        </div>

                        <p style={{ fontSize: fs(8.5), fontWeight: 700, color: "#18182e", margin: 0, lineHeight: 1.3,
                          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {isPlayingPodcast ? currentPodcast!.episodeTitle : (station?.name ?? "Aucun media")}
                        </p>
                        <p style={{ fontSize: fs(7), color: "#445", margin: `${fs(1)}px 0 0`, lineHeight: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isPlayingPodcast ? currentPodcast!.podcastName
                           : playerApi.isLoading ? "Chargement…"
                           : station?.genre ?? ""}
                        </p>

                        {showVol && (
                          <div style={{ marginTop: fs(4), display: "flex", gap: Math.round(1.5*scale), justifyContent: "center", alignItems: "flex-end", height: Math.round(10*scale) }}>
                            {Array.from({ length: 10 }, (_,i) => (
                              <div key={i} style={{
                                width: Math.round(4*scale), borderRadius: 1,
                                height: `${38 + i * 6}%`,
                                background: i / 10 <= vol ? "#3870aa" : "rgba(0,0,0,0.15)",
                              }} />
                            ))}
                          </div>
                        )}

                        {!showVol && (
                          <div style={{ marginTop: fs(5), height: Math.round(2.5*scale), borderRadius: 2, background: "rgba(0,0,0,0.14)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              background: "linear-gradient(to right, #3870aa, #58a0d8)",
                              width: playerApi.isPlaying ? "100%" : "0%",
                              transition: "width 0.5s",
                            }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Menu ── */}
                    {screen === "menu" && (
                      <div>
                        {MENU_ITEMS.map((item, i) => (
                          <div key={item.id} onClick={() => { setMenuIdx(i); handleCenter(); }}
                            style={{
                              display: "flex", alignItems: "center", gap: fs(5),
                              padding: `${fs(4)}px ${fs(5)}px`, borderRadius: Math.round(3*scale),
                              background: i === menuIdx ? "linear-gradient(135deg, #3870aa, #5890c8)" : "transparent",
                              cursor: "pointer", marginBottom: Math.round(1*scale),
                            }}>
                            <span style={{ fontSize: fs(9) }}>{item.icon}</span>
                            <span style={{ fontSize: fs(9), fontWeight: i === menuIdx ? 700 : 500, color: i === menuIdx ? "white" : "#18182e", flex: 1 }}>
                              {item.label}
                            </span>
                            {i === menuIdx && <span style={{ fontSize: fs(9), color: "rgba(255,255,255,0.8)" }}>›</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Stations ── */}
                    {screen === "stations" && renderList(
                      stations, stationIdx,
                      s => s.name,
                      s => s.genre,
                      s => undefined as any,
                      (s, idx) => { setStationIdx(idx); onSelectStation(s); setScreen("nowplaying"); },
                    )}

                    {/* ── Podcasts ── */}
                    {screen === "podcasts" && (
                      podcasts.length === 0
                        ? <p style={{ fontSize: fs(8), color: "#888", textAlign: "center", marginTop: fs(12) }}>Chargement…</p>
                        : renderList(
                            podcasts, podcastIdx,
                            p => p.trackName,
                            p => p.artistName,
                            undefined,
                            (p, idx) => { setPodcastIdx(idx); setSelectedPod(p); setScreen("episodes"); },
                          )
                    )}

                    {/* ── Episodes ── */}
                    {screen === "episodes" && (
                      epLoading
                        ? <p style={{ fontSize: fs(8), color: "#888", textAlign: "center", marginTop: fs(12) }}>Chargement…</p>
                        : episodes.length === 0
                          ? <p style={{ fontSize: fs(8), color: "#888", textAlign: "center", marginTop: fs(12) }}>Aucun épisode</p>
                          : renderList(
                              episodes, episodeIdx,
                              ep => ep.title,
                              ep => ep.duration || ep.pubDate.slice(0, 10),
                              undefined,
                              (ep, idx) => {
                                setEpisodeIdx(idx);
                                if (selectedPod) { onPlayEpisode(ep, selectedPod); setScreen("nowplaying"); }
                              },
                            )
                    )}
                  </div>
                </div>
              </div>

              {/* ── Click Wheel ── */}
              <div ref={wheelRef} onMouseDown={handleWheelDown} onTouchStart={handleWheelDown}
                style={{
                  width: wheelD, height: wheelD, borderRadius: "50%", margin: "0 auto", position: "relative",
                  background: skin.wheel,
                  boxShadow: `0 ${Math.round(4*scale)}px ${Math.round(12*scale)}px rgba(0,0,0,0.22), inset 0 ${Math.round(2*scale)}px ${Math.round(4*scale)}px rgba(255,255,255,0.65), inset 0 -${Math.round(2*scale)}px ${Math.round(4*scale)}px rgba(0,0,0,0.12)`,
                  cursor: "grab", userSelect: "none", touchAction: "none",
                }}>
                <div style={{ position: "absolute", inset: Math.round(8*scale), borderRadius: "50%", border: "1px solid rgba(0,0,0,0.07)", background: skin.wheelRing }} />

                {/* MENU */}
                {renderWheelBtn("menu", "MENU", { top: Math.round(14*scale), left: "50%", transform: "translateX(-50%)" }, fs(8), handleMenu)}
                {/* ⏮ */}
                {renderWheelBtn("prev", "⏮", { left: Math.round(14*scale), top: "50%", transform: "translateY(-50%)" }, fs(11), handlePrev)}
                {/* ⏭ */}
                {renderWheelBtn("next", "⏭", { right: Math.round(14*scale), top: "50%", transform: "translateY(-50%)" }, fs(11), handleNext)}
                {/* ▶/⏸ */}
                {renderWheelBtn("play", playerApi.isPlaying ? "⏸" : "▶", { bottom: Math.round(14*scale), left: "50%", transform: "translateX(-50%)" }, fs(12), playerApi.togglePlay)}

                {/* Center button */}
                <button onMouseDown={e => e.stopPropagation()} onMouseUp={e => { e.stopPropagation(); handleCenter(); }}
                  onTouchStart={e => e.stopPropagation()} onTouchEnd={e => { e.stopPropagation(); handleCenter(); }}
                  style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    width: Math.round(58*scale), height: Math.round(58*scale), borderRadius: "50%",
                    background: skin.centerOuter, border: "none", cursor: "pointer",
                    boxShadow: `0 ${Math.round(2*scale)}px ${Math.round(8*scale)}px rgba(0,0,0,0.18), inset 0 1px ${Math.round(2*scale)}px rgba(255,255,255,0.85), inset 0 -1px ${Math.round(2*scale)}px rgba(0,0,0,0.1)`,
                    display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent",
                  }}>
                  <div style={{ width: Math.round(38*scale), height: Math.round(38*scale), borderRadius: "50%", background: skin.centerInner, boxShadow: `inset 0 1px ${Math.round(3*scale)}px rgba(0,0,0,0.1)` }} />
                </button>
              </div>

              <p style={{ textAlign: "center", marginTop: Math.round(10*scale), fontSize: fs(7), color: skin.footColor, letterSpacing: 0.5, fontFamily: "system-ui" }}>RadioFR iPod</p>
            </div>
          </motion.div>

          <style>{`@keyframes ipodEq { from { height: 28%; } to { height: 92%; } }`}</style>
        </>
      )}
    </AnimatePresence>
  );

  function renderWheelBtn(id: string, label: string, pos: React.CSSProperties, size: number, action: () => void) {
    return (
      <button
        onMouseDown={e => { e.stopPropagation(); setPressed(id); }}
        onMouseUp={e => { e.stopPropagation(); setPressed(null); action(); }}
        onTouchStart={e => { e.stopPropagation(); setPressed(id); }}
        onTouchEnd={e => { e.stopPropagation(); setPressed(null); action(); }}
        style={{
          position: "absolute", ...pos,
          background: "none", border: "none", cursor: "pointer",
          fontSize: size, color: skin.btnColor, fontFamily: "system-ui",
          fontWeight: id === "menu" ? 700 : 400, letterSpacing: id === "menu" ? 1 : 0,
          padding: `${Math.round(4*scale)}px ${Math.round(6*scale)}px`,
          opacity: pressed === id ? 0.45 : 1, transition: "opacity 0.08s",
          WebkitTapHighlightColor: "transparent",
        }}>
        {label}
      </button>
    );
  }
}
