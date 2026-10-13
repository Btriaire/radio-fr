"use client";
import React, { useRef, useState, useCallback, useMemo } from "react";

interface StudioKnobProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
  onChange: (value: number) => void;
  size?: number;
}

/**
 * StudioKnob — Precision machined rotary dial.
 * Braun SK4 / Dieter Rams & Revox B77 master aesthetic.
 * 100% Vector SVG, physical knurling teeth, laser-etched scale graduations,
 * brushed aluminum lighting gradients, zero emoji, haptic ticks.
 */
export default function StudioKnob({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = "",
  onChange,
  size = 94,
}: StudioKnobProps) {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);
  const [active, setActive] = useState(false);

  // Normalize value to 0..1 and compute rotation angle (-135deg to +135deg)
  const norm = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const angle = -135 + norm * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
    setActive(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    // Haptic tick
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(8);
      }
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dy = startYRef.current - e.clientY;
    const range = max - min;
    const delta = (dy / 130) * range;
    let next = Math.round((startValRef.current + delta) / step) * step;
    next = Math.min(max, Math.max(min, next));
    if (next !== value) {
      onChange(next);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(4);
        }
      } catch {}
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    setActive(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const center = size / 2;
  const outerRadius = size * 0.44;
  const knobRadius = size * 0.35;
  const innerRadius = size * 0.23;

  // Generate 27 scale graduations along the 270-degree travel arc
  const scaleTicks = useMemo(() => {
    const ticks = [];
    const count = 19; // tick every 15 degrees
    for (let i = 0; i < count; i++) {
      const a = -135 + (i / (count - 1)) * 270;
      const rad = (a * Math.PI) / 180;
      const isMajor = i === 0 || i === Math.floor(count / 2) || i === count - 1;
      const isMid = i % 3 === 0;
      const rInner = outerRadius - (isMajor ? 6 : isMid ? 4 : 2.5);
      const rOuter = outerRadius;
      const x1 = center + rInner * Math.cos(rad);
      const y1 = center + rInner * Math.sin(rad);
      const x2 = center + rOuter * Math.cos(rad);
      const y2 = center + rOuter * Math.sin(rad);

      const isActive = a <= angle;
      ticks.push({
        id: i,
        x1, y1, x2, y2,
        isMajor,
        isMid,
        isActive,
      });
    }
    return ticks;
  }, [outerRadius, center, angle]);

  // Knurling teeth around knob circumference (32 physical notches)
  const knurls = useMemo(() => {
    const arr = [];
    const numKnurls = 32;
    for (let i = 0; i < numKnurls; i++) {
      const a = (i / numKnurls) * 360;
      const rad = (a * Math.PI) / 180;
      const r1 = knobRadius;
      const r2 = knobRadius - 2;
      arr.push({
        id: i,
        x1: center + r1 * Math.cos(rad),
        y1: center + r1 * Math.sin(rad),
        x2: center + r2 * Math.cos(rad),
        y2: center + r2 * Math.sin(rad),
      });
    }
    return arr;
  }, [knobRadius, center]);

  // Arc path for active amber gauge
  const startRad = (-135 * Math.PI) / 180;
  const currentRad = (angle * Math.PI) / 180;
  const arcR = outerRadius + 2.5;
  const arcX1 = center + arcR * Math.cos(startRad);
  const arcY1 = center + arcR * Math.sin(startRad);
  const arcX2 = center + arcR * Math.cos(currentRad);
  const arcY2 = center + arcR * Math.sin(currentRad);
  const largeArc = angle - -135 > 180 ? 1 : 0;

  return (
    <div
      className="flex flex-col items-center select-none touch-none group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          onChange(Math.min(max, value + step));
        } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          onChange(Math.max(min, value - step));
        }
      }}
    >
      <div
        className="relative flex items-center justify-center cursor-ns-resize"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]"
        >
          <defs>
            {/* Brushed metal dark dial gradient */}
            <radialGradient id={`dialGrad-${label}`} cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#2b2b30" />
              <stop offset="65%" stopColor="#17171a" />
              <stop offset="100%" stopColor="#0d0d0f" />
            </radialGradient>

            {/* Beveled edge metallic ring */}
            <linearGradient id={`bezelGrad-${label}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#45454b" />
              <stop offset="50%" stopColor="#1f1f22" />
              <stop offset="100%" stopColor="#38383e" />
            </linearGradient>

            {/* Recessed center cap gradient */}
            <radialGradient id={`capGrad-${label}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0d0d0f" />
              <stop offset="85%" stopColor="#18181c" />
              <stop offset="100%" stopColor="#2a2a30" />
            </radialGradient>
          </defs>

          {/* Recessed circular bedplate */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius + 3}
            fill="#09090b"
            stroke="#1c1c20"
            strokeWidth="1"
          />

          {/* Scale ticks */}
          {scaleTicks.map((t) => (
            <line
              key={t.id}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                t.isActive
                  ? "#d4a843"
                  : t.isMajor
                  ? "#44444a"
                  : "#26262b"
              }
              strokeWidth={t.isMajor ? 1.5 : 1}
              strokeLinecap="round"
            />
          ))}

          {/* Active amber arc line on outer track */}
          {norm > 0.02 && (
            <path
              d={`M ${arcX1} ${arcY1} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcX2} ${arcY2}`}
              fill="none"
              stroke="#d4a843"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Main physical rotary dial disc */}
          <circle
            cx={center}
            cy={center}
            r={knobRadius}
            fill={`url(#dialGrad-${label})`}
            stroke={`url(#bezelGrad-${label})`}
            strokeWidth="1.5"
            className="transition-colors duration-150"
          />

          {/* Knurled peripheral teeth */}
          {knurls.map((k) => (
            <line
              key={k.id}
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              stroke="#2e2e34"
              strokeWidth="0.8"
              opacity="0.8"
            />
          ))}

          {/* Recessed center cap */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill={`url(#capGrad-${label})`}
            stroke="#1c1c20"
            strokeWidth="1"
          />

          {/* Center concentric micro-groove */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius - 4}
            fill="none"
            stroke="#202024"
            strokeWidth="0.6"
            strokeDasharray="2 2"
          />

          {/* Precision machined needle with glowing tip */}
          <g transform={`rotate(${angle} ${center} ${center})`}>
            {/* Shadow behind indicator */}
            <line
              x1={center}
              y1={center - (innerRadius - 1)}
              x2={center}
              y2={center - (knobRadius - 3)}
              stroke="#000000"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Luminous indicator bar */}
            <line
              x1={center}
              y1={center - (innerRadius - 2)}
              x2={center}
              y2={center - (knobRadius - 3)}
              stroke={active ? "#ffc642" : "#d4a843"}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Luminescent tip bead */}
            <circle
              cx={center}
              cy={center - (knobRadius - 4)}
              r="1.8"
              fill={active ? "#ffffff" : "#fadb82"}
            />
          </g>

          {/* Center tactile metallic hub rivet */}
          <circle cx={center} cy={center} r="2" fill="#505058" />
        </svg>
      </div>

      {/* Label and high-precision readout */}
      <div className="mt-1.5 flex flex-col items-center">
        <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-400 group-hover:text-neutral-200 transition-colors">
          {label}
        </span>
        <div className="flex items-baseline gap-0.5 mt-0.5">
          <span className="text-xs font-mono font-bold text-[#d4a843] tabular-nums tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-[9px] font-mono text-neutral-500 uppercase">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
