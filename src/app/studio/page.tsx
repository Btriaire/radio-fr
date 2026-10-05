"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFavorites } from "@/hooks/useFavorites";
import { STATIONS, Station, preferredStreamUrl } from "@/lib/stations";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { useMediaSession } from "@/hooks/useMediaSession";
import StudioKnob from "@/components/studio/StudioKnob";
import StudioVuMeter from "@/components/studio/StudioVuMeter";
import StudioFrequencyDial from "@/components/studio/StudioFrequencyDial";
import AudioRecorderModal from "@/components/AudioRecorderModal";
import StationLogo from "@/components/StationLogo";

/**
 * Studio Hi-Fi Analogique (v2 parallel experience)
 * Braun T3 / Dieter Rams inspired minimal tactile radio.
 * Zero emoji, thermal monochrome + amber accents, one-handed thumb zone.
 */
export default function StudioPage() {
  const player = useAudioPlayer();
  const { isPlaying, isLoading, currentUrl, play, pause, changeVolume, volume, analyserRef, mediaElRef, ctxRef, gainRef, initAudio } = player;
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  const [currentStation, setCurrentStation] = useState<Station | null>(() => STATIONS[0] || null);
  const [stationIndex, setStationIndex] = useState(0);
  const [bassLevel, setBassLevel] = useState(50);
  const [trebleLevel, setTrebleLevel] = useState(50);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const nowPlaying = useNowPlaying(currentStation, isPlaying);

  const selectStationByIndex = useCallback(
    (idx: number) => {
      const target = STATIONS[(idx + STATIONS.length) % STATIONS.length];
      if (!target) return;
      setStationIndex(idx);
      setCurrentStation(target);
      initAudio(preferredStreamUrl(target), { live: true });

      // Haptic tick
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(15);
        }
      } catch {}
    },
    [initAudio]
  );

  const nextStation = useCallback(() => selectStationByIndex(stationIndex + 1), [selectStationByIndex, stationIndex]);
  const prevStation = useCallback(() => selectStationByIndex(stationIndex - 1), [selectStationByIndex, stationIndex]);

  // Sync media session for mobile lockscreen
  useMediaSession({
    title: nowPlaying?.songTitle || currentStation?.name || "Radio Studio",
    artist: nowPlaying?.songArtist || currentStation?.tagline || "Live Audio Stream",
    album: currentStation?.name || "Radio Studio Hi-Fi",
    artwork: currentStation?.logo,
    isPlaying,
    onPlay: () => currentStation && initAudio(preferredStreamUrl(currentStation), { live: true }),
    onPause: pause,
    onNext: nextStation,
    onPrev: prevStation,
  });

  // One-handed edge swipe gesture for rapid zapping
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 60) {
      if (deltaX < 0) nextStation();
      else prevStation();
    }
    setTouchStartX(null);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-[#0e0e0e] text-[#ededed] font-mono flex flex-col justify-between selection:bg-[#d4a843]/30"
    >
      {/* ── TOP HEADER / CHASSIS BAR ── */}
      <header className="border-b border-neutral-800/80 px-4 py-3 flex items-center justify-between bg-[#121212]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full border border-[#d4a843] flex items-center justify-center">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-[#d4a843] animate-ping" : "bg-neutral-600"}`} />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-widest uppercase text-white flex items-center gap-2">
              <span>RADIO STUDIO</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#d4a843]/40 text-[#d4a843]">
                HI-FI MK-II
              </span>
            </h1>
            <p className="text-[9px] text-neutral-500 uppercase tracking-tight">
              BRAUN &bull; RAMS DESIGN PHILOSOPHY
            </p>
          </div>
        </div>

        {/* Switch back to Nothing OS version */}
        <Link
          href="/"
          className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors flex items-center gap-1.5"
          title="Basculer vers la version Nothing OS"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>NOTHING OS</span>
        </Link>
      </header>

      {/* ── MAIN ANALOG CONSOLE ── */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col gap-4 justify-center">
        {/* Physical Station Chassis Card */}
        <div className="bg-[#141414] border border-neutral-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
          {/* Subtle brushed metal hairline highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-600 to-transparent opacity-30" />

          {/* Station identification display */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-black border border-neutral-800 flex items-center justify-center flex-shrink-0 p-1">
                {currentStation && (
                  <StationLogo
                    logo={currentStation.logo}
                    name={currentStation.name}
                    color={currentStation.color || "#d4a843"}
                    size="sm"
                  />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white tracking-tight truncate">
                  {currentStation?.name || "SELECTIONNER STATION"}
                </h2>
                <p className="text-xs text-[#d4a843] truncate font-medium mt-0.5">
                  {nowPlaying?.songTitle || currentStation?.tagline || "Diffusion en direct"}
                </p>
              </div>
            </div>

            {/* Favorite toggle button */}
            {currentStation && (
              <button
                onClick={() => toggleFavorite(currentStation)}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                  isFavorite(currentStation.id)
                    ? "border-[#d4a843] bg-[#d4a843]/15 text-[#d4a843]"
                    : "border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-white"
                }`}
                aria-label="Ajouter aux favoris"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite(currentStation.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}
          </div>

          {/* Analog VU-Meter */}
          <StudioVuMeter analyserRef={analyserRef} isPlaying={isPlaying} width={340} height={52} />

          {/* FM Frequency Tuning Dial */}
          <StudioFrequencyDial
            currentStation={currentStation}
            onSelectStation={(st) => {
              setCurrentStation(st);
              initAudio(preferredStreamUrl(st), { live: true });
            }}
          />

          {/* Rotary Control Bank (Volume, Bass, Treble) */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800/80">
            <StudioKnob
              label="VOLUME"
              value={Math.round(volume * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => changeVolume(v / 100)}
            />
            <StudioKnob
              label="BASS"
              value={bassLevel}
              min={0}
              max={100}
              unit=""
              onChange={setBassLevel}
            />
            <StudioKnob
              label="TREBLE"
              value={trebleLevel}
              min={0}
              max={100}
              unit=""
              onChange={setTrebleLevel}
            />
          </div>
        </div>
      </main>

      {/* ── THUMB-ZONE BOTTOM CONTROL PLATFORM (Ergonomie à une main) ── */}
      <footer className="w-full max-w-xl mx-auto p-4 pb-6 bg-[#121212]/95 border-t border-neutral-800 backdrop-blur-md rounded-t-3xl shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          {/* Previous Station */}
          <button
            onClick={prevStation}
            className="w-12 h-12 rounded-2xl border border-neutral-800 bg-[#171717] hover:bg-neutral-800 flex items-center justify-center text-neutral-300 active:scale-95 transition-all"
            aria-label="Station précédente"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          {/* Master Heavy Toggle Play/Stop */}
          <button
            onClick={() => {
              if (isPlaying) {
                pause();
              } else if (currentStation) {
                if (currentUrl === preferredStreamUrl(currentStation)) {
                  play();
                } else {
                  initAudio(preferredStreamUrl(currentStation), { live: true });
                }
              }
            }}
            className={`flex-1 h-14 rounded-2xl font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2.5 border active:scale-[0.98] ${
              isPlaying
                ? "bg-[#d4a843] border-[#d4a843] text-black shadow-[0_0_20px_rgba(212,168,67,0.35)]"
                : "bg-neutral-900 border-neutral-700 text-white hover:border-[#d4a843]"
            }`}
          >
            {isPlaying ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <span>STOP SIGNAL</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
                <span>{isLoading ? "EN COURS..." : "ON AIR"}</span>
              </>
            )}
          </button>

          {/* Next Station */}
          <button
            onClick={nextStation}
            className="w-12 h-12 rounded-2xl border border-neutral-800 bg-[#171717] hover:bg-neutral-800 flex items-center justify-center text-neutral-300 active:scale-95 transition-all"
            aria-label="Station suivante"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>

        {/* DVR Recorder Bar directly in Studio thumb zone */}
        <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
            DVR &bull; CAPTURE DIRECTE
          </span>
          <AudioRecorderModal
            mediaElRef={mediaElRef}
            ctxRef={ctxRef}
            gainRef={gainRef}
            currentStationName={currentStation?.name || "Studio Radio"}
            currentSongTitle={nowPlaying?.songTitle}
            currentStreamUrl={currentUrl}
            isPlaying={isPlaying}
          />
        </div>
      </footer>
    </div>
  );
}
