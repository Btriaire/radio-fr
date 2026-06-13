"use client";
import { EQBand } from "@/hooks/useAudioPlayer";

interface Props {
  bands: EQBand[];
  onBandChange: (index: number, gain: number) => void;
  onReset: () => void;
}

const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0],
  Bass: [8, 5, 0, -2, -3],
  Vocal: [-2, 0, 4, 5, 2],
  "Rock": [4, 2, -1, 3, 5],
  "Pop": [-1, 3, 4, 3, 1],
  Classical: [4, 2, 0, 2, 4],
  Jazz: [3, 0, 1, 2, 3],
};

export default function Equalizer({ bands, onBandChange, onReset }: Props) {
  const applyPreset = (values: number[]) => {
    values.forEach((g, i) => onBandChange(i, g));
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80 tracking-wider uppercase">Égaliseur</h3>
        <button
          onClick={onReset}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded glass-hover"
        >
          Reset
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EQ_PRESETS).map(([name, values]) => (
          <button
            key={name}
            onClick={() => applyPreset(values)}
            className="text-xs px-2.5 py-1 rounded-full glass glass-hover text-white/70 hover:text-white transition-all"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="flex items-end justify-between gap-2 h-32">
        {bands.map((band, i) => (
          <div key={band.freq} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-blue-400 font-mono tabular-nums">
              {band.gain > 0 ? "+" : ""}{band.gain}
            </span>
            <div className="flex-1 flex items-center justify-center w-full">
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={band.gain}
                onChange={(e) => onBandChange(i, Number(e.target.value))}
                className="eq-slider"
                style={{ height: "80px" }}
              />
            </div>
            <span className="text-[10px] text-white/40 font-mono">{band.label}</span>
          </div>
        ))}
      </div>

      {/* Visual bar representation */}
      <div className="flex items-end justify-between gap-1 h-8 mt-1">
        {bands.map((band, i) => {
          const pct = ((band.gain + 12) / 24) * 100;
          return (
            <div key={i} className="flex-1 h-full flex items-end">
              <div
                className="w-full rounded-sm transition-all duration-150"
                style={{
                  height: `${Math.abs(band.gain) / 12 * 100}%`,
                  minHeight: "2px",
                  background: band.gain >= 0
                    ? "linear-gradient(to top, #3b82f6, #06b6d4)"
                    : "linear-gradient(to top, #8b5cf6, #ec4899)",
                  opacity: 0.7 + Math.abs(band.gain) / 12 * 0.3,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
