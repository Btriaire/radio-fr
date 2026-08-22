"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MusicTrack } from "@/lib/musicSearch";
import { loadYouTubeAPI, createYouTubePlayer, YTController } from "@/lib/youtubePlayer";
import TascamPlayer from "@/components/TascamPlayer";

// Compact "now playing" deck for YouTube tracks opened from SongPOD.
//
// YouTube audio is cross-origin → it can't enter the Web Audio EQ graph. So this
// player drives the official hidden IFrame (audio-only; the user only sees the
// title) and reuses the TASCAM faceplate for transport. EQ & spectral FX are
// impossible here, but TREMOLO and GATE *are* achievable by modulating the
// player's own volume with an LFO — the same trick used in the DJ decks.

export default function YouTubeMiniPlayer({ track, onClose }: {
  track: MusicTrack | null;
  onClose: () => void;
}) {
  const ytRef = useRef<YTController | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [trem, setTrem] = useState(false);
  const [gate, setGate] = useState(false);
  const [tremAmt, setTremAmt] = useState(0.6);
  const [gateAmt, setGateAmt] = useState(0.6);

  // Fresh mirror for the volume-LFO interval (re-subscribes only on FX toggles).
  const lvlRef = useRef({ volume, trem, gate, tremAmt, gateAmt });
  lvlRef.current = { volume, trem, gate, tremAmt, gateAmt };
  // Last integer volume actually sent to the IFrame. YouTube THROTTLES rapid
  // setVolume() calls over postMessage (this is why a naive 40 Hz LFO sounded
  // like "rien ne marche"), so we only post when the target % actually changes.
  const lastSentRef = useRef(-1);

  // Load / switch the video whenever the requested track changes.
  useEffect(() => {
    if (!track) {
      try { ytRef.current?.player.pauseVideo(); } catch {}
      setPlaying(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      if (!ytRef.current) {
        const mount = mountRef.current;
        if (!mount) return;
        ytRef.current = createYouTubePlayer(mount, {
          onState: (s) => {
            if (s === 1) { setPlaying(true); setLoading(false); }
            else if (s === 3) setLoading(true);
            else if (s === 2 || s === 0) { setPlaying(false); setLoading(false); }
          },
        });
      }
      const yt = ytRef.current!;
      yt.ready.then(() => {
        if (cancelled) return;
        try {
          yt.player.loadVideoById(track.streamUrl);
          yt.player.setVolume(Math.round(volume * 100));
          lastSentRef.current = Math.round(volume * 100);
          yt.player.playVideo();
        } catch {}
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.streamUrl]);

  // Poll position / duration.
  useEffect(() => {
    const iv = setInterval(() => {
      const yt = ytRef.current;
      if (!yt) return;
      try {
        setTime(yt.player.getCurrentTime?.() || 0);
        setDuration(yt.player.getDuration?.() || 0);
      } catch {}
    }, 250);
    return () => clearInterval(iv);
  }, []);

  // Volume + dynamic FX (TREMOLO / GATE) driver. ~33 Hz, but we only actually
  // call setVolume when the rounded level changes — so GATE sends a clean
  // square-wave of distinct values (crisp), and TREMOLO sends a quantised sweep
  // that YouTube doesn't drop. Rates kept moderate so the postMessage round-trip
  // can keep up.
  useEffect(() => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const yt = ytRef.current;
      if (!yt) return;
      const { volume: v, trem: T, gate: G, tremAmt: TA, gateAmt: GA } = lvlRef.current;
      let factor = 1;
      if (T || G) {
        const t = (performance.now() - t0) / 1000;
        if (T) {
          const rate = 1.5 + TA * 6, depth = 0.4 + TA * 0.6;
          factor *= 1 - depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t));
        }
        if (G) {
          const rate = 2 + GA * 8;
          factor *= ((t * rate) % 1) < 0.5 ? 1 : (1 - (0.55 + GA * 0.45));
        }
      }
      // Quantise to steps of 3% → fewer distinct postMessages, each one counts.
      const level = Math.max(0, Math.min(1, v * factor)) * 100;
      const target = Math.round(level / 3) * 3;
      if (target !== lastSentRef.current) {
        lastSentRef.current = target;
        try { yt.player.setVolume(target); } catch {}
      }
    }, 30);
    return () => clearInterval(iv);
  }, []);

  const play = () => { try { ytRef.current?.player.playVideo(); } catch {} };
  const pause = () => { try { ytRef.current?.player.pauseVideo(); } catch {} };
  const seek = (t: number) => { try { ytRef.current?.player.seekTo(t, true); setTime(t); } catch {} };

  return (
    <>
      {/* Hidden audio-only IFrame mount */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div ref={(el) => { mountRef.current = el; }} />
      </div>

      {track && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-2">
          {/* Header: badge + close */}
          <div className="flex items-center gap-2 px-1">
            <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 999, background: "rgba(239,68,68,0.18)", color: "#f87171" }}>YOUTUBE</span>
            <span className="text-white/30 text-[9px] flex-1 truncate">audio caché · sans EQ</span>
            <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none flex-shrink-0">✕</button>
          </div>

          {/* TASCAM faceplate handles play/pause/seek + the time display */}
          <TascamPlayer
            title={track.title}
            artist={track.artist}
            isPlaying={playing}
            isLoading={loading}
            currentTime={time}
            duration={duration}
            onPlay={play}
            onPause={pause}
            onSeek={seek}
            accent="#f87171"
          />

          {/* Volume */}
          <div className="glass rounded-xl p-2.5 flex items-center gap-3">
            <span className="text-white/30 text-xs">🔊</span>
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1" style={{ accentColor: "#f87171" }} />
          </div>

          {/* Dynamic FX (the only ones possible on YouTube) */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { on: trem, setOn: setTrem, amt: tremAmt, setAmt: setTremAmt, label: "TREMOLO", c: "#fbbf24" },
              { on: gate, setOn: setGate, amt: gateAmt, setAmt: setGateAmt, label: "GATE", c: "#34d399" },
            ] as const).map((f) => (
              <div key={f.label} className="rounded-lg p-1.5 flex flex-col gap-1"
                style={{ border: f.on ? `1px solid ${f.c}66` : "1px solid rgba(255,255,255,0.08)", background: f.on ? `${f.c}14` : "rgba(255,255,255,0.03)" }}>
                <button onClick={() => f.setOn((v) => !v)}
                  className="py-1 rounded-md text-[9px] font-extrabold tracking-wide"
                  style={{ border: f.on ? `1px solid ${f.c}` : "1px solid rgba(255,255,255,0.12)", background: f.on ? `${f.c}33` : "rgba(255,255,255,0.05)", color: f.on ? f.c : "rgba(255,255,255,0.75)" }}>
                  {f.label}
                </button>
                <input type="range" min={0} max={1} step={0.01} value={f.amt} disabled={!f.on}
                  onChange={(e) => f.setAmt(Number(e.target.value))}
                  style={{ width: "100%", accentColor: f.c, opacity: f.on ? 1 : 0.35 }} />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </>
  );
}
