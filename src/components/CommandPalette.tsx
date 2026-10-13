"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Station, STATIONS } from "@/lib/stations";
import StationLogo from "@/components/StationLogo";

interface CommandPaletteProps {
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
  nowPlayingSong?: string | null;
}

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
  nowPlayingSong,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Actions list
  const actions = useMemo(() => [
    ...(onTogglePlay
      ? [{
          id: "act-play-pause",
          type: "action" as const,
          title: isPlaying ? "Mettre la lecture en pause (Espace)" : "Reprendre la lecture (Espace)",
          run: () => { onClose(); onTogglePlay(); },
        }]
      : []),
    ...(onOpenLyrics
      ? [{
          id: "act-lyrics",
          type: "action" as const,
          title: nowPlayingSong ? `Voir les paroles : ${nowPlayingSong}` : "Afficher les paroles du morceau en direct",
          run: () => { onClose(); onOpenLyrics(); },
        }]
      : []),
    ...(onRandomZapping
      ? [{ id: "act-zap", type: "action" as const, title: "Zapper au hasard (nouvelle station)", run: () => { onClose(); onRandomZapping(); } }]
      : []),
    ...(onOpenStudio
      ? [{ id: "act-studio", type: "action" as const, title: "Basculer vers Studio Hi-Fi Analogique MK-II", run: () => { onClose(); onOpenStudio(); } }]
      : []),
    ...(onOpenIpod
      ? [{ id: "act-ipod", type: "action" as const, title: "Ouvrir le Mode iPod Classic", run: () => { onClose(); onOpenIpod(); } }]
      : []),
    ...(onOpenDj
      ? [{ id: "act-dj", type: "action" as const, title: "Ouvrir la Console DJ (Scratch & Mix)", run: () => { onClose(); onOpenDj(); } }]
      : []),
    ...(onOpenConfig
      ? [{ id: "act-cfg", type: "action" as const, title: "Ouvrir les Paramètres & Égaliseur", run: () => { onClose(); onOpenConfig(); } }]
      : []),
  ], [onTogglePlay, isPlaying, onOpenLyrics, nowPlayingSong, onRandomZapping, onOpenStudio, onOpenIpod, onOpenDj, onOpenConfig, onClose]);

  // Filtered stations and actions
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        ...actions,
        ...STATIONS.slice(0, 15).map((s) => ({ ...s, type: "station" as const })),
      ];
    }

    const filteredActions = actions.filter((a) => a.title.toLowerCase().includes(q));
    const filteredStations = STATIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.tagline && s.tagline.toLowerCase().includes(q)) ||
        (s.genre && s.genre.toLowerCase().includes(q)) ||
        (s.freq && s.freq.toLowerCase().includes(q))
    ).map((s) => ({ ...s, type: "station" as const }));

    return [...filteredActions, ...filteredStations];
  }, [query, actions]);

  // Reset index on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

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
          onSelectStation(current as Station);
          onClose();
        }
      }
    }
  };

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-3 sm:px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Chassis */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ type: "spring", stiffness: 450, damping: 30 }}
          className="relative w-full max-w-xl bg-[#0e0e12] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[70vh]"
        >
          {/* Search Input Bar */}
          <div className="p-3.5 border-b border-neutral-800 flex items-center gap-3 bg-[#131318]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 flex-shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher une radio, fréquence FM ou action..."
              className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-neutral-500 focus:outline-none font-mono"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="text-xs text-neutral-500 hover:text-white px-1.5 py-0.5 rounded bg-white/5"
              >
                Effacer
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-500 bg-white/5 rounded border border-neutral-800">
                ESC
              </kbd>
            )}
          </div>

          {/* Results List */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {results.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-xs font-mono">
                Aucun résultat pour « {query} »
              </div>
            ) : (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                if (item.type === "action") {
                  return (
                    <button
                      key={item.id}
                      onClick={item.run}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-all text-xs font-mono ${
                        isSelected
                          ? "bg-[#d4a843]/15 text-white border border-[#d4a843]/40"
                          : "text-neutral-300 hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d4a843]" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0">Action ↵</span>
                    </button>
                  );
                }

                const st = item as Station;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      onSelectStation(st);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? "bg-white/10 text-white border border-white/20"
                        : "text-neutral-300 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StationLogo logo={st.logo} name={st.name} color={st.color} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-white truncate flex items-center gap-2">
                          <span>{st.name}</span>
                          {st.freq && (
                            <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
                              {st.freq}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate">{st.tagline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-neutral-400 font-mono">
                        {st.genre}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] text-[#d4a843] font-mono hidden sm:inline-block">Écouter ↵</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Guide */}
          <div className="p-2.5 border-t border-neutral-800/80 bg-[#101014] flex items-center justify-between text-[10px] font-mono text-neutral-500 px-3">
            <div className="flex items-center gap-3">
              <span>↑↓ Naviguer</span>
              <span>↵ Valider</span>
              <span>ESC Fermer</span>
            </div>
            <span>91 Stations directes</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
