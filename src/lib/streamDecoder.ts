// Streaming MP3 → Web Audio playback.
//
// iOS Safari routes <audio> (MediaElementSource) straight to hardware and feeds
// SILENCE into the Web Audio graph, so EQ filters never touch the sound. To get a
// real EQ on iPhone we bypass the <audio> element entirely: fetch the raw MP3
// stream, decode it to PCM on the fly, and schedule the PCM through the SAME EQ
// filter chain. Everything stays inside Web Audio, so the filters actually apply.

import { MPEGDecoder } from "mpg123-decoder";

export interface DecodeController {
  stop: () => void;
}

export interface PlayDecodedOptions {
  url: string;
  ctx: AudioContext;
  destination: AudioNode;       // scheduled buffers connect here (e.g. masterGain → filters)
  onFirstAudio?: () => void;    // fired when the first PCM buffer is scheduled
  onError?: (e: unknown) => void;
}

// Detect iOS / iPadOS (where MediaElementSource is bypassed).
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iDevice = /iP(hone|ad|od)/.test(ua);
  // iPadOS 13+ masquerades as desktop Safari but has touch points.
  const iPadOS =
    navigator.platform === "MacIntel" &&
    typeof (navigator as { maxTouchPoints?: number }).maxTouchPoints === "number" &&
    (navigator as { maxTouchPoints: number }).maxTouchPoints > 1;
  return iDevice || iPadOS;
}

export async function playDecodedStream(opts: PlayDecodedOptions): Promise<DecodeController> {
  const { url, ctx, destination, onFirstAudio, onError } = opts;

  const decoder = new MPEGDecoder();
  await decoder.ready;

  const abort = new AbortController();
  let stopped = false;
  let firstDone = false;
  let nextTime = 0;                                   // audio-clock cursor for gapless scheduling
  const activeSources = new Set<AudioBufferSourceNode>();

  const res = await fetch(url, { signal: abort.signal, mode: "cors" });
  if (!res.ok || !res.body) throw new Error("stream fetch failed: " + res.status);
  const reader = res.body.getReader();

  const schedule = (channels: Float32Array[], samples: number, sampleRate: number) => {
    if (stopped || samples <= 0 || !channels.length || !sampleRate) return;
    const buf = ctx.createBuffer(channels.length, samples, sampleRate);
    for (let c = 0; c < channels.length; c++) {
      // Copy into a fresh, non-shared Float32Array to satisfy copyToChannel's
      // ArrayBuffer-backed (not SharedArrayBuffer) typing.
      const chan = new Float32Array(samples);
      chan.set(channels[c].subarray(0, samples));
      buf.copyToChannel(chan, c);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(destination);
    const now = ctx.currentTime;
    // Prime a small lead buffer; if we fell behind (underrun) jump forward.
    if (nextTime < now + 0.08) nextTime = now + 0.15;
    src.start(nextTime);
    nextTime += buf.duration;
    activeSources.add(src);
    src.onended = () => activeSources.delete(src);
    if (!firstDone) { firstDone = true; onFirstAudio?.(); }
  };

  (async () => {
    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done || stopped) break;
        if (!value || !value.length) continue;
        const { channelData, samplesDecoded, sampleRate } = decoder.decode(value);
        schedule(channelData, samplesDecoded, sampleRate);
      }
    } catch (e) {
      if (!stopped) onError?.(e);
    }
  })();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try { abort.abort(); } catch {}
      activeSources.forEach((s) => { try { s.stop(); } catch {} try { s.disconnect(); } catch {} });
      activeSources.clear();
      try { decoder.free(); } catch {}
    },
  };
}
