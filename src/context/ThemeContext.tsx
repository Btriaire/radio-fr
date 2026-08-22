"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeId = "default" | "steel" | "bronze" | "copper" | "gunmetal" | "cosmic" | "neon" | "synthwave" | "wood";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  swatch: string[];       // 3 representative colors for the preview swatch
  description: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "default",
    name: "Bleu Nuit",
    swatch: ["#020817", "#3b82f6", "#06b6d4"],
    description: "Verre sombre & bleu profond",
  },
  {
    id: "steel",
    name: "Acier",
    swatch: ["#060a10", "#7090c0", "#a0b8d8"],
    description: "Acier brossé, reflets froids",
  },
  {
    id: "bronze",
    name: "Bronze",
    swatch: ["#0c0800", "#c8830a", "#e8a830"],
    description: "Bronze antique, patine chaude",
  },
  {
    id: "copper",
    name: "Cuivre",
    swatch: ["#100500", "#d2691e", "#f08040"],
    description: "Cuivre poli, éclats rouges",
  },
  {
    id: "gunmetal",
    name: "Gunmetal",
    swatch: ["#080a08", "#6aaa6a", "#90c890"],
    description: "Métal sombre, teintes militaires",
  },
  {
    id: "cosmic",
    name: "Cosmic Galaxy ✦",
    swatch: ["#03001c", "#a855f7", "#ec4899"],
    description: "Nébuleuse, violet & or stellaire",
  },
  {
    id: "neon",
    name: "Neon Tech ⚡",
    swatch: ["#010107", "#00e5ff", "#00ff88"],
    description: "Nuit électrique, cyan & vert néon",
  },
  {
    id: "synthwave",
    name: "Synthwave Grid ▲",
    swatch: ["#0a0014", "#ff2ec4", "#05d9e8"],
    description: "Horizon rétro-futuriste, soleil & grille laser",
  },
  {
    id: "wood",
    name: "Bois Vintage 🪵",
    swatch: ["#1c1108", "#c9812f", "#e8b374"],
    description: "Chaleur du bois, veines dorées",
  },
];

// ── iPod overlay color skins ──────────────────────────────────────────────
export type IpodSkin = "white" | "grey" | "black";

export interface IpodSkinMeta {
  id: IpodSkin;
  name: string;
  shell: string;        // body gradient
  wheel: string;        // click-wheel gradient
  wheelRing: string;    // inner ring of the wheel
  centerOuter: string;  // center button outer
  centerInner: string;  // center button inner disc
  btnColor: string;     // wheel label / icon color
  footColor: string;    // "RadioFR iPod" caption color
  closeBg: string;      // close button background
  closeColor: string;   // close button glyph color
  preview: string[];    // 2-stop swatch for the config picker
}

export const IPOD_SKINS: IpodSkinMeta[] = [
  {
    id: "white",
    name: "Blanc",
    shell: "linear-gradient(160deg, #f6f6f1 0%, #e9e9e4 40%, #d2d2cc 100%)",
    wheel: "linear-gradient(145deg, #e9e9e4 0%, #d2d2cc 50%, #c2c2bc 100%)",
    wheelRing: "linear-gradient(145deg, #dcdcd7 0%, #cacacc 100%)",
    centerOuter: "linear-gradient(145deg, #f0f0eb 0%, #dcdcd7 100%)",
    centerInner: "linear-gradient(145deg, #e8e8e3, #d8d8d3)",
    btnColor: "#444",
    footColor: "#999",
    closeBg: "rgba(0,0,0,0.13)",
    closeColor: "#555",
    preview: ["#f6f6f1", "#d2d2cc"],
  },
  {
    id: "grey",
    name: "Gris sidéral",
    shell: "linear-gradient(160deg, #8a8d92 0%, #6e7177 40%, #54565b 100%)",
    wheel: "linear-gradient(145deg, #76787d 0%, #5c5e63 50%, #4a4c50 100%)",
    wheelRing: "linear-gradient(145deg, #6a6c70 0%, #54565a 100%)",
    centerOuter: "linear-gradient(145deg, #7e8085 0%, #64666b 100%)",
    centerInner: "linear-gradient(145deg, #74767b, #5e6065)",
    btnColor: "#ececee",
    footColor: "#d2d2d5",
    closeBg: "rgba(255,255,255,0.18)",
    closeColor: "#f0f0f0",
    preview: ["#8a8d92", "#54565b"],
  },
  {
    id: "black",
    name: "Noir",
    shell: "linear-gradient(160deg, #3a3a3d 0%, #232325 40%, #131314 100%)",
    wheel: "linear-gradient(145deg, #2e2e31 0%, #1d1d1f 50%, #111113 100%)",
    wheelRing: "linear-gradient(145deg, #2a2a2d 0%, #18181a 100%)",
    centerOuter: "linear-gradient(145deg, #343437 0%, #1e1e20 100%)",
    centerInner: "linear-gradient(145deg, #2c2c2f, #19191b)",
    btnColor: "#dadadc",
    footColor: "#8a8a8d",
    closeBg: "rgba(255,255,255,0.14)",
    closeColor: "#e0e0e0",
    preview: ["#3a3a3d", "#131314"],
  },
];

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  defaultStationId: string | null;
  setDefaultStationId: (id: string | null) => void;
  ipodSkin: IpodSkin;
  setIpodSkin: (s: IpodSkin) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "default",
  setTheme: () => {},
  defaultStationId: null,
  setDefaultStationId: () => {},
  ipodSkin: "white",
  setIpodSkin: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("default");
  const [defaultStationId, setDefaultStationIdState] = useState<string | null>(null);
  const [ipodSkin, setIpodSkinState] = useState<IpodSkin>("white");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("radiofr_theme") as ThemeId | null;
      if (saved) setThemeState(saved);
      const ds = localStorage.getItem("radiofr_default_station");
      if (ds) setDefaultStationIdState(ds);
      const sk = localStorage.getItem("radiofr_ipod_skin") as IpodSkin | null;
      if (sk) setIpodSkinState(sk);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "default" ? "" : theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    try { localStorage.setItem("radiofr_theme", t); } catch {}
  }, []);

  const setDefaultStationId = useCallback((id: string | null) => {
    setDefaultStationIdState(id);
    try {
      if (id) localStorage.setItem("radiofr_default_station", id);
      else localStorage.removeItem("radiofr_default_station");
    } catch {}
  }, []);

  const setIpodSkin = useCallback((s: IpodSkin) => {
    setIpodSkinState(s);
    try { localStorage.setItem("radiofr_ipod_skin", s); } catch {}
  }, []);

  return (
    <Ctx.Provider value={{ theme, setTheme, defaultStationId, setDefaultStationId, ipodSkin, setIpodSkin }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
