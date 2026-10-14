"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Station, STATIONS, GENRES } from "@/lib/stations";
import StationLogo from "@/components/StationLogo";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  onTogglePlay?: () => void;
  isPlaying?: boolean;
  onRandomZapping?: () => void;
  onOpenLyrics?: () => void;
  onOpenStudio?: () => void;
  onOpenIpod?: () => void;
  onOpenDj?: () => void;
  onOpenConfig?: () => void;
  onOpenSleepTimer?: () => void;
  onOpenRecorder?: () => void;
  onOpenAlarm?: () => void;
  onOpenNightstand?: () => void;
  onSelectGenre?: (genre: string) => void;
  onSelectTab?: (tab: string) => void;
  onChangeVolume?: (vol: number) => void;
  nowPlayingSong?: string | null;
}

interface PaletteAction {
  id: string;
  type: "action";
  category: "Actions Audio" | "Minuteur & Fondu" | "Enregistreur" | "Navigation" | "Égaliseur";
  title: string;
  subtitle?: string;
  badge?: string;
  shortcut?: string;
  run: () => void;
}

interface PaletteStation extends Station {
  type: "station";
  category: "Stations Françaises";
}

type PaletteItem = PaletteAction | PaletteStation;

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectStation,
  onTogglePlay,
  isPlaying,
  onRandomZapping,
  onOpenLyrics,
  onOpenStudio,
  onOpenIpod,
  onOpenDj,
  onOpenConfig,
  onOpenSleepTimer,
  onOpenRecorder,
  onOpenAlarm,
  onOpenNightstand,
  onSelectGenre,
  onSelectTab,
  onChangeVolume,
  nowPlayingSong,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input automatically on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // Pre-indexed actions list
  const actions: PaletteAction[] = useMemo(() => [
    ...(onTogglePlay
      ? [{
          id: "act-play-pause",
          type: "action" as const,
          category: "Actions Audio" as const,
          title: isPlaying ? "Mettre la lecture en pause" : "Reprendre la lecture en direct",
          subtitle: "Contrôle immédiat du flux audio",
          shortcut: "Espace",
          run: () => { onClose(); onTogglePlay(); },
        }]
      : []),
    ...(onOpenAlarm
      ? [{
          id: "act-alarm-clock",
          type: "action" as const,
          category: "Minuteur & Fondu" as const,
          title: "Réveil Hi-Fi & Sunrise Audio",
          subtitle: "Programmer des réveils avec montée progressive du volume et secours offline",
          badge: "Réveil",
          run: () => { onClose(); onOpenAlarm(); },
        }]
      : []),
    ...(onOpenNightstand
      ? [{
          id: "act-nightstand",
          type: "action" as const,
          category: "Minuteur & Fondu" as const,
          title: "Mode Horloge de Chevet (Nightstand)",
          subtitle: "Affichage nocturne géant avec Wake Lock et luminosité OLED réglable",
          badge: "Chevet",
          run: () => { onClose(); onOpenNightstand(); },
        }]
      : []),
    ...(onOpenSleepTimer
      ? [{
          id: "act-sleep-timer",
          type: "action" as const,
          category: "Minuteur & Fondu" as const,
          title: "Minuteur de veille avancé avec fondu sonore",
          subtitle: "Programmer l'extinction progressive (15m, 30m, 60m...)",
          badge: "Fondu",
          run: () => { onClose(); onOpenSleepTimer(); },
        }]
      : []),
    ...(onOpenRecorder
      ? [{
          id: "act-recorder",
          type: "action" as const,
          category: "Enregistreur" as const,
          title: "Magnétophone numérique & Enregistrement programmé",
          subtitle: "Enregistrement direct DVR ou départ différé programmable",
          badge: "DVR",
          run: () => { onClose(); onOpenRecorder(); },
        }]
      : []),
    ...(onOpenLyrics
      ? [{
          id: "act-lyrics",
          type: "action" as const,
          category: "Actions Audio" as const,
          title: nowPlayingSong ? `Voir les paroles : ${nowPlayingSong}` : "Afficher les paroles du morceau en direct",
          subtitle: "Synchronisation LRCLIB et base francophone",
          badge: "Paroles",
          run: () => { onClose(); onOpenLyrics(); },
        }]
      : []),
    ...(onRandomZapping
      ? [{
          id: "act-zap",
          type: "action" as const,
          category: "Actions Audio" as const,
          title: "Zapper au hasard (Tuner Zapping)",
          subtitle: "Découvrir une radio parmi les 91 stations",
          shortcut: "Z",
          run: () => { onClose(); onRandomZapping(); },
        }]
      : []),
    ...(onChangeVolume
      ? [
          {
            id: "act-vol-100",
            type: "action" as const,
            category: "Actions Audio" as const,
            title: "Régler le volume à 100%",
            subtitle: "Puissance sonore maximale",
            run: () => { onClose(); onChangeVolume(1); },
          },
          {
            id: "act-vol-50",
            type: "action" as const,
            category: "Actions Audio" as const,
            title: "Régler le volume à 50%",
            subtitle: "Niveau d'écoute modéré",
            run: () => { onClose(); onChangeVolume(0.5); },
          },
        ]
      : []),
    ...(onOpenStudio
      ? [{
          id: "act-studio",
          type: "action" as const,
          category: "Navigation" as const,
          title: "Studio Hi-Fi Analogique MK-II",
          subtitle: "Interface matériel vintage avec potentiomètres et VU-mètres",
          badge: "MK-II",
          run: () => { onClose(); onOpenStudio(); },
        }]
      : []),
    ...(onOpenIpod
      ? [{
          id: "act-ipod",
          type: "action" as const,
          category: "Navigation" as const,
          title: "Mode iPod Classic",
          subtitle: "Molette tactile Click Wheel et écran rétro",
          badge: "Retro",
          run: () => { onClose(); onOpenIpod(); },
        }]
      : []),
    ...(onOpenDj
      ? [{
          id: "act-dj",
          type: "action" as const,
          category: "Navigation" as const,
          title: "Console DJ (Double Platine & Scratch)",
          subtitle: "Mixer, filtrer et scratcher les flux radio",
          badge: "Mix",
          run: () => { onClose(); onOpenDj(); },
        }]
      : []),
    ...(onOpenConfig
      ? [{
          id: "act-cfg",
          type: "action" as const,
          category: "Navigation" as const,
          title: "Paramètres, Thèmes & Égaliseur 10 bandes",
          subtitle: "Configurer le traitement sonore et l'apparence",
          run: () => { onClose(); onOpenConfig(); },
        }]
      : []),
    ...(onSelectTab
      ? [
          {
            id: "act-tab-radio",
            type: "action" as const,
            category: "Navigation" as const,
            title: "Onglet : Radios FM & DAB+",
            subtitle: "91 stations françaises en direct",
            run: () => { onClose(); onSelectTab("radio"); },
          },
          {
            id: "act-tab-podcasts",
            type: "action" as const,
            category: "Navigation" as const,
            title: "Onglet : Podcasts & Émissions",
            subtitle: "Replay, flux RSS et téléchargements hors-ligne",
            run: () => { onClose(); onSelectTab("podcasts"); },
          },
          {
            id: "act-tab-songpod",
            type: "action" as const,
            category: "Navigation" as const,
            title: "Onglet : SongPOD (Musique & Morceaux)",
            subtitle: "Explorer les millions de titres Audius & Jamendo",
            run: () => { onClose(); onSelectTab("audius"); },
          },
          {
            id: "act-tab-webradio",
            type: "action" as const,
            category: "Navigation" as const,
            title: "Onglet : Web Radios",
            subtitle: "Stations thématiques et flux mondiaux",
            run: () => { onClose(); onSelectTab("webradio"); },
          },
        ]
      : []),
  ], [
    onTogglePlay, isPlaying, onOpenSleepTimer, onOpenRecorder, onOpenLyrics,
    nowPlayingSong, onRandomZapping, onChangeVolume, onOpenStudio, onOpenIpod,
    onOpenDj, onOpenConfig, onSelectTab, onClose
  ]);

  // Precomputed station tokens for ultra-fast matching
  const preindexedStations = useMemo(() => {
    return STATIONS.map((s) => ({
      ...s,
      type: "station" as const,
      category: "Stations Françaises" as const,
      searchToken: `${s.name} ${s.freq || ""} ${s.genre} ${s.tagline || ""} ${s.id}`.toLowerCase(),
    }));
  }, []);

  // Filtered list with 0ms pre-indexed search
  const results: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default view: top actions + first 16 stations
      return [
        ...actions,
        ...preindexedStations.slice(0, 16),
      ];
    }

    const filteredActions = actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q)) ||
        a.category.toLowerCase().includes(q)
    );

    const filteredStations = preindexedStations.filter((s) =>
      s.searchToken.includes(q)
    );

    return [...filteredActions, ...filteredStations];
  }, [query, actions, preindexedStations]);

  // Reset selected index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = results[selectedIndex];
      if (current) {
        if (current.type === "action") {
          current.run();
        } else {
          onClose();
          onSelectStation(current);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Palette Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -12 }}
          transition={{ type: "spring", stiffness: 450, damping: 30 }}
          className="relative w-full max-w-2xl rounded-2xl sm:rounded-3xl glass-dark border border-white/10 shadow-2xl overflow-hidden z-10 flex flex-col text-white max-h-[82vh]"
        >
          {/* Search Header Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3 bg-white/[0.02]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-amber-400 flex-shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher une radio, fréquence, minuteur, paroles, enregistrement..."
              className="flex-1 bg-transparent border-none outline-none text-white text-sm sm:text-base placeholder-white/40 font-medium"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="w-6 h-6 rounded-full glass flex items-center justify-center text-white/50 hover:text-white text-xs"
                title="Effacer"
              >
                ✕
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-white/40">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">⌘K</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">ESC</kbd>
              </div>
            )}
          </div>

          {/* Results List */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain">
            {results.length === 0 ? (
              <div className="py-12 text-center text-white/40 space-y-2">
                <div className="text-sm font-medium">Aucun résultat trouvé pour "{query}"</div>
                <div className="text-xs">Essayez un nom de radio (ex: "FIP", "Nostalgie"), une fréquence ("105.5") ou "minuteur".</div>
              </div>
            ) : (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                if (item.type === "action") {
                  return (
                    <div
                      key={item.id}
                      data-index={idx}
                      onClick={item.run}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? "bg-amber-400/20 text-white border border-amber-400/40 shadow-sm"
                          : "text-white/80 hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-amber-400 text-black" : "bg-white/10 text-white/70"
                          }`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.badge && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-400/30 text-amber-300 border border-amber-400/40 uppercase">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <div className="text-[11px] text-white/50 truncate font-normal">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.shortcut && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                            {item.shortcut}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-white/40 opacity-0 sm:opacity-100">
                          ↵ Entrée
                        </span>
                      </div>
                    </div>
                  );
                }

                // Station Item
                return (
                  <div
                    key={item.id}
                    data-index={idx}
                    onClick={() => {
                      onClose();
                      onSelectStation(item);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-amber-400/20 text-white border border-amber-400/40 shadow-sm"
                        : "text-white/80 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        <StationLogo
                          logo={item.logo}
                          name={item.name}
                          color={item.color}
                          size="sm"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold truncate flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.freq && (
                            <span className="text-[10px] font-mono text-amber-400/90 font-medium">
                              {item.freq}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/50 truncate font-normal">
                          {item.genre} {item.tagline ? `— ${item.tagline}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/60 border border-white/10 hidden sm:inline">
                        {item.genre}
                      </span>
                      <span className="text-[10px] font-mono text-white/40 opacity-0 sm:opacity-100">
                        ↵ Écouter
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40 font-mono">
            <div className="flex items-center gap-3">
              <span>↑↓ Naviguer</span>
              <span>↵ Sélectionner</span>
              <span>Échap Quitter</span>
            </div>
            <div className="text-amber-400/80">
              {results.length} résultat{results.length > 1 ? "s" : ""}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
