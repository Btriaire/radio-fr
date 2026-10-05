"use client";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { Station, STATIONS, preferredStreamUrl } from "@/lib/stations";

interface StudioFrequencyDialProps {
  currentStation: Station | null;
  onSelectStation: (st: Station) => void;
}

/**
 * StudioFrequencyDial — Horizontal tactile frequency scale (FM 87.5 - 108.0 MHz)
 * with snap markers for French stations, drag gesture, and haptic feedback.
 */
export default function StudioFrequencyDial({
  currentStation,
  onSelectStation,
}: StudioFrequencyDialProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Generate synthetic FM frequencies between 87.5 and 108.0
  const stationsWithFreq = React.useMemo(() => {
    return STATIONS.map((st, i) => {
      // Deterministic synthetic frequency spread across FM band
      const freq = st.freq || (87.5 + ((i * 1.37) % 20.3)).toFixed(1);
      return { ...st, freq };
    }).sort((a, b) => parseFloat(a.freq) - parseFloat(b.freq));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    startXRef.current = e.clientX;
    scrollLeftRef.current = containerRef.current.scrollLeft;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const dx = e.clientX - startXRef.current;
    containerRef.current.scrollLeft = scrollLeftRef.current - dx;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  return (
    <div className="w-full bg-[#121212] border border-neutral-800 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-[10px] font-mono tracking-wider text-neutral-400">
        <span>FM TUNING SCALE</span>
        <span className="text-[#d4a843] font-bold">
          {currentStation?.name || "RECHERCHE..."}
        </span>
        <span>87.5 - 108.0 MHz</span>
      </div>

      {/* Horizontal Frequency Dial */}
      <div className="relative w-full h-16 bg-[#0a0a0a] rounded-xl overflow-hidden border border-neutral-800/80">
        {/* Center needle indicator in warm amber */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-[#d4a843] z-20 pointer-events-none shadow-[0_0_8px_rgba(212,168,67,0.6)]">
          <div className="w-2.5 h-1.5 bg-[#d4a843] -translate-x-1" />
        </div>

        {/* Scrollable scale */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full flex items-center overflow-x-auto scrollbar-none select-none cursor-ew-resize px-1/2"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-end gap-6 px-[50%] h-12">
            {stationsWithFreq.map((st) => {
              const isCurrent = currentStation?.id === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => {
                    onSelectStation(st);
                    try {
                      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                        navigator.vibrate(12);
                      }
                    } catch {}
                  }}
                  className={`flex flex-col items-center flex-shrink-0 transition-transform ${
                    isCurrent ? "scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <span
                    className={`h-4 w-0.5 mb-1 ${
                      isCurrent ? "bg-[#d4a843] h-6" : "bg-neutral-600"
                    }`}
                  />
                  <span
                    className={`text-[9px] font-mono font-medium whitespace-nowrap ${
                      isCurrent ? "text-[#d4a843] font-bold" : "text-neutral-400"
                    }`}
                  >
                    {st.freq}
                  </span>
                  <span className="text-[8px] font-mono text-neutral-500 truncate max-w-[50px]">
                    {st.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
