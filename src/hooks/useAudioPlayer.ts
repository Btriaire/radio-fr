"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import type { DecodeController } from "@/lib/streamDecoder";
import { isEqCompatible } from "@/lib/stations";
import { fadeOut } from "@/lib/audioFade";
import { getNextStreamFallback, StreamCandidateStation } from "@/lib/streamFailover";

// Lightweight iOS check inlined here so the heavy MP3-decoder module (with its
// WASM) is only pulled in via dynamic import on devices that actually need it.
function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iDevice = /iP(hone|ad|od)/.test(ua);
  const iPadOS =
    navigator.platform === "MacIntel" &&
    typeof (navigator as { maxTouchPoints?: number }).maxTouchPoints === "number" &&
    (navigator as { maxTouchPoints: number }).maxTouchPoints > 1;
  return iDevice || iPadOS;
}

// Mode "Économie de batterie" — skips the Web Audio graph (MediaElementSource +
// 10-band filter chain + analyser) entirely, the same way iOS already does, so
// there's no continuous audio-thread processing or analyser polling to pay for.
// Costs the EQ and the real waveform/bars (visualizers fall back to their
// static idle state); playback itself is unaffected.
function lowBatteryMode(): boolean {
  try { return localStorage.getItem("radiofr_low_battery") === "1"; } catch { return false; }
}

// Mode "Sommeil" — auto-pauses playback during a configured daily time window
// (e.g. bedtime) so the radio doesn't keep playing all night unattended.
function readSleepSchedule(): { enabled: boolean; start: string; end: string } {
  try {
    return {
      enabled: localStorage.getItem("radiofr_sleep_enabled") === "1",
      start: localStorage.getItem("radiofr_sleep_start") || "23:00",
      end: localStorage.getItem("radiofr_sleep_end") || "07:00",
    };
  } catch {
    return { enabled: false, start: "23:00", end: "07:00" };
  }
}

// "HH:MM" → minutes past midnight → range check that wraps past midnight
// (e.g. 23:00 → 07:00 covers 23:00-23:59 AND 00:00-06:59).
function isWithinSleepWindow(start: string, end: string): boolean {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return false; // degenerate (e.g. same time twice) → never
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return startMin < endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin;
}

// Shared guard: is the sleep schedule currently telling us to stay quiet?
// Used both to trigger the auto-pause and to stop the interruption-recovery
// logic below from fighting it (e.g. resuming right as bedtime starts).
function isSleepingNow(): boolean {
  const { enabled, start, end } = readSleepSchedule();
  return enabled && isWithinSleepWindow(start, end);
}

export interface EQBand {
  label: string;
  freq: number;
  gain: number;
  type: BiquadFilterType;
  Q?: number;
}

// Q ≈ 1.0 for octave-spaced peaking bands → bands overlap, broad audible effect.
// (Q=2.0 was too narrow: tiny notches between bands, barely audible.)
export const DEFAULT_BANDS: EQBand[] = [
  { label: "32",  freq: 32,    gain: 0, type: "lowshelf",  Q: 0.7 },
  { label: "64",  freq: 64,    gain: 0, type: "peaking",   Q: 1.0 },
  { label: "125", freq: 125,   gain: 0, type: "peaking",   Q: 1.0 },
  { label: "250", freq: 250,   gain: 0, type: "peaking",   Q: 1.0 },
  { label: "500", freq: 500,   gain: 0, type: "peaking",   Q: 1.0 },
  { label: "1k",  freq: 1000,  gain: 0, type: "peaking",   Q: 1.0 },
  { label: "2k",  freq: 2000,  gain: 0, type: "peaking",   Q: 1.0 },
  { label: "4k",  freq: 4000,  gain: 0, type: "peaking",   Q: 1.0 },
  { label: "8k",  freq: 8000,  gain: 0, type: "peaking",   Q: 1.0 },
  { label: "16k", freq: 16000, gain: 0, type: "highshelf", Q: 0.7 },
];

//  bands:        32   64  125  250  500   1k   2k   4k   8k  16k
export const EQ_PRESETS: Record<string, number[]> = {
  Flat:       [  0,   0,   0,   0,   0,   0,   0,   0,   0,   0],
  Bass:       [ 12,  10,   7,   3,   0,   0,   0,  -1,  -1,  -2],
  Vocal:      [ -3,  -2,   0,   3,   8,   8,   6,   3,   1,   0],
  Rock:       [  8,   6,   3,   0,  -2,   0,   3,   6,   8,   6],
  Pop:        [ -2,   0,   3,   5,   6,   5,   3,   1,   0,  -2],
  Classical:  [  6,   5,   3,   0,   0,   0,   0,   3,   5,   6],
  Jazz:       [  5,   3,   0,   3,  -2,  -2,   0,   2,   3,   5],
  Electronic: [ 10,   8,   5,   0,  -2,   0,   2,   5,   8,  10],
  Podcast:    [ -4,  -3,   0,   5,   9,   9,   7,   3,   0,  -2],
  Nuit:       [  6,   5,   2,   0,  -4,  -6,  -6,  -3,  -1,   0],
  // ── Vocal & Speech focus presets ─────────────────────────────────────────
  "Clarté Voix": [ -10,  -8,  -4,   2,  10,  12,   8,   4,   0,  -4],
  "Radio Talk":  [ -16, -12,  -6,   4,  11,  10,   6,   2,  -8, -14],
  "Studio Pro":  [  -8,  -5,   1,   5,   8,   9,   7,   5,   2,   0],
  // ── Music focus presets ──────────────────────────────────────────────────
  "Acoustique":  [   6,   8,   7,   4,   2,   0,   1,   3,   2,   1],
  "Scène Live":  [   9,   7,   4,   1,  -1,   2,   4,   6,   8,  10],
  "Punch Club":  [  12,  10,   5,  -2,   0,   4,   6,   5,   7,   8],
  // ── Imaginative & effective extras ──────────────────────────────────────
  "Boom 808": [ 16,  15,   9,   2,  -1,  -2,   0,   2,   3,   2],  // trap/hip-hop sub
  Club:       [ 11,  10,   8,   4,   2,   0,   1,   3,   5,   6],  // smiley loudness
  Live:       [  4,   5,   4,   2,   0,   1,   2,   4,   5,   4],  // concert presence
  Loudness:   [ 13,   9,   4,   0,  -1,   0,   2,   5,   9,  12],  // equal-loudness V
  Brillance:  [ -2,  -1,   0,   1,   2,   3,   5,   8,  11,  13],  // air & sparkle
  "Basse Pro":[ 18,  14,   8,   2,  -2,  -3,  -1,   1,   2,   1],  // deep clean sub
  Vinyle:     [  5,   6,   4,   2,   1,   0,  -1,  -3,  -6,  -9],  // warm analog rolloff
  "Lo-Fi":    [  3,   4,   2,   0,  -1,  -2,  -4,  -7, -12, -16],  // dusty mellow
  Téléphone:  [-18, -16,  -8,   2,   8,  10,   8,   2,  -8, -16],  // mid-band radio
  Cathédrale: [  8,   6,   3,  -2,  -3,  -2,   1,   4,   7,   9],  // huge airy space
  Cinéma:     [ 12,  10,   5,   1,  -1,   0,   2,   4,   7,   9],  // wide dynamic
  Casque:     [  6,   4,   1,  -1,  -2,   0,   2,   3,   2,   4],  // headphone tuning
  "Voix Off": [ -6,  -5,  -2,   4,  10,  10,   6,   1,  -3,  -6],  // narration clarity
  Chaleur:    [  7,   8,   6,   4,   2,   0,  -1,  -2,  -2,  -1],  // warm & smooth
  Cristal:    [  2,   1,   0,  -1,   0,   2,   4,   7,  10,  12],  // crisp top end
  Punch:      [  9,   7,   2,  -2,   0,   3,   5,   4,   3,   5],  // tight kick+snap
  Ample:      [ 10,   7,   3,   0,  -2,  -1,   1,   3,   6,   9],  // wide & full
  Doux:       [  3,   2,   1,   0,  -1,  -2,  -3,  -4,  -5,  -4],  // soft, fatigue-free
  "Trésor":   [ 14,  11,   6,   2,   3,   4,   3,   5,   8,  10],  // maximalist fun
};

// ── Strong one-tap modes (used by dedicated Player toggles) ───────────────
//   bands: 32 64 125 250 500 1k 2k 4k 8k 16k
export const BASS_BOOSTER:    number[] = [18, 16, 12,  6,  1,  0,  0,  2,  3,  4];
export const VOICE_ISOLATION: number[] = [-20, -18, -12, -4,  4,  9,  9,  6, -5, -16];

// ── Vocal & Speech Processing Profiles ─────────────────────────────────────
export const VOCAL_CLARITY:   number[] = [-10,  -8,  -4,  2, 10, 12,  8,  4,  0, -4]; // Crisp voice intelligibility
export const NEWS_SPEECH:     number[] = [-16, -12,  -6,  4, 11, 10,  6,  2, -8,-14]; // Radio talk / news anchor focus
export const PODCAST_PRO:     number[] = [ -8,  -5,   1,  5,  8,  9,  7,  5,  2,  0]; // Broadcast studio presence

// ── Music Processing Profiles ──────────────────────────────────────────────
export const WARM_ACOUSTIC:   number[] = [  6,   8,   7,  4,  2,  0,  1,  3,  2,  1]; // Rich acoustic guitar & organic warm lows
export const CONCERT_HALL:    number[] = [  9,   7,   4,  1, -1,  2,  4,  6,  8, 10]; // Live stadium soundstage & airy presence
export const DYNAMIC_PUNCH:   number[] = [ 12,  10,   5, -2,  0,  4,  6,  5,  7,  8]; // Punchy kicks, detailed highs, modern EDM/Rock

// ── Auto-reconnect tuning (module scope) ───────────────────────────────────
// On a dropped stream we retry with exponential backoff instead of dying with
// a red error. Live radio resumes at the live edge; podcasts/music re-seek to
// the last known position. A pause/stop is a *deliberate* stop and never retries.
// Tuned for stability: avoid false-positive reconnects on slow networks.
const MAX_RECONNECT_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 2000;   // 2s, 4s, 8s, 16s, 32s → capped (slower ramp)
const BACKOFF_CAP_MS  = 30000;  // cap at 30s (more patient)
const STALL_TIMEOUT_MS = 15000; // currentTime frozen 15s+ (not just 9s) = likely drop
const WATCHDOG_TICK_MS = 3000;  // check every 3s (not 2s) — less CPU, fewer false alarms
const STALL_CONSISTENCY = 2;    // require 2 consecutive stalls to trigger reconnect
// A stream that never even reaches its first `onplaying` (bad redirect, dead
// icecast mount, silently hung TCP connection) previously had ZERO protection —
// the stall watchdog only starts once playback has begun. This is the connect-
// phase equivalent: if we're still waiting after this long, treat it as a drop.
const CONNECT_TIMEOUT_MS = 20000;

export function useAudioPlayer() {
  // A <video> element (not <audio>) so we can optionally show the picture for
  // video podcasts. Off-DOM it behaves exactly like an audio element for sound;
  // the Player mounts it into a tiny viewport only when the episode has video.
  const audioRef    = useRef<HTMLMediaElement | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef  = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef     = useRef<GainNode | null>(null);
  const eqEnabledRef = useRef(true); // false when CORS blocks Web Audio
  // iOS-only decode pipeline: when active we bypass the <audio> element entirely
  // and feed decoded PCM through the real filter chain so the EQ actually works.
  const decoderRef  = useRef<DecodeController | null>(null);
  const modeRef     = useRef<"element" | "decoder">("element");

  const [isPlaying,   setIsPlaying]   = useState(false);
  const [volume,      setVolume]      = useState(0.8);
  const prevVolumeRef = useRef(0.8);
  const [isLooping,   setIsLooping]   = useState(false);
  const isLoopingRef  = useRef(false);
  const [nightMode,   setNightMode]   = useState(false);
  const nightModeRef  = useRef(false);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const [stereoPan,   setStereoPanState] = useState(0);
  const stereoPanRef  = useRef(0);
  const pannerRef     = useRef<StereoPannerNode | null>(null);
  const [spatialAudio, setSpatialAudio] = useState(false);
  const spatialAudioRef = useRef(false);
  const [currentUrl,  setCurrentUrl]  = useState<string | null>(null);
  const [bands,       setBands]       = useState<EQBand[]>(DEFAULT_BANDS);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [eqActive,    setEqActive]    = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const playbackRateRef = useRef(1);

  // ── Sleep timer (countdown, distinct from the "Mode Sommeil" clock-time
  // schedule above) — seconds left, or null when no timer is armed. Exposed
  // as state (not a ref) purely for the live "Arrêt dans MM:SS" display.
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const sleepTimerEndAtRef = useRef<number | null>(null);
  const sleepTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTickRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // True when the current source is an actual video podcast (we then use a
  // <video> element). For audio-only content we use an <audio> element, because
  // iOS Safari PAUSES <video> playback the moment the screen locks / the tab
  // backgrounds — only <audio> keeps playing in the background.
  const wantVideoRef = useRef(false);

  // Fires once when the current track plays through to its natural end. Used by
  // the page to auto-advance a podcast/music queue (enchaînement automatique).
  const onEndedRef = useRef<(() => void) | null>(null);
  const setOnEnded = useCallback((cb: (() => void) | null) => { onEndedRef.current = cb; }, []);

  // ── Auto-reconnect state ──────────────────────────────────────────────────
  // wantPlayingRef is the source of truth for *intent*: true while the user
  // wants sound. pause()/stop() set it false → a drop then never reconnects.
  const wantPlayingRef = useRef(false);
  // Everything needed to replay the exact same pipeline on reconnect.
  const lastInitRef = useRef<{ url: string; live: boolean; video: boolean } | null>(null);
  const liveRef = useRef(true);            // live-ness of the current source (radio = true)
  const resumeAtRef = useRef(0);           // last currentTime for non-live re-seek
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);            // reconnect attempts so far
  const lastProgressRef = useRef<{ t: number; at: number }>({ t: 0, at: 0 });
  const stallCountRef = useRef(0);         // consecutive stall checks (for consistency)
  // Breaks the circular dependency: scheduleReconnect arms a timer that calls
  // doReconnectRef.current(), which is wired to reconnectNow() via a useEffect.
  const doReconnectRef = useRef<(() => void) | null>(null);
  const stationRef = useRef<StreamCandidateStation | null>(null);
  const sessionIdRef = useRef(0);

  const [reconnecting,     setReconnecting]     = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [offline,          setOffline]          = useState(false);

  // ── Build the Web Audio graph ──────────────────────────────────────────────
  const buildGraph = useCallback((audio: HTMLMediaElement, currentBands: EQBand[]) => {
    // On iOS the element gets routed to hardware and the graph only receives
    // silence (EQ never works this way), while wrapping the element in a
    // MediaElementSource can also stop playback when the screen locks. So on
    // iOS we leave the <audio> element untouched → reliable background playback,
    // unless the user explicitly opted into the iOS EQ in Settings.
    // Low-battery mode opts out the same way, on purpose, to skip the graph's
    // ongoing CPU cost (filters + analyser) even on desktop.
    let iosEqOptIn = false;
    try { iosEqOptIn = localStorage.getItem("radiofr_ios_eq") === "1"; } catch {}

    if ((detectIOS() && !iosEqOptIn) || lowBatteryMode()) {
      eqEnabledRef.current = false;
      setEqActive(false);
      gainRef.current = null;   // volume falls back to element.volume
      return;
    }
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
      gainRef.current = null;        // no graph → volume falls back to element.volume
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
      f.Q.value = band.Q ?? 1.0;
      return f;
    });
    filtersRef.current = filters;

    // Analyser for visualizer
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Master gain → controls volume INSIDE the graph. Setting <audio>.volume is
    // ignored by browsers that route the element through a MediaElementSource
    // (and by iOS entirely), so the slider must drive a GainNode instead.
    const gain = ctx.createGain();
    gain.gain.value = audio.volume;   // adopt the volume the element was primed with
    gainRef.current = gain;
    // The graph now owns volume → keep the element at unity to avoid double
    // attenuation in browsers that DO apply element.volume to the source.
    audio.volume = 1;

    // Dynamics compressor (Night Mode)
    let compressor: DynamicsCompressorNode | null = null;
    try {
      compressor = ctx.createDynamicsCompressor();
      if (nightModeRef.current) {
        compressor.threshold.setValueAtTime(-30, ctx.currentTime);
        compressor.knee.setValueAtTime(30, ctx.currentTime);
        compressor.ratio.setValueAtTime(12, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);
      } else {
        compressor.threshold.setValueAtTime(0, ctx.currentTime);
        compressor.ratio.setValueAtTime(1, ctx.currentTime);
      }
    } catch {}
    compressorRef.current = compressor;

    // Stereo panner (Balance L/R)
    let panner: StereoPannerNode | null = null;
    try {
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(stereoPanRef.current, ctx.currentTime);
      }
    } catch {}
    pannerRef.current = panner;

    // source → filter[0] → … → filter[9] → analyser → gain → (compressor) → (panner) → destination
    let node: AudioNode = source;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(gain);
    
    let lastNode: AudioNode = gain;
    if (compressor) {
      lastNode.connect(compressor);
      lastNode = compressor;
    }
    if (panner) {
      lastNode.connect(panner);
      lastNode = panner;
    }
    lastNode.connect(ctx.destination);
  }, []);

  // ── Build the SAME filter chain WITHOUT a MediaElementSource ───────────────
  // Used by the iOS decode pipeline: decoded PCM buffers connect to the returned
  // input node, so the filters genuinely process the sound (no element bypass).
  const buildDecoderChain = useCallback((ctx: AudioContext, currentBands: EQBand[], vol: number): AudioNode => {
    const filters = currentBands.map((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.gain.value = band.gain;
      f.Q.value = band.Q ?? 1.0;
      return f;
    });
    filtersRef.current = filters;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const gain = ctx.createGain();
    gain.gain.value = vol;
    gainRef.current = gain;

    let compressor: DynamicsCompressorNode | null = null;
    try {
      compressor = ctx.createDynamicsCompressor();
      if (nightModeRef.current) {
        compressor.threshold.setValueAtTime(-30, ctx.currentTime);
        compressor.knee.setValueAtTime(30, ctx.currentTime);
        compressor.ratio.setValueAtTime(12, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);
      } else {
        compressor.threshold.setValueAtTime(0, ctx.currentTime);
        compressor.ratio.setValueAtTime(1, ctx.currentTime);
      }
    } catch {}
    compressorRef.current = compressor;

    let panner: StereoPannerNode | null = null;
    try {
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(stereoPanRef.current, ctx.currentTime);
      }
    } catch {}
    pannerRef.current = panner;

    // (PCM) → filter[0] → … → filter[9] → analyser → gain → (compressor) → (panner) → destination
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(analyser);
    analyser.connect(gain);
    
    let lastNode: AudioNode = gain;
    if (compressor) {
      lastNode.connect(compressor);
      lastNode = compressor;
    }
    if (panner) {
      lastNode.connect(panner);
      lastNode = panner;
    }
    lastNode.connect(ctx.destination);
    return filters[0];   // input: decoded buffers connect here
  }, []);

  // ── Reconnect plumbing ─────────────────────────────────────────────────────
  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
  }, []);

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
  }, []);

  const clearConnectTimer = useCallback(() => {
    if (connectTimerRef.current) { clearTimeout(connectTimerRef.current); connectTimerRef.current = null; }
  }, []);

  // The single place that arms a retry. No-ops if the user didn't want sound, if
  // we're offline (those don't burn attempts), or if a retry is already pending.
  const scheduleReconnect = useCallback((_reason: string) => {
    if (!wantPlayingRef.current) return;
    if (reconnectTimerRef.current) return;       // a retry is already queued
    stopWatchdog();
    clearConnectTimer();
    if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setReconnecting(false);
      setIsLoading(false);
      setError("Connexion perdue. Réessayer ?");
      return;
    }
    const n = attemptRef.current;
    attemptRef.current = n + 1;
    setReconnectAttempt(n + 1);
    const base = Math.min(BACKOFF_BASE_MS * Math.pow(2, n), BACKOFF_CAP_MS);
    // Larger jitter (±50%) to spread reconnect attempts across time when multiple
    // clients or the server is under stress. Avoids thundering herd.
    const jitter = 0.5 + Math.random();  // 0.5 to 1.5x multiplier
    const delay = Math.round(base * jitter);
    setReconnecting(true);
    setError(null);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      doReconnectRef.current?.();
    }, delay);
  }, [stopWatchdog, clearConnectTimer]);

  // Detects a silently-stalled element: currentTime frozen for STALL_TIMEOUT_MS
  // while we still want playback and the element isn't (deliberately) paused.
  // Requires STALL_CONSISTENCY ticks in a row to avoid false alarms on slow nets.
  const startWatchdog = useCallback(() => {
    stopWatchdog();
    stallCountRef.current = 0;
    lastProgressRef.current = { t: audioRef.current?.currentTime ?? 0, at: Date.now() };
    watchdogRef.current = setInterval(() => {
      // Browsers are free to auto-suspend an AudioContext to save power
      // (backgrounded tab/app, long idle). The <audio> element itself keeps
      // downloading/decoding when this happens — currentTime keeps advancing
      // and nothing errors — but the graph downstream of it is silent. That's
      // a "stream that looks alive but makes no sound" drop the stall check
      // below can never catch (it only watches currentTime). Nudge it back.
      if (wantPlayingRef.current && ctxRef.current?.state === "suspended") {
        ctxRef.current.resume().catch(() => {});
      }
      const audio = audioRef.current;
      if (!audio || !wantPlayingRef.current || modeRef.current !== "element") return;
      if (audio.paused) { stallCountRef.current = 0; return; } // reset if deliberately paused
      const now = Date.now();
      const t = audio.currentTime;
      const isIOS = detectIOS();
      const stallThreshold = isIOS ? 8000 : STALL_TIMEOUT_MS;

      // Immediate reconnect if the stream lost its source (e.g. WiFi to 4G drop)
      if (audio.networkState === 3 /* NETWORK_NO_SOURCE */) {
        scheduleReconnect("network-no-source");
        return;
      }

      if (t > lastProgressRef.current.t + 0.05) {
        // Time moved → reset stall counter (good progress)
        lastProgressRef.current = { t, at: now };
        stallCountRef.current = 0;
      } else if (now - lastProgressRef.current.at > stallThreshold) {
        // Time frozen → increment stall counter
        stallCountRef.current++;
        if (stallCountRef.current >= (isIOS ? 1 : STALL_CONSISTENCY)) {
          scheduleReconnect("stall");
          stallCountRef.current = 0;
        }
      }
    }, WATCHDOG_TICK_MS);
  }, [stopWatchdog, scheduleReconnect]);

  // ── Load & play a URL via the <audio> element (desktop + non-iOS path) ─────
  const initElementAudio = useCallback((url: string, force = false) => {
    const currentSession = ++sessionIdRef.current;

    // Same URL already loaded → just toggle play. On a forced reconnect we skip
    // this shortcut and rebuild the element from scratch (the old stream dropped).
    if (!force && audioRef.current && currentUrl === url) {
      if (!isPlaying) {
        ctxRef.current?.resume();
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      return;
    }

    // 1. Hard stop any previous decode pipeline
    if (decoderRef.current) {
      try { decoderRef.current.stop(); } catch {}
      decoderRef.current = null;
    }

    // 2. Clear all reconnect, stall watchdog and connection timers
    clearReconnect();
    stopWatchdog();
    clearConnectTimer();

    // 3. Stop and mute any rogue audio/video elements across the document
    if (typeof document !== "undefined") {
      document.querySelectorAll("audio, video").forEach((el) => {
        if (el !== audioRef.current) {
          try {
            (el as HTMLMediaElement).pause();
            (el as HTMLMediaElement).removeAttribute("src");
            (el as HTMLMediaElement).load();
          } catch {}
        }
      });
    }

    setError(null);
    setIsLoading(true);
    setCurrentUrl(url);

    // Re-use or create the single audio instance (avoids multi-element overlap)
    let audio = audioRef.current;
    const desiredTag = wantVideoRef.current ? "video" : "audio";
    if (!audio || audio.tagName.toLowerCase() !== desiredTag) {
      if (audio) {
        audio.oncanplay = audio.onerror = audio.onplaying = audio.onpause = audio.onwaiting = null;
        audio.ontimeupdate = audio.onloadedmetadata = audio.onended = audio.onstalled = null;
        try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch {}
      }
      audio = document.createElement(desiredTag) as HTMLMediaElement;
      (audio as any).playsInline = true;
      (audio as any).disablePictureInPicture = true;
      audio.setAttribute("webkit-playsinline", "true");
      audioRef.current = audio;
    } else {
      audio.oncanplay = audio.onerror = audio.onplaying = audio.onpause = audio.onwaiting = null;
      audio.ontimeupdate = audio.onloadedmetadata = audio.onended = audio.onstalled = null;
      try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch {}
    }

    let iosEqOptIn = false;
    try { iosEqOptIn = localStorage.getItem("radiofr_ios_eq") === "1"; } catch {}
    audio.crossOrigin = ((!detectIOS() || iosEqOptIn) && isEqCompatible(url)) ? "anonymous" : null;
    audio.volume = volume;
    audio.loop = isLoopingRef.current;
    try {
      audio.playbackRate = playbackRateRef.current;
      audio.defaultPlaybackRate = playbackRateRef.current;
    } catch {}

    let playUrl = url;
    if (force && liveRef.current && !url.startsWith("blob:") && !url.startsWith("data:")) {
      const sep = url.includes("?") ? "&" : "?";
      playUrl = `${url}${sep}_t=${Date.now()}`;
    }
    audio.src = playUrl;
    buildGraph(audio, bands);

    audio.oncanplay = () => {
      if (sessionIdRef.current === currentSession) setIsLoading(false);
    };
    audio.ontimeupdate = () => {
      if (sessionIdRef.current !== currentSession) return;
      setCurrentTime(audio.currentTime);
      if (!liveRef.current) resumeAtRef.current = audio.currentTime;
    };
    audio.onloadedmetadata = () => {
      if (sessionIdRef.current === currentSession) {
        setDuration(isFinite(audio.duration) ? audio.duration : 0);
      }
    };
    audio.onended = () => {
      if (sessionIdRef.current !== currentSession) return;
      if (liveRef.current) { scheduleReconnect("ended"); return; }
      setIsPlaying(false); setCurrentTime(0); onEndedRef.current?.();
    };
    audio.onerror = () => {
      if (sessionIdRef.current !== currentSession) return;
      clearConnectTimer();
      if (audio.crossOrigin === "anonymous" && eqEnabledRef.current) {
        audio.crossOrigin = "";
        eqEnabledRef.current = false;
        setEqActive(false);
        audio.src = url;
        audio.play().catch(() => {
          if (sessionIdRef.current === currentSession) {
            setIsLoading(false);
            scheduleReconnect("error");
          }
        });
      } else {
        if (stationRef.current) {
          const fallback = getNextStreamFallback(stationRef.current, url);
          if (fallback && fallback !== url) {
            audio.src = fallback;
            setCurrentUrl(fallback);
            audio.play().catch(() => {
              if (sessionIdRef.current === currentSession) {
                setIsLoading(false);
                scheduleReconnect("fallback-error");
              }
            });
            return;
          }
        }
        setIsLoading(false);
        scheduleReconnect("error");
      }
    };
    audio.onplaying = () => {
      if (sessionIdRef.current !== currentSession) {
        try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch {}
        return;
      }
      clearConnectTimer();
      setIsPlaying(true);
      setIsLoading(false);
      attemptRef.current = 0;
      setReconnectAttempt(0);
      setReconnecting(false);
      setError(null);
      stallCountRef.current = 0;
      if (!liveRef.current && resumeAtRef.current > 0.5 &&
          Math.abs(audio.currentTime - resumeAtRef.current) > 1.5) {
        try { audio.currentTime = resumeAtRef.current; } catch {}
      }
      startWatchdog();
      if (eqEnabledRef.current) {
        const checkGraphSilent = (attempt: number) => {
          if (sessionIdRef.current !== currentSession) return;
          const a = analyserRef.current;
          if (!a || !eqEnabledRef.current) return;
          const buf = new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(buf);
          const sum = buf.reduce((s, v) => s + v, 0);
          if (sum > 0) return;
          if (attempt < 2) { setTimeout(() => checkGraphSilent(attempt + 1), 1200); return; }
          eqEnabledRef.current = false;
          setEqActive(false);
        };
        setTimeout(() => checkGraphSilent(0), 1500);
      }
    };
    audio.onpause = () => {
      if (sessionIdRef.current !== currentSession) return;
      setIsPlaying(false);
      // Auto-recovery securise par session token:
      // Si la pause n est pas voulue (coupure Bluetooth, notification OS, micro-buffering),
      // et que l intention de lecture persiste, on relance audio.play() apres 1200ms sur la MEME station.
      if (wantPlayingRef.current && !isSleepingNow()) {
        setTimeout(() => {
          if (
            sessionIdRef.current === currentSession &&
            wantPlayingRef.current &&
            audioRef.current === audio &&
            audio.paused &&
            !isSleepingNow()
          ) {
            audio.play().catch(() => {});
          }
        }, 1200);
      }
    };
    audio.onwaiting = () => {
      if (sessionIdRef.current === currentSession) setIsLoading(true);
    };

    ctxRef.current?.resume();
    audio.play().catch(() => {
      if (sessionIdRef.current !== currentSession) return;
      clearConnectTimer();
      setError("Cliquez Play pour démarrer (politique du navigateur).");
      setIsLoading(false);
    });

    connectTimerRef.current = setTimeout(() => {
      connectTimerRef.current = null;
      if (sessionIdRef.current === currentSession && audioRef.current === audio && wantPlayingRef.current) {
        scheduleReconnect("connect-timeout");
      }
    }, CONNECT_TIMEOUT_MS);
  }, [currentUrl, isPlaying, volume, bands, buildGraph, scheduleReconnect, startWatchdog, clearConnectTimer]);

  // ── iOS decode pipeline: fetch → decode MP3 → schedule PCM through the EQ ──
  const startDecodedAudio = useCallback(async (url: string) => {
    const currentSession = ++sessionIdRef.current;
    modeRef.current = "decoder";

    // Tear down any element playback so we don't double-play.
    if (audioRef.current) {
      const old = audioRef.current;
      old.oncanplay = old.onerror = old.onplaying = old.onpause = old.onwaiting = null;
      try {
        old.pause();
        old.removeAttribute("src");
        old.load();
      } catch {}
    }
    if (typeof document !== "undefined") {
      document.querySelectorAll("audio, video").forEach((el) => {
        try {
          (el as HTMLMediaElement).pause();
          (el as HTMLMediaElement).removeAttribute("src");
          (el as HTMLMediaElement).load();
        } catch {}
      });
    }
    // Tear down a previous decoder.
    try { decoderRef.current?.stop(); } catch {}
    decoderRef.current = null;

    setError(null);
    setIsLoading(true);
    setCurrentUrl(url);
    setDuration(0);
    setCurrentTime(0);

    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = ctxRef.current;
    try { await ctx.resume(); } catch {}

    if (sessionIdRef.current !== currentSession) return;

    const input = buildDecoderChain(ctx, bands, volume);
    eqEnabledRef.current = true;
    setEqActive(true);

    // A decoder drop (network/airplane mode) routes the replay through the
    // reliable <audio> element path via the reconnect scheduler.
    const fallback = () => {
      if (sessionIdRef.current !== currentSession) return;
      try { decoderRef.current?.stop(); } catch {}
      decoderRef.current = null;
      modeRef.current = "element";
      eqEnabledRef.current = false;
      setEqActive(false);
      if (wantPlayingRef.current) scheduleReconnect("decoder-drop");
    };

    try {
      // Lazy-load the WASM MP3 decoder so only iOS pays the bundle cost.
      const { playDecodedStream } = await import("@/lib/streamDecoder");
      if (sessionIdRef.current !== currentSession) return;
      const ctrl = await playDecodedStream({
        url, ctx, destination: input,
        onFirstAudio: () => {
          if (sessionIdRef.current !== currentSession) {
            try { ctrl.stop(); } catch {}
            return;
          }
          setIsLoading(false); setIsPlaying(true);
          attemptRef.current = 0; setReconnectAttempt(0); setReconnecting(false); setError(null);
        },
        onError: fallback,
      });
      // A late stop() or station switch may have fired while we awaited — honour it.
      if (sessionIdRef.current !== currentSession || modeRef.current !== "decoder") {
        try { ctrl.stop(); } catch {}
        return;
      }
      decoderRef.current = ctrl;
      setIsPlaying(true);
    } catch {
      if (sessionIdRef.current === currentSession) {
        fallback();
      }
    }
  }, [bands, volume, buildDecoderChain, scheduleReconnect]);

  // ── Public entry point: pick the right pipeline ───────────────────────────
  // `live` (radio) streams on iOS that are MP3 + CORS-friendly go through the
  // decode pipeline so the EQ works; everything else uses the <audio> element.
  const initAudio = useCallback((url: string, opts?: { live?: boolean; video?: boolean; forceSwitch?: boolean; station?: StreamCandidateStation }) => {
    const live = opts?.live ?? true;
    wantVideoRef.current = !!opts?.video;
    if (opts?.station) stationRef.current = opts.station;

    // Record the intent + exact params so a drop can replay this same pipeline.
    // Any fresh initAudio also cancels a pending retry → fast station switching
    // never leaves an old reconnect timer firing on top of the new stream.
    wantPlayingRef.current = true;
    liveRef.current = live;
    lastInitRef.current = { url, live, video: !!opts?.video };
    clearReconnect();
    stopWatchdog();
    clearConnectTimer();
    attemptRef.current = 0;
    setReconnectAttempt(0);
    setReconnecting(false);
    resumeAtRef.current = 0;

    // Same source already loaded → just resume if paused (unless forced switch requested).
    if (!opts?.forceSwitch && currentUrl === url && (audioRef.current || decoderRef.current)) {
      if (!isPlaying) {
        ctxRef.current?.resume();
        if (modeRef.current === "decoder") startDecodedAudio(url);
        else { audioRef.current?.play().catch(console.error); setIsPlaying(true); }
      }
      return;
    }

    // On iOS the Web Audio decode pipeline gets suspended when the screen
    // locks, which would cut live radio in the background. So we default to the
    // plain <audio> element (keeps playing on lock-screen) and only use the
    // EQ-capable decoder if the user explicitly opted in via Settings.
    let iosEqOptIn = false;
    try { iosEqOptIn = localStorage.getItem("radiofr_ios_eq") === "1"; } catch {}
    // The JS decode pipeline is more CPU-hungry than the Web Audio graph it
    // replaces on iOS — skip it under low-battery too, even if EQ was opted in.
    const isMpeg = !/\.(aac|m3u8|ogg|flac|opus|m4a)(\?|$)/i.test(url);
    const useDecoder = live && iosEqOptIn && detectIOS() && !lowBatteryMode() && isEqCompatible(url) && isMpeg;
    if (useDecoder) {
      startDecodedAudio(url);
    } else {
      try { decoderRef.current?.stop(); } catch {}
      decoderRef.current = null;
      modeRef.current = "element";
      initElementAudio(url, !!opts?.forceSwitch);
    }
  }, [currentUrl, isPlaying, startDecodedAudio, initElementAudio, clearReconnect, stopWatchdog, clearConnectTimer]);

  // ── Reconnect executor ─────────────────────────────────────────────────────
  // Replays lastInitRef through the exact same pipeline initAudio would pick.
  // The element path is forced (force=true) so the "same URL" shortcut can't
  // short-circuit the rebuild of a stream that just dropped.
  const reconnectNow = useCallback(() => {
    const last = lastInitRef.current;
    if (!last || !wantPlayingRef.current) return;
    setReconnecting(true);
    setIsLoading(true);
    let iosEqOptIn = false;
    try { iosEqOptIn = localStorage.getItem("radiofr_ios_eq") === "1"; } catch {}
    const isMpeg = !/\.(aac|m3u8|ogg|flac|opus|m4a)(\?|$)/i.test(last.url);
    const useDecoder = last.live && iosEqOptIn && detectIOS() && !lowBatteryMode() &&
      isEqCompatible(last.url) && isMpeg;
    if (useDecoder) {
      startDecodedAudio(last.url);
    } else {
      try { decoderRef.current?.stop(); } catch {}
      decoderRef.current = null;
      modeRef.current = "element";
      wantVideoRef.current = last.video;
      initElementAudio(last.url, true);
    }
  }, [startDecodedAudio, initElementAudio]);

  // Wire the executor into the ref the backoff timer calls (breaks the cycle).
  useEffect(() => { doReconnectRef.current = reconnectNow; }, [reconnectNow]);

  // Immediate hot-swap when settings change (e.g. user toggles "Égaliseur sur iPhone" in Settings)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSettingsChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.key === "ios_eq" || detail?.key === "low_battery") {
        const last = lastInitRef.current;
        if (last && (wantPlayingRef.current || isPlaying || audioRef.current || decoderRef.current)) {
          let iosEqOptIn = false;
          try { iosEqOptIn = localStorage.getItem("radiofr_ios_eq") === "1"; } catch {}
          const isMpeg = !/\.(aac|m3u8|ogg|flac|opus|m4a)(\?|$)/i.test(last.url);
          const useDecoder = last.live && iosEqOptIn && detectIOS() && !lowBatteryMode() &&
            isEqCompatible(last.url) && isMpeg;

          if (useDecoder) {
            startDecodedAudio(last.url);
          } else {
            try { decoderRef.current?.stop(); } catch {}
            decoderRef.current = null;
            modeRef.current = "element";
            wantVideoRef.current = last.video;
            initElementAudio(last.url, true);
          }
        }
      }
    };
    window.addEventListener("radiofr:settings-changed", handleSettingsChange);
    return () => window.removeEventListener("radiofr:settings-changed", handleSettingsChange);
  }, [isPlaying, startDecodedAudio, initElementAudio]);

  const play = useCallback(() => {
    wantPlayingRef.current = true;
    // If the retry budget was already spent, a manual Play resets it so the
    // backoff can start fresh from this deliberate user action.
    if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      attemptRef.current = 0; setReconnectAttempt(0); clearReconnect();
    }
    ctxRef.current?.resume();
    if (modeRef.current === "decoder") {
      if (!decoderRef.current && currentUrl) startDecodedAudio(currentUrl);
      setIsPlaying(true);
    } else {
      audioRef.current?.play().catch(console.error);
    }
  }, [currentUrl, startDecodedAudio, clearReconnect]);

  const pause = useCallback(() => {
    // Deliberate pause → invalidate any in-flight promises & timers
    sessionIdRef.current++;
    wantPlayingRef.current = false;
    clearReconnect();
    stopWatchdog();
    clearConnectTimer();
    setReconnecting(false);
    setIsLoading(false);
    if (modeRef.current === "decoder") {
      // Live stream → stop the fetch/decode loop; play() rejoins live.
      try { decoderRef.current?.stop(); } catch {}
      decoderRef.current = null;
      setIsPlaying(false);
    } else {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
    // Suspend the Web Audio graph so the browser can idle the audio render
    // thread instead of continuously processing (silent) buffers — a real
    // CPU/battery cost while paused that most users never notice is happening.
    try { ctxRef.current?.suspend(); } catch {}
  }, [clearReconnect, stopWatchdog, clearConnectTimer]);

  // ── Sleep timer ─────────────────────────────────────────────────────────────
  // A one-off countdown ("stop in N minutes") for falling asleep to the radio —
  // distinct from "Mode Sommeil" above, which is a recurring daily clock-time
  // window. cancelSleepTimer clears it; addSleepMinutes both arms a fresh timer
  // and *extends* a running one (tapping +10 twice = 20 min), which is why it
  // reads the real end timestamp from a ref rather than the rounded display
  // value in state.
  const cancelSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) { clearTimeout(sleepTimeoutRef.current); sleepTimeoutRef.current = null; }
    if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
    sleepTimerEndAtRef.current = null;
    setSleepTimerRemaining(null);
  }, []);

  const armSleepTimer = useCallback((endAt: number) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    sleepTimerEndAtRef.current = endAt;
    const tick = () => setSleepTimerRemaining(Math.max(0, Math.round((endAt - Date.now()) / 1000)));
    tick();
    sleepTickRef.current = setInterval(tick, 1000);

    const msUntilEnd = Math.max(0, endAt - Date.now());
    const fadeDurationSec = Math.min(5, Math.max(1, msUntilEnd / 1000));
    const msBeforeFade = Math.max(0, msUntilEnd - fadeDurationSec * 1000);

    sleepTimeoutRef.current = setTimeout(() => {
      const g = gainRef.current;
      const ctx = ctxRef.current;
      if (g && ctx && ctx.state === "running") {
        fadeOut(g, fadeDurationSec, ctx, () => {
          pause();
          cancelSleepTimer();
          try { g.gain.setValueAtTime(volume, ctx.currentTime); } catch {}
        });
      } else {
        pause();
        cancelSleepTimer();
      }
    }, msBeforeFade);
  }, [pause, cancelSleepTimer, volume]);

  const addSleepMinutes = useCallback((minutes: number) => {
    const now = Date.now();
    const base = sleepTimerEndAtRef.current && sleepTimerEndAtRef.current > now ? sleepTimerEndAtRef.current : now;
    armSleepTimer(base + minutes * 60000);
  }, [armSleepTimer]);

  const togglePlay = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, play, pause]);

  const changeVolume = useCallback((v: number) => {
    const safeVol = Math.max(0, Math.min(1, v));
    setVolume(safeVol);
    const g = gainRef.current;
    const ctx = ctxRef.current;
    if (g) {
      // Web Audio path: volume lives on the GainNode; keep the element at unity.
      if (audioRef.current) audioRef.current.volume = 1;
      try {
        if (ctx && ctx.state !== "closed" && ctx.currentTime > 0) {
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
          g.gain.linearRampToValueAtTime(safeVol, ctx.currentTime + 0.025);
        } else {
          g.gain.value = safeVol;
        }
      } catch {
        g.gain.value = safeVol;
      }
    } else if (audioRef.current) {
      // No graph (CORS fallback) → drive the element directly.
      audioRef.current.volume = safeVol;
    }
  }, []);

  // Apply a gain change to a live BiquadFilter node with smooth ramping.
  // iOS Safari does NOT recompute filter coefficients on direct `.gain.value = x`
  // assignment while the node is already connected & playing — the change is
  // silently ignored. linearRampToValueAtTime(...) schedules it smoothly on the
  // audio timeline, forces coefficient recompute, and eliminates zipper noise / pops.
  const setFilterGain = useCallback((f: BiquadFilterNode | undefined, gain: number) => {
    if (!f) return;
    const ctx = ctxRef.current;
    try {
      if (ctx && ctx.state !== "closed" && ctx.currentTime > 0) {
        f.gain.cancelScheduledValues(ctx.currentTime);
        f.gain.setValueAtTime(f.gain.value, ctx.currentTime);
        f.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.03);
      } else {
        f.gain.value = gain;
      }
    } catch {
      f.gain.value = gain;
    }
  }, []);

  const updateBand = useCallback((index: number, gain: number) => {
    setBands((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], gain };
      return next;
    });
    setFilterGain(filtersRef.current[index], gain);
  }, [setFilterGain]);

  const applyPreset = useCallback((gains: number[]) => {
    setBands((prev) => prev.map((b, i) => ({ ...b, gain: gains[i] ?? 0 })));
    gains.forEach((g, i) => setFilterGain(filtersRef.current[i], g));
  }, [setFilterGain]);

  const resetEQ = useCallback(() => applyPreset(Array(10).fill(0)), [applyPreset]);

  const seekTo = useCallback((t: number) => {
    if (audioRef.current && isFinite(t)) {
      audioRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, []);

  const seekRelative = useCallback((deltaSeconds: number) => {
    if (audioRef.current && isFinite(audioRef.current.currentTime)) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      const target = Math.max(0, Math.min(isFinite(dur) && dur > 0 ? dur : Infinity, current + deltaSeconds));
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
    if (audioRef.current) {
      try {
        audioRef.current.playbackRate = rate;
        audioRef.current.defaultPlaybackRate = rate;
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      changeVolume(0);
    } else {
      changeVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.8);
    }
  }, [volume, changeVolume]);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev;
      isLoopingRef.current = next;
      if (audioRef.current) {
        audioRef.current.loop = next;
      }
      return next;
    });
  }, []);

  const toggleNightMode = useCallback(() => {
    setNightMode((prev) => {
      const next = !prev;
      nightModeRef.current = next;
      const comp = compressorRef.current;
      const ctx = ctxRef.current;
      if (comp && ctx && ctx.state !== "closed") {
        try {
          if (next) {
            comp.threshold.setValueAtTime(-30, ctx.currentTime);
            comp.knee.setValueAtTime(30, ctx.currentTime);
            comp.ratio.setValueAtTime(12, ctx.currentTime);
            comp.attack.setValueAtTime(0.003, ctx.currentTime);
            comp.release.setValueAtTime(0.25, ctx.currentTime);
          } else {
            comp.threshold.setValueAtTime(0, ctx.currentTime);
            comp.ratio.setValueAtTime(1, ctx.currentTime);
          }
        } catch {}
      }
      return next;
    });
  }, []);

  const setStereoPan = useCallback((pan: number) => {
    const clamped = Math.max(-1, Math.min(1, pan));
    stereoPanRef.current = clamped;
    setStereoPanState(clamped);
    const panner = pannerRef.current;
    const ctx = ctxRef.current;
    if (panner && ctx && ctx.state !== "closed") {
      try {
        if (ctx.currentTime > 0) {
          panner.pan.cancelScheduledValues(ctx.currentTime);
          panner.pan.setValueAtTime(panner.pan.value, ctx.currentTime);
          panner.pan.linearRampToValueAtTime(clamped, ctx.currentTime + 0.03);
        } else {
          panner.pan.value = clamped;
        }
      } catch {
        panner.pan.value = clamped;
      }
    }
  }, []);

  const toggleSpatialAudio = useCallback(() => {
    setSpatialAudio((prev) => {
      const next = !prev;
      spatialAudioRef.current = next;
      // When spatial audio is enabled, apply a wider EQ curve (slight boost at 64Hz and 8kHz/16kHz, slight dip at 500Hz)
      if (next) {
        applyPreset([4, 3, 1, 0, -2, 0, 1, 3, 5, 6]);
      } else {
        resetEQ();
      }
      return next;
    });
  }, [applyPreset, resetEQ]);

  const stop = useCallback(() => {
    // Full stop → cancel any reconnection and forget the source.
    sessionIdRef.current++;
    wantPlayingRef.current = false;
    clearReconnect();
    stopWatchdog();
    clearConnectTimer();
    lastInitRef.current = null;
    attemptRef.current = 0;
    setReconnectAttempt(0);
    setReconnecting(false);
    setError(null);
    modeRef.current = "element";
    try { decoderRef.current?.stop(); } catch {}
    decoderRef.current = null;
    if (audioRef.current) {
      const old = audioRef.current;
      old.oncanplay = null;
      old.onerror = null;
      old.onplaying = null;
      old.onpause = null;
      old.onwaiting = null;
      old.ontimeupdate = null;
      old.onloadedmetadata = null;
      old.onended = null;
      old.onstalled = null;
      try {
        old.pause();
        old.removeAttribute("src");
        old.load();
      } catch {}
      audioRef.current = null;
    }
    if (typeof document !== "undefined") {
      document.querySelectorAll("audio, video").forEach((el) => {
        try {
          (el as HTMLMediaElement).pause();
          (el as HTMLMediaElement).removeAttribute("src");
          (el as HTMLMediaElement).load();
        } catch {}
      });
    }
    setIsPlaying(false);
    setCurrentUrl(null);
    setCurrentTime(0);
    setDuration(0);
    // Same rationale as pause(): let the audio thread idle instead of
    // rendering silence indefinitely.
    try { ctxRef.current?.suspend(); } catch {}
  }, [clearReconnect, stopWatchdog, clearConnectTimer]);

  // ── online / offline ───────────────────────────────────────────────────────
  // Going offline pauses the retry loop (so we don't burn attempts on a dead
  // link) and shows a "connexion perdue" state; coming back online resumes
  // immediately with a fresh budget.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOffline = () => {
      setOffline(true);
      clearReconnect();
      stopWatchdog();
      clearConnectTimer();
      if (wantPlayingRef.current) { setReconnecting(false); setError(null); }
    };
    const onOnline = () => {
      setOffline(false);
      if (wantPlayingRef.current) {
        attemptRef.current = 0;
        setReconnectAttempt(0);
        reconnectNow();
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [clearReconnect, stopWatchdog, clearConnectTimer, reconnectNow]);

  // ── Resume after coming back to the foreground ─────────────────────────────
  // A longer interruption (phone call, screen-off power saving, another app
  // holding the audio focus for a while) can leave the element paused or the
  // AudioContext suspended well past the single delayed retry in onpause. The
  // moment the tab/app is visible again is the reliable signal that whatever
  // held the focus has let go — worth one more attempt right then instead of
  // waiting on the next watchdog tick or making the user tap Play themselves.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !wantPlayingRef.current) return;
      if (isSleepingNow()) return; // e.g. a call ends mid-bedtime → stay paused
      if (ctxRef.current?.state === "suspended") ctxRef.current.resume().catch(() => {});
      if (modeRef.current === "element" && audioRef.current?.paused) {
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // ── Sleep schedule ("Mode Sommeil") ─────────────────────────────────────────
  // Polls rather than scheduling a single timeout at the boundary because the
  // window (and whether it's even enabled) can change anytime from Settings,
  // and a plain interval trivially handles that without re-arming timers.
  // Edge-triggered on purpose: wasSleepingRef only lets the pause fire once per
  // false→true transition into the window. Without it, a user who manually
  // hits Play to override the sleep mode would just get paused again on the
  // very next 20s tick (still "sleeping" == true) — the interval would fight
  // its own promised escape hatch. Only a later false→true transition (i.e.
  // tomorrow night) auto-pauses again.
  const wasSleepingRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      const sleeping = isSleepingNow();
      if (sleeping && !wasSleepingRef.current && wantPlayingRef.current) pause();
      wasSleepingRef.current = sleeping;
    };
    check(); // covers opening the app while already inside the window
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [pause]);

  useEffect(() => () => {
    clearReconnect();
    stopWatchdog();
    clearConnectTimer();
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    try { decoderRef.current?.stop(); } catch {}
    decoderRef.current = null;
    if (audioRef.current) {
      const old = audioRef.current;
      old.oncanplay = null;
      old.onerror = null;
      old.onplaying = null;
      old.onpause = null;
      old.onwaiting = null;
      old.ontimeupdate = null;
      old.onloadedmetadata = null;
      old.onended = null;
      old.onstalled = null;
      old.pause();
      old.src = "";
      old.load();
      audioRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    filtersRef.current.forEach((f) => { try { f.disconnect(); } catch {} });
    filtersRef.current = [];
    try { ctxRef.current?.close(); } catch {}
  }, [clearReconnect, stopWatchdog, clearConnectTimer]);

  // Manual "Réessayer" button (last resort after the budget is spent).
  const retry = useCallback(() => {
    wantPlayingRef.current = true;
    attemptRef.current = 0;
    setReconnectAttempt(0);
    clearReconnect();
    setError(null);
    reconnectNow();
  }, [clearReconnect, reconnectNow]);

  return {
    isPlaying, volume, currentUrl, bands, isLoading, error, eqActive,
    currentTime, duration,
    reconnecting, reconnectAttempt, offline,
    analyserRef, filtersRef, mediaElRef: audioRef,
    initAudio, play, pause, togglePlay, seekTo,
    changeVolume, updateBand, applyPreset, resetEQ, stop,
    setOnEnded, retry,
    playbackRate, setPlaybackRate, seekRelative,
    sleepTimerRemaining, addSleepMinutes, cancelSleepTimer,
    isLooping, toggleLoop,
    nightMode, toggleNightMode,
    stereoPan, setStereoPan,
    spatialAudio, toggleSpatialAudio,
    toggleMute,
  };
}
