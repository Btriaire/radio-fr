"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { STATIONS, GENRES, Station } from "@/lib/stations";
import Player from "@/components/Player";
import StationCard from "@/components/StationCard";
import SpotifyPanel from "@/components/SpotifyPanel";
import ClipVisualizer from "@/components/ClipVisualizer";
import RadioSearch from "@/components/RadioSearch";
import { useStationLogos } from "@/hooks/useStationLogos";

type Tab = "radio" | "search" | "favoris" | "podcasts";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "radio",    label: "Radio",    icon: "📻" },
  { id: "search",   label: "Chercher", icon: "🔍" },
  { id: "favoris",  label: "Favoris",  icon: "⭐" },
  { id: "podcasts", label: "Podcasts", icon: "🎧" },
];

export default function Home() {
  const [tab, setTab]                       = useState<Tab>("radio");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [genre, setGenre]                   = useState("Tous");
  const playerApi                           = useAudioPlayer();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const logoMap = useStationLogos(STATIONS);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "podcasts") setTab("podcasts");
  }, []);

  const filteredStations = genre === "Tous"
    ? STATIONS
    : STATIONS.filter((s) => s.genre === genre);

  const handlePlay = (station: Station) => {
    if (selectedStation?.id === station.id) {
      playerApi.togglePlay();
    } else {
      setSelectedStation(station);
      playerApi.initAudio(station.streamUrl);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 glass-dark border-b border-white/5 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-glow-cyan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-bold text-lg leading-none">RadioFR</h1>
              <p className="text-white/30 text-[10px] leading-none mt-0.5">Radios & Podcasts</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex glass rounded-xl p-1 gap-0.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.id
                    ? "bg-blue-600 text-white shadow-glow"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.id === "favoris" && favorites.length > 0 && (
                  <span className="text-[9px] bg-yellow-500/30 text-yellow-300 rounded-full px-1 py-0.5 leading-none">
                    {favorites.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="text-xs text-white/25 hidden lg:block flex-shrink-0">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left — tab content */}
        <div>
          <AnimatePresence mode="wait">

            {/* RADIO tab */}
            {tab === "radio" && (
              <motion.div key="radio"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {GENRES.map((g) => (
                    <button key={g} onClick={() => setGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all ${
                        genre === g
                          ? "bg-blue-600 text-white shadow-glow"
                          : "glass glass-hover text-white/60 hover:text-white"
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {filteredStations.map((station) => (
                    <StationCard
                      key={station.id}
                      station={{ ...station, logo: logoMap[station.id] || station.logo }}
                      isActive={selectedStation?.id === station.id}
                      isPlaying={selectedStation?.id === station.id && playerApi.isPlaying}
                      analyserRef={playerApi.analyserRef}
                      isFavorite={isFavorite(station.id)}
                      onClick={() => handlePlay(station)}
                      onToggleFavorite={() => toggleFavorite(station)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* SEARCH tab */}
            {tab === "search" && (
              <motion.div key="search"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                <RadioSearch
                  onPlay={(station) => { setSelectedStation(station); playerApi.initAudio(station.streamUrl); }}
                  onToggleFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                  currentUrl={playerApi.currentUrl}
                  isPlaying={playerApi.isPlaying}
                />
              </motion.div>
            )}

            {/* FAVORIS tab */}
            {tab === "favoris" && (
              <motion.div key="favoris"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                {favorites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="w-14 h-14 rounded-full glass flex items-center justify-center text-3xl">⭐</div>
                    <p className="text-white/40 text-sm">Aucun favori pour l'instant</p>
                    <p className="text-white/20 text-xs max-w-xs">
                      Clique sur l'étoile d'une station dans les onglets Radio ou Chercher pour la sauvegarder ici.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-4 font-medium">
                      Ma liste — {favorites.length} station{favorites.length > 1 ? "s" : ""}
                    </p>
                    {favorites.map((station) => (
                      <StationCard
                        key={station.id}
                        station={station}
                        isActive={selectedStation?.id === station.id}
                        isPlaying={selectedStation?.id === station.id && playerApi.isPlaying}
                        analyserRef={playerApi.analyserRef}
                        isFavorite={true}
                        onClick={() => handlePlay(station)}
                        onToggleFavorite={() => toggleFavorite(station)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* PODCASTS tab */}
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
            station={selectedStation ? { ...selectedStation, logo: logoMap[selectedStation.id] || selectedStation.logo } : null}
            playerApi={playerApi}
            isFavorite={selectedStation ? isFavorite(selectedStation.id) : false}
            onToggleFavorite={selectedStation ? () => toggleFavorite(selectedStation) : undefined}
          />

          {selectedStation && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <ClipVisualizer
                analyserRef={playerApi.analyserRef}
                isPlaying={playerApi.isPlaying}
                color={selectedStation.color}
              />
            </motion.div>
          )}

          {/* Mini now-playing */}
          {selectedStation && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                playerApi.isPlaying ? "bg-green-400 animate-pulse" : "bg-white/20"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-xs font-medium truncate">{selectedStation.name}</p>
                <p className="text-white/30 text-[10px]">
                  {playerApi.isLoading ? "Chargement…" : playerApi.isPlaying ? "En direct ✦ Live" : "En pause"}
                </p>
              </div>
              <span className="text-xs text-white/20">{selectedStation.genre}</span>
            </motion.div>
          )}
        </div>
      </main>

      <footer className="text-center py-4 text-white/15 text-xs border-t border-white/5">
        RadioFR · Radios & Podcasts Français · 2026
      </footer>
    </div>
  );
}
