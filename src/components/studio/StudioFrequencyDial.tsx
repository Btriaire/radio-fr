"use client";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Station, STATIONS } from "@/lib/stations";

interface StudioFrequencyDialProps {
  currentStation: Station | null;
  onSelectStation: (st: Station) => void;
}

/**
 * StudioFrequencyDial — Master FM frequency tuning glass (87.5 - 108.0 MHz).
 * Braun RT20 / T3 inspired tactile horizontal tuner.
 * Backlit glass scale, luminous amber optical runner, precision 0.2 MHz tick subdivisions,
 * smooth drag & snap gesture, zero emoji.
 */
export default function StudioFrequencyDial({
  currentStation,
  onSelectStation,
}: StudioFrequencyDialProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Generate synthetic FM frequencies between 87.5 and 108.0 for stations
  const stationsWithFreq = useMemo(() => {
    return STATIONS.map((st, i) => {
      const freq = st.freq || (88.0 + ((i * 1.33) % 19.8)).toFixed(1);
      return { ...st, freq };
    }).sort((a, b) => parseFloat(a.freq) - parseFloat(b.freq));
  }, []);

  // Center selected station smoothly under the optical needle with zero drift
  useEffect(() => {
    if (!currentStation || !containerRef.current || isDragging) return;
    const activeBtn = containerRef.current.querySelector<HTMLElement>(`[data-station-id="${currentStation.id}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentStation, isDragging]);

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
    <div className="w-full bg-[#0e0e11] border border-neutral-800/90 rounded-2xl p-3 flex flex-col gap-2.5 shadow-2xl relative overflow-hidden">
      {/* Top Header Label */}
      <div className="flex items-center justify-between text-[9px] font-mono tracking-widest text-neutral-400 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#d4a843]" />
          <span className="font-bold text-neutral-300">FM SYNTONISATION SCALE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#d4a843] font-bold tracking-tight">
            {currentStation ? `${currentStation.name} • ${currentStation.freq || "FM"}` : "RECHERCHE..."}
          </span>
        </div>
        <span className="text-neutral-500">87.5 - 108.0 MHz</span>
      </div>

      {/* Main Backlit Frequency Glass Viewport */}
      <div className="relative w-full h-20 bg-[#070709] rounded-xl overflow-hidden border border-black/90 shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)]">
        {/* Subtle glass reflection sheen across top half */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none z-30" />

        {/* Center Optical Tuning Needle with Luminous Amber Beam */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-[#d4a843] z-20 pointer-events-none shadow-[0_0_10px_rgba(212,168,67,0.9)]">
          {/* Top cursor prism pip */}
          <div className="w-3 h-2 bg-[#d4a843] -translate-x-[5px] rounded-b-sm shadow-[0_0_6px_rgba(212,168,67,1)]" />
          {/* Bottom cursor prism pip */}
          <div className="absolute bottom-0 w-3 h-2 bg-[#d4a843] -translate-x-[5px] rounded-t-sm shadow-[0_0_6px_rgba(212,168,67,1)]" />
        </div>

        {/* Top & Bottom Hairline Frequency Scale Rules */}
        <div className="absolute top-1 left-0 right-0 h-1.5 border-b border-neutral-800/60 pointer-events-none z-10" />
        <div className="absolute bottom-1 left-0 right-0 h-1.5 border-t border-neutral-800/60 pointer-events-none z-10" />

        {/* Horizontal Scrollable Frequency Carriage */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full flex items-center overflow-x-auto scrollbar-none select-none cursor-ew-resize"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-8 px-[50%] h-full">
            {stationsWithFreq.map((st) => {
              const isCurrent = currentStation?.id === st.id;
              return (
                <button
                  key={st.id}
                  data-station-id={st.id}
                  onClick={() => {
                    onSelectStation(st);
                    try {
                      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                        navigator.vibrate(12);
                      }
                    } catch {}
                  }}
                  className={`flex flex-col items-center flex-shrink-0 transition-all duration-200 group focus:outline-none ${
                    isCurrent
                      ? "scale-105 opacity-100"
                      : "opacity-45 hover:opacity-85"
                  }`}
                  style={{ width: "64px" }}
                >
                  {/* Frequency Marker Pin */}
                  <div className="flex flex-col items-center mb-1">
                    <span
                      className={`w-0.5 transition-all ${
                        isCurrent
                          ? "bg-[#d4a843] h-6 shadow-[0_0_6px_rgba(212,168,67,0.7)]"
                          : "bg-neutral-600 h-3.5 group-hover:bg-neutral-400"
                      }`}
                    />
                    <div
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isCurrent ? "bg-[#d4a843]" : "bg-neutral-700"
                      }`}
                    />
                  </div>

                  {/* Frequency Number */}
                  <span
                    className={`text-[10px] font-mono tracking-tighter tabular-nums whitespace-nowrap transition-colors ${
                      isCurrent
                        ? "text-[#d4a843] font-bold"
                        : "text-neutral-400 group-hover:text-neutral-200"
                    }`}
                  >
                    {st.freq}
                  </span>

                  {/* Station Name Callout */}
                  <span
                    className={`text-[8px] font-mono uppercase tracking-wider truncate max-w-[64px] text-center mt-0.5 transition-colors ${
                      isCurrent ? "text-white font-semibold" : "text-neutral-500"
                    }`}
                  >
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
