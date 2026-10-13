"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  artist: string | null | undefined;
  title: string | null | undefined;
  stationName?: string;
}

export default function LyricsModal({
  isOpen,
  onClose,
  artist,
  title,
  stationName,
}: LyricsModalProps) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !artist || !title) return;

    let isCurrent = true;
    setLoading(true);
    setLyrics(null);
    setSource(null);

    const fetchLyrics = async () => {
      try {
        const url = `/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Paroles non trouvées");
        const data = await res.json();
        if (isCurrent) {
          setLyrics(data.plainLyrics || data.syncedLyrics || null);
          setSource(data.source);
          setLoading(false);
        }
      } catch {
        if (isCurrent) {
          setLyrics(null);
          setLoading(false);
        }
      }
    };

    fetchLyrics();

    return () => {
      isCurrent = false;
    };
  }, [isOpen, artist, title]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = () => {
    if (!lyrics) return;
    navigator.clipboard.writeText(`${title} - ${artist}\n\n${lyrics}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="relative w-full max-w-lg max-h-[85vh] bg-[#101014] border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-800/80 flex-shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4a843]" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                  {stationName ? `${stationName} • Paroles` : "Paroles en direct"}
                </span>
                {source && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-neutral-700 text-neutral-400">
                    {source}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {title || "Titre en cours"}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 truncate">
                {artist || "Artiste"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all flex-shrink-0"
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Lyrics Content */}
          <div className="flex-1 overflow-y-auto py-5 pr-2 scrollbar-thin text-neutral-200 select-text">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-400">
                <div className="w-6 h-6 border-2 border-neutral-600 border-t-[#d4a843] rounded-full animate-spin" />
                <span className="text-xs font-mono">Recherche des paroles...</span>
              </div>
            ) : lyrics ? (
              <div className="space-y-4 font-sans text-sm sm:text-base leading-relaxed whitespace-pre-line text-neutral-300">
                {lyrics}
              </div>
            ) : (
              <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-sm font-medium">Aucune parole trouvée pour ce titre</p>
                <p className="text-xs text-neutral-600">Il peut s&apos;agir d&apos;une émission parlée ou d&apos;un morceau instrumental.</p>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          {lyrics && (
            <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono flex-shrink-0">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copied ? "Copié !" : "Copier les paroles"}</span>
              </button>

              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`${artist} ${title} paroles lyrics`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-[#d4a843] transition-colors flex items-center gap-1"
              >
                <span>Recherche Web</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
