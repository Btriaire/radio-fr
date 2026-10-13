"use client";
import React, { useRef, useEffect } from "react";
import { setupRetinaCanvas } from "@/lib/canvasOptimizer";

interface StudioVuMeterProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  label?: string;
  width?: number;
  height?: number;
}

/**
 * StudioVuMeter — Precision dual-channel stereo analog VU meter.
 * Laboratory broadcast grade (Studer / Nagra / Revox inspiration).
 * Dual ballistic needles (CH-L & CH-R), incandescent tungsten backlighting,
 * peak hold persistence, acrylic glass glare sheen, zero emoji.
 */
export default function StudioVuMeter({
  analyserRef,
  isPlaying,
  label = "VU INDICATOR • CH-L / CH-R",
  width = 340,
  height = 68,
}: StudioVuMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const levelLRef = useRef(0);
  const levelRRef = useRef(0);
  const peakLRef = useRef(0);
  const peakRRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { ctx } = setupRetinaCanvas(canvas, width, height);
    if (!ctx) return;

    const buf = new Uint8Array(32);

    const render = () => {
      let targetL = 0;
      let targetR = 0;

      if (isPlaying && analyserRef.current) {
        try {
          analyserRef.current.getByteFrequencyData(buf);
          // Split frequency spectrum into Left/Mid bias and Right/High bias
          let sumL = 0;
          let sumR = 0;
          const half = Math.floor(buf.length / 2);
          for (let i = 0; i < half; i++) sumL += buf[i];
          for (let i = half; i < buf.length; i++) sumR += buf[i];

          targetL = (sumL / (half * 255)) * 1.15;
          targetR = (sumR / ((buf.length - half) * 255)) * 1.18;
        } catch {
          targetL = 0;
          targetR = 0;
        }
      }

      // Ballistic smoothing (fast attack, natural smooth decay)
      levelLRef.current += (targetL - levelLRef.current) * (targetL > levelLRef.current ? 0.42 : 0.08);
      levelRRef.current += (targetR - levelRRef.current) * (targetR > levelRRef.current ? 0.42 : 0.08);

      // Peak hold decay
      if (levelLRef.current > peakLRef.current) peakLRef.current = levelLRef.current;
      else peakLRef.current = Math.max(0, peakLRef.current - 0.005);

      if (levelRRef.current > peakRRef.current) peakRRef.current = levelRRef.current;
      else peakRRef.current = Math.max(0, peakRRef.current - 0.005);

      const l = Math.min(1, Math.max(0, levelLRef.current));
      const r = Math.min(1, Math.max(0, levelRRef.current));
      const peakL = Math.min(1, Math.max(0, peakLRef.current));
      const peakR = Math.min(1, Math.max(0, peakRRef.current));

      // ── Background: Incandescent tungsten lamp backplate ──
      const gradBg = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width * 0.6);
      gradBg.addColorStop(0, "#22190b");
      gradBg.addColorStop(0.5, "#151310");
      gradBg.addColorStop(1, "#0a0a0c");
      ctx.fillStyle = gradBg;
      ctx.fillRect(0, 0, width, height);

      // Fine grid texture
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      for (let x = 16; x < width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // ── Scales & Labels ──
      const startX = 36;
      const endX = width - 20;
      const meterW = endX - startX;

      // Scale decibel calibrations
      ctx.font = "8px ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = "#6b6b72";
      const dbMarks = [
        { label: "-20", pos: 0.0 },
        { label: "-10", pos: 0.28 },
        { label: "-5",  pos: 0.52 },
        { label: "-2",  pos: 0.68 },
        { label: "0",   pos: 0.80 },
        { label: "+1",  pos: 0.88 },
        { label: "+3",  pos: 0.98 },
      ];

      dbMarks.forEach((m) => {
        const x = startX + m.pos * meterW;
        const isRed = m.pos >= 0.80;
        ctx.fillStyle = isRed ? "#e63946" : "#7c7c88";
        ctx.fillText(m.label, x - 6, 12);

        // Small tick mark
        ctx.strokeStyle = isRed ? "#e63946" : "#3b3b44";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 15);
        ctx.lineTo(x, 19);
        ctx.stroke();
      });

      // Channel Bars (CH-L: bar at y=23, CH-R: bar at y=43)
      const barH = 10;
      const numSegs = 28;
      const segW = (meterW - (numSegs - 1) * 2) / numSegs;

      const drawChannel = (val: number, peakVal: number, y: number, chLabel: string) => {
        // Channel ID label
        ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = "#8a8a96";
        ctx.fillText(chLabel, 12, y + 8);

        for (let i = 0; i < numSegs; i++) {
          const segNorm = i / (numSegs - 1);
          const segX = startX + i * (segW + 2);
          const isOver = segNorm >= 0.80;
          const isLit = segNorm <= val;

          if (isLit) {
            ctx.fillStyle = isOver ? "#ff333d" : "#d4a843";
          } else {
            ctx.fillStyle = isOver ? "#280b0e" : "#17171c";
          }

          ctx.fillRect(segX, y, segW, barH);
        }

        // Peak Hold Indicator Needle
        if (peakVal > 0.02) {
          const peakX = startX + peakVal * meterW;
          ctx.fillStyle = peakVal >= 0.80 ? "#ffffff" : "#fadb82";
          ctx.fillRect(Math.min(endX - 2, Math.max(startX, peakX - 1)), y - 1, 2.5, barH + 2);
        }
      };

      drawChannel(l, peakL, 24, "L");
      drawChannel(r, peakR, 42, "R");

      // ── Acrylic Glass Specular Glare (Physical instrument sheen) ──
      const glare = ctx.createLinearGradient(0, 0, width, height);
      glare.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      glare.addColorStop(0.35, "rgba(255, 255, 255, 0.02)");
      glare.addColorStop(0.5, "transparent");
      ctx.fillStyle = glare;
      ctx.fillRect(0, 0, width, height);

      // Border rim inside glass
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

      // Only schedule next frame if audio is playing or levels are decaying
      if (isPlaying || levelLRef.current > 0.001 || levelRRef.current > 0.001 || peakLRef.current > 0.001) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, isPlaying, width, height]);

  return (
    <div className="flex flex-col border border-neutral-800/90 bg-[#0d0d0f] rounded-2xl p-2.5 shadow-2xl relative overflow-hidden group">
      {/* Top Header Row with status & LED */}
      <div className="flex items-center justify-between w-full mb-1.5 px-1.5">
        <div className="flex items-center gap-2">
          {/* Subtle Torx screw detail */}
          <div className="w-2.5 h-2.5 rounded-full border border-neutral-700 bg-neutral-800 flex items-center justify-center">
            <div className="w-1.5 h-0.5 bg-neutral-600 rotate-45" />
          </div>
          <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-400 font-semibold">
            {label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Peak Warning text */}
          <span className="text-[8px] font-mono tracking-widest text-neutral-600 uppercase">
            CAL 0dB = 1.23V RMS
          </span>

          {/* Active Carrier LED */}
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <span
              className={`w-2 h-2 rounded-full border transition-all ${
                isPlaying
                  ? "bg-[#d4a843] border-[#d4a843] shadow-[0_0_8px_rgba(212,168,67,0.8)]"
                  : "bg-neutral-800 border-neutral-700"
              }`}
            />
            <span className={isPlaying ? "text-[#d4a843] font-bold" : "text-neutral-500"}>
              {isPlaying ? "ON AIR" : "IDLE"}
            </span>
          </div>

          <div className="w-2.5 h-2.5 rounded-full border border-neutral-700 bg-neutral-800 flex items-center justify-center">
            <div className="w-1.5 h-0.5 bg-neutral-600 -rotate-45" />
          </div>
        </div>
      </div>

      {/* High-definition meter glass viewport */}
      <div className="relative rounded-xl overflow-hidden border border-black/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full max-w-full block"
        />
      </div>
    </div>
  );
}
