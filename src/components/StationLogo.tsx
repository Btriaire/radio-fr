"use client";
import { useState, useEffect } from "react";
import { logoDomain } from "@/lib/stations";

interface Props {
  logo: string;
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: 36, md: 48, lg: 60 };

// Build the ordered list of logo URLs to try: the given one first, then
// DuckDuckGo's icon as a fallback (different infra → covers Google misses),
// before finally falling back to initials.
function logoCandidates(logo: string): string[] {
  const list = [logo];
  const domain = logoDomain(logo);
  if (domain) {
    const ddg = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    if (!list.includes(ddg)) list.push(ddg);
  }
  return list.filter(Boolean);
}

export default function StationLogo({ logo, name, color, size = "md" }: Props) {
  const candidates = logoCandidates(logo);
  const [idx, setIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const px = SIZE[size];

  // Reset the fallback chain whenever the logo URL changes
  useEffect(() => {
    setIdx(0);
    setImgError(false);
  }, [logo]);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const currentSrc = candidates[idx];
  const showImage = currentSrc && !imgError;

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
          src={currentSrc}
          alt={name}
          width={px - 10}
          height={px - 10}
          style={{ objectFit: "contain", width: px - 10, height: px - 10 }}
          onError={() => {
            // Try the next candidate; only show initials once all are exhausted.
            if (idx < candidates.length - 1) setIdx(idx + 1);
            else setImgError(true);
          }}
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
