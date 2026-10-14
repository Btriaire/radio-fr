"use client";
import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioRecorder, RecordedTrack, ScheduledRecording } from "@/hooks/useAudioRecorder";
import { useTheme } from "@/context/ThemeContext";
import { STATIONS, Station, preferredStreamUrl } from "@/lib/stations";

interface Props {
  mediaElRef: React.MutableRefObject<HTMLMediaElement | null>;
  ctxRef?: React.MutableRefObject<AudioContext | null>;
  gainRef?: React.MutableRefObject<GainNode | null>;
  currentStationName?: string;
  currentSongTitle?: string | null;
  currentStreamUrl?: string | null;
  isPlaying: boolean;
}

const DURATION_PRESETS = [1, 5, 15, 30, 45, 60, 120];
const IN_MINUTES_PRESETS = [1, 5, 10, 15, 30, 60];

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
  const [activeTab, setActiveTab] = useState<"live" | "scheduled">("live");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scheduling form states
  const [schedStationId, setSchedStationId] = useState<string>("current");
  const [schedMode, setSchedMode] = useState<"in_minutes" | "at_time">("in_minutes");
  const [schedMinutes, setSchedMinutes] = useState<number>(5);
  const [schedTime, setSchedTime] = useState<string>("");
  const [schedDuration, setSchedDuration] = useState<number>(15);
  const [schedTitle, setSchedTitle] = useState<string>("");

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
    } catch {
      showToast("Erreur lors du téléchargement.");
    }
  }, [showToast]);

  const onRecordingFinished = useCallback((newTrack: RecordedTrack) => {
    setIsOpen(true);
    handleDownload(newTrack);
  }, [handleDownload]);

  const {
    isRecording,
    recordingSeconds,
    recordings,
    error,
    toggleRecording,
    deleteRecording,
    scheduledTask,
    scheduledCountdownSeconds,
    scheduleRecording,
    cancelScheduledRecording,
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
    if (!isFinite(s) || s < 0) return "00:00";
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

  // Arm scheduled recording handler
  const handleArmScheduler = () => {
    let targetStation: Station | undefined;
    if (schedStationId === "current") {
      targetStation = STATIONS.find((s) => s.name === currentStationName) || STATIONS[0];
    } else {
      targetStation = STATIONS.find((s) => s.id === schedStationId) || STATIONS[0];
    }

    const streamUrl = targetStation ? preferredStreamUrl(targetStation) : currentStreamUrl;
    const stationName = targetStation ? targetStation.name : (currentStationName || "RadioFR");

    let startAt = Date.now();
    if (schedMode === "in_minutes") {
      startAt = Date.now() + schedMinutes * 60000;
    } else if (schedMode === "at_time" && schedTime) {
      const [hStr, mStr] = schedTime.split(":");
      const now = new Date();
      const targetDate = new Date();
      targetDate.setHours(Number(hStr), Number(mStr), 0, 0);
      if (targetDate.getTime() <= now.getTime()) {
        // Next day if time already passed today
        targetDate.setDate(targetDate.getDate() + 1);
      }
      startAt = targetDate.getTime();
    } else {
      startAt = Date.now() + 5 * 60000;
    }

    scheduleRecording({
      stationName,
      streamUrl,
      trackTitle: schedTitle.trim() || undefined,
      startAt,
      durationMinutes: schedDuration,
    });

    const diffMinutes = Math.max(1, Math.round((startAt - Date.now()) / 60000));
    showToast(`Magnétophone armé : départ dans ${diffMinutes} min (${schedDuration} min de capture)`);
  };

  return (
    <>
      {/* ── Compact Trigger Buttons in Player / Toolbar ── */}
      <div className="flex items-center gap-1.5">
        {scheduledTask?.status === "armed" ? (
          <button
            onClick={() => {
              setActiveTab("scheduled");
              setIsOpen(true);
            }}
            title={`Magnétophone programmé actif : début dans ${fmtTime(scheduledCountdownSeconds || 0)}`}
            aria-label="Voir la programmation de l'enregistrement"
            className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer border border-amber-400/50 bg-amber-400/15 text-amber-300 animate-pulse"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="tabular-nums font-mono font-bold tracking-tight">
              PROG {fmtTime(scheduledCountdownSeconds || 0)}
            </span>
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            title={isRecording ? "Arrêter l'enregistrement (STOP)" : "Démarrer l'enregistrement live (REC)"}
            aria-label={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              isRecording
                ? "bg-[#d71921]/15 border-[#d71921] text-[#d71921]"
                : isNothing
                ? "bg-transparent border-black/15 dark:border-white/15 text-white/70 hover:text-white hover:border-black/30 dark:hover:border-white/30"
                : "glass glass-hover text-white/60 hover:text-white border-white/10"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRecording ? "bg-[#d71921] animate-ping" : "bg-[#d71921]"
              }`}
            />
            <span className="flex items-center gap-1.5">
              {isRecording ? (
                <>
                  <span className="tabular-nums font-mono font-bold tracking-tight text-[#d71921]">
                    REC {fmtTime(recordingSeconds)}
                  </span>
                  <span className="inline-flex items-end gap-[2px] h-3 ml-0.5">
                    <span className="w-[2px] h-2 bg-[#d71921] animate-pulse" />
                    <span className="w-[2px] h-3 bg-[#d71921] animate-pulse [animation-delay:150ms]" />
                    <span className="w-[2px] h-1.5 bg-[#d71921] animate-pulse [animation-delay:300ms]" />
                  </span>
                </>
              ) : (
                "REC"
              )}
            </span>
          </button>
        )}

        {/* Dedicated Enregistrements / Drawer opener button */}
        <button
          onClick={() => setIsOpen(true)}
          title="Ouvrir le magnétophone et les enregistrements"
          aria-label="Voir le magnétophone et les enregistrements"
          className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer border ${
            isNothing
              ? "bg-transparent border-black/15 dark:border-white/15 text-white/70 hover:text-white hover:border-black/30 dark:hover:border-white/30"
              : "glass glass-hover text-white/60 hover:text-white border-white/10"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {recordings.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#d71921]/15 border border-[#d71921]/40 text-[#d71921] font-semibold">
              {recordings.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Toast Feedback Notification ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 text-xs font-mono pointer-events-none ${
              isNothing
                ? "bg-[#111111] text-white border-white/20 shadow-none"
                : "glass-dark border-white/20 shadow-2xl text-white"
            }`}
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
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className={`relative w-full max-w-lg rounded-3xl p-6 z-10 space-y-5 border ${
                isNothing
                  ? "bg-[#111111] border-white/15 shadow-none text-white"
                  : "glass-dark border-white/15 shadow-2xl text-white"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#d71921]/15 border border-[#d71921]/40 flex items-center justify-center text-[#d71921]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d71921]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-white tracking-tight flex items-center gap-2">
                      Magnétophone Numérique
                    </h3>
                    <p className="text-white/45 text-xs font-mono">
                      Capture DVR en direct &amp; programmation différée
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
                  aria-label="Fermer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                <button
                  onClick={() => setActiveTab("live")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === "live"
                      ? "bg-white/15 text-white font-semibold shadow-sm border border-white/20"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#d71921]" />
                  <span>Direct &amp; Historique</span>
                </button>

                <button
                  onClick={() => setActiveTab("scheduled")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === "scheduled"
                      ? "bg-amber-400/20 text-amber-300 font-semibold shadow-sm border border-amber-400/40"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Programmé</span>
                  {scheduledTask?.status === "armed" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  )}
                </button>
              </div>

              {/* Tab 1: Live DVR Tab */}
              {activeTab === "live" && (
                <>
                  {/* Action Banner */}
                  <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 border ${
                    isNothing ? "bg-white/[0.03] border-white/10" : "bg-white/[0.04] border-white/10"
                  }`}>
                    <div className="min-w-0">
                      <p className="text-[11px] text-white/40 font-mono">Station source :</p>
                      <p className="text-sm font-medium text-white truncate">
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
                      className={`px-4 py-2 rounded-xl text-xs font-medium font-mono transition-all flex items-center gap-2 cursor-pointer border ${
                        isRecording
                          ? "bg-[#d71921] text-white border-[#d71921]"
                          : isPlaying
                          ? isNothing
                            ? "bg-transparent hover:bg-white/10 text-white border-white/20"
                            : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                          : "opacity-40 bg-white/5 text-white/30 border-transparent cursor-not-allowed"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
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
                    <div className="flex items-center justify-between text-xs font-mono text-white/45 px-1">
                      <span>MES ENREGISTREMENTS ({recordings.length})</span>
                      <span>ENREGISTRÉ SUR L&apos;APPAREIL</span>
                    </div>

                    {recordings.length === 0 ? (
                      <div className={`py-8 text-center rounded-2xl p-4 border space-y-2 ${
                        isNothing ? "border-white/10 bg-white/[0.02]" : "glass border-white/5"
                      }`}>
                        <p className="text-white/40 text-xs font-mono">
                          Aucun enregistrement pour le moment.
                        </p>
                        <p className="text-white/30 text-[11px]">
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
                              className={`p-3 rounded-2xl flex items-center justify-between gap-3 border transition-colors ${
                                isNothing
                                  ? "bg-white/[0.03] border-white/10 hover:border-white/20"
                                  : "bg-white/[0.03] border-white/10 hover:border-white/20"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/70 font-mono font-semibold">
                                    {fileExt}
                                  </span>
                                  <h4 className="text-sm font-medium text-white truncate">
                                    {rec.trackTitle || rec.stationName}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono mt-1">
                                  <span>{rec.stationName}</span>
                                  <span>·</span>
                                  <span>{fmtTime(rec.durationSec)}</span>
                                  <span>·</span>
                                  <span>{fmtBytes(rec.blobSize)}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    if (isThisPlaying) {
                                      setPlayingId(null);
                                    } else {
                                      setPlayingId(rec.id);
                                      const audio = new Audio(rec.blobUrl);
                                      audio.onended = () => setPlayingId(null);
                                      audio.play().catch(() => setPlayingId(null));
                                    }
                                  }}
                                  title={isThisPlaying ? "Arrêter l'écoute" : "Écouter l'enregistrement"}
                                  className="w-8 h-8 rounded-xl glass glass-hover flex items-center justify-center text-white/80 hover:text-white"
                                >
                                  {isThisPlaying ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                      <rect x="6" y="4" width="4" height="16" />
                                      <rect x="14" y="4" width="4" height="16" />
                                    </svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                      <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                  )}
                                </button>

                                <button
                                  onClick={() => handleDownload(rec)}
                                  title="Télécharger le fichier"
                                  className="w-8 h-8 rounded-xl glass glass-hover flex items-center justify-center text-white/80 hover:text-white"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                </button>

                                <button
                                  onClick={() => deleteRecording(rec.id)}
                                  title="Supprimer"
                                  className="w-8 h-8 rounded-xl glass glass-hover flex items-center justify-center text-red-400 hover:text-red-300"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Tab 2: Programmation Différée Tab */}
              {activeTab === "scheduled" && (
                <div className="space-y-4">
                  {scheduledTask?.status === "armed" ? (
                    <div className="p-5 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] text-center space-y-4">
                      <div className="flex items-center justify-center gap-2 text-amber-300 text-xs font-mono font-semibold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span>Magnétophone Armé // Standby</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums">
                          {fmtTime(scheduledCountdownSeconds || 0)}
                        </div>
                        <p className="text-xs text-white/50 font-mono">
                          Début de l'enregistrement automatique
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-left text-xs font-mono space-y-1.5 text-white/80">
                        <div className="flex justify-between">
                          <span className="text-white/40">Station cible :</span>
                          <span className="font-semibold text-white">{scheduledTask.stationName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Heure de départ :</span>
                          <span>{new Date(scheduledTask.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Durée prévue :</span>
                          <span className="text-amber-300">{scheduledTask.durationMinutes} minutes</span>
                        </div>
                        {scheduledTask.trackTitle && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Émission :</span>
                            <span className="truncate">{scheduledTask.trackTitle}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={cancelScheduledRecording}
                        className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono font-semibold transition-all active:scale-95"
                      >
                        Annuler la programmation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {/* Station Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                          Station à enregistrer
                        </label>
                        <select
                          value={schedStationId}
                          onChange={(e) => setSchedStationId(e.target.value)}
                          className="w-full p-2.5 rounded-xl glass border border-white/10 text-white text-xs font-mono outline-none bg-[#1a1a1a]"
                        >
                          <option value="current">
                            Station actuelle ({currentStationName || "En cours"})
                          </option>
                          {STATIONS.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.freq || s.genre})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Mode de démarrage */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                          Heure de démarrage
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSchedMode("in_minutes")}
                            className={`py-2 px-2.5 rounded-xl text-xs font-mono transition-all border ${
                              schedMode === "in_minutes"
                                ? "border-amber-400 bg-amber-400/20 text-amber-300 font-semibold"
                                : "border-white/10 glass text-white/60"
                            }`}
                          >
                            Dans un délai (min)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedMode("at_time")}
                            className={`py-2 px-2.5 rounded-xl text-xs font-mono transition-all border ${
                              schedMode === "at_time"
                                ? "border-amber-400 bg-amber-400/20 text-amber-300 font-semibold"
                                : "border-white/10 glass text-white/60"
                            }`}
                          >
                            À heure fixe (HH:MM)
                          </button>
                        </div>
                      </div>

                      {schedMode === "in_minutes" ? (
                        <div className="grid grid-cols-6 gap-1.5">
                          {IN_MINUTES_PRESETS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSchedMinutes(m)}
                              className={`py-2 rounded-xl text-xs font-mono transition-all border ${
                                schedMinutes === m
                                  ? "border-amber-400 bg-amber-400/30 text-amber-300 font-bold"
                                  : "border-white/10 glass text-white/70"
                              }`}
                            >
                              +{m}m
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="time"
                          value={schedTime}
                          onChange={(e) => setSchedTime(e.target.value)}
                          className="w-full p-2.5 rounded-xl glass border border-white/10 text-white text-sm font-mono outline-none bg-[#1a1a1a]"
                        />
                      )}

                      {/* Durée de capture */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold uppercase tracking-wider text-white/50">
                            Durée de l'enregistrement
                          </span>
                          <span className="font-mono text-amber-400 font-bold">
                            {schedDuration} minutes
                          </span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {DURATION_PRESETS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setSchedDuration(d)}
                              className={`py-1.5 rounded-xl text-xs font-mono transition-all border ${
                                schedDuration === d
                                  ? "border-amber-400 bg-amber-400/30 text-amber-300 font-bold"
                                  : "border-white/10 glass text-white/70"
                              }`}
                            >
                              {d}m
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Titre optionnel de l'émission */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-white/40 font-mono">
                          Nom de l'émission (optionnel)
                        </label>
                        <input
                          type="text"
                          value={schedTitle}
                          onChange={(e) => setSchedTitle(e.target.value)}
                          placeholder="Ex: Le 7/9 Inter, Journal de 20h, Jazz Night..."
                          className="w-full p-2 rounded-xl glass border border-white/10 text-white text-xs font-mono outline-none bg-[#1a1a1a] placeholder-white/30"
                        />
                      </div>

                      {/* Bouton Armer */}
                      <button
                        type="button"
                        onClick={handleArmScheduler}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs font-mono tracking-wide transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Armer le Magnétophone Programmé</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
