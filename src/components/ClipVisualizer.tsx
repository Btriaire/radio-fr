"use client";
import { useEffect, useRef } from "react";

interface Props {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  color?: string;
}

/**
 * Compact waveform-style clip visualizer — Safari compatible (no OfflineAudioContext tricks).
 * Uses canvas 2D with oscilloscope-style time-domain rendering.
 */
export default function ClipVisualizer({ analyserRef, isPlaying, color = "#06b6d4" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      const analyser = analyserRef.current;

      if (!analyser || !isPlaying) {
        // Animated idle sine
        phaseRef.current += 0.03;
        ctx.beginPath();
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin((x / W) * Math.PI * 4 + phaseRef.current) * 3;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      const bufLen = analyser.fftSize;
      const data = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(data);

      // Find first rising zero crossing for stable display
      let start = 0;
      for (let i = 1; i < bufLen - 1; i++) {
        if (data[i - 1] < 128 && data[i] >= 128) { start = i; break; }
      }

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.lineJoin = "round";

      const sliceW = W / Math.min(bufLen - start, W);
      for (let i = 0; i < W && start + i < bufLen; i++) {
        const v = (data[start + i] - 128) / 128;
        const y = (H / 2) + v * (H / 2 - 4);
        if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, isPlaying, color]);

  return (
    <div className="glass rounded-xl overflow-hidden" style={{ padding: "8px 12px" }}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "animate-pulse" : "opacity-30"}`}
          style={{ background: color }} />
        <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Waveform</span>
      </div>
      <canvas
        ref={canvasRef}
        width={200}
        height={40}
        className="w-full"
        style={{ display: "block", height: 40 }}
      />
    </div>
  );
}
