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
 * StudioVuMeter — Precision analog VU meter with warm thermal backlighting,
 * dual ballistic needles, and peak headroom graduation (-20dB to +3dB).
 */
export default function StudioVuMeter({
  analyserRef,
  isPlaying,
  label = "SIGNAL LEVEL / CH-L+R",
  width = 240,
  height = 56,
}: StudioVuMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const currentLevelRef = useRef(0);
  const peakRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { ctx } = setupRetinaCanvas(canvas, width, height);
    if (!ctx) return;

    const buf = new Uint8Array(32);

    const render = () => {
      let targetLevel = 0;
      if (isPlaying && analyserRef.current) {
        try {
          analyserRef.current.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            sum += buf[i];
          }
          targetLevel = sum / (buf.length * 255);
        } catch {
          targetLevel = 0;
        }
      }

      // Ballistic smoothing (fast attack, slow smooth decay)
      if (targetLevel > currentLevelRef.current) {
        currentLevelRef.current += (targetLevel - currentLevelRef.current) * 0.45;
      } else {
        currentLevelRef.current += (targetLevel - currentLevelRef.current) * 0.08;
      }

      // Peak hold decay
      if (currentLevelRef.current > peakRef.current) {
        peakRef.current = currentLevelRef.current;
      } else {
        peakRef.current = Math.max(0, peakRef.current - 0.005);
      }

      const lvl = currentLevelRef.current;
      const peak = peakRef.current;

      // Draw background
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle scale markings
      const numSegments = 24;
      const segWidth = (width - 24) / numSegments;
      const startX = 12;
      const barY = height - 20;

      for (let i = 0; i < numSegments; i++) {
        const segX = startX + i * segWidth;
        const norm = i / (numSegments - 1);
        const isRedZone = norm > 0.82;
        const isLit = norm <= lvl;

        if (isLit) {
          ctx.fillStyle = isRedZone ? "#d71921" : "#d4a843";
        } else {
          ctx.fillStyle = isRedZone ? "#2b1012" : "#222222";
        }

        ctx.fillRect(segX, barY, segWidth - 2, 8);
      }

      // Draw peak hold line
      if (peak > 0.02) {
        const peakX = startX + peak * (width - 24);
        ctx.fillStyle = peak > 0.82 ? "#ff3b44" : "#f5c558";
        ctx.fillRect(Math.min(width - 14, Math.max(startX, peakX - 1)), barY - 2, 2, 12);
      }

      // Scale decibel text
      ctx.font = "9px ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = "#666666";
      ctx.fillText("-20", startX, 14);
      ctx.fillText("-10", startX + (width - 24) * 0.35, 14);
      ctx.fillText("0 dB", startX + (width - 24) * 0.76, 14);
      ctx.fillStyle = "#d71921";
      ctx.fillText("+3", width - 26, 14);

      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, isPlaying, width, height]);

  return (
    <div className="flex flex-col items-center border border-neutral-800 bg-[#121212] rounded-xl p-2.5 shadow-inner">
      <div className="flex items-center justify-between w-full mb-1 px-1">
        <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500">
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-neutral-400">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPlaying ? "bg-[#d4a843] animate-pulse" : "bg-neutral-700"
            }`}
          />
          {isPlaying ? "LINE IN" : "STANDBY"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full max-w-full rounded"
      />
    </div>
  );
}
