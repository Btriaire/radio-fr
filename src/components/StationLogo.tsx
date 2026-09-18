"use client";
import { useState, useEffect, useMemo } from "react";
import { getLogoCandidates, getStationInitials } from "@/lib/logoResolver";

interface Props {
  logo: string;
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: 36, md: 48, lg: 60 };

export default function StationLogo({ logo, name, color, size = "md" }: Props) {
  const candidates = useMemo(() => getLogoCandidates(logo), [logo]);
  const [idx, setIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const px = SIZE[size];

  useEffect(() => {
    setIdx(0);
    setImgError(false);
  }, [logo]);

  const initials = useMemo(() => getStationInitials(name), [name]);

  const currentSrc = candidates[idx];
  const showImage = currentSrc && !imgError;

  return (
    <div
      className="relative flex items-center justify-center rounded-[14px] overflow-hidden flex-shrink-0 transition-transform duration-200"
      style={{
        width: px,
        height: px,
        background: showImage 
          ? `linear-gradient(145deg, ${color}28 0%, ${color}0e 100%)` 
          : `linear-gradient(145deg, ${color}55 0%, ${color}22 100%)`,
        border: `1px solid ${color}${showImage ? "40" : "60"}`,
        boxShadow: `0 4px 12px -2px ${color}30, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}
    >
      {/* iOS app icon highlight reflection */}
      <div 
        className="absolute inset-x-0 top-0 h-1/2 pointer-events-none opacity-25 rounded-t-[14px]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={name}
          width={px - 8}
          height={px - 8}
          className="relative z-10 p-1"
          style={{ objectFit: "contain", width: px - 8, height: px - 8 }}
          onError={() => {
            // Try the next candidate; only show initials once all are exhausted.
            if (idx < candidates.length - 1) setIdx(idx + 1);
            else setImgError(true);
          }}
          onLoad={() => setImgError(false)}
        />
      ) : (
        <span
          className="relative z-10 font-black tracking-wider select-none text-white drop-shadow-sm"
          style={{
            fontSize: size === "lg" ? 19 : size === "md" ? 14 : 11,
            letterSpacing: "0.08em",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
