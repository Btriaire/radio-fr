"use client";
import { useRef, useState, useCallback, useEffect } from "react";

export interface EQBand {
  label: string;
  freq: number;
  gain: number;
  type: BiquadFilterType;
  Q?: number;
}

export const DEFAULT_BANDS: EQBand[] = [
  { label: "32",  freq: 32,    gain: 0, type: "lowshelf",  Q: 0.7 },
  { label: "64",  freq: 64,    gain: 0, type: "peaking",   Q: 2.0 },
  { label: "125", freq: 125,   gain: 0, type: "peaking",   Q: 2.0 },
  { label: "250", freq: 250,   gain: 0, type: "peaking",   Q: 2.0 },
  { label: "500", freq: 500,   gain: 0, type: "peaking",   Q: 2.0 },
  { label: "1k",  freq: 1000,  gain: 0, type: "peaking",   Q: 2.0 },
  { label: "2k",  freq: 2000,  gain: 0, type: "peaking",   Q: 2.0 },
  { label: "4k",  freq: 4000,  gain: 0, type: "peaking",   Q: 2.0 },
  { label: "8k",  freq: 8000,  gain: 0, type: "peaking",   Q: 2.0 },
  { label: "16k", freq: 16000, gain: 0, type: "highshelf", Q: 0.7 },
];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:       [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  Bass:       [8,  6,  4,  2,  0,  0,  0, -1, -1, -2],
  Vocal:      [-2, -1,  0,  2,  5,  5,  4,  2,  1,  0],
  Rock:       [5,  4,  2,  0, -1,  0,  2,  4,  5,  4],
  Pop:        [-1,  0,  2,  3,  4,  3,  2,  1,  0, -1],
  Classical:  [4,  3,  2,  0,  0,  0,  0,  2,  3,  4],
  Jazz:       [3,  2,  0,  2, -1, -1,  0,  1,  2,  3],
  Electronic: [6,  5,  3,  0, -1,  0,  1,  3,  5,  6],
  Podcast:    [-3, -2,  0,  3,  6,  6,  5,  2,  0, -1],
  Nuit:       [4,  3,  1,  0, -3, -4, -4, -2, -1,  0],
};

export function useAudioPlayer() {
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef  = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqEnabledRef = useRef(true); // false when CORS blocks Web Audio

  const [isPlaying,  setIsPlaying]  = useState(false);
  const [volume,     setVolume]     = useState(0.8);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [bands,      setBands]      = useState<EQBand[]>(DEFAULT_BANDS);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [eqActive,   setEqActive]   = useState(true);

  // ── Build the Web Audio graph ──────────────────────────────────────────────
  const buildGraph = useCallback((audio: HTMLAudioElement, currentBands: EQBand[]) => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    // Disconnect previous source cleanly
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }

    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(audio);
      sourceRef.current = source;
    } catch (e) {
      // Already connected to another context or security error — skip Web Audio
      console.warn("Web Audio source error:", e);
      eqEnabledRef.current = false;
      setEqActive(false);
      return;
    }

    eqEnabledRef.current = true;
    setEqActive(true);

    // 10-band filter chain
    const filters = currentBands.map((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = band.gain;
      f.Q.value = band.Q ?? 2.0;
      return f;
    });
    filtersRef.current = filters;

    // Analyser for visualizer
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // source → filter[0] → … → filter[9] → analyser → destination
    let node: AudioNode = source;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(ctx.destination);
  }, []);

  // ── Load & play a URL ─────────────────────────────────────────────────────
  const initAudio = useCallback((url: string) => {
    // Same URL already loaded → just toggle play
    if (audioRef.current && currentUrl === url) {
      if (!isPlaying) {
        ctxRef.current?.resume();
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      return;
    }

    // Stop & release previous
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }

    setError(null);
    setIsLoading(true);
    setCurrentUrl(url);

    const audio = new Audio();
    // crossOrigin is needed for Web Audio API; if it fails the browser
    // will fire an error and we fall back gracefully.
    audio.crossOrigin = "anonymous";
    audio.volume = volume;
    audioRef.current = audio;

    // Build Web Audio graph BEFORE setting src (avoids timing issues)
    buildGraph(audio, bands);

    audio.src = url;

    audio.oncanplay  = () => setIsLoading(false);
    audio.onerror    = () => {
      // Try without crossOrigin if CORS failed
      if (audio.crossOrigin === "anonymous") {
        audio.crossOrigin = "";
        eqEnabledRef.current = false;
        setEqActive(false);
        audio.src = url;
        audio.play().catch(() => setError("Impossible de charger le flux."));
      } else {
        setError("Impossible de charger le flux.");
        setIsLoading(false);
      }
    };
    audio.onplaying = () => { setIsPlaying(true); setIsLoading(false); };
    audio.onpause   = () => setIsPlaying(false);
    audio.onwaiting = () => setIsLoading(true);

    ctxRef.current?.resume();
    audio.play().catch(() => {
      setError("Cliquez Play pour démarrer (politique du navigateur).");
      setIsLoading(false);
    });
  }, [currentUrl, isPlaying, volume, bands, buildGraph]);

  const play  = useCallback(() => { ctxRef.current?.resume(); audioRef.current?.play().catch(console.error); }, []);
  const pause = useCallback(() => { audioRef.current?.pause(); }, []);
  const togglePlay = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, play, pause]);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const updateBand = useCallback((index: number, gain: number) => {
    setBands((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], gain };
      return next;
    });
    // Apply immediately to the live BiquadFilter node
    const f = filtersRef.current[index];
    if (f) {
      f.gain.setTargetAtTime(gain, ctxRef.current?.currentTime ?? 0, 0.01);
    }
  }, []);

  const applyPreset = useCallback((gains: number[]) => {
    const now = ctxRef.current?.currentTime ?? 0;
    setBands((prev) => prev.map((b, i) => ({ ...b, gain: gains[i] ?? 0 })));
    gains.forEach((g, i) => {
      const f = filtersRef.current[i];
      if (f) f.gain.setTargetAtTime(g, now, 0.02);
    });
  }, []);

  const resetEQ = useCallback(() => applyPreset(Array(10).fill(0)), [applyPreset]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) { audioRef.current.src = ""; audioRef.current.load(); }
    setIsPlaying(false);
    setCurrentUrl(null);
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    ctxRef.current?.close();
  }, []);

  return {
    isPlaying, volume, currentUrl, bands, isLoading, error, eqActive,
    analyserRef, filtersRef,
    initAudio, play, pause, togglePlay,
    changeVolume, updateBand, applyPreset, resetEQ, stop,
  };
}
