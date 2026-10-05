"use client";
import React, { useRef, useState, useEffect, useCallback } from "react";

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
 * StudioKnob — Dieter Rams / Braun SK4 inspired rotary control.
 * Pure vector SVG, zero emoji, haptic vibration support, thermal monochrome + amber indicator.
 */
export default function StudioKnob({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = "",
  onChange,
  size = 84,
}: StudioKnobProps) {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);
  const [active, setActive] = useState(false);

  // Map value to angle (-135deg to +135deg)
  const norm = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const angle = -135 + norm * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
    setActive(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Haptic tick on touch
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
    const delta = (dy / 140) * range;
    let next = Math.round((startValRef.current + delta) / step) * step;
    next = Math.min(max, Math.max(min, next));
    if (next !== value) {
      onChange(next);
      // Subtle micro-haptic on step change
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
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const radius = size * 0.38;
  const strokeWidth = 2.5;
  const center = size / 2;

  // Arc path for indicator gauge
  const startRad = (-135 * Math.PI) / 180;
  const currentRad = (angle * Math.PI) / 180;

  const arcX1 = center + radius * Math.cos(startRad);
  const arcY1 = center + radius * Math.sin(startRad);
  const arcX2 = center + radius * Math.cos(currentRad);
  const arcY2 = center + radius * Math.sin(currentRad);
  const largeArc = angle - -135 > 180 ? 1 : 0;

  return (
    <div
      className="flex flex-col items-center select-none touch-none"
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
          className="overflow-visible"
        >
          {/* Outer hairline track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#262626"
            strokeWidth={strokeWidth}
            strokeDasharray="3 3"
          />

          {/* Active amber arc */}
          {norm > 0.01 && (
            <path
              d={`M ${arcX1} ${arcY1} A ${radius} ${radius} 0 ${largeArc} 1 ${arcX2} ${arcY2}`}
              fill="none"
              stroke="#d4a843"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}

          {/* Inner physical dial disc */}
          <circle
            cx={center}
            cy={center}
            r={radius - 6}
            fill="#171717"
            stroke={active ? "#d4a843" : "#333333"}
            strokeWidth="1"
            className="transition-colors duration-150"
          />

          {/* Precision tick notch rotating with angle */}
          <g transform={`rotate(${angle} ${center} ${center})`}>
            <line
              x1={center}
              y1={center - (radius - 8)}
              x2={center}
              y2={center - (radius - 17)}
              stroke="#d4a843"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          {/* Center tactile dot */}
          <circle cx={center} cy={center} r="2.5" fill="#404040" />
        </svg>
      </div>

      {/* Label and readout */}
      <div className="mt-1 flex flex-col items-center">
        <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
          {label}
        </span>
        <span className="text-xs font-mono font-medium text-[#d4a843] tabular-nums mt-0.5">
          {value}
          {unit}
        </span>
      </div>
    </div>
  );
}
