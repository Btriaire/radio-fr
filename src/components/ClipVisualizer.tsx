"use client";
import { useEffect, useRef } from "react";

interface Props {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  color?: string;
}

export default function ClipVisualizer({ analyserRef, isPlaying, color = "#06b6d4" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const phaseRef  = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const analyser = analyserRef.current;
      phaseRef.current += isPlaying ? 0.045 : 0.015;
      const ph = phaseRef.current;

      if (!isPlaying) {
        // Slow idle sine
        ctx.beginPath();
        ctx.strokeStyle = `${color}45`;
        ctx.lineWidth = 1.5;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin((x / W) * Math.PI * 3 + ph) * 3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      // Try real time-domain data
      let useReal = false;
      let timeDomain: Uint8Array | null = null;
      if (analyser) {
        const buf = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buf);
        // Check if there's real audio (not all 128)
        let silent = true;
        for (let i = 0; i < buf.length; i += 8) {
          if (Math.abs(buf[i] - 128) > 2) { silent = false; break; }
        }
        if (!silent) { timeDomain = buf; useReal = true; }
      }

      if (useReal && timeDomain) {
        // Real oscilloscope — find zero crossing for stability
        let start = 0;
        for (let i = 1; i < timeDomain.length - 1; i++) {
          if (timeDomain[i - 1] < 128 && timeDomain[i] >= 128) { start = i; break; }
        }
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.lineJoin = "round";
        const sliceW = W / Math.min(timeDomain.length - start, W);
        for (let i = 0; i < W && start + i < timeDomain.length; i++) {
          const v = (timeDomain[start + i] - 128) / 128;
          const y = H / 2 + v * (H / 2 - 4);
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sliceW, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Simulated waveform — multi-sine composite looks organic
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.lineJoin = "round";
        for (let x = 0; x < W; x++) {
          const t  = (x / W) * Math.PI * 2;
          const y  = H / 2
            + Math.sin(t * 3 + ph)       * H * 0.18
            + Math.sin(t * 7 + ph * 1.3) * H * 0.08
            + Math.sin(t * 13 + ph * 0.7)* H * 0.04
            + Math.sin(t * 2  + ph * 0.5)* H * 0.12;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Faint fill
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const t = (x / W) * Math.PI * 2;
          const y = H / 2
            + Math.sin(t * 3 + ph)       * H * 0.18
            + Math.sin(t * 7 + ph * 1.3) * H * 0.08
            + Math.sin(t * 13 + ph * 0.7)* H * 0.04
            + Math.sin(t * 2  + ph * 0.5)* H * 0.12;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H / 2);
        ctx.lineTo(0, H / 2);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `${color}30`);
        grad.addColorStop(1, `${color}05`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, isPlaying, color]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glass rounded-xl overflow-hidden" style={{ padding: "8px 12px" }}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "animate-pulse" : "opacity-30"}`}
          style={{ background: color }} />
        <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Waveform</span>
      </div>
      <canvas
        ref={canvasRef}
        width={300}
        height={44}
        className="w-full"
        style={{ display: "block", height: 44 }}
      />
    </div>
  );
}
