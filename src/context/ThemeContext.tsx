"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeId = "default" | "steel" | "bronze" | "copper" | "gunmetal";

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
];

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  defaultStationId: string | null;
  setDefaultStationId: (id: string | null) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "default",
  setTheme: () => {},
  defaultStationId: null,
  setDefaultStationId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("default");
  const [defaultStationId, setDefaultStationIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("radiofr_theme") as ThemeId | null;
      if (saved) setThemeState(saved);
      const ds = localStorage.getItem("radiofr_default_station");
      if (ds) setDefaultStationIdState(ds);
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

  return (
    <Ctx.Provider value={{ theme, setTheme, defaultStationId, setDefaultStationId }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
