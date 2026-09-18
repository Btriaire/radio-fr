"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isPlaying: boolean;
  color?: string;
  small?: boolean;
}

// Canvas gradients reject CSS custom properties like "var(--accent)" (and our
// `${color}20` alpha trick needs 6-digit hex). Resolve a var() to its computed
// hex at runtime; fall back to a safe hex otherwise.
function resolveHex(c: string): string {
  let v = (c || "").trim();
  const m = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (m && typeof window !== "undefined") {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(m[1]).trim();
    v = resolved || (m[2]?.trim() ?? "");
  }
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#3b82f6";
}

export default function AudioVisualizer({ analyserRef, isPlaying, color: rawColor = "#3b82f6", small = false }: Props) {
  const { visualizerStyle } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const phaseRef  = useRef(0);
  // Simulated bars amplitudes (random-ish, stable per instance)
  const simRef    = useRef<number[]>([]);

  // Mode "Économie de batterie": treat the visualizer as always-idle so it
  // never runs its 60fps rAF loop, regardless of playback state.
  let lowBattery = false;
  try { lowBattery = localStorage.getItem("radiofr_low_battery") === "1"; } catch {}
  const effectivePlaying = isPlaying && !lowBattery;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const color = resolveHex(rawColor);

    // Init simulated bar targets
    if (!simRef.current.length) {
      simRef.current = Array.from({ length: 40 }, (_, i) =>
        0.1 + 0.6 * Math.pow(Math.sin(i * 0.8), 2)
      );
    }
    const simAmps  = simRef.current;
    const simSpeed = Array.from({ length: 40 }, (_, i) => 0.6 + i * 0.03);

    if (!effectivePlaying) {
      // Draw the static flat line ONCE and stop — no point burning a 60fps
      // rAF loop (CPU/battery) to keep redrawing a line that never changes.
      cancelAnimationFrame(rafRef.current);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();
      ctx.strokeStyle = `${color}40`;
      ctx.lineWidth = 1.5;
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      return;
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

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

      if (visualizerStyle === "wave") {
        // Smooth sine / bezier wave
        ctx.beginPath();
        const step = W / 40;
        ctx.moveTo(0, H / 2);
        for (let i = 0; i <= 40; i++) {
          const x = i * step;
          let factor = 0.4;
          if (useReal && data) {
            const idx = Math.floor((i / 40) * (data.length / 2));
            factor = (data[idx] || 50) / 255;
          } else {
            factor = 0.3 + 0.4 * Math.sin(phase * 1.5 + i * 0.35);
          }
          const y = H / 2 + Math.sin(phase + i * 0.25) * (H * 0.38) * factor;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = small ? 1.5 : 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (visualizerStyle === "dots") {
        // Glowing neon dots
        const count = small ? 14 : 28;
        const spacing = W / count;
        for (let i = 0; i < count; i++) {
          let factor = 0.3;
          if (useReal && data) {
            const idx = Math.floor((i / count) * (data.length / 2));
            factor = (data[idx] || 40) / 255;
          } else {
            const t = phase * simSpeed[i % simSpeed.length];
            factor = simAmps[i % simAmps.length] * (0.4 + 0.6 * Math.sin(t + i * 0.5));
          }
          const cy = H - Math.max(6, factor * H * 0.85);
          const cx = i * spacing + spacing / 2;
          const r = small ? 2 : 3.5;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      } else {
        // Default: bars
        if (useReal && data) {
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
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, effectivePlaying, rawColor, visualizerStyle]); // eslint-disable-line react-hooks/exhaustive-deps

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
