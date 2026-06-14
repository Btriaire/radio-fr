"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { useStationLogos } from "@/hooks/useStationLogos";
import { useTheme } from "@/context/ThemeContext";
import { STATIONS, GENRES, Station } from "@/lib/stations";
import Player from "@/components/Player";
import StationCard from "@/components/StationCard";
import SpotifyPanel from "@/components/SpotifyPanel";
import ClipVisualizer from "@/components/ClipVisualizer";
import RadioSearch from "@/components/RadioSearch";
import ConfigPanel from "@/components/ConfigPanel";

type Tab = "radio" | "search" | "favoris" | "podcasts";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "radio",    label: "Radio",    icon: "📻" },
  { id: "search",   label: "Chercher", icon: "🔍" },
  { id: "favoris",  label: "Favoris",  icon: "⭐" },
  { id: "podcasts", label: "Podcasts", icon: "🎧" },
];

export default function Home() {
  const [tab, setTab]                           = useState<Tab>("radio");
  const [selectedStation, setSelectedStation]   = useState<Station | null>(null);
  const [genre, setGenre]                       = useState("Tous");
  const [configOpen, setConfigOpen]             = useState(false);

  const playerApi                               = useAudioPlayer();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const logoMap                                 = useStationLogos(STATIONS);
  const { defaultStationId }                    = useTheme();

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
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 glass-dark border-b metal-texture"
        style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg leading-none text-gradient">RadioFR</h1>
              <p className="text-white/30 text-[10px] leading-none mt-0.5">Radios & Podcasts</p>
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
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
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

            {tab === "search" && (
              <motion.div key="search"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                <RadioSearch
                  onPlay={(s) => { setSelectedStation(s); playerApi.initAudio(s.streamUrl); }}
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
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="w-14 h-14 rounded-full glass flex items-center justify-center text-3xl">⭐</div>
                    <p className="text-white/40 text-sm">Aucun favori pour l'instant</p>
                    <p className="text-white/20 text-xs max-w-xs">
                      Clique sur l'étoile d'une station pour la sauvegarder ici.
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
                <SpotifyPanel />
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
    </div>
  );
}
