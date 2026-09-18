"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import type { DecodeController } from "@/lib/streamDecoder";
import { isEqCompatible } from "@/lib/stations";

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
const CONNECT_TIMEOUT_MS = 12000;

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

  const [reconnecting,     setReconnecting]     = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [offline,          setOffline]          = useState(false);

  // ── Build the Web Audio graph ──────────────────────────────────────────────
  const buildGraph = useCallback((audio: HTMLMediaElement, currentBands: EQBand[]) => {
    // On iOS the element gets routed to hardware and the graph only receives
    // silence (EQ never works this way), while wrapping the element in a
    // MediaElementSource can also stop playback when the screen locks. So on
    // iOS we leave the <audio> element untouched → reliable background playback.
    // Low-battery mode opts out the same way, on purpose, to skip the graph's
    // ongoing CPU cost (filters + analyser) even on desktop.
    if (detectIOS() || lowBatteryMode()) {
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

    // source → filter[0] → … → filter[9] → analyser → gain → destination
    let node: AudioNode = source;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
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

    // (PCM) → filter[0] → … → filter[9] → analyser → gain → destination
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
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

    // Stop & release previous — null ALL handlers first or onerror fires
    // and re-sets the src, causing the old stream to restart on top of the new one
    if (audioRef.current) {
      const old = audioRef.current;
      old.oncanplay  = null;
      old.onerror    = null;
      old.onplaying  = null;
      old.onpause    = null;
      old.onwaiting  = null;
      old.pause();
      old.src = "";
      old.load();      // abort any in-flight HTTP request
    }
    clearConnectTimer(); // a fresh connect attempt starts below — drop the old one's timer

    setError(null);
    setIsLoading(true);
    setCurrentUrl(url);

    // Element type matters for iOS background playback: iOS Safari PAUSES a
    // <video> element as soon as the screen locks / the tab backgrounds, but
    // keeps an <audio> element playing. So only spin up a <video> when the
    // episode actually has a picture to show; everything else (radio, music,
    // audio podcasts) uses <audio> so the sound survives a screen-off / lock.
    const audio = document.createElement(wantVideoRef.current ? "video" : "audio") as HTMLMediaElement;
    (audio as any).playsInline = true;  // never auto-fullscreen on iOS (no-op on <audio>)
    (audio as any).disablePictureInPicture = true;
    audio.setAttribute("webkit-playsinline", "true");
    // crossOrigin="anonymous" is only needed to feed the Web Audio EQ graph, and
    // it has a real cost: most radio streams (all of Web Radio's radio-browser.info
    // catalogue, RTL/NRJ, etc.) don't send CORS headers or sit behind a redirect to
    // a cast-point server that doesn't either. Forcing crossOrigin="anonymous" on
    // those makes the browser refuse the (opaque, cross-origin) redirect/response
    // outright — the stream never starts or drops immediately, which is the main
    // cause of "ça bloque / s'arrête souvent" across the station catalogue. Only
    // request CORS mode for the small whitelist of hosts known to actually send
    // the header (EQ_CORS_HOSTS) — everything else loads in plain mode, exactly
    // like iOS already does, and plays reliably (just without the EQ tap).
    audio.crossOrigin = (!detectIOS() && isEqCompatible(url)) ? "anonymous" : null;
    audio.volume = volume;
    try {
      audio.playbackRate = playbackRateRef.current;
      audio.defaultPlaybackRate = playbackRateRef.current;
    } catch {}
    audioRef.current = audio;

    // Set src FIRST, then build the Web Audio graph. iOS Safari binds
    // createMediaElementSource to silence if the element has no source loaded
    // yet, so the element must already point at a stream before we tap it.
    // On forced reconnect of live radio, append a cache-buster query parameter so
    // iOS Safari / Chrome doesn't replay stale or stalled byte segments from internal cache.
    let playUrl = url;
    if (force && liveRef.current && !url.startsWith("blob:") && !url.startsWith("data:")) {
      const sep = url.includes("?") ? "&" : "?";
      playUrl = `${url}${sep}_t=${Date.now()}`;
    }
    audio.src = playUrl;
    buildGraph(audio, bands);

    audio.oncanplay      = () => setIsLoading(false);
    audio.ontimeupdate   = () => {
      setCurrentTime(audio.currentTime);
      // Remember the position so a non-live reconnect resumes where we left off.
      if (!liveRef.current) resumeAtRef.current = audio.currentTime;
    };
    audio.onloadedmetadata = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    audio.onended        = () => {
      // A live stream that "ends" actually dropped → reconnect at the live edge.
      if (liveRef.current) { scheduleReconnect("ended"); return; }
      setIsPlaying(false); setCurrentTime(0); onEndedRef.current?.();
    };
    // onstalled alone is not enough to trigger reconnect (can be normal buffering).
    // The watchdog detects true stalls (currentTime frozen 15+ seconds).
    audio.onerror    = () => {
      clearConnectTimer();
      // Only reconnect on error. If CORS+EQ is available, try the fallback path.
      if (audio.crossOrigin === "anonymous" && eqEnabledRef.current) {
        // CORS headers said "no" → try without CORS (lose EQ but often works).
        audio.crossOrigin = "";
        eqEnabledRef.current = false;
        setEqActive(false);
        audio.src = url;
        audio.play().catch(() => { setIsLoading(false); scheduleReconnect("error"); });
      } else {
        // Real load/network failure → schedule a reconnect instead of dying.
        setIsLoading(false);
        scheduleReconnect("error");
      }
    };
    audio.onplaying = () => {
      clearConnectTimer();
      setIsPlaying(true);
      setIsLoading(false);
      // A successful (re)start clears any reconnect state.
      attemptRef.current = 0;
      setReconnectAttempt(0);
      setReconnecting(false);
      setError(null);
      stallCountRef.current = 0;
      // Non-live reconnect: jump back to where we were (if meaningfully off).
      // Only do this on a real reconnect (resumeAtRef > 0), not on normal play.
      if (!liveRef.current && resumeAtRef.current > 0.5 &&
          Math.abs(audio.currentTime - resumeAtRef.current) > 1.5) {
        try { audio.currentTime = resumeAtRef.current; } catch {}
      }
      startWatchdog();
      // iOS Safari routes MediaElementSource audio straight to hardware and feeds
      // SILENCE into the Web Audio graph — so the EQ filters never touch the sound.
      // Detect it (analyser stays all-zero while audio is audible) and honestly mark
      // EQ unavailable instead of pretending it works.
      if (eqEnabledRef.current) {
        const checkGraphSilent = (attempt: number) => {
          const a = analyserRef.current;
          if (!a || !eqEnabledRef.current) return;
          const buf = new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(buf);
          const sum = buf.reduce((s, v) => s + v, 0);
          if (sum > 0) return;               // graph is live → EQ works
          if (attempt < 2) { setTimeout(() => checkGraphSilent(attempt + 1), 1200); return; }
          eqEnabledRef.current = false;       // 3 silent reads → graph bypassed (iOS)
          setEqActive(false);
        };
        setTimeout(() => checkGraphSilent(0), 1500);
      }
    };
    audio.onpause   = () => {
      setIsPlaying(false);
      // Only our own pause()/stop() flip wantPlayingRef to false. If it's still
      // true here, something else paused the element out from under us — a
      // phone call, Siri, another app grabbing the audio focus, a Bluetooth
      // route change, headphones unplugged. The OS doesn't resume these for
      // us, so without this the stream just sits silently paused forever and
      // it looks to the user like a random dropout. One delayed retry covers
      // the common short interruptions; the visibilitychange handler below
      // covers longer ones (phone call) once the user comes back to the tab.
      if (wantPlayingRef.current && !isSleepingNow()) {
        setTimeout(() => {
          if (wantPlayingRef.current && audioRef.current === audio && audio.paused && !isSleepingNow()) {
            audio.play().catch(() => {});
          }
        }, 1200);
      }
    };
    audio.onwaiting = () => setIsLoading(true);

    ctxRef.current?.resume();
    audio.play().catch(() => {
      clearConnectTimer();
      setError("Cliquez Play pour démarrer (politique du navigateur).");
      setIsLoading(false);
    });
    // Guard the connect phase itself: if `onplaying` never fires (dead mount,
    // hung redirect, silently-refused connection), the stall watchdog below
    // can't help — it only starts once playback has actually begun. This is
    // the only thing that recovers a stream stuck at "chargement…" forever.
    connectTimerRef.current = setTimeout(() => {
      connectTimerRef.current = null;
      // Still the current element and `onplaying` never fired → genuinely hung.
      if (audioRef.current === audio && wantPlayingRef.current) {
        scheduleReconnect("connect-timeout");
      }
    }, CONNECT_TIMEOUT_MS);
  }, [currentUrl, isPlaying, volume, bands, buildGraph, scheduleReconnect, startWatchdog, clearConnectTimer]);

  // ── iOS decode pipeline: fetch → decode MP3 → schedule PCM through the EQ ──
  const startDecodedAudio = useCallback(async (url: string) => {
    modeRef.current = "decoder";

    // Tear down any element playback so we don't double-play.
    if (audioRef.current) {
      const old = audioRef.current;
      old.oncanplay = old.onerror = old.onplaying = old.onpause = old.onwaiting = null;
      old.pause(); old.src = ""; old.load();
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

    const input = buildDecoderChain(ctx, bands, volume);
    eqEnabledRef.current = true;
    setEqActive(true);

    // A decoder drop (network/airplane mode) routes the replay through the
    // reliable <audio> element path via the reconnect scheduler.
    const fallback = () => {
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
      const ctrl = await playDecodedStream({
        url, ctx, destination: input,
        onFirstAudio: () => {
          setIsLoading(false); setIsPlaying(true);
          attemptRef.current = 0; setReconnectAttempt(0); setReconnecting(false); setError(null);
        },
        onError: fallback,
      });
      // A late stop() may have fired while we awaited — honour it.
      if (modeRef.current !== "decoder") { try { ctrl.stop(); } catch {} return; }
      decoderRef.current = ctrl;
      setIsPlaying(true);
    } catch {
      fallback();
    }
  }, [bands, volume, buildDecoderChain, scheduleReconnect]);

  // ── Public entry point: pick the right pipeline ───────────────────────────
  // `live` (radio) streams on iOS that are MP3 + CORS-friendly go through the
  // decode pipeline so the EQ works; everything else uses the <audio> element.
  const initAudio = useCallback((url: string, opts?: { live?: boolean; video?: boolean }) => {
    const live = opts?.live ?? true;
    wantVideoRef.current = !!opts?.video;

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

    // Same source already loaded → just resume if paused.
    if (currentUrl === url && (audioRef.current || decoderRef.current)) {
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
    const useDecoder = live && iosEqOptIn && detectIOS() && !lowBatteryMode() && isEqCompatible(url) && /\.mp3(\?|$)/i.test(url);
    if (useDecoder) {
      startDecodedAudio(url);
    } else {
      try { decoderRef.current?.stop(); } catch {}
      decoderRef.current = null;
      modeRef.current = "element";
      initElementAudio(url);
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
    const useDecoder = last.live && iosEqOptIn && detectIOS() && !lowBatteryMode() &&
      isEqCompatible(last.url) && /\.mp3(\?|$)/i.test(last.url);
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
    // Deliberate pause → no reconnection on the resulting stream drop.
    wantPlayingRef.current = false;
    clearReconnect();
    stopWatchdog();
    clearConnectTimer();
    setReconnecting(false);
    if (modeRef.current === "decoder") {
      // Live stream → stop the fetch/decode loop; play() rejoins live.
      try { decoderRef.current?.stop(); } catch {}
      decoderRef.current = null;
      setIsPlaying(false);
    } else {
      audioRef.current?.pause();
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
    sleepTimeoutRef.current = setTimeout(() => { pause(); cancelSleepTimer(); }, Math.max(0, endAt - Date.now()));
  }, [pause, cancelSleepTimer]);

  const addSleepMinutes = useCallback((minutes: number) => {
    const now = Date.now();
    const base = sleepTimerEndAtRef.current && sleepTimerEndAtRef.current > now ? sleepTimerEndAtRef.current : now;
    armSleepTimer(base + minutes * 60000);
  }, [armSleepTimer]);

  const togglePlay = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, play, pause]);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    const g = gainRef.current;
    const ctx = ctxRef.current;
    if (g) {
      // Web Audio path: volume lives on the GainNode; keep the element at unity.
      if (audioRef.current) audioRef.current.volume = 1;
      try {
        if (ctx && ctx.state !== "closed") g.gain.setValueAtTime(v, ctx.currentTime);
        else g.gain.value = v;
      } catch { g.gain.value = v; }
    } else if (audioRef.current) {
      // No graph (CORS fallback) → drive the element directly.
      audioRef.current.volume = v;
    }
  }, []);

  // Apply a gain change to a live BiquadFilter node.
  // iOS Safari does NOT recompute filter coefficients on direct `.gain.value = x`
  // assignment while the node is already connected & playing — the change is
  // silently ignored. setValueAtTime(...) schedules it on the audio timeline and
  // forces the recompute. We use ctx.currentTime (always > 0 on a running ctx),
  // and fall back to direct assignment if scheduling throws.
  const setFilterGain = useCallback((f: BiquadFilterNode | undefined, gain: number) => {
    if (!f) return;
    const ctx = ctxRef.current;
    try {
      if (ctx && ctx.state !== "closed") {
        f.gain.setValueAtTime(gain, ctx.currentTime);
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

  const stop = useCallback(() => {
    // Full stop → cancel any reconnection and forget the source.
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
    audioRef.current?.pause();
    if (audioRef.current) { audioRef.current.src = ""; audioRef.current.load(); }
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
    audioRef.current?.pause();
    ctxRef.current?.close();
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
  };
}
