"use client";
import { motion, AnimatePresence } from "framer-motion";
import { THEMES, useTheme } from "@/context/ThemeContext";
import { STATIONS } from "@/lib/stations";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConfigPanel({ open, onClose }: Props) {
  const { theme, setTheme, defaultStationId, setDefaultStationId } = useTheme();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.6)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-80 glass-dark overflow-y-auto"
            style={{ borderLeft: "1px solid var(--glass-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "var(--glass-border)" }}>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" style={{ color: "var(--accent)" }}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                <h2 className="font-semibold text-white">Configuration</h2>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg glass glass-hover flex items-center justify-center text-white/50 hover:text-white transition-all">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-8">
              {/* ── Theme selector ── */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--accent)" }}>
                  Thème Métal
                </h3>
                <div className="space-y-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all glass glass-hover ${
                        theme === t.id ? "border-opacity-60" : ""
                      }`}
                      style={theme === t.id ? {
                        borderColor: "var(--accent)",
                        boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 25%, transparent)",
                      } : {}}
                    >
                      {/* Metal swatch */}
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden relative"
                        style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                        {/* Base color */}
                        <div className="absolute inset-0" style={{ background: t.swatch[0] }} />
                        {/* Metal brushed lines */}
                        <div className="absolute inset-0"
                          style={{
                            backgroundImage: `repeating-linear-gradient(
                              90deg,
                              transparent 0px,
                              rgba(255,255,255,0.06) 1px,
                              transparent 2px,
                              transparent 3px
                            )`,
                          }} />
                        {/* Diagonal highlight */}
                        <div className="absolute inset-0"
                          style={{
                            background: `linear-gradient(135deg, ${t.swatch[2]}55 0%, transparent 50%, ${t.swatch[1]}44 100%)`,
                          }} />
                        {/* Top shine */}
                        <div className="absolute inset-x-0 top-0 h-1/2"
                          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)" }} />
                        {/* Color dot */}
                        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full"
                          style={{ background: t.swatch[1], boxShadow: `0 0 4px ${t.swatch[1]}` }} />
                      </div>

                      <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium">{t.name}</p>
                        <p className="text-white/40 text-xs">{t.description}</p>
                      </div>

                      {theme === t.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" style={{ color: "var(--accent)", flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Default station ── */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--accent)" }}>
                  Station par défaut
                </h3>
                <p className="text-white/30 text-xs">Lance automatiquement au démarrage.</p>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  <button
                    onClick={() => setDefaultStationId(null)}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-sm transition-all glass glass-hover ${
                      !defaultStationId ? "text-white" : "text-white/50"
                    }`}
                    style={!defaultStationId ? { borderColor: "var(--accent)" } : {}}
                  >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: "rgba(255,255,255,0.06)" }}>–</div>
                    <span>Aucune</span>
                    {!defaultStationId && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" className="ml-auto" style={{ color: "var(--accent)" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {STATIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setDefaultStationId(s.id)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-sm transition-all glass glass-hover ${
                        defaultStationId === s.id ? "text-white" : "text-white/60"
                      }`}
                      style={defaultStationId === s.id ? { borderColor: "var(--accent)" } : {}}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${s.color}33`, color: s.color }}>
                        {s.name[0]}
                      </div>
                      <span className="truncate">{s.name}</span>
                      {s.freq && <span className="text-white/25 text-xs ml-auto flex-shrink-0">{s.freq}</span>}
                      {defaultStationId === s.id && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" className="flex-shrink-0" style={{ color: "var(--accent)" }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Spotify config hint ── */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--accent)" }}>
                  Spotify
                </h3>
                <div className="glass rounded-xl p-3 space-y-2 text-xs text-white/50">
                  <p className="font-medium text-white/70">Redirect URI à configurer :</p>
                  <code className="block px-2 py-1.5 rounded-lg text-[10px] font-mono break-all"
                    style={{ background: "rgba(0,0,0,0.4)", color: "var(--accent)" }}>
                    {typeof window !== "undefined" ? window.location.origin : "https://radio-fr.vercel.app"}
                    /api/spotify/callback
                  </code>
                  <p>Ajoute cette URL dans ton app Spotify Developer Dashboard → Redirect URIs.</p>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
