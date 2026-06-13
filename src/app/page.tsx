"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { STATIONS, GENRES, Station } from "@/lib/stations";
import Player from "@/components/Player";
import StationCard from "@/components/StationCard";
import SpotifyPanel from "@/components/SpotifyPanel";
import ClipVisualizer from "@/components/ClipVisualizer";

type Tab = "radio" | "podcasts";

export default function Home() {
  const [tab, setTab] = useState<Tab>("radio");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [genre, setGenre] = useState("Tous");
  const playerApi = useAudioPlayer();

  // Read tab from URL query
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "podcasts") setTab("podcasts");
  }, []);

  const filteredStations = genre === "Tous"
    ? STATIONS
    : STATIONS.filter((s) => s.genre === genre);

  const handleStationClick = (station: Station) => {
    if (selectedStation?.id === station.id) {
      playerApi.togglePlay();
    } else {
      setSelectedStation(station);
      playerApi.initAudio(station.streamUrl);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-dark border-b border-white/5 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-glow-cyan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">RadioFR</h1>
              <p className="text-white/30 text-[10px] leading-none mt-0.5">Radios & Podcasts</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex glass rounded-xl p-1 gap-1">
            {(["radio", "podcasts"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-blue-600 text-white shadow-glow"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {t === "radio" ? "📻 Radio" : "🎧 Podcasts"}
              </button>
            ))}
          </div>

          <div className="text-xs text-white/30 hidden sm:block">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column — tab content */}
        <div>
          <AnimatePresence mode="wait">
            {tab === "radio" ? (
              <motion.div
                key="radio"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Genre filter */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all ${
                        genre === g
                          ? "bg-blue-600 text-white shadow-glow"
                          : "glass glass-hover text-white/60 hover:text-white"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {/* Station list */}
                <div className="space-y-2">
                  {filteredStations.map((station) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      isActive={selectedStation?.id === station.id}
                      isPlaying={selectedStation?.id === station.id && playerApi.isPlaying}
                      analyserRef={playerApi.analyserRef}
                      onClick={() => handleStationClick(station)}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="podcasts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <SpotifyPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column — player + visualizer */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Player station={selectedStation} playerApi={playerApi} />

          {/* Clip visualizer — small, Safari-friendly */}
          {selectedStation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ClipVisualizer
                analyserRef={playerApi.analyserRef}
                isPlaying={playerApi.isPlaying}
                color={selectedStation.color}
              />
            </motion.div>
          )}

          {/* Now playing info */}
          {selectedStation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-2xl p-4 space-y-3"
            >
              <p className="text-white/40 text-xs uppercase tracking-wider">En cours</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `${selectedStation.color}22` }}
                >
                  {selectedStation.logo}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{selectedStation.name}</p>
                  <p className="text-white/40 text-xs">{selectedStation.genre} · Live</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${playerApi.isPlaying ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
                <span className="text-xs text-white/40">
                  {playerApi.isLoading ? "Chargement…" : playerApi.isPlaying ? "En direct" : "En pause"}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-white/20 text-xs border-t border-white/5">
        RadioFR · Radios & Podcasts Français · 2026
      </footer>
    </div>
  );
}
