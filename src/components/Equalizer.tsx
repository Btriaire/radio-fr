"use client";
import { useEffect, useRef, useCallback } from "react";
import { EQBand, EQ_PRESETS } from "@/hooks/useAudioPlayer";

interface Props {
  bands: EQBand[];
  filtersRef: React.MutableRefObject<BiquadFilterNode[]>;
  onBandChange: (index: number, gain: number) => void;
  onApplyPreset: (gains: number[]) => void;
  onReset: () => void;
}

const MAX_GAIN = 12;
const CURVE_FREQS = 512; // frequency samples for curve

export default function Equalizer({ bands, filtersRef, onBandChange, onApplyPreset, onReset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    // Horizontal lines at -12, -6, 0, +6, +12 dB
    for (const db of [-12, -6, 0, 6, 12]) {
      const y = H / 2 - (db / MAX_GAIN) * (H / 2 - 8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      if (db !== 0) {
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "10px monospace";
        ctx.fillText(`${db > 0 ? "+" : ""}${db}`, 4, y - 2);
      }
    }
    // 0dB line — brighter
    const midY = H / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // Vertical frequency grid
    const freqMarks = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    for (const f of freqMarks) {
      const x = freqToX(f, W);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Compute combined EQ curve
    const filters = filtersRef.current;
    if (!filters.length) return;

    const freqArray = new Float32Array(CURVE_FREQS);
    const minF = Math.log10(20);
    const maxF = Math.log10(22000);
    for (let i = 0; i < CURVE_FREQS; i++) {
      freqArray[i] = Math.pow(10, minF + (i / CURVE_FREQS) * (maxF - minF));
    }

    const totalMag = new Float32Array(CURVE_FREQS).fill(1);
    const mag = new Float32Array(CURVE_FREQS);
    const phase = new Float32Array(CURVE_FREQS);

    for (const filter of filters) {
      try {
        filter.getFrequencyResponse(freqArray, mag, phase);
        for (let i = 0; i < CURVE_FREQS; i++) totalMag[i] *= mag[i];
      } catch {}
    }

    // Draw fill below/above curve
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "rgba(59,130,246,0.25)");
    gradient.addColorStop(0.5, "rgba(59,130,246,0.05)");
    gradient.addColorStop(1, "rgba(6,182,212,0.1)");

    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < CURVE_FREQS; i++) {
      const x = (i / CURVE_FREQS) * W;
      const dbVal = 20 * Math.log10(Math.max(totalMag[i], 0.0001));
      const y = midY - (dbVal / MAX_GAIN) * (H / 2 - 8);
      if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, midY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the curve line
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#3b82f6";
    ctx.shadowBlur = 8;
    ctx.lineJoin = "round";
    for (let i = 0; i < CURVE_FREQS; i++) {
      const x = (i / CURVE_FREQS) * W;
      const dbVal = 20 * Math.log10(Math.max(totalMag[i], 0.0001));
      const y = midY - (dbVal / MAX_GAIN) * (H / 2 - 8);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw band frequency dots
    for (const band of bands) {
      const x = freqToX(band.freq, W);
      const y = midY - (band.gain / MAX_GAIN) * (H / 2 - 8);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = band.gain === 0 ? "rgba(255,255,255,0.4)" : "#06b6d4";
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = band.gain !== 0 ? 10 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [bands, filtersRef]);

  useEffect(() => {
    // Redraw after a small delay to let filter nodes update
    const id = requestAnimationFrame(drawCurve);
    return () => cancelAnimationFrame(id);
  }, [drawCurve]);

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/60 tracking-widest uppercase">Égaliseur 10 bandes</h3>
        <button
          onClick={onReset}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded glass-hover"
        >
          Reset
        </button>
      </div>

      {/* Frequency response curve */}
      <div className="rounded-xl overflow-hidden glass" style={{ background: "rgba(0,0,0,0.3)" }}>
        <canvas
          ref={canvasRef}
          width={480}
          height={100}
          className="w-full"
          style={{ display: "block", height: 100 }}
        />
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EQ_PRESETS).map(([name, values]) => (
          <button
            key={name}
            onClick={() => onApplyPreset(values)}
            className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/60 hover:text-white transition-all"
          >
            {name}
          </button>
        ))}
      </div>

      {/* 10 band sliders */}
      <div className="flex items-end justify-between gap-1.5">
        {bands.map((band, i) => {
          const pct = (band.gain / MAX_GAIN) * 100;
          const isBoost = band.gain > 0;
          const isCut   = band.gain < 0;
          return (
            <div key={band.freq} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              {/* dB value */}
              <span className={`text-[9px] font-mono tabular-nums leading-none ${
                isBoost ? "text-blue-400" : isCut ? "text-purple-400" : "text-white/30"
              }`}>
                {band.gain > 0 ? "+" : ""}{band.gain}
              </span>

              {/* Slider track + thumb */}
              <div className="relative flex flex-col items-center" style={{ height: 72 }}>
                {/* Track */}
                <div className="absolute inset-x-1/2 -translate-x-1/2 w-0.5 rounded-full"
                  style={{ top: 4, bottom: 4, background: "rgba(255,255,255,0.08)" }} />

                {/* Fill bar */}
                {band.gain !== 0 && (
                  <div
                    className="absolute inset-x-1/2 -translate-x-1/2 w-0.5 rounded-full"
                    style={{
                      background: isBoost
                        ? "linear-gradient(to top,#3b82f6,#06b6d4)"
                        : "linear-gradient(to bottom,#8b5cf6,#ec4899)",
                      ...(isBoost
                        ? { bottom: "50%", top: `${50 - Math.abs(pct) / 2}%` }
                        : { top: "50%", bottom: `${50 - Math.abs(pct) / 2}%` }),
                    }}
                  />
                )}

                {/* Native range (vertical) */}
                <input
                  type="range"
                  min={-MAX_GAIN}
                  max={MAX_GAIN}
                  step={1}
                  value={band.gain}
                  onChange={(e) => onBandChange(i, Number(e.target.value))}
                  className="eq-slider"
                  style={{ height: 72 }}
                />
              </div>

              {/* Frequency label */}
              <span className="text-[9px] text-white/35 font-mono leading-none">{band.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function freqToX(freq: number, W: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(22000);
  return ((Math.log10(freq) - minLog) / (maxLog - minLog)) * W;
}
