"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { useStationLogos } from "@/hooks/useStationLogos";
import { useTheme } from "@/context/ThemeContext";
import { STATIONS, GENRES, Station } from "@/lib/stations";
import Player from "@/components/Player";
import StationCard from "@/components/StationCard";
import SpotifyPanel, { SpotifyPanelHandle } from "@/components/SpotifyPanel";
import ClipVisualizer from "@/components/ClipVisualizer";
import RadioSearch from "@/components/RadioSearch";
import ConfigPanel from "@/components/ConfigPanel";
import WebRadioPanel from "@/components/WebRadioPanel";
import IpodOverlay from "@/components/IpodOverlay";

type Tab = "radio" | "webradio" | "search" | "favoris" | "podcasts";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "radio",    label: "Radio",     icon: "📻" },
  { id: "webradio", label: "Web Radio", icon: "🌐" },
  { id: "search",   label: "Chercher",  icon: "🔍" },
  { id: "favoris",  label: "Favoris",   icon: "⭐" },
  { id: "podcasts", label: "Podcasts",  icon: "🎧" },
];

export default function Home() {
  const [tab, setTab]                           = useState<Tab>("radio");
  const [selectedStation, setSelectedStation]   = useState<Station | null>(null);
  const [genre, setGenre]                       = useState("Tous");
  const [configOpen, setConfigOpen]             = useState(false);
  const [ipodOpen, setIpodOpen]                 = useState(false);
  const spotifyPanelRef                         = useRef<SpotifyPanelHandle>(null);

  const playerApi                               = useAudioPlayer();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const logoMap                                 = useStationLogos(STATIONS);
  const { defaultStationId, theme }             = useTheme();

  // Honour tab from URL params (e.g. after Spotify OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "podcasts") setTab("podcasts");
  }, []);

  // Auto-play default station on first load
  useEffect(() => {
    if (!defaultStationId) return;
    const station = STATIONS.find((s) => s.id === defaultStationId);
    if (station && !selectedStation) {
      setSelectedStation(station);
      // Small delay to ensure AudioContext is allowed after user gesture on revisit
      const id = setTimeout(() => playerApi.initAudio(station.streamUrl), 300);
      return () => clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStationId]);

  const withLogo = (s: Station): Station => ({
    ...s,
    logo: logoMap[s.id] || s.logo,
  });

  const filteredStations = (genre === "Tous" ? STATIONS : STATIONS.filter((s) => s.genre === genre))
    .map(withLogo);

  const handlePlay = (station: Station) => {
    // Pause podcast if playing
    spotifyPanelRef.current?.pause();
    if (selectedStation?.id === station.id) {
      playerApi.togglePlay();
    } else {
      setSelectedStation(station);
      playerApi.initAudio(station.streamUrl);
    }
  };

  const currentStation = selectedStation ? withLogo(selectedStation) : null;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Cosmic starfield (only in cosmic theme) ── */}
      {theme === "cosmic" && (
        <div className="cosmic-starfield fixed inset-0 pointer-events-none z-0" aria-hidden />
      )}

      {/* ── Decorative SVG background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        {/* Large radio-wave arcs — bottom left */}
        <svg className="absolute -bottom-32 -left-32 opacity-[0.06]" width="600" height="600" viewBox="0 0 600 600" fill="none">
          {[80,160,240,320,400,480].map((r, i) => (
            <circle key={r} cx="100" cy="500" r={r}
              stroke="url(#waveGrad)" strokeWidth="1.5"
              strokeDasharray={i % 2 === 0 ? "8 6" : "none"} />
          ))}
          <defs>
            <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Frequency grid — top right */}
        <svg className="absolute -top-10 -right-10 opacity-[0.04]" width="500" height="400" viewBox="0 0 500 400" fill="none">
          {Array.from({length: 12}).map((_,i) => (
            <line key={`h${i}`} x1="0" y1={i*35} x2="500" y2={i*35} stroke="var(--accent)" strokeWidth="0.8" />
          ))}
          {Array.from({length: 14}).map((_,i) => (
            <line key={`v${i}`} x1={i*38} y1="0" x2={i*38} y2="400" stroke="var(--accent)" strokeWidth="0.8" />
          ))}
          {/* Diagonal accent */}
          <line x1="0" y1="400" x2="500" y2="0" stroke="var(--accent-2)" strokeWidth="1" strokeDasharray="4 8" />
        </svg>

        {/* Antenna tower — right mid */}
        <svg className="absolute right-8 top-1/3 opacity-[0.05]" width="120" height="260" viewBox="0 0 120 260" fill="none">
          <line x1="60" y1="0" x2="60" y2="260" stroke="var(--accent)" strokeWidth="2" />
          <line x1="60" y1="0" x2="10" y2="100" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="60" y1="0" x2="110" y2="100" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="60" y1="40" x2="25" y2="110" stroke="var(--accent)" strokeWidth="1" />
          <line x1="60" y1="40" x2="95" y2="110" stroke="var(--accent)" strokeWidth="1" />
          {[100,130,160,190,220].map((y, i) => (
            <line key={y} x1={60-(i%2===0?30:20)} y1={y} x2={60+(i%2===0?30:20)} y2={y}
              stroke="var(--accent)" strokeWidth="1.2" />
          ))}
          {/* Signal pulses */}
          {[40,70,100].map((r, i) => (
            <circle key={r} cx="60" cy="0" r={r}
              stroke="var(--accent-2)" strokeWidth="1" opacity={0.6 - i*0.15}
              strokeDasharray="5 4" />
          ))}
        </svg>

        {/* Waveform strip — center bottom */}
        <svg className="absolute bottom-0 left-0 right-0 w-full opacity-[0.05]" height="80" preserveAspectRatio="none" viewBox="0 0 1200 80" fill="none">
          <polyline
            points={Array.from({length:120},(_,i)=>`${i*10},${40+Math.sin(i*0.7)*20*Math.sin(i*0.13)}`).join(' ')}
            stroke="var(--accent)" strokeWidth="1.5" fill="none" />
          <polyline
            points={Array.from({length:120},(_,i)=>`${i*10},${40+Math.cos(i*0.5)*15*Math.cos(i*0.19)}`).join(' ')}
            stroke="var(--accent-2)" strokeWidth="1" fill="none" />
        </svg>

        {/* Small circuit-like dot grid */}
        <svg className="absolute left-1/2 top-1/4 -translate-x-1/2 opacity-[0.04]" width="400" height="220" viewBox="0 0 400 220" fill="none">
          {/* Dots — alternating opacity via index pattern */}
          {Array.from({length: 5}).map((_,row) =>
            Array.from({length: 10}).map((_,col) => (
              <circle key={`${row}-${col}`} cx={col*44+22} cy={row*44+22} r="2"
                fill="var(--accent)" opacity={(row + col) % 3 === 0 ? 1 : 0.4} />
            ))
          )}
          {/* Horizontal lines */}
          {Array.from({length: 5}).map((_,row) =>
            Array.from({length: 9}).map((_,col) => (
              <line key={`l${row}-${col}`}
                x1={col*44+22} y1={row*44+22} x2={col*44+66} y2={row*44+22}
                stroke="var(--accent)" strokeWidth="0.6" opacity="0.5" />
            ))
          )}
          {/* Vertical connectors — some */}
          {[1,3,5,7].map((col) =>
            [0,2].map((row) => (
              <line key={`v${row}-${col}`}
                x1={col*44+22} y1={row*44+22} x2={col*44+22} y2={row*44+66}
                stroke="var(--accent-2)" strokeWidth="0.6" opacity="0.5" />
            ))
          )}
        </svg>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 glass-dark border-b metal-texture relative"
        style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              {/* Tiny signal arcs */}
              <svg className="absolute -right-2 -top-2 pointer-events-none" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M2 16 Q2 2 16 2" stroke="var(--accent)" strokeWidth="1.2" fill="none" opacity="0.6" />
                <path d="M5 16 Q5 5 16 5" stroke="var(--accent-2)" strokeWidth="0.8" fill="none" opacity="0.4" />
                <circle cx="16" cy="2" r="1.5" fill="var(--accent)" opacity="0.8" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg leading-none text-gradient">RadioFR</h1>
              <p className="text-white/30 text-[10px] leading-none mt-0.5">Radios & Podcasts</p>
            </div>
            {/* Mini EQ bars decoration */}
            <div className="hidden lg:flex items-end gap-0.5 h-5 ml-1">
              {[40,70,55,80,45,65,35,75,50,60].map((h, i) => (
                <div key={i} className="w-[3px] rounded-sm flex-shrink-0"
                  style={{
                    height: `${h}%`,
                    background: `var(--accent)`,
                    opacity: 0.25 + i * 0.03,
                  }} />
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex glass rounded-xl p-1 gap-0.5 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.id ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                style={tab === t.id ? {
                  background: "var(--accent)",
                  boxShadow: "0 0 12px rgba(59,130,246,0.5)",
                } : {}}>
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.id === "favoris" && favorites.length > 0 && (
                  <span className="text-[9px] rounded-full px-1 py-0.5 leading-none"
                    style={{ background: "rgba(255,255,255,0.15)", color: "var(--accent)" }}>
                    {favorites.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/20 hidden lg:block">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            {/* iPod button */}
            <button
              onClick={() => setIpodOpen(true)}
              className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center transition-all"
              title="Mode iPod"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" style={{ color: "var(--accent)" }}>
                {/* iPod body */}
                <rect x="6" y="1" width="12" height="22" rx="3" />
                {/* Screen */}
                <rect x="8" y="3" width="8" height="6" rx="1" />
                {/* Click wheel */}
                <circle cx="12" cy="16" r="4" />
                <circle cx="12" cy="16" r="1.5" />
              </svg>
            </button>
            {/* Config button */}
            <button
              onClick={() => setConfigOpen(true)}
              className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center transition-all"
              title="Configuration"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" style={{ color: "var(--accent)" }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 relative z-10">
        {/* Left */}
        <div>
          <AnimatePresence mode="wait">

            {tab === "radio" && (
              <motion.div key="radio"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {GENRES.map((g) => (
                    <button key={g} onClick={() => setGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all ${
                        genre === g ? "text-white" : "glass glass-hover text-white/60 hover:text-white"
                      }`}
                      style={genre === g ? {
                        background: "var(--accent)",
                        boxShadow: "0 0 10px rgba(59,130,246,0.4)",
                      } : {}}>
                      {g}
                    </button>
                  ))}
                </div>
                {/* Section header decoration */}
                <div className="flex items-center gap-3 mb-3 opacity-40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <path d="M1 6c0 0 4-2 7 2s7 2 7 2" />
                    <path d="M1 12c0 0 4-2 7 2s7 2 7 2" />
                    <path d="M1 18c0 0 4-2 7 2s7 2 7 2" />
                  </svg>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, var(--accent), transparent)" }} />
                  <span className="text-[10px] font-medium" style={{ color: "var(--accent)" }}>
                    {filteredStations.length} STATION{filteredStations.length > 1 ? "S" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {filteredStations.map((station) => (
                    <StationCard key={station.id} station={station}
                      isActive={selectedStation?.id === station.id}
                      isPlaying={selectedStation?.id === station.id && playerApi.isPlaying}
                      analyserRef={playerApi.analyserRef}
                      isFavorite={isFavorite(station.id)}
                      onClick={() => handlePlay(station)}
                      onToggleFavorite={() => toggleFavorite(station)} />
                  ))}
                </div>
              </motion.div>
            )}

            {tab === "webradio" && (
              <motion.div key="webradio"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                <WebRadioPanel
                  onPlay={(s) => { spotifyPanelRef.current?.pause(); setSelectedStation(s); playerApi.initAudio(s.streamUrl); }}
                  currentUrl={playerApi.currentUrl}
                  isPlaying={playerApi.isPlaying}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              </motion.div>
            )}

            {tab === "search" && (
              <motion.div key="search"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                <RadioSearch
                  onPlay={(s) => { spotifyPanelRef.current?.pause(); setSelectedStation(s); playerApi.initAudio(s.streamUrl); }}
                  onToggleFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                  currentUrl={playerApi.currentUrl}
                  isPlaying={playerApi.isPlaying}
                />
              </motion.div>
            )}

            {tab === "favoris" && (
              <motion.div key="favoris"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-14 text-center">
                    {/* SVG star constellation illustration */}
                    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="opacity-30" aria-hidden>
                      {/* Radio waves */}
                      {[20, 36, 52].map((r) => (
                        <path key={r}
                          d={`M ${60-r*0.7} ${50+r*0.5} A ${r} ${r} 0 0 1 ${60+r*0.7} ${50+r*0.5}`}
                          stroke="var(--accent)" strokeWidth="1.2" fill="none" strokeDasharray="4 3" />
                      ))}
                      {/* Center star */}
                      <polygon points="60,20 63.5,30 74,30 65.5,36 68.5,46 60,40 51.5,46 54.5,36 46,30 56.5,30"
                        fill="var(--accent)" opacity="0.7" />
                      {/* Small stars */}
                      <polygon points="20,15 21.5,20 26,20 22.5,23 24,28 20,25 16,28 17.5,23 14,20 18.5,20"
                        fill="var(--accent-2)" opacity="0.5" />
                      <polygon points="100,35 101,38 104,38 102,40 102.5,43 100,41.5 97.5,43 98,40 96,38 99,38"
                        fill="var(--accent)" opacity="0.4" />
                      {/* Horizontal line */}
                      <line x1="0" y1="80" x2="120" y2="80" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="3 5" />
                    </svg>
                    <p className="text-white/40 text-sm font-medium">Aucun favori pour l'instant</p>
                    <p className="text-white/20 text-xs max-w-xs leading-relaxed">
                      Clique sur l'étoile ⭐ d'une station pour la sauvegarder ici.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-4 font-medium">
                      Ma liste · {favorites.length} station{favorites.length > 1 ? "s" : ""}
                    </p>
                    {favorites.map((s) => (
                      <StationCard key={s.id} station={withLogo(s)}
                        isActive={selectedStation?.id === s.id}
                        isPlaying={selectedStation?.id === s.id && playerApi.isPlaying}
                        analyserRef={playerApi.analyserRef}
                        isFavorite={true}
                        onClick={() => handlePlay(withLogo(s))}
                        onToggleFavorite={() => toggleFavorite(s)} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {tab === "podcasts" && (
              <motion.div key="podcasts"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <SpotifyPanel
                  ref={spotifyPanelRef}
                  onWillPlay={() => { if (playerApi.isPlaying) playerApi.togglePlay(); }}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Right — player */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Player
            station={currentStation}
            playerApi={playerApi}
            isFavorite={selectedStation ? isFavorite(selectedStation.id) : false}
            onToggleFavorite={selectedStation ? () => toggleFavorite(selectedStation) : undefined}
          />

          {currentStation && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <ClipVisualizer
                analyserRef={playerApi.analyserRef}
                isPlaying={playerApi.isPlaying}
                color={currentStation.color}
              />
            </motion.div>
          )}

          {currentStation && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                playerApi.isPlaying ? "animate-pulse" : "opacity-30"
              }`} style={{ background: "var(--accent)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-xs font-medium truncate">{currentStation.name}</p>
                <p className="text-white/30 text-[10px]">
                  {playerApi.isLoading ? "Chargement…"
                   : playerApi.isPlaying ? "En direct ✦ Live"
                   : "En pause"}
                  {!playerApi.eqActive && " · EQ indisponible (CORS)"}
                </p>
              </div>
              <span className="text-xs text-white/20">{currentStation.genre}</span>
            </motion.div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 text-xs border-t"
        style={{ color: "rgba(255,255,255,0.12)", borderColor: "var(--glass-border)" }}>
        RadioFR · Radios & Podcasts Français · 2026
      </footer>

      {/* Config panel */}
      <ConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />

      {/* iPod overlay */}
      <IpodOverlay
        open={ipodOpen}
        onClose={() => setIpodOpen(false)}
        playerApi={playerApi}
        station={currentStation}
        stations={STATIONS}
        onSelectStation={(s) => {
          spotifyPanelRef.current?.pause();
          setSelectedStation(s);
          playerApi.initAudio(s.streamUrl);
        }}
      />
    </div>
  );
}
