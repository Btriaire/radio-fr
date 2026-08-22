"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MusicTrack, searchAllMusic, playableUrl, sourceBadge } from "@/lib/musicSearch";
import { loadYouTubeAPI, createYouTubePlayer, YTController } from "@/lib/youtubePlayer";

interface Props {
  open: boolean;
  onClose: () => void;
}

type DeckId = "A" | "B";

interface DeckNodes {
  audio: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  vol: GainNode;
  cross: GainNode;
  analyser: AnalyserNode;
}

interface Engine {
  ctx: AudioContext;
  decks: Record<DeckId, DeckNodes>;
  masterFilter: BiquadFilterNode;
  masterGain: GainNode;
  echoDelay: DelayNode;
  echoFeedback: GainNode;
  echoWet: GainNode;
  // ── Extra master-FX sends (each parallel to the dry path; wet=0 when off) ──
  reverb: ConvolverNode;
  reverbWet: GainNode;
  flangerDelay: DelayNode;
  flangerFb: GainNode;
  flangerLFO: OscillatorNode;
  flangerDepth: GainNode;
  flangerWet: GainNode;
  shaper: WaveShaperNode;
  crushWet: GainNode;
  gateGain: GainNode;
  gateLFO: OscillatorNode;
  gateDepth: GainNode;
  gateWet: GainNode;
  // PHASER (allpass chain swept by an LFO)
  phaserStages: BiquadFilterNode[];
  phaserLFO: OscillatorNode;
  phaserDepth: GainNode;
  phaserWet: GainNode;
  // TREMOLO (smooth amplitude wobble)
  tremGain: GainNode;
  tremLFO: OscillatorNode;
  tremDepth: GainNode;
  tremWet: GainNode;
  // AUTO-WAH (resonant bandpass swept by an LFO)
  wahFilter: BiquadFilterNode;
  wahLFO: OscillatorNode;
  wahDepth: GainNode;
  wahWet: GainNode;
  // RISER / NOISE-SWEEP (looping white noise through a swept bandpass)
  noiseSrc: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  noiseLFO: OscillatorNode;
  noiseDepth: GainNode;
  noiseWet: GainNode;
}

interface DeckState {
  track: MusicTrack | null;
  kind: "audio" | "youtube"; // "audio" = HTMLAudio→WebAudio (EQ/FX); "youtube" = hidden IFrame (no EQ/FX)
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  tempo: number; // 0.90 .. 1.10
  volume: number; // 0 .. 1
  eq: { low: number; mid: number; high: number }; // dB, -26..+8
  cue: number | null;
  loop: boolean;
  loopLen: number; // active-loop length in seconds
}

const FRESH = (): DeckState => ({
  track: null, kind: "audio", playing: false, loading: false, time: 0, duration: 0,
  tempo: 1, volume: 0.85, eq: { low: 0, mid: 0, high: 0 }, cue: null, loop: false, loopLen: 0.5,
});

// YouTube only exposes a discrete set of playback rates via the IFrame API.
function nearestYtRate(v: number): number {
  const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  return rates.reduce((p, c) => (Math.abs(c - v) < Math.abs(p - v) ? c : p), 1);
}

const DECK_COLOR: Record<DeckId, string> = { A: "#22d3ee", B: "#f472b6" };
const PICKER_TAGS = ["Lofi", "House", "Techno", "Funk", "Jazz", "Hip Hop", "Disco", "Ambient", "Soul", "Breaks"];

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Synthetic reverb tail (no external IR file needed): exponentially-decaying
// stereo noise → ConvolverNode impulse response.
function makeImpulse(ctx: AudioContext, seconds = 2.6, decay = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// Soft-clip drive curve for the WaveShaper (CRUSH/DRIVE effect).
function makeDriveCurve(amount = 60): Float32Array {
  const n = 2048;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

const FX_KEYS = ["reverb", "flanger", "phaser", "tremolo", "autowah", "crush", "gate", "noise"] as const;
type FxKey = (typeof FX_KEYS)[number];
// Max wet-send level per effect at intensity = 1 (sends are additive, so some
// exceed 1.0 to stay audible against the dry signal).
const FX_MAX: Record<FxKey, number> = {
  reverb: 1.0, flanger: 1.2, phaser: 1.1, tremolo: 1.0,
  autowah: 1.1, crush: 1.0, gate: 1.2, noise: 0.6,
};
// FX rack metadata (label + accent colour), in display order.
const FX_META: { k: FxKey; label: string; c: string }[] = [
  { k: "reverb", label: "REVERB", c: "#60a5fa" },
  { k: "flanger", label: "FLANGER", c: "#a78bfa" },
  { k: "phaser", label: "PHASER", c: "#22d3ee" },
  { k: "tremolo", label: "TREMOLO", c: "#fbbf24" },
  { k: "autowah", label: "AUTO-WAH", c: "#f59e0b" },
  { k: "crush", label: "CRUSH", c: "#fb7185" },
  { k: "gate", label: "GATE", c: "#34d399" },
  { k: "noise", label: "RISER", c: "#e879f9" },
];
// Loop lengths in seconds — heavy on sub-second sizes for fast stutter/roll FX.
const LOOP_LENGTHS: { label: string; sec: number }[] = [
  { label: "1/16", sec: 0.0625 },
  { label: "1/8", sec: 0.125 },
  { label: "1/4", sec: 0.25 },
  { label: "1/2", sec: 0.5 },
  { label: "1", sec: 1 },
  { label: "2", sec: 2 },
];

// Effects achievable on a YouTube deck. YT audio is cross-origin (no Web Audio
// access), so spectral FX (reverb/flanger/phaser/auto-wah/crush/riser) and EQ
// are impossible. But TREMOLO and GATE are pure *amplitude* effects — we sculpt
// them by modulating the IFrame player's own volume with an LFO.
const YT_FX: FxKey[] = ["tremolo", "gate"];

// Map each FX key to its parallel wet-send gain node.
function fxWetNodes(e: Engine): Record<FxKey, GainNode> {
  return {
    reverb: e.reverbWet, flanger: e.flangerWet, phaser: e.phaserWet,
    tremolo: e.tremWet, autowah: e.wahWet, crush: e.crushWet,
    gate: e.gateWet, noise: e.noiseWet,
  };
}

// ── Rotary knob (pointer-drag, like a real mixer) ─────────────────────
function Knob({ value, min, max, reset, onChange, label, color, size = 44 }: {
  value: number; min: number; max: number; reset: number;
  onChange: (v: number) => void; label: string; color: string; size?: number;
}) {
  const startY = useRef(0);
  const startV = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startY.current = e.clientY;
    startV.current = value;
    const move = (ev: PointerEvent) => {
      const dy = startY.current - ev.clientY;
      let nv = startV.current + (dy / 130) * (max - min);
      nv = Math.max(min, Math.min(max, nv));
      onChange(nv);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const angle = -135 + ((value - min) / (max - min)) * 270;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div
        onPointerDown={onDown}
        onDoubleClick={() => onChange(reset)}
        title={`${label} (double-clic = reset)`}
        style={{
          width: size, height: size, borderRadius: "50%", position: "relative",
          background: "radial-gradient(circle at 50% 35%, #45454c, #1c1c20 70%)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.18)",
          cursor: "ns-resize", touchAction: "none", flexShrink: 0,
        }}
      >
        {/* Indicator */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 2.5, height: size / 2 - 5, background: color, borderRadius: 2,
          transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          transformOrigin: "50% 100%", boxShadow: `0 0 5px ${color}`,
        }} />
        {/* Centre cap */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: size * 0.28, height: size * 0.28,
          transform: "translate(-50%,-50%)", borderRadius: "50%", background: "#2a2a2e",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
        }} />
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.55)" }}>{label}</span>
    </div>
  );
}

export default function DjMode({ open, onClose }: Props) {
  const engineRef = useRef<Engine | null>(null);
  // Hidden YouTube IFrame players (one per deck). Their audio is cross-origin and
  // CANNOT enter the Web Audio graph, so YT decks get transport + level only,
  // driven through the player's own setVolume()/seekTo()/setPlaybackRate().
  const ytRef = useRef<Record<DeckId, YTController | null>>({ A: null, B: null });
  const ytMountRef = useRef<Record<DeckId, HTMLDivElement | null>>({ A: null, B: null });
  const [decks, setDecks] = useState<Record<DeckId, DeckState>>({ A: FRESH(), B: FRESH() });
  // Always-fresh mirror of `decks` for the meter RAF (which only re-subscribes on open).
  const decksRef = useRef(decks);
  decksRef.current = decks;
  const [crossfade, setCrossfade] = useState(0.5);
  const [masterVol, setMasterVol] = useState(0.9);
  const [filter, setFilter] = useState(0); // -1..1
  const [echo, setEcho] = useState(false);
  const [fx, setFx] = useState<Record<FxKey, boolean>>(
    () => Object.fromEntries(FX_KEYS.map((k) => [k, false])) as Record<FxKey, boolean>
  );
  // Per-effect intensity (0..1) — scales each effect's wet send up to FX_MAX.
  const [fxAmt, setFxAmt] = useState<Record<FxKey, number>>(
    () => Object.fromEntries(FX_KEYS.map((k) => [k, 0.6])) as Record<FxKey, number>
  );
  const [showFx, setShowFx] = useState(false);
  const [picker, setPicker] = useState<DeckId | null>(null);
  const [narrow, setNarrow] = useState(false);

  // Fresh mirrors for the YouTube-FX driver (an interval that re-subscribes only
  // on `open`, so it can't close over live state directly).
  const fxRef = useRef({ fx, fxAmt, crossfade, masterVol });
  fxRef.current = { fx, fxAmt, crossfade, masterVol };

  // Active-loop bookkeeping read by the RAF monitor (kept in a ref so the
  // animation frame always sees fresh values without re-subscribing).
  const loopRef = useRef<Record<DeckId, { active: boolean; start: number; len: number }>>({
    A: { active: false, start: 0, len: 0.5 },
    B: { active: false, start: 0, len: 0.5 },
  });

  // Stack decks vertically on phones so the console stays centred & reachable.
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const canvasRef = useRef<Record<DeckId, HTMLCanvasElement | null>>({ A: null, B: null });

  const setDeck = useCallback((id: DeckId, fn: (d: DeckState) => DeckState) => {
    setDecks((prev) => ({ ...prev, [id]: fn(prev[id]) }));
  }, []);

  // Effective YouTube level = master × this deck's crossfader gain × deck volume.
  // (For HTMLAudio decks the same three gains live as real Web Audio nodes; YT
  // can't, so we fold them into the player's single 0–100 setVolume().)
  const applyYtVolume = useCallback((id: DeckId, d: DeckState, xf: number, master: number) => {
    const yt = ytRef.current[id];
    if (!yt) return;
    const g = id === "A" ? Math.cos(xf * Math.PI / 2) : Math.sin(xf * Math.PI / 2);
    const v = Math.max(0, Math.min(1, master * g * d.volume));
    try { yt.player.setVolume(Math.round(v * 100)); } catch {}
  }, []);

  // ── Build the audio engine lazily (needs a user gesture) ──
  const ensureEngine = useCallback((): Engine => {
    if (engineRef.current) return engineRef.current;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();

    const make = (): DeckNodes => {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      const src = ctx.createMediaElementSource(audio);
      const low = ctx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 120;
      const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.9;
      const high = ctx.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 3500;
      const vol = ctx.createGain(); vol.gain.value = 0.85;
      const cross = ctx.createGain();
      const analyser = ctx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.75;
      src.connect(low); low.connect(mid); mid.connect(high); high.connect(vol); vol.connect(cross);
      high.connect(analyser);
      return { audio, src, low, mid, high, vol, cross, analyser };
    };

    const A = make(), B = make();
    const masterFilter = ctx.createBiquadFilter(); masterFilter.type = "allpass";
    const masterGain = ctx.createGain(); masterGain.gain.value = 0.9;
    const echoDelay = ctx.createDelay(1.0); echoDelay.delayTime.value = 0.34;
    const echoFeedback = ctx.createGain(); echoFeedback.gain.value = 0.36;
    const echoWet = ctx.createGain(); echoWet.gain.value = 0;

    A.cross.connect(masterFilter); B.cross.connect(masterFilter);
    masterFilter.connect(masterGain); masterGain.connect(ctx.destination);
    masterFilter.connect(echoDelay); echoDelay.connect(echoFeedback); echoFeedback.connect(echoDelay);
    echoDelay.connect(echoWet); echoWet.connect(ctx.destination);

    // ── REVERB (convolver send) ──
    const reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(ctx);
    const reverbWet = ctx.createGain(); reverbWet.gain.value = 0;
    masterFilter.connect(reverb); reverb.connect(reverbWet); reverbWet.connect(masterGain);

    // ── FLANGER (LFO-modulated short delay with feedback) ──
    const flangerDelay = ctx.createDelay(0.05); flangerDelay.delayTime.value = 0.005;
    const flangerFb = ctx.createGain(); flangerFb.gain.value = 0.35;
    const flangerLFO = ctx.createOscillator(); flangerLFO.type = "sine"; flangerLFO.frequency.value = 0.25;
    const flangerDepth = ctx.createGain(); flangerDepth.gain.value = 0.002;
    const flangerWet = ctx.createGain(); flangerWet.gain.value = 0;
    masterFilter.connect(flangerDelay); flangerDelay.connect(flangerFb); flangerFb.connect(flangerDelay);
    flangerDelay.connect(flangerWet); flangerWet.connect(masterGain);
    flangerLFO.connect(flangerDepth); flangerDepth.connect(flangerDelay.delayTime); flangerLFO.start();

    // ── CRUSH / DRIVE (waveshaper send) ──
    const shaper = ctx.createWaveShaper(); shaper.curve = makeDriveCurve() as any; shaper.oversample = "4x";
    const crushWet = ctx.createGain(); crushWet.gain.value = 0;
    masterFilter.connect(shaper); shaper.connect(crushWet); crushWet.connect(masterGain);

    // ── GATE / STUTTER (square-LFO-chopped send) ──
    const gateGain = ctx.createGain(); gateGain.gain.value = 0.5;
    const gateLFO = ctx.createOscillator(); gateLFO.type = "square"; gateLFO.frequency.value = 8;
    const gateDepth = ctx.createGain(); gateDepth.gain.value = 0.5;
    const gateWet = ctx.createGain(); gateWet.gain.value = 0;
    masterFilter.connect(gateGain); gateGain.connect(gateWet); gateWet.connect(masterGain);
    gateLFO.connect(gateDepth); gateDepth.connect(gateGain.gain); gateLFO.start();

    // ── PHASER (4-stage allpass chain swept by an LFO) ──
    const phaserStages: BiquadFilterNode[] = [];
    let phPrev: AudioNode = masterFilter;
    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter(); ap.type = "allpass";
      ap.frequency.value = 400 + i * 350; ap.Q.value = 0.7;
      phPrev.connect(ap); phPrev = ap; phaserStages.push(ap);
    }
    const phaserWet = ctx.createGain(); phaserWet.gain.value = 0;
    phPrev.connect(phaserWet); phaserWet.connect(masterGain);
    const phaserLFO = ctx.createOscillator(); phaserLFO.type = "sine"; phaserLFO.frequency.value = 0.4;
    const phaserDepth = ctx.createGain(); phaserDepth.gain.value = 300;
    phaserLFO.connect(phaserDepth); phaserStages.forEach((ap) => phaserDepth.connect(ap.frequency)); phaserLFO.start();

    // ── TREMOLO (smooth sine amplitude wobble) ──
    const tremGain = ctx.createGain(); tremGain.gain.value = 0.5;
    const tremLFO = ctx.createOscillator(); tremLFO.type = "sine"; tremLFO.frequency.value = 5;
    const tremDepth = ctx.createGain(); tremDepth.gain.value = 0.5;
    const tremWet = ctx.createGain(); tremWet.gain.value = 0;
    masterFilter.connect(tremGain); tremGain.connect(tremWet); tremWet.connect(masterGain);
    tremLFO.connect(tremDepth); tremDepth.connect(tremGain.gain); tremLFO.start();

    // ── AUTO-WAH (resonant bandpass swept by an LFO) ──
    const wahFilter = ctx.createBiquadFilter(); wahFilter.type = "bandpass"; wahFilter.frequency.value = 800; wahFilter.Q.value = 5;
    const wahLFO = ctx.createOscillator(); wahLFO.type = "sine"; wahLFO.frequency.value = 1.2;
    const wahDepth = ctx.createGain(); wahDepth.gain.value = 700;
    const wahWet = ctx.createGain(); wahWet.gain.value = 0;
    masterFilter.connect(wahFilter); wahFilter.connect(wahWet); wahWet.connect(masterGain);
    wahLFO.connect(wahDepth); wahDepth.connect(wahFilter.frequency); wahLFO.start();

    // ── RISER / NOISE-SWEEP (looping white noise through a swept bandpass) ──
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
    const noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = "bandpass"; noiseFilter.frequency.value = 1800; noiseFilter.Q.value = 0.8;
    const noiseLFO = ctx.createOscillator(); noiseLFO.type = "sine"; noiseLFO.frequency.value = 0.15;
    const noiseDepth = ctx.createGain(); noiseDepth.gain.value = 1500;
    const noiseWet = ctx.createGain(); noiseWet.gain.value = 0;
    noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseWet); noiseWet.connect(masterGain);
    noiseLFO.connect(noiseDepth); noiseDepth.connect(noiseFilter.frequency);
    noiseSrc.start(); noiseLFO.start();

    const eng: Engine = {
      ctx, decks: { A, B }, masterFilter, masterGain, echoDelay, echoFeedback, echoWet,
      reverb, reverbWet, flangerDelay, flangerFb, flangerLFO, flangerDepth, flangerWet,
      shaper, crushWet, gateGain, gateLFO, gateDepth, gateWet,
      phaserStages, phaserLFO, phaserDepth, phaserWet,
      tremGain, tremLFO, tremDepth, tremWet,
      wahFilter, wahLFO, wahDepth, wahWet,
      noiseSrc, noiseFilter, noiseLFO, noiseDepth, noiseWet,
    };
    engineRef.current = eng;

    // iOS unlock: a context created off-gesture starts "suspended" and the whole
    // graph (both decks) stays silent. ensureEngine() always runs inside a tap
    // (CHARGER / play), so resume + a one-shot silent buffer here unlocks it.
    ctx.resume().catch(() => {});
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = buf; s.connect(ctx.destination); s.start(0);
    } catch {}

    (["A", "B"] as DeckId[]).forEach((id) => {
      const a = eng.decks[id].audio;
      a.addEventListener("timeupdate", () => setDeck(id, (d) => ({ ...d, time: a.currentTime })));
      a.addEventListener("loadedmetadata", () => setDeck(id, (d) => ({ ...d, duration: a.duration || 0 })));
      a.addEventListener("play", () => setDeck(id, (d) => ({ ...d, playing: true })));
      a.addEventListener("pause", () => setDeck(id, (d) => ({ ...d, playing: false })));
      a.addEventListener("ended", () => setDeck(id, (d) => ({ ...d, playing: false })));
      a.addEventListener("waiting", () => setDeck(id, (d) => ({ ...d, loading: true })));
      a.addEventListener("playing", () => setDeck(id, (d) => ({ ...d, loading: false })));
      a.addEventListener("canplay", () => setDeck(id, (d) => ({ ...d, loading: false })));
    });

    // Apply current mixer positions + any FX toggled on before the engine existed.
    A.cross.gain.value = Math.cos(crossfade * Math.PI / 2);
    B.cross.gain.value = Math.sin(crossfade * Math.PI / 2);
    masterGain.gain.value = masterVol;
    echoWet.gain.value = echo ? 0.32 : 0;
    const wet = fxWetNodes(eng);
    FX_KEYS.forEach((k) => { wet[k].gain.value = fx[k] ? fxAmt[k] * FX_MAX[k] : 0; });
    return eng;
  }, [setDeck, crossfade, masterVol, echo, fx, fxAmt]);

  // ── Deck actions ──
  const loadTrack = useCallback((id: DeckId, track: MusicTrack) => {
    const eng = ensureEngine();
    if (eng.ctx.state === "suspended") eng.ctx.resume();
    loopRef.current[id].active = false;

    if (track.source === "youtube") {
      // Park the HTMLAudio deck and drive the hidden IFrame player instead.
      const a = eng.decks[id].audio;
      a.pause(); a.removeAttribute("src"); a.load();
      setDeck(id, (d) => ({ ...d, kind: "youtube", track, time: 0, duration: 0, cue: null, loop: false, loading: true }));
      loadYouTubeAPI().then(() => {
        if (!ytRef.current[id]) {
          const mount = ytMountRef.current[id];
          if (!mount) return;
          ytRef.current[id] = createYouTubePlayer(mount, {
            onState: (s) => {
              // 1 playing, 2 paused, 0 ended, 3 buffering
              if (s === 1) setDeck(id, (d) => ({ ...d, playing: true, loading: false }));
              else if (s === 2 || s === 0) setDeck(id, (d) => ({ ...d, playing: false }));
              else if (s === 3) setDeck(id, (d) => ({ ...d, loading: true }));
            },
          });
        }
        const yt = ytRef.current[id]!;
        yt.ready.then(() => {
          try {
            yt.player.loadVideoById(track.streamUrl);
            yt.player.pauseVideo();
            yt.player.setPlaybackRate(nearestYtRate(decks[id].tempo));
          } catch {}
          setDecks((prev) => {
            applyYtVolume(id, prev[id], crossfade, masterVol);
            return prev;
          });
        });
      });
      return;
    }

    // ── Regular HTMLAudio deck (full Web Audio: EQ + master FX) ──
    if (ytRef.current[id]) { try { ytRef.current[id]!.player.pauseVideo(); } catch {} }
    const a = eng.decks[id].audio;
    a.src = playableUrl(track.streamUrl);
    (a as any).preservesPitch = false;
    a.playbackRate = decks[id].tempo;
    a.loop = false; // active-loop is handled by the RAF monitor, not native loop
    a.load();
    setDeck(id, (d) => ({ ...d, kind: "audio", track, time: 0, duration: 0, cue: null, loop: false, loading: true }));
  }, [ensureEngine, decks, setDeck, crossfade, masterVol, applyYtVolume]);

  const togglePlay = useCallback((id: DeckId) => {
    const eng = ensureEngine();
    if (eng.ctx.state === "suspended") eng.ctx.resume();
    if (decks[id].kind === "youtube") {
      const yt = ytRef.current[id];
      if (!yt) return;
      let st = 2; try { st = yt.player.getPlayerState?.(); } catch {}
      try { if (st === 1) yt.player.pauseVideo(); else yt.player.playVideo(); } catch {}
      return;
    }
    const a = eng.decks[id].audio;
    if (!a.src) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }, [ensureEngine, decks]);

  const cueDeck = useCallback((id: DeckId) => {
    const eng = ensureEngine();
    const d = decks[id];
    if (d.kind === "youtube") {
      const yt = ytRef.current[id];
      if (!yt) return;
      if (d.cue == null) {
        let t = 0; try { t = yt.player.getCurrentTime?.() || 0; } catch {}
        setDeck(id, (dd) => ({ ...dd, cue: t }));
      } else {
        try { yt.player.seekTo(d.cue, true); yt.player.pauseVideo(); } catch {}
      }
      return;
    }
    const a = eng.decks[id].audio;
    if (!a.src) return;
    if (d.cue == null) {
      // First press: drop a cue marker at the current position.
      setDeck(id, (dd) => ({ ...dd, cue: a.currentTime }));
    } else {
      // Subsequent press: jump back to the cue and hold.
      a.currentTime = d.cue;
      a.pause();
    }
  }, [ensureEngine, setDeck, decks]);

  const restart = useCallback((id: DeckId) => {
    const eng = ensureEngine();
    if (decks[id].kind === "youtube") {
      try { ytRef.current[id]?.player.seekTo(0, true); } catch {}
      return;
    }
    const a = eng.decks[id].audio;
    if (a.src) a.currentTime = 0;
  }, [ensureEngine, decks]);

  const setTempo = useCallback((id: DeckId, v: number) => {
    setDeck(id, (d) => ({ ...d, tempo: v }));
    if (decks[id].kind === "youtube") {
      try { ytRef.current[id]?.player.setPlaybackRate(nearestYtRate(v)); } catch {}
      return;
    }
    const eng = engineRef.current;
    if (eng) eng.decks[id].audio.playbackRate = v;
  }, [setDeck, decks]);

  const setVolume = useCallback((id: DeckId, v: number) => {
    setDeck(id, (d) => ({ ...d, volume: v }));
    if (decks[id].kind === "youtube") {
      applyYtVolume(id, { ...decks[id], volume: v }, crossfade, masterVol);
      return;
    }
    const eng = engineRef.current;
    if (eng) eng.decks[id].vol.gain.value = v;
  }, [setDeck, decks, crossfade, masterVol, applyYtVolume]);

  const setEq = useCallback((id: DeckId, band: "low" | "mid" | "high", v: number) => {
    setDeck(id, (d) => ({ ...d, eq: { ...d.eq, [band]: v } }));
    const eng = engineRef.current;
    if (eng) eng.decks[id][band].gain.value = v;
  }, [setDeck]);

  // Active beat-loop: capture the current position and repeat a `loopLen`-second
  // region (the RAF monitor seeks back to start each time the playhead passes it).
  const toggleLoop = useCallback((id: DeckId) => {
    const eng = ensureEngine();
    setDeck(id, (d) => {
      const active = !d.loop;
      let start = eng.decks[id].audio.currentTime;
      if (d.kind === "youtube") { try { start = ytRef.current[id]?.player.getCurrentTime?.() || 0; } catch {} }
      loopRef.current[id] = { active, start, len: d.loopLen };
      return { ...d, loop: active };
    });
  }, [ensureEngine, setDeck]);

  const setLoopLen = useCallback((id: DeckId, len: number) => {
    setDeck(id, (d) => ({ ...d, loopLen: len }));
    loopRef.current[id].len = len;
  }, [setDeck]);

  // Vinyl brake — ramp playbackRate to a stop, then pause.
  const brakeTimers = useRef<Record<DeckId, any>>({ A: null, B: null });
  const brake = useCallback((id: DeckId) => {
    const eng = ensureEngine();
    if (decks[id].kind === "youtube") {
      // YT can't ramp playbackRate smoothly; step it down then pause.
      const yt = ytRef.current[id]; if (!yt) return;
      try { yt.player.setPlaybackRate(0.25); } catch {}
      setTimeout(() => { try { yt.player.pauseVideo(); yt.player.setPlaybackRate(nearestYtRate(decks[id].tempo)); } catch {} }, 260);
      return;
    }
    const a = eng.decks[id].audio;
    if (!a.src || a.paused) return;
    const base = decks[id].tempo;
    let r = a.playbackRate;
    clearInterval(brakeTimers.current[id]);
    brakeTimers.current[id] = setInterval(() => {
      r -= base / 12;
      if (r <= 0.06) {
        clearInterval(brakeTimers.current[id]);
        a.pause();
        a.playbackRate = base;
      } else {
        a.playbackRate = r;
      }
    }, 28);
  }, [ensureEngine, decks]);

  // SYNC: beat-match deck B to deck A — copy A's tempo AND re-drop B in phase
  // (jump B to its cue/start and, if A is rolling, start B so the two line up).
  const syncBtoA = useCallback(() => {
    const eng = ensureEngine();
    setTempo("B", decks.A.tempo);
    // Is deck A currently rolling?
    let aRolling = !eng.decks.A.audio.paused;
    if (decks.A.kind === "youtube") { try { aRolling = ytRef.current.A?.player.getPlayerState?.() === 1; } catch {} }
    if (decks.B.kind === "youtube") {
      const yt = ytRef.current.B; if (!yt) return;
      try { yt.player.seekTo(decks.B.cue ?? 0, true); if (aRolling) yt.player.playVideo(); } catch {}
      return;
    }
    const aB = eng.decks.B.audio;
    if (!aB.src) return;
    aB.currentTime = decks.B.cue ?? 0;
    if (aRolling) aB.play().catch(() => {});
  }, [ensureEngine, setTempo, decks.A.tempo, decks.A.kind, decks.B.kind, decks.B.cue]);

  // ── Mixer params → engine ──
  useEffect(() => {
    const eng = engineRef.current;
    if (eng) {
      eng.decks.A.cross.gain.value = Math.cos(crossfade * Math.PI / 2);
      eng.decks.B.cross.gain.value = Math.sin(crossfade * Math.PI / 2);
    }
    // YT decks fold the crossfader into the player volume.
    (["A", "B"] as DeckId[]).forEach((id) => {
      if (decks[id].kind === "youtube") applyYtVolume(id, decks[id], crossfade, masterVol);
    });
  }, [crossfade, decks, masterVol, applyYtVolume]);

  useEffect(() => {
    const eng = engineRef.current;
    if (eng) eng.masterGain.gain.value = masterVol;
    (["A", "B"] as DeckId[]).forEach((id) => {
      if (decks[id].kind === "youtube") applyYtVolume(id, decks[id], crossfade, masterVol);
    });
  }, [masterVol, decks, crossfade, applyYtVolume]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const f = eng.masterFilter;
    if (Math.abs(filter) < 0.03) { f.type = "allpass"; f.frequency.value = 1000; return; }
    if (filter < 0) { f.type = "lowpass"; f.frequency.value = 20000 * Math.pow(250 / 20000, -filter); f.Q.value = 1; }
    else { f.type = "highpass"; f.frequency.value = 20 * Math.pow(8000 / 20, filter); f.Q.value = 1; }
  }, [filter]);

  useEffect(() => {
    const eng = engineRef.current;
    if (eng) eng.echoWet.gain.value = echo ? 0.32 : 0;
  }, [echo]);

  // ── Extra master-FX sends: wet level = on ? intensity × max : 0 ──
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const wet = fxWetNodes(e);
    FX_KEYS.forEach((k) => { wet[k].gain.value = fx[k] ? fxAmt[k] * FX_MAX[k] : 0; });
  }, [fx, fxAmt]);

  // ── Meter animation + active-loop monitor ──
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const draw = () => {
      const eng = engineRef.current;
      if (eng) {
        (["A", "B"] as DeckId[]).forEach((id) => {
          const cv = canvasRef.current[id];
          const an = eng.decks[id].analyser;
          if (!cv || !an) return;
          const ctx2d = cv.getContext("2d");
          if (!ctx2d) return;
          const w = cv.width, h = cv.height;
          const isYt = decksRef.current[id].kind === "youtube";
          ctx2d.clearRect(0, 0, w, h);
          const bars = 28;
          const bw = w / bars;
          if (isYt) {
            // No analyser access to cross-origin YT audio — draw a gentle faux
            // VU so the deck doesn't look frozen while it plays.
            const playing = decksRef.current[id].playing;
            const now = performance.now() / 220;
            for (let i = 0; i < bars; i++) {
              const v = playing ? (0.25 + 0.6 * Math.abs(Math.sin(now + i * 0.55)) * (0.5 + 0.5 * Math.sin(now * 0.7 + i))) : 0.04;
              const bh = Math.max(2, v * h);
              ctx2d.fillStyle = DECK_COLOR[id];
              ctx2d.globalAlpha = 0.3 + v * 0.6;
              ctx2d.fillRect(i * bw + 1, h - bh, bw - 1.5, bh);
            }
            ctx2d.globalAlpha = 1;
          } else {
            const bins = an.frequencyBinCount;
            const data = new Uint8Array(bins);
            an.getByteFrequencyData(data);
            for (let i = 0; i < bars; i++) {
              const v = data[Math.floor((i / bars) * bins)] / 255;
              const bh = Math.max(2, v * h);
              ctx2d.fillStyle = DECK_COLOR[id];
              ctx2d.globalAlpha = 0.35 + v * 0.65;
              ctx2d.fillRect(i * bw + 1, h - bh, bw - 1.5, bh);
            }
            ctx2d.globalAlpha = 1;

            // Active-loop: seek back to the loop start when the playhead runs past it.
            const lp = loopRef.current[id];
            const a = eng.decks[id].audio;
            if (lp.active && !a.paused) {
              const end = Math.min(lp.start + lp.len, a.duration || Infinity);
              if (a.currentTime >= end) a.currentTime = lp.start;
            }
          }
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // YouTube decks have no `timeupdate` event — poll position/duration (and run
  // the active-loop seek) on a light interval while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => {
      (["A", "B"] as DeckId[]).forEach((id) => {
        if (decksRef.current[id].kind !== "youtube") return;
        const yt = ytRef.current[id];
        if (!yt) return;
        let t = 0, dur = 0;
        try { t = yt.player.getCurrentTime?.() || 0; dur = yt.player.getDuration?.() || 0; } catch {}
        const lp = loopRef.current[id];
        if (lp.active) {
          const end = Math.min(lp.start + lp.len, dur || Infinity);
          if (t >= end) { try { yt.player.seekTo(lp.start, true); } catch {} t = lp.start; }
        }
        setDeck(id, (d) => (Math.abs(d.time - t) > 0.05 || d.duration !== dur ? { ...d, time: t, duration: dur } : d));
      });
    }, 200);
    return () => clearInterval(iv);
  }, [open, setDeck]);

  // ── YouTube dynamic FX: TREMOLO + GATE via volume-LFO ──────────────────
  // The only way to "FX" cross-origin YT audio: sculpt the player's own volume.
  // Runs ~40 Hz so the modulation sounds smooth, and only for YT decks whose
  // tremolo/gate is engaged (static level stays event-driven via applyYtVolume).
  useEffect(() => {
    if (!open) return;
    const t0 = performance.now();
    const iv = setInterval(() => {
      const { fx: F, fxAmt: A, crossfade: XF, masterVol: MV } = fxRef.current;
      (["A", "B"] as DeckId[]).forEach((id) => {
        const d = decksRef.current[id];
        if (d.kind !== "youtube") return;
        const yt = ytRef.current[id];
        if (!yt) return;
        if (!F.tremolo && !F.gate) return; // no dynamic FX → applyYtVolume owns level
        const g = id === "A" ? Math.cos(XF * Math.PI / 2) : Math.sin(XF * Math.PI / 2);
        const base = Math.max(0, Math.min(1, MV * g * d.volume));
        const t = (performance.now() - t0) / 1000;
        let factor = 1;
        if (F.tremolo) {
          const rate = 1.5 + A.tremolo * 10;      // 1.5 → 11.5 Hz
          const depth = 0.35 + A.tremolo * 0.6;   // 0.35 → 0.95
          factor *= 1 - depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t));
        }
        if (F.gate) {
          const rate = 2 + A.gate * 12;           // 2 → 14 Hz chop
          const duty = 0.5;
          const phase = (t * rate) % 1;
          factor *= phase < duty ? 1 : (1 - (0.4 + A.gate * 0.6)); // dip depth scales
        }
        try { yt.player.setVolume(Math.round(Math.max(0, Math.min(1, base * factor)) * 100)); } catch {}
      });
    }, 25);
    return () => clearInterval(iv);
  }, [open]);

  // When tremolo/gate turn OFF for a YT deck, restore its steady level.
  useEffect(() => {
    (["A", "B"] as DeckId[]).forEach((id) => {
      if (decksRef.current[id].kind === "youtube" && !fx.tremolo && !fx.gate) {
        applyYtVolume(id, decksRef.current[id], crossfade, masterVol);
      }
    });
  }, [fx.tremolo, fx.gate, crossfade, masterVol, applyYtVolume]);

  // Pause both decks when the overlay closes (no background mixes).
  useEffect(() => {
    if (open) return;
    const eng = engineRef.current;
    if (eng) { eng.decks.A.audio.pause(); eng.decks.B.audio.pause(); }
    (["A", "B"] as DeckId[]).forEach((id) => { try { ytRef.current[id]?.player.pauseVideo(); } catch {} });
  }, [open]);

  // ── Single deck panel ──
  // NOTE: invoked as a plain function (renderDeck("A")) — NOT as <DeckPanel/>.
  // As a JSX element it would get a fresh component identity on every parent
  // render, and since `timeupdate` re-renders this component several times a
  // second during playback, React would unmount+remount the whole deck each
  // tick — dropping in-flight button taps and knob drags (the "boutons qui ne
  // marchent pas" bug). Calling it inlines the JSX into our own tree, keeping
  // the DOM (and the meter canvas ref) stable across renders.
  const renderDeck = (id: DeckId) => {
    const d = decks[id];
    const color = DECK_COLOR[id];
    const pct = d.duration ? Math.min(100, (d.time / d.duration) * 100) : 0;
    return (
      <div style={{
        flex: 1, minWidth: 0, background: "linear-gradient(180deg,#222226,#161618)",
        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 12,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color, display: "flex", alignItems: "center", gap: 6 }}>
            DECK {id}
            {d.kind === "youtube" && (
              <span title="YouTube (audio caché) — EQ & FX spectraux indisponibles, mais TREMOLO, GATE, LOOP, BRAKE & TEMPO fonctionnent via le lecteur"
                style={{ fontSize: 7.5, fontWeight: 800, padding: "1px 5px", borderRadius: 999, background: "rgba(239,68,68,0.18)", color: "#f87171", letterSpacing: 0.2 }}>
                YT · FX dynamiques
              </span>
            )}
          </span>
          <button onClick={() => setPicker(id)}
            style={{
              fontSize: 10, fontWeight: 700, color: "#fff", background: `${color}33`,
              border: `1px solid ${color}66`, borderRadius: 8, padding: "4px 10px", cursor: "pointer",
            }}>
            ⤓ CHARGER
          </button>
        </div>

        {/* Platter + track */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
            <div
              className="dj-platter"
              style={{
                width: 84, height: 84, borderRadius: "50%",
                background: d.track?.artwork
                  ? `url(${d.track.artwork}) center/cover`
                  : "repeating-radial-gradient(circle at 50% 50%, #2a2a2e 0 2px, #1a1a1d 2px 4px)",
                boxShadow: `0 0 0 4px #0d0d0f, 0 0 0 5px ${color}55, 0 6px 16px rgba(0,0,0,0.6)`,
                animationPlayState: d.playing ? "running" : "paused",
                animationDuration: `${(1.8 / Math.max(0.4, d.tempo)).toFixed(2)}s`,
              }}
            />
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: 14, height: 14, borderRadius: "50%", background: "#0d0d0f",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)",
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.25,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {d.track?.title ?? "— aucun titre —"}
            </p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {d.track?.artist ?? "Charge un morceau"}
            </p>
            <div style={{ marginTop: 4, fontSize: 10, fontFamily: "ui-monospace, monospace", color }}>
              {fmt(d.time)} <span style={{ color: "rgba(255,255,255,0.3)" }}>/ {fmt(d.duration)}</span>
              <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.4)" }}>{Math.round(d.tempo * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Meter + progress */}
        <canvas ref={(el) => { canvasRef.current[id] = el; }} width={260} height={34}
          style={{ width: "100%", height: 34, display: "block", borderRadius: 6, background: "rgba(0,0,0,0.35)" }} />
        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.2s linear" }} />
        </div>

        {/* EQ knobs */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "2px 0" }}>
          <Knob label="HI" color={color} value={d.eq.high} min={-26} max={8} reset={0} onChange={(v) => setEq(id, "high", v)} />
          <Knob label="MID" color={color} value={d.eq.mid} min={-26} max={8} reset={0} onChange={(v) => setEq(id, "mid", v)} />
          <Knob label="LO" color={color} value={d.eq.low} min={-26} max={8} reset={0} onChange={(v) => setEq(id, "low", v)} />
          <Knob label="VOL" color={color} value={d.volume} min={0} max={1} reset={0.85} onChange={(v) => setVolume(id, v)} />
        </div>

        {/* Tempo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", width: 38 }}>TEMPO</span>
          <input type="range" min={0.9} max={1.1} step={0.005} value={d.tempo}
            onChange={(e) => setTempo(id, Number(e.target.value))}
            style={{ flex: 1, accentColor: color }} />
          <button onClick={() => setTempo(id, 1)}
            style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "3px 6px", cursor: "pointer" }}>
            RESET
          </button>
        </div>

        {/* Transport */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "cue", label: "CUE", on: d.cue != null, act: () => cueDeck(id) },
            { k: "play", label: d.playing ? "❚❚" : "►", on: d.playing, act: () => togglePlay(id), accent: true },
            { k: "loop", label: "LOOP", on: d.loop, act: () => toggleLoop(id) },
            { k: "brake", label: "BRAKE", on: false, act: () => brake(id) },
            { k: "restart", label: "⏮", on: false, act: () => restart(id) },
          ].map((b) => (
            <button key={b.k} onClick={b.act}
              style={{
                flex: b.k === "play" ? 1.5 : 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                border: b.on ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.12)",
                background: b.on ? `${color}33` : (b as any).accent ? "linear-gradient(180deg,#3a3a40,#222226)" : "rgba(255,255,255,0.05)",
                color: b.on ? color : "rgba(255,255,255,0.85)",
              }}>
              {b.label}
            </button>
          ))}
        </div>

        {/* Loop length (seconds) — used when LOOP is engaged */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.5)", width: 38 }}>LOOP</span>
          {LOOP_LENGTHS.map((L) => (
            <button key={L.label} onClick={() => setLoopLen(id, L.sec)}
              style={{
                flex: 1, padding: "4px 0", borderRadius: 6, cursor: "pointer",
                fontSize: 9.5, fontWeight: 800,
                border: d.loopLen === L.sec ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.12)",
                background: d.loopLen === L.sec ? `${color}33` : "rgba(255,255,255,0.05)",
                color: d.loopLen === L.sec ? color : "rgba(255,255,255,0.7)",
              }}>
              {L.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
    {/* Persistent, visually-hidden YouTube IFrame mounts (kept mounted across
        open/close so the players survive — audio-only, user only sees titles). */}
    <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none", zIndex: -1 }}>
      <div ref={(el) => { ytMountRef.current.A = el; }} />
      <div ref={(el) => { ytMountRef.current.B = el; }} />
    </div>
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120]" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
            onClick={onClose} />

          <div className="fixed inset-0 z-[121] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }} transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-[min(100%,860px)] max-h-[94vh] overflow-y-auto overflow-x-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              background: "linear-gradient(180deg,#101012,#06060a)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 16,
              boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
            }}>
              {/* Title bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🎛️</span>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: 0.5 }}>DJ MIX</h2>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", margin: 0 }}>Double platine · Audius · Jamendo · Archive · YouTube</p>
                  </div>
                </div>
                <button onClick={onClose}
                  style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}>
                  ✕
                </button>
              </div>

              {/* Decks + mixer */}
              <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 12, alignItems: "stretch" }}>
                {renderDeck("A")}

                {/* Centre mixer */}
                <div style={{
                  width: narrow ? "100%" : 150, flexShrink: 0, background: "linear-gradient(180deg,#1c1c20,#101012)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(255,255,255,0.6)" }}>MIXER</span>

                  {/* FX knobs */}
                  <div style={{ display: "flex", gap: 16 }}>
                    <Knob label="FILTER" color="#fbbf24" value={filter} min={-1} max={1} reset={0} onChange={setFilter} size={48} />
                    <Knob label="MASTER" color="#a3e635" value={masterVol} min={0} max={1} reset={0.9} onChange={setMasterVol} size={48} />
                  </div>

                  {/* Echo + Sync */}
                  <div style={{ display: "flex", gap: 6, width: "100%" }}>
                    <button onClick={() => setEcho((v) => !v)}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: "pointer",
                        border: echo ? "1px solid #f472b6" : "1px solid rgba(255,255,255,0.12)",
                        background: echo ? "#f472b633" : "rgba(255,255,255,0.05)",
                        color: echo ? "#f472b6" : "rgba(255,255,255,0.8)",
                      }}>
                      ECHO
                    </button>
                    <button onClick={syncBtoA}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: "pointer",
                        border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)",
                      }}>
                      SYNC ▸
                    </button>
                  </div>

                  {/* FX rack toggle */}
                  <button onClick={() => { ensureEngine(); setShowFx((v) => !v); }}
                    style={{
                      width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: "pointer",
                      letterSpacing: 1, border: showFx ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.12)",
                      background: showFx ? "#38bdf833" : "rgba(255,255,255,0.05)", color: showFx ? "#38bdf8" : "rgba(255,255,255,0.8)",
                    }}>
                    ⚙ FX {showFx ? "▾" : "▸"}
                  </button>

                  {/* FX rack — extra master effects, each with an intensity slider */}
                  {showFx && (
                    <div style={{
                      width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                      padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                      {FX_META.map((f) => {
                        const on = fx[f.k];
                        return (
                          <div key={f.k} style={{
                            display: "flex", flexDirection: "column", gap: 4, padding: 5, borderRadius: 8,
                            border: on ? `1px solid ${f.c}66` : "1px solid rgba(255,255,255,0.08)",
                            background: on ? `${f.c}14` : "rgba(255,255,255,0.03)",
                          }}>
                            <button onClick={() => { ensureEngine(); setFx((p) => ({ ...p, [f.k]: !p[f.k] })); }}
                              style={{
                                padding: "6px 0", borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3,
                                border: on ? `1px solid ${f.c}` : "1px solid rgba(255,255,255,0.12)",
                                background: on ? `${f.c}33` : "rgba(255,255,255,0.05)",
                                color: on ? f.c : "rgba(255,255,255,0.75)",
                              }}>
                              {f.label}
                            </button>
                            <input type="range" min={0} max={1} step={0.01} value={fxAmt[f.k]} disabled={!on}
                              onChange={(e) => setFxAmt((p) => ({ ...p, [f.k]: Number(e.target.value) }))}
                              title={`Intensité ${f.label} : ${Math.round(fxAmt[f.k] * 100)}%`}
                              style={{ width: "100%", accentColor: f.c, opacity: on ? 1 : 0.35, cursor: on ? "pointer" : "default" }} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Crossfader */}
                  <div style={{ width: "100%", marginTop: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, marginBottom: 4 }}>
                      <span style={{ color: DECK_COLOR.A }}>A</span>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>XFADE</span>
                      <span style={{ color: DECK_COLOR.B }}>B</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.01} value={crossfade}
                      onChange={(e) => setCrossfade(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#fff" }} />
                  </div>
                </div>

                {renderDeck("B")}
              </div>

              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 12 }}>
                Astuce : double-clique un bouton rotatif pour le remettre à zéro · les morceaux viennent de sources gratuites & légales
              </p>
            </div>
          </motion.div>
          </div>

          {/* Track picker */}
          <AnimatePresence>
            {picker && (
              <TrackPicker
                deck={picker}
                color={DECK_COLOR[picker]}
                onPick={(t) => { loadTrack(picker, t); setPicker(null); }}
                onClose={() => setPicker(null)}
              />
            )}
          </AnimatePresence>

          <style>{`
            @keyframes djSpin { to { transform: rotate(360deg); } }
            .dj-platter { animation: djSpin 1.8s linear infinite; }
          `}</style>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

// ── Track picker modal (shared search) ────────────────────────────────
function TrackPicker({ deck, color, onPick, onClose }: {
  deck: DeckId; color: string; onPick: (t: MusicTrack) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [visible, setVisible] = useState(18);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true); setErr(null); setVisible(18);
    try {
      const res = await searchAllMusic(query, { youtube: true });
      setTracks(res);
      if (!res.length) setErr("Aucun titre trouvé.");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur de recherche.");
    } finally { setLoading(false); }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <motion.div initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(96vw,460px)", maxHeight: "82vh", overflow: "hidden",
          background: "linear-gradient(180deg,#16161a,#0a0a0e)", border: `1px solid ${color}55`,
          borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>Charger sur DECK {deck}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(q)}
            placeholder="Cherche un morceau, un artiste…" autoFocus
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none" }} />
          <button onClick={() => run(q)} style={{ background: color, border: "none", borderRadius: 10, padding: "0 16px", color: "#06060a", fontWeight: 800, cursor: "pointer" }}>
            {loading ? "…" : "OK"}
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PICKER_TAGS.map((t) => (
            <button key={t} onClick={() => { setQ(t); run(t); }}
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>

        {err && <p style={{ color: "#f87171", fontSize: 12, textAlign: "center" }}>{err}</p>}

        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {tracks.slice(0, visible).map((t, i) => (
            <button key={t.id || i} onClick={() => onPick(t)}
              style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: 8, cursor: "pointer",
              }}>
              {t.artwork
                ? <img src={t.artwork} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 42, height: 42, borderRadius: 6, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🎵</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.artist}</p>
              </div>
              {(() => { const b = sourceBadge(t.source); return (
                <span style={{ fontSize: 7.5, fontWeight: 800, padding: "2px 6px", borderRadius: 999, flexShrink: 0,
                  background: b.bg, color: b.color }}>
                  {b.label}
                </span>
              ); })()}
            </button>
          ))}
          {tracks.length > visible && (
            <button onClick={() => setVisible((v) => v + 18)}
              style={{
                marginTop: 2, padding: "10px 0", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${color}55`, background: `${color}1a`, color,
                fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
              }}>
              Voir plus ({tracks.length - visible})
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
