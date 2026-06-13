"use client";
import { useState } from "react";

interface Props {
  logo: string;
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: 36, md: 48, lg: 60 };

export default function StationLogo({ logo, name, color, size = "md" }: Props) {
  const [imgError, setImgError] = useState(false);
  const px = SIZE[size];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (logo && !imgError) {
    return (
      <div
        className="flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0"
        style={{
          width: px, height: px,
          background: `${color}18`,
          border: `1px solid ${color}30`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={name}
          width={px - 8}
          height={px - 8}
          style={{ objectFit: "contain", maxWidth: px - 8, maxHeight: px - 8 }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: colored initials badge
  return (
    <div
      className="flex items-center justify-center rounded-xl flex-shrink-0 font-bold select-none"
      style={{
        width: px, height: px,
        background: `linear-gradient(135deg, ${color}44, ${color}22)`,
        border: `1px solid ${color}44`,
        color,
        fontSize: size === "lg" ? 20 : size === "md" ? 15 : 12,
      }}
    >
      {initials}
    </div>
  );
}
