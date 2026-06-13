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
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (!analyser || !isPlaying) {
        // Idle flat line
        ctx.beginPath();
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }

      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);

      const barW = (W / bufLen) * 2.5;
      let x = 0;

      for (let i = 0; i < bufLen; i++) {
        const barH = (data[i] / 255) * H;
        const alpha = 0.4 + (data[i] / 255) * 0.6;

        // Gradient per bar
        const grad = ctx.createLinearGradient(0, H - barH, 0, H);
        grad.addColorStop(0, color);
        grad.addColorStop(1, `${color}20`);

        ctx.fillStyle = grad;
        ctx.globalAlpha = alpha;
        const radius = Math.min(barW / 2, 3);
        ctx.beginPath();
        ctx.roundRect(x, H - barH, barW - 1, barH, [radius, radius, 0, 0]);
        ctx.fill();

        x += barW + 1;
      }
      ctx.globalAlpha = 1;
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, isPlaying, color]);

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
