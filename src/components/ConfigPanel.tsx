"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { THEMES, IPOD_SKINS, useTheme, VisualizerStyle } from "@/context/ThemeContext";
import { STATIONS } from "@/lib/stations";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ConfigTab = "appearance" | "audio" | "timer" | "system";

export default function ConfigPanel({ open, onClose }: Props) {
  const {
    theme, setTheme,
    defaultStationId, setDefaultStationId,
    ipodSkin, setIpodSkin,
    visualizerStyle, setVisualizerStyle
  } = useTheme();

  const [activeTab, setActiveTab] = useState<ConfigTab>("appearance");

  // Options states
  const [iosEq, setIosEq] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [volumeNormalization, setVolumeNormalization] = useState(true);
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const [sleepStart, setSleepStart] = useState("23:00");
  const [sleepEnd, setSleepEnd] = useState("07:00");
  const [defaultTimerMin, setDefaultTimerMin] = useState(30);
  const [podcastAutoplay, setPodcastAutoplay] = useState(true);
  const [searchStation, setSearchStation] = useState("");
  const [showClearSuccess, setShowClearSuccess] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    try {
      setIosEq(localStorage.getItem("radiofr_ios_eq") === "1");
      setLowBandwidth(localStorage.getItem("radiofr_low_bandwidth") === "1");
      setLowBattery(localStorage.getItem("radiofr_low_battery") === "1");
      setAutoReconnect(localStorage.getItem("radiofr_auto_reconnect") !== "0");
      setVolumeNormalization(localStorage.getItem("radiofr_vol_norm") !== "0");
      setSleepEnabled(localStorage.getItem("radiofr_sleep_enabled") === "1");
      setSleepStart(localStorage.getItem("radiofr_sleep_start") || "23:00");
      setSleepEnd(localStorage.getItem("radiofr_sleep_end") || "07:00");
      setPodcastAutoplay(localStorage.getItem("radiofr_autoplay_next") !== "0");
      const savedTimer = localStorage.getItem("radiofr_default_timer");
      if (savedTimer) setDefaultTimerMin(Number(savedTimer));
    } catch {}
  }, []);

  const toggleIosEq = () => {
    setIosEq((v) => {
      const next = !v;
      try {
        localStorage.setItem("radiofr_ios_eq", next ? "1" : "0");
        window.dispatchEvent(new CustomEvent("radiofr:settings-changed", { detail: { key: "ios_eq", value: next } }));
      } catch {}
      return next;
    });
  };

  const toggleLowBandwidth = () => {
    setLowBandwidth((v) => {
      const next = !v;
      try { localStorage.setItem("radiofr_low_bandwidth", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const toggleLowBattery = () => {
    setLowBattery((v) => {
      const next = !v;
      try {
        localStorage.setItem("radiofr_low_battery", next ? "1" : "0");
        window.dispatchEvent(new CustomEvent("radiofr:settings-changed", { detail: { key: "low_battery", value: next } }));
      } catch {}
      return next;
    });
  };

  const toggleAutoReconnect = () => {
    setAutoReconnect((v) => {
      const next = !v;
      try { localStorage.setItem("radiofr_auto_reconnect", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const toggleVolumeNormalization = () => {
    setVolumeNormalization((v) => {
      const next = !v;
      try { localStorage.setItem("radiofr_vol_norm", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const toggleSleep = () => {
    setSleepEnabled((v) => {
      const next = !v;
      try { localStorage.setItem("radiofr_sleep_enabled", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const togglePodcastAutoplay = () => {
    setPodcastAutoplay((v) => {
      const next = !v;
      try { localStorage.setItem("radiofr_autoplay_next", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const handleClearCache = () => {
    if (confirm("Réinitialiser les préférences et vider les caches locaux ?")) {
      try {
        localStorage.clear();
        setShowClearSuccess(true);
        setTimeout(() => window.location.reload(), 800);
      } catch {}
    }
  };

  const filteredStations = STATIONS.filter(s =>
    s.name.toLowerCase().includes(searchStation.toLowerCase()) ||
    s.genre.toLowerCase().includes(searchStation.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Panel Container (iOS Center of Control Style) */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] glass-dark border-l border-white/10 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 sm:px-6 pb-4 border-b border-white/10 bg-white/[0.03]"
              style={{ paddingTop: "max(1.25rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 bg-white/5" style={{ color: "var(--accent)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-white text-base leading-tight">Préférences</h2>
                  <p className="text-white/40 text-[11px] leading-tight mt-0.5">Configuration du lecteur</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 flex items-center justify-center gap-1.5 text-white/90 hover:text-white transition-all active:scale-95 text-xs font-semibold shadow-sm cursor-pointer"
                aria-label="Fermer la configuration"
                title="Fermer (Échap)"
              >
                <span>Fermer</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* iOS Segmented Navigation Pill */}
            <div className="px-5 pt-3 pb-2">
              <div className="flex glass rounded-xl p-1 gap-1 relative">
                {([
                  { id: "appearance" as const, label: "Thèmes", icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                    </svg>
                  )},
                  { id: "audio" as const, label: "Audio", icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  )},
                  { id: "timer" as const, label: "Veille", icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                  )},
                  { id: "system" as const, label: "Système", icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  )},
                ]).map((t) => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`relative flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 z-10 ${
                        active ? "text-white" : "text-white/45 hover:text-white/80"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="configTabIndicator"
                          className="absolute inset-0 rounded-lg bg-[var(--accent)] shadow-md"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1">
                        {t.icon}
                        <span>{t.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

              {/* TAB 1: THEMES & APPARENCE */}
              {activeTab === "appearance" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold tracking-wider uppercase text-white/50">Thèmes d&apos;ambiance</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 font-mono">
                        {THEMES.length} disponibles
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all glass glass-hover relative overflow-hidden text-left ${
                            theme === t.id ? "ring-2 ring-[var(--accent)] shadow-lg" : "border border-white/10"
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden relative border border-white/20 shadow-md">
                            <div className="absolute inset-0" style={{ background: t.swatch[0] }} />
                            <div className="absolute inset-0 opacity-80" style={{
                              background: `radial-gradient(circle at 70% 30%, ${t.swatch[1]}, transparent 65%)`
                            }} />
                            <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full" style={{
                              background: t.swatch[2],
                              boxShadow: `0 0 8px ${t.swatch[1]}`
                            }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-bold truncate">{t.name}</p>
                            <p className="text-white/45 text-xs truncate mt-0.5">{t.description}</p>
                          </div>

                          {theme === t.id && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--accent)] text-white shadow-md">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Visualizer Style */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold tracking-wider uppercase text-white/50">Style du visualiseur audio</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "bars" as const, label: "Spectre", desc: "Barres EQ" },
                        { id: "wave" as const, label: "Onde", desc: "Waveform" },
                        { id: "dots" as const, label: "Néon", desc: "Points pulse" },
                      ].map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setVisualizerStyle(v.id)}
                          className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all glass glass-hover text-center ${
                            visualizerStyle === v.id ? "ring-2 ring-[var(--accent)] bg-white/10" : "border border-white/10"
                          }`}
                        >
                          <span className="text-xs font-bold text-white">{v.label}</span>
                          <span className="text-[10px] text-white/40">{v.desc}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* iPod Skins */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold tracking-wider uppercase text-white/50">Habillage du mode iPod</h3>
                    <div className="grid grid-cols-3 gap-2.5">
                      {IPOD_SKINS.map((sk) => (
                        <button
                          key={sk.id}
                          onClick={() => setIpodSkin(sk.id)}
                          className={`p-3 rounded-2xl flex flex-col items-center gap-2 transition-all glass glass-hover ${
                            ipodSkin === sk.id ? "ring-2 ring-[var(--accent)]" : "border border-white/10"
                          }`}
                        >
                          <div className="w-10 h-14 rounded-lg flex flex-col items-center justify-end pb-1.5 shadow-md"
                            style={{ background: `linear-gradient(160deg, ${sk.preview[0]}, ${sk.preview[1]})`, border: "1px solid rgba(255,255,255,0.2)" }}>
                            <div className="w-7 h-4 rounded-[2px] mb-1.5 bg-blue-100/90" />
                            <div className="w-5 h-5 rounded-full" style={{ background: sk.wheelRing }} />
                          </div>
                          <span className="text-xs font-semibold text-white/80">{sk.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {/* TAB 2: AUDIO & QUALITÉ */}
              {activeTab === "audio" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold tracking-wider uppercase text-white/50">Performances Audio</h3>

                    {/* Low Bandwidth */}
                    <div className="p-4 rounded-2xl glass border border-white/10 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white text-sm font-bold">Économie de données</p>
                        <p className="text-white/45 text-xs mt-0.5">Privilégie les flux 32-64 kbps pour réduire la consommation mobile.</p>
                      </div>
                      <button
                        onClick={toggleLowBandwidth}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                          lowBandwidth ? "bg-emerald-500" : "bg-white/15"
                        }`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                          lowBandwidth ? "left-6" : "left-1"
                        }`} />
                      </button>
                    </div>

                    {/* Auto Reconnect */}
                    <div className="p-4 rounded-2xl glass border border-white/10 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white text-sm font-bold">Reconnexion automatique</p>
                        <p className="text-white/45 text-xs mt-0.5">Relance immédiatement le flux en cas de passage WiFi / 4G / 5G.</p>
                      </div>
                      <button
                        onClick={toggleAutoReconnect}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                          autoReconnect ? "bg-emerald-500" : "bg-white/15"
                        }`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                          autoReconnect ? "left-6" : "left-1"
                        }`} />
                      </button>
                    </div>

                    {/* Volume Normalization */}
                    <div className="p-4 rounded-2xl glass border border-white/10 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white text-sm font-bold">Protection acoustique douce</p>
                        <p className="text-white/45 text-xs mt-0.5">Évite les variations de volume brutales entre différentes radios.</p>
                      </div>
                      <button
                        onClick={toggleVolumeNormalization}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                          volumeNormalization ? "bg-emerald-500" : "bg-white/15"
                        }`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                          volumeNormalization ? "left-6" : "left-1"
                        }`} />
                      </button>
                    </div>

                    {/* iOS Web Audio EQ */}
                    <div className="p-4 rounded-2xl glass border border-white/10 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white text-sm font-bold">Égaliseur sur iPhone</p>
                        <p className="text-white/45 text-xs mt-0.5">
                          {iosEq ? "Actif (Attention : coupe le son écran éteint sur iOS).": "Désactivé pour préserver la lecture en arrière-plan."}
                        </p>
                      </div>
                      <button
                        onClick={toggleIosEq}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                          iosEq ? "bg-amber-500" : "bg-white/15"
                        }`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                          iosEq ? "left-6" : "left-1"
                        }`} />
                      </button>
                    </div>
                  </section>
                </motion.div>
              )}

              {/* TAB 3: MINUTERIE & VEILLE */}
              {activeTab === "timer" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                  {/* Mode Batterie */}
                  <div className="p-4 rounded-2xl glass border border-white/10 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-white text-sm font-bold">Mode Économie de Batterie</p>
                      <p className="text-white/45 text-xs mt-0.5">Suspend les visualisations 60fps et le graphe Web Audio pour doubler l&apos;autonomie.</p>
                    </div>
                    <button
                      onClick={toggleLowBattery}
                      className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                        lowBattery ? "bg-emerald-500" : "bg-white/15"
                      }`}
                    >
                      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                        lowBattery ? "left-6" : "left-1"
                      }`} />
                    </button>
                  </div>

                  {/* Mode Sommeil Quotidien */}
                  <div className="p-4 rounded-2xl glass border border-white/10 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white text-sm font-bold">Mode Sommeil Quotidien</p>
                        <p className="text-white/45 text-xs mt-0.5">Coupe automatiquement la lecture pendant votre plage de sommeil.</p>
                      </div>
                      <button
                        onClick={toggleSleep}
                        className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                          sleepEnabled ? "bg-indigo-500" : "bg-white/15"
                        }`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                          sleepEnabled ? "left-6" : "left-1"
                        }`} />
                      </button>
                    </div>

                    {sleepEnabled && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-white/40 block mb-1">Extinction</label>
                          <input
                            type="time"
                            value={sleepStart}
                            onChange={(e) => {
                              setSleepStart(e.target.value);
                              try { localStorage.setItem("radiofr_sleep_start", e.target.value); } catch {}
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-white/40 block mb-1">Reprise autorisée</label>
                          <input
                            type="time"
                            value={sleepEnd}
                            onChange={(e) => {
                              setSleepEnd(e.target.value);
                              try { localStorage.setItem("radiofr_sleep_end", e.target.value); } catch {}
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Minuterie par défaut */}
                  <div className="p-4 rounded-2xl glass border border-white/10 space-y-3">
                    <div>
                      <p className="text-white text-sm font-bold">Durée par défaut de la minuterie</p>
                      <p className="text-white/45 text-xs mt-0.5">Valeur présélectionnée dans le lecteur.</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 30, 45, 60].map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setDefaultTimerMin(m);
                            try { localStorage.setItem("radiofr_default_timer", String(m)); } catch {}
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all ${
                            defaultTimerMin === m
                              ? "bg-[var(--accent)] text-white shadow-md"
                              : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: SYSTÈME & DÉMARRAGE */}
              {activeTab === "system" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                  {/* Podcast Autoplay */}
                  <div className="p-4 rounded-2xl glass border border-white/10 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-white text-sm font-bold">Enchaînement automatique</p>
                      <p className="text-white/45 text-xs mt-0.5">Lit automatiquement l&apos;épisode suivant à la fin du podcast.</p>
                    </div>
                    <button
                      onClick={togglePodcastAutoplay}
                      className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${
                        podcastAutoplay ? "bg-emerald-500" : "bg-white/15"
                      }`}
                    >
                      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                        podcastAutoplay ? "left-6" : "left-1"
                      }`} />
                    </button>
                  </div>

                  {/* Default Station Picker */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold tracking-wider uppercase text-white/50">Station au lancement</h3>
                      {defaultStationId && (
                        <button
                          onClick={() => setDefaultStationId(null)}
                          className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors"
                        >
                          Désactiver
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={searchStation}
                      onChange={(e) => setSearchStation(e.target.value)}
                      placeholder="Rechercher une station…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[var(--accent)]"
                    />

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {filteredStations.slice(0, 15).map((s) => {
                        const isSelected = defaultStationId === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setDefaultStationId(isSelected ? null : s.id)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs transition-all text-left ${
                              isSelected
                                ? "bg-[var(--accent)] text-white shadow-md"
                                : "glass glass-hover text-white/70"
                            }`}
                          >
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                              style={{ background: `${s.color}33`, color: isSelected ? "#fff" : s.color }}>
                              {s.name[0]}
                            </span>
                            <span className="truncate flex-1 font-medium">{s.name}</span>
                            {s.freq && <span className="opacity-50 text-[10px]">{s.freq}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Keyboard Shortcuts Guide */}
                  <div className="p-4 rounded-2xl glass border border-white/10 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/>
                      </svg>
                      <p className="text-white text-sm font-bold">Raccourcis Clavier</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-white/60">Lecture / Pause</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">Espace</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-white/60">Saut / Station</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">Gauche / Droite</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-white/60">Volume +/-</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">Haut / Bas</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-white/60">Couper le son</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">M</kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 col-span-2">
                        <span className="text-white/60">Ajouter aux favoris</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">F</kbd>
                      </div>
                    </div>
                  </div>

                  {/* Reset & Cache Maintenance */}
                  <div className="p-4 rounded-2xl glass border border-red-500/20 bg-red-500/[0.03] space-y-3">
                    <div>
                      <p className="text-red-300 text-sm font-bold">Maintenance & Cache</p>
                      <p className="text-white/40 text-xs mt-0.5">Efface les données locales et restaure la configuration par défaut.</p>
                    </div>
                    <button
                      onClick={handleClearCache}
                      className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs font-bold transition-all active:scale-98"
                    >
                      {showClearSuccess ? "Réinitialisé !" : "Vider le cache et réinitialiser"}
                    </button>
                  </div>
                </motion.div>
              )}

            </div>

            {/* Footer Status & Done Button */}
            <div
              className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-white/50 font-mono"
              style={{ paddingBottom: "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Radio-PaLaMa
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl font-sans font-semibold text-xs text-white border border-white/20 hover:border-white/40 transition-all active:scale-95 cursor-pointer"
                style={{ background: "var(--accent)33", color: "var(--accent)" }}
              >
                Terminer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
