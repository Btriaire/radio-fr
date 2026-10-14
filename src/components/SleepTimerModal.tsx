"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleepTimerRemaining: number | null;
  sleepTimerTotalSeconds: number | null;
  sleepFadeSeconds: number;
  setSleepFadeSeconds: (sec: number) => void;
  isSleepFading: boolean;
  setSleepTimer: (minutes: number, fadeSec?: number) => void;
  addSleepMinutes: (minutes: number) => void;
  cancelSleepTimer: () => void;
  isPlaying: boolean;
}

const PRESETS = [5, 10, 15, 30, 45, 60, 90, 120];
const FADE_OPTIONS = [
  { sec: 0, label: "Sans fondu" },
  { sec: 15, label: "15s" },
  { sec: 30, label: "30s" },
  { sec: 60, label: "60s" },
  { sec: 120, label: "2 min" },
];

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const sStr = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${sStr}`;
  }
  return `${String(m).padStart(2, "0")}:${sStr}`;
}

export default function SleepTimerModal({
  isOpen,
  onClose,
  sleepTimerRemaining,
  sleepTimerTotalSeconds,
  sleepFadeSeconds,
  setSleepFadeSeconds,
  isSleepFading,
  setSleepTimer,
  addSleepMinutes,
  cancelSleepTimer,
  isPlaying,
}: SleepTimerModalProps) {
  const [customMinutes, setCustomMinutes] = useState(30);

  if (!isOpen) return null;

  const isArmed = sleepTimerRemaining !== null && sleepTimerRemaining > 0;
  const progressPercent =
    isArmed && sleepTimerTotalSeconds && sleepTimerTotalSeconds > 0
      ? Math.min(100, Math.max(0, ((sleepTimerTotalSeconds - sleepTimerRemaining) / sleepTimerTotalSeconds) * 100))
      : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative w-full max-w-md rounded-3xl glass-dark border border-white/10 p-6 shadow-2xl z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-wide">Minuteur de Veille Avancé</h3>
                <p className="text-xs text-white/50">Arrêt automatique avec fondu sonore progressif</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full glass glass-hover flex items-center justify-center text-white/60 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="py-5 space-y-6">
            {/* If armed: Active Countdown Display */}
            {isArmed ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5 text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Minuteur Actif</span>
                </div>

                {/* Big Countdown */}
                <div className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white tabular-nums">
                  {fmt(sleepTimerRemaining)}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </div>

                {/* Fade Status */}
                <div className="text-xs text-white/70 flex items-center justify-center gap-1.5 font-mono">
                  {isSleepFading ? (
                    <span className="text-amber-300 font-semibold flex items-center gap-1 animate-pulse">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                      Fondu sonore en cours vers le silence...
                    </span>
                  ) : (
                    <span>
                      Fondu sonore automatique dans les dernières <strong className="text-amber-300">{sleepFadeSeconds}s</strong>
                    </span>
                  )}
                </div>

                {/* Quick adjustments when active */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => addSleepMinutes(5)}
                    className="px-3 py-1.5 rounded-xl glass glass-hover text-xs font-mono font-semibold text-white/90 hover:text-white transition-all active:scale-95"
                  >
                    +5 min
                  </button>
                  <button
                    onClick={() => addSleepMinutes(15)}
                    className="px-3 py-1.5 rounded-xl glass glass-hover text-xs font-mono font-semibold text-white/90 hover:text-white transition-all active:scale-95"
                  >
                    +15 min
                  </button>
                  <button
                    onClick={cancelSleepTimer}
                    className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all active:scale-95"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Duration Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Durée d'écoute avant mise en veille
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESETS.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setCustomMinutes(m);
                          setSleepTimer(m, sleepFadeSeconds);
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-semibold transition-all flex items-center justify-center border ${
                          customMinutes === m
                            ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-sm"
                            : "border-white/10 glass glass-hover text-white/70 hover:text-white"
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50 font-medium">Réglage personnalisé</span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">
                      {customMinutes} minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={180}
                    step={1}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="w-full h-2 rounded-lg bg-white/10 appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 font-mono">
                    <span>1 min</span>
                    <span>1h (60m)</span>
                    <span>2h (120m)</span>
                    <span>3h (180m)</span>
                  </div>
                </div>

                {/* Fade-out duration options */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50 flex items-center justify-between">
                    <span>Durée du fondu progressif</span>
                    <span className="text-[11px] font-normal text-amber-400/80">
                      Évite les coupures brusques
                    </span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FADE_OPTIONS.map((f) => (
                      <button
                        key={f.sec}
                        onClick={() => setSleepFadeSeconds(f.sec)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-mono transition-all text-center border ${
                          sleepFadeSeconds === f.sec
                            ? "border-amber-400 bg-amber-400/20 text-amber-300 font-bold"
                            : "border-white/10 glass glass-hover text-white/60 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activate Action */}
                <button
                  onClick={() => {
                    setSleepTimer(customMinutes, sleepFadeSeconds);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                  <span>Activer la mise en veille ({customMinutes} min)</span>
                </button>
              </>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
            <span>RadioFR Système Hi-Fi</span>
            <span>{isPlaying ? "Lecture en cours" : "Lecteur en pause"}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
