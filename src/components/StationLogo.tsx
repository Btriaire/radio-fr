"use client";
import { useState, useEffect } from "react";

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

  // Reset error state whenever the logo URL changes
  useEffect(() => {
    setImgError(false);
  }, [logo]);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showImage = logo && !imgError;

  return (
    <div
      className="flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0"
      style={{
        width: px,
        height: px,
        background: showImage ? `${color}18` : `linear-gradient(135deg, ${color}44, ${color}22)`,
        border: `1px solid ${color}${showImage ? "30" : "44"}`,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={name}
          width={px - 10}
          height={px - 10}
          style={{ objectFit: "contain", width: px - 10, height: px - 10 }}
          onError={() => setImgError(true)}
          onLoad={() => setImgError(false)}
        />
      ) : (
        <span
          className="font-bold select-none"
          style={{
            color,
            fontSize: size === "lg" ? 20 : size === "md" ? 15 : 12,
            letterSpacing: "0.05em",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
