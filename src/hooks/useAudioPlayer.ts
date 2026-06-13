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
  { label: "32",   freq: 32,    gain: 0, type: "lowshelf",  Q: 0.7 },
  { label: "64",   freq: 64,    gain: 0, type: "peaking",   Q: 1.4 },
  { label: "125",  freq: 125,   gain: 0, type: "peaking",   Q: 1.4 },
  { label: "250",  freq: 250,   gain: 0, type: "peaking",   Q: 1.4 },
  { label: "500",  freq: 500,   gain: 0, type: "peaking",   Q: 1.4 },
  { label: "1k",   freq: 1000,  gain: 0, type: "peaking",   Q: 1.4 },
  { label: "2k",   freq: 2000,  gain: 0, type: "peaking",   Q: 1.4 },
  { label: "4k",   freq: 4000,  gain: 0, type: "peaking",   Q: 1.4 },
  { label: "8k",   freq: 8000,  gain: 0, type: "peaking",   Q: 1.4 },
  { label: "16k",  freq: 16000, gain: 0, type: "highshelf", Q: 0.7 },
];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Bass:       [6, 5, 4, 2, 0, 0, 0, -1, -1, -2],
  Vocal:      [-2, -1, 0, 2, 4, 4, 3, 2, 1, 0],
  Rock:       [5, 4, 2, 0, -1, 0, 2, 4, 5, 4],
  Pop:        [-1, 0, 2, 3, 4, 3, 2, 1, 0, -1],
  Classical:  [4, 3, 2, 0, 0, 0, 0, 2, 3, 4],
  Jazz:       [3, 2, 0, 2, -1, -1, 0, 1, 2, 3],
  Electronic: [4, 4, 2, 0, -1, 0, 1, 2, 4, 5],
  Podcast:    [-2, -1, 0, 2, 5, 5, 4, 2, 1, 0],
  Nuit:       [3, 2, 1, 0, -2, -3, -3, -2, -1, 0],
};

export function useAudioPlayer() {
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef  = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume,    setVolume]    = useState(0.8);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [bands,     setBands]     = useState<EQBand[]>(DEFAULT_BANDS);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const buildGraph = useCallback((audio: HTMLAudioElement, currentBands: EQBand[]) => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = ctxRef.current;

    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch {} }

    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;

    const filters = currentBands.map((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = band.gain;
      f.Q.value = band.Q ?? 1.4;
      return f;
    });
    filtersRef.current = filters;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    let node: AudioNode = source;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(ctx.destination);

    if (ctx.state === "suspended") ctx.resume();
  }, []);

  const initAudio = useCallback((url: string) => {
    if (audioRef.current && currentUrl === url) {
      if (!isPlaying) {
        ctxRef.current?.resume();
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    setError(null);
    setIsLoading(true);

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.volume = volume;
    audio.src = url;
    audioRef.current = audio;
    setCurrentUrl(url);

    buildGraph(audio, bands);

    audio.oncanplay  = () => setIsLoading(false);
    audio.onerror    = () => { setError("Impossible de charger le flux."); setIsLoading(false); };
    audio.onplaying  = () => { setIsPlaying(true); setIsLoading(false); };
    audio.onpause    = () => setIsPlaying(false);
    audio.onwaiting  = () => setIsLoading(true);

    audio.play().catch(() => { setError("Lecture bloquée par le navigateur."); setIsLoading(false); });
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
    if (filtersRef.current[index]) {
      filtersRef.current[index].gain.value = gain;
    }
  }, []);

  const applyPreset = useCallback((gains: number[]) => {
    setBands((prev) => prev.map((b, i) => ({ ...b, gain: gains[i] ?? 0 })));
    gains.forEach((g, i) => {
      if (filtersRef.current[i]) filtersRef.current[i].gain.value = g;
    });
  }, []);

  const resetEQ = useCallback(() => applyPreset(Array(10).fill(0)), [applyPreset]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    setIsPlaying(false);
    setCurrentUrl(null);
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    ctxRef.current?.close();
  }, []);

  return {
    isPlaying, volume, currentUrl, bands, isLoading, error,
    analyserRef, filtersRef,
    initAudio, play, pause, togglePlay,
    changeVolume, updateBand, applyPreset, resetEQ, stop,
  };
}
