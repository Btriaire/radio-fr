"use client";
import { useEffect, useRef } from "react";

interface Props {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  color?: string;
  small?: boolean;
}

export default function AudioVisualizer({ analyserRef, isPlaying, color = "#3b82f6", small = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const phaseRef  = useRef(0);
  // Simulated bars amplitudes (random-ish, stable per instance)
  const simRef    = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Init simulated bar targets
    if (!simRef.current.length) {
      simRef.current = Array.from({ length: 40 }, (_, i) =>
        0.1 + 0.6 * Math.pow(Math.sin(i * 0.8), 2)
      );
    }
    const simAmps  = simRef.current;
    const simSpeed = Array.from({ length: 40 }, (_, i) => 0.6 + i * 0.03);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!isPlaying) {
        // Static flat line
        ctx.beginPath();
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }

      // Try to read real data from analyser
      let useReal = false;
      let data: Uint8Array | null = null;
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        // Check if there is actual audio data (not all zeros)
        const sum = buf.reduce((a, b) => a + b, 0);
        if (sum > 0) { data = buf; useReal = true; }
      }

      phaseRef.current += 0.05;
      const phase = phaseRef.current;

      if (useReal && data) {
        // Real bars
        const barW = (W / data.length) * 2.5;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const barH = (data[i] / 255) * H;
          const alpha = 0.4 + (data[i] / 255) * 0.6;
          const grad = ctx.createLinearGradient(0, H - barH, 0, H);
          grad.addColorStop(0, color);
          grad.addColorStop(1, `${color}20`);
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha;
          const r = Math.min(barW / 2, 3);
          ctx.beginPath();
          ctx.roundRect(x, H - barH, barW - 1, barH, [r, r, 0, 0]);
          ctx.fill();
          x += barW + 1;
        }
        ctx.globalAlpha = 1;
      } else {
        // Simulated animated bars (CORS-blocked or no analyser)
        const count = small ? 16 : 32;
        const barW  = (W - count + 1) / count;
        for (let i = 0; i < count; i++) {
          const t     = phase * simSpeed[i % simSpeed.length];
          const amp   = simAmps[i % simAmps.length];
          const raw   = amp * (0.5 + 0.5 * Math.sin(t + i * 0.7)) *
                        (0.7 + 0.3 * Math.sin(t * 0.4 + i * 0.3));
          const barH  = Math.max(3, raw * H * 0.85);
          const alpha = 0.35 + raw * 0.5;
          const grad  = ctx.createLinearGradient(0, H - barH, 0, H);
          grad.addColorStop(0, color);
          grad.addColorStop(1, `${color}15`);
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha;
          const r = Math.min(barW / 2, 3);
          const x = i * (barW + 1);
          ctx.beginPath();
          ctx.roundRect(x, H - barH, barW, barH, [r, r, 0, 0]);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, isPlaying, color]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={small ? 120 : 400}
      height={small ? 32 : 64}
      className={small ? "w-full h-8 opacity-80" : "w-full h-16"}
      style={{ display: "block" }}
    />
  );
}
