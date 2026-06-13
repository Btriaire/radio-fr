"use client";
import { useRef, useState, useCallback, useEffect } from "react";

export interface EQBand {
  label: string;
  freq: number;
  gain: number;
  type: BiquadFilterType;
}

const DEFAULT_BANDS: EQBand[] = [
  { label: "60Hz", freq: 60, gain: 0, type: "lowshelf" },
  { label: "230Hz", freq: 230, gain: 0, type: "peaking" },
  { label: "910Hz", freq: 910, gain: 0, type: "peaking" },
  { label: "3.6kHz", freq: 3600, gain: 0, type: "peaking" },
  { label: "14kHz", freq: 14000, gain: 0, type: "highshelf" },
];

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [bands, setBands] = useState<EQBand[]>(DEFAULT_BANDS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initAudio = useCallback((url: string) => {
    // Reuse existing audio element if same URL
    if (audioRef.current && currentUrl === url) {
      if (!isPlaying) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      return;
    }

    // Stop previous
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

    // Build Web Audio graph
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = ctxRef.current;

    // Disconnect previous source
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
    }

    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;

    // Create EQ filters chain
    const filters = bands.map((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = band.gain;
      f.Q.value = 1;
      return f;
    });
    filtersRef.current = filters;

    // Analyser for visualizer
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Chain: source -> filters -> analyser -> destination
    let node: AudioNode = source;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(ctx.destination);

    audio.oncanplay = () => setIsLoading(false);
    audio.onerror = () => {
      setError("Impossible de charger le flux.");
      setIsLoading(false);
    };
    audio.onplaying = () => { setIsPlaying(true); setIsLoading(false); };
    audio.onpause = () => setIsPlaying(false);
    audio.onwaiting = () => setIsLoading(true);

    if (ctx.state === "suspended") ctx.resume();
    audio.play().catch((e) => {
      setError("Lecture bloquée par le navigateur.");
      setIsLoading(false);
    });
  }, [currentUrl, isPlaying, volume, bands]);

  const play = useCallback(() => {
    if (audioRef.current) {
      ctxRef.current?.resume();
      audioRef.current.play().catch(console.error);
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause(); else play();
  }, [isPlaying, play, pause]);

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

  const resetEQ = useCallback(() => {
    setBands(DEFAULT_BANDS.map((b) => ({ ...b, gain: 0 })));
    filtersRef.current.forEach((f) => { f.gain.value = 0; });
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setIsPlaying(false);
    setCurrentUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      ctxRef.current?.close();
    };
  }, []);

  return {
    isPlaying,
    volume,
    currentUrl,
    bands,
    isLoading,
    error,
    analyserRef,
    initAudio,
    play,
    pause,
    togglePlay,
    changeVolume,
    updateBand,
    resetEQ,
    stop,
  };
}
