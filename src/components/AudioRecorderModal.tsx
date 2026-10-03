"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioRecorder, RecordedTrack } from "@/hooks/useAudioRecorder";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  mediaElRef: React.MutableRefObject<HTMLMediaElement | null>;
  ctxRef?: React.MutableRefObject<AudioContext | null>;
  gainRef?: React.MutableRefObject<GainNode | null>;
  currentStationName?: string;
  currentSongTitle?: string | null;
  currentStreamUrl?: string | null;
  isPlaying: boolean;
}

export default function AudioRecorderModal({
  mediaElRef,
  ctxRef,
  gainRef,
  currentStationName,
  currentSongTitle,
  currentStreamUrl,
  isPlaying,
}: Props) {
  const { theme } = useTheme();
  const isNothing = theme === "nothing" || theme === "nothing-dark";

  const [isOpen, setIsOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const handleDownload = useCallback((rec: RecordedTrack) => {
    try {
      const ext = rec.mimeType.includes("mpeg") ? "mp3" : "webm";
      const rawName = (rec.trackTitle || rec.stationName || "enregistrement")
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .slice(0, 40);
      const fileName = `${rawName}_${new Date(rec.timestamp)
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.${ext}`;

      const a = document.createElement("a");
      a.href = rec.blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(`Téléchargement lancé : ${fileName}`);
    } catch (e) {
      showToast("Erreur lors du téléchargement.");
    }
  }, [showToast]);

  const onRecordingFinished = useCallback((newTrack: RecordedTrack) => {
    // Automatically open modal drawer when recording stops so the user immediately sees it
    setIsOpen(true);
    // Also trigger instant download to ensure the user gets their file saved
    handleDownload(newTrack);
  }, [handleDownload]);

  const {
    isRecording,
    recordingSeconds,
    recordings,
    error,
    toggleRecording,
    deleteRecording,
  } = useAudioRecorder({
    mediaElRef,
    ctxRef,
    gainRef,
    currentStationName,
    currentSongTitle,
    currentStreamUrl,
    onRecordingFinished,
  });

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const fmtBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} Ko`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <>
      {/* ── Compact REC Button in Player or Toolbar ── */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            if (isRecording) {
              // Stopping recording will automatically trigger onRecordingFinished -> setIsOpen(true)
              toggleRecording();
            } else {
              toggleRecording();
            }
          }}
          title={isRecording ? "Arrêter l'enregistrement (STOP)" : "Démarrer l'enregistrement live (REC)"}
          aria-label={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all glass glass-hover flex items-center gap-1.5 cursor-pointer select-none font-mono ${
            isRecording
              ? "bg-[#d71921]/20 border border-[#d71921] text-[#d71921]"
              : "text-white/60 hover:text-white"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isRecording ? "bg-[#d71921] animate-ping" : "bg-[#d71921]"
            }`}
          />
          <span>{isRecording ? `REC ${fmtTime(recordingSeconds)}` : "REC"}</span>
        </button>

        {/* Dedicated Enregistrements / Drawer opener button */}
        <button
          onClick={() => setIsOpen(true)}
          title="Ouvrir la liste des enregistrements"
          aria-label="Voir les enregistrements"
          className="px-2 py-1.5 rounded-xl text-xs font-mono transition-all glass glass-hover text-white/60 hover:text-white flex items-center gap-1 cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {recordings.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#d71921]/20 border border-[#d71921]/50 text-[#d71921] font-bold">
              {recordings.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Toast Feedback Notification ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl glass-dark border border-white/20 shadow-2xl flex items-center gap-2.5 text-xs text-white font-mono pointer-events-none"
            style={{ borderColor: "rgba(215, 25, 33, 0.4)" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#d71921]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Drawer / Recordings Manager ── */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="relative w-full max-w-lg rounded-3xl glass-dark border border-white/15 p-6 shadow-2xl z-10 space-y-5"
              style={{
                borderColor: isNothing ? "rgba(215, 25, 33, 0.4)" : "var(--glass-border)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#d71921]/15 border border-[#d71921]/40 flex items-center justify-center text-[#d71921]">
                    <span className="w-3 h-3 rounded-full bg-[#d71921]" />
                  </div>
                  <div>
                    <h3
                      className="font-bold text-base text-white tracking-wide flex items-center gap-1.5"
                      style={{ fontFamily: isNothing ? "var(--font-dot), monospace" : "inherit" }}
                    >
                      FICHIERS ENREGISTRÉS // DVR
                    </h3>
                    <p className="text-white/40 text-xs font-mono">
                      Stockage local permanent & téléchargement
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full glass-hover flex items-center justify-center text-white/50 hover:text-white"
                  aria-label="Fermer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Action Banner */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-white/50 font-mono">Station source :</p>
                  <p className="text-sm font-semibold text-white truncate font-mono">
                    {currentStationName || "Aucune station en cours"}
                  </p>
                  {currentSongTitle && (
                    <p className="text-xs text-[#d71921] truncate font-mono mt-0.5">
                      {currentSongTitle}
                    </p>
                  )}
                </div>

                <button
                  onClick={toggleRecording}
                  disabled={!isPlaying && !isRecording}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer font-mono ${
                    isRecording
                      ? "bg-[#d71921] text-white shadow-[0_0_20px_#d71921]"
                      : isPlaying
                      ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                      : "opacity-40 bg-white/5 text-white/30 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isRecording ? "bg-white animate-ping" : "bg-[#d71921]"
                    }`}
                  />
                  <span>{isRecording ? `STOP (${fmtTime(recordingSeconds)})` : "ENREGISTRER"}</span>
                </button>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-mono">
                  {error}
                </div>
              )}

              {/* Recordings List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-white/50 px-1">
                  <span>MES ENREGISTREMENTS ({recordings.length})</span>
                  <span>ENREGISTRÉ SUR L&apos;APPAREIL</span>
                </div>

                {recordings.length === 0 ? (
                  <div className="py-8 text-center glass rounded-2xl p-4 border border-white/5 space-y-2">
                    <p className="text-white/40 text-xs font-mono">
                      Aucun enregistrement pour le moment.
                    </p>
                    <p className="text-white/25 text-[11px]">
                      Lancez une station puis cliquez sur REC pour capturer vos émissions ou titres préférés.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {recordings.map((rec) => {
                      const isThisPlaying = playingId === rec.id;
                      const fileExt = rec.mimeType?.includes("mpeg") ? "MP3" : "WEBM";
                      return (
                        <div
                          key={rec.id}
                          className="p-3.5 rounded-2xl glass border border-white/10 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-white/80">
                                {fileExt}
                              </span>
                              <p className="font-semibold text-white truncate font-mono">
                                {rec.trackTitle || rec.stationName}
                              </p>
                            </div>
                            <p className="text-[11px] text-white/40 font-mono mt-1">
                              {fmtTime(rec.durationSec)} • {fmtBytes(rec.blobSize)} •{" "}
                              {new Date(rec.timestamp).toLocaleDateString([], {
                                day: "2-digit",
                                month: "2-digit",
                              })}{" "}
                              {new Date(rec.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Play locally */}
                            <button
                              onClick={() => {
                                if (isThisPlaying) {
                                  setPlayingId(null);
                                } else {
                                  setPlayingId(rec.id);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-xl glass-hover border border-white/10 flex items-center gap-1.5 text-white/80 hover:text-white font-mono"
                              title={isThisPlaying ? "Pause" : "Écouter"}
                            >
                              {isThisPlaying ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                  </svg>
                                  <span className="text-[11px]">PAUSE</span>
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="6 3 20 12 6 21 6 3" />
                                  </svg>
                                  <span className="text-[11px]">ÉCOUTER</span>
                                </>
                              )}
                            </button>

                            {/* Download explicit button */}
                            <button
                              onClick={() => handleDownload(rec)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-1.5 text-white font-mono"
                              title="Télécharger sur votre appareil"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              <span className="text-[11px]">TÉLÉCHARGER</span>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => {
                                if (playingId === rec.id) setPlayingId(null);
                                deleteRecording(rec.id);
                              }}
                              className="w-8 h-8 rounded-xl glass-hover flex items-center justify-center text-red-400 hover:text-red-300"
                              title="Supprimer"
                              aria-label="Supprimer l'enregistrement"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>

                          {/* Invisible HTML5 player for preview */}
                          {isThisPlaying && (
                            <audio
                              src={rec.blobUrl}
                              autoPlay
                              onEnded={() => setPlayingId(null)}
                              className="hidden"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
