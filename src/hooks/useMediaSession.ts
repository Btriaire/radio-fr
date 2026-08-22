"use client";
import { useEffect } from "react";

// Wires the page's now-playing state into the OS Media Session API so the
// station/episode shows up on the lock screen, notification shade, smartwatch,
// car display, and responds to hardware media keys / headphone buttons.
export interface MediaSessionOptions {
  title: string | null;
  artist?: string;
  album?: string;
  artwork?: string;
  isPlaying: boolean;
  // Position info for the lock-screen scrubber (podcasts / music). Live radio
  // streams should leave these undefined so iOS shows no (meaningless) progress.
  currentTime?: number;
  duration?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onStop?: () => void;
  onSeek?: (t: number) => void;
}

function artworkType(url: string): string {
  if (url.endsWith(".svg")) return "image/svg+xml";
  if (url.endsWith(".ico")) return "image/x-icon";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export function useMediaSession(opts: MediaSessionOptions) {
  const { title, artist, album, artwork, isPlaying, currentTime, duration, onPlay, onPause, onNext, onPrev, onStop, onSeek } = opts;

  // ── Metadata (title / artist / artwork) ──────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!title) { ms.metadata = null; return; }
    const art = artwork
      ? [96, 128, 192, 256, 384, 512].map((s) => ({
          src: artwork, sizes: `${s}x${s}`, type: artworkType(artwork),
        }))
      : [];
    try {
      ms.metadata = new MediaMetadata({
        title,
        artist: artist ?? "",
        album: album ?? "RadioFR",
        artwork: art,
      });
    } catch {}
  }, [title, artist, album, artwork]);

  // ── Playback state ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // ── Position state (lock-screen progress bar for podcasts / music) ────────
  // Only meaningful for finite-length content; live radio leaves duration
  // undefined so we clear it (iOS then shows a plain "live" deck, no scrubber).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setPositionState !== "function") return;
    try {
      if (duration && isFinite(duration) && duration > 0) {
        ms.setPositionState({
          duration,
          position: Math.max(0, Math.min(currentTime ?? 0, duration)),
          playbackRate: 1,
        });
      } else {
        ms.setPositionState();   // clear → no progress bar for live streams
      }
    } catch {}
  }, [currentTime, duration]);

  // ── Action handlers (hardware keys / lock screen buttons) ────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler?: () => void) => {
      try { ms.setActionHandler(action, handler ? () => handler() : null); } catch {}
    };
    set("play", onPlay);
    set("pause", onPause);
    set("nexttrack", onNext);
    set("previoustrack", onPrev);
    set("stop", onStop);

    // Scrub handlers (only when the content is seekable). These take event
    // details, so they're registered directly rather than via `set()`.
    if (onSeek) {
      const at = () => currentTime ?? 0;
      try {
        ms.setActionHandler("seekto", (d) => {
          if (typeof d.seekTime === "number") onSeek(d.seekTime);
        });
        ms.setActionHandler("seekbackward", (d) => {
          onSeek(Math.max(0, at() - (d.seekOffset || 10)));
        });
        ms.setActionHandler("seekforward", (d) => {
          const max = duration && isFinite(duration) ? duration : Infinity;
          onSeek(Math.min(max, at() + (d.seekOffset || 10)));
        });
      } catch {}
    }

    return () => {
      (["play", "pause", "nexttrack", "previoustrack", "stop", "seekto", "seekbackward", "seekforward"] as MediaSessionAction[])
        .forEach((a) => { try { ms.setActionHandler(a, null); } catch {} });
    };
  }, [onPlay, onPause, onNext, onPrev, onStop, onSeek, currentTime, duration]);
}
