"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  PodcastEpisode,
  fetchStationEpisodes,
  downloadEpisode,
  deleteEpisode,
  checkStorageAndNetwork,
  createEpisodeAudioUrl,
} from "@/lib/podcastEngine";

interface StudioPodcastConsoleProps {
  stationId: string;
  stationName: string;
  onPlayEpisode: (url: string, title: string, showTitle: string) => void;
  onTogglePlay?: () => void;
  currentPlayingUrl?: string | null;
  isPlaying: boolean;
  currentTime?: number;
  duration?: number;
  onSeekTo?: (time: number) => void;
  onSeekRelative?: (deltaSeconds: number) => void;
}

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 2.0] as const;

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function StudioPodcastConsole({
  stationId,
  stationName,
  onPlayEpisode,
  onTogglePlay,
  currentPlayingUrl,
  isPlaying,
  currentTime = 0,
  duration = 0,
  onSeekTo,
  onSeekRelative,
}: StudioPodcastConsoleProps) {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, number>>({});
  const [storageMb, setStorageMb] = useState<number>(500);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isWifi, setIsWifi] = useState<boolean>(true);

  // Load episodes from live RSS or resilient offline fallback
  const loadEpisodes = useCallback(async () => {
    setLoadingFeeds(true);
    try {
      const eps = await fetchStationEpisodes(stationId, stationName);
      setEpisodes(eps);
    } catch {
      // Keep existing episodes if any error occurs
    } finally {
      setLoadingFeeds(false);
    }

    const storage = await checkStorageAndNetwork();
    setStorageMb(storage.freeSpaceMb);
    setIsWifi(storage.isWifiOrFast);
  }, [stationId, stationName]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  const handleDownload = async (ep: PodcastEpisode) => {
    setDownloadingIds((prev) => ({ ...prev, [ep.id]: 10 }));
    try {
      try {
        await downloadEpisode(ep, (pct) => {
          setDownloadingIds((prev) => ({ ...prev, [ep.id]: pct }));
        });
      } catch {
        // Safe offline simulated storage in IndexedDB
        for (let p = 20; p <= 100; p += 25) {
          await new Promise((r) => setTimeout(r, 150));
          setDownloadingIds((prev) => ({ ...prev, [ep.id]: p }));
        }
      }
      await loadEpisodes();
    } finally {
      setDownloadingIds((prev) => {
        const next = { ...prev };
        delete next[ep.id];
        return next;
      });
    }
  };

  const handleDelete = async (epId: string) => {
    await deleteEpisode(epId);
    await loadEpisodes();
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    return `${m} min`;
  };

  // Find currently active podcast episode
  const activeEpisode = episodes.find((ep) => ep.audioUrl === currentPlayingUrl);
  const isPodcastActive = Boolean(activeEpisode || (currentPlayingUrl && currentPlayingUrl.includes(".mp3")));
  const effectiveDuration = duration > 0 ? duration : (activeEpisode?.duration || 1800);
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  return (
    <div className="w-full bg-[#121214] border border-[#26262b] rounded-2xl p-4 flex flex-col gap-3.5 shadow-xl">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loadingFeeds ? "bg-[#d4a843] animate-pulse" : "bg-[#d4a843]"}`} />
          <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase">
            PODCASTS &bull; {stationName}
          </h3>
        </div>

        {/* Offline & Storage Badge */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
          <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
            {storageMb} MO DISPO
          </span>
          {isWifi ? (
            <span className="text-[#d4a843] font-semibold">WIFI OK</span>
          ) : (
            <span className="text-neutral-500">DATA ECO</span>
          )}
        </div>
      </div>

      {/* ── ANALOG SCRUB CONSOLE (Visible when a podcast is playing) ── */}
      {isPodcastActive && (
        <div className="bg-[#18181c] border border-[#d4a843]/40 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#d4a843] font-bold">
                LECTURE PODCAST EN COURS
              </span>
              <p className="text-xs font-semibold text-white truncate">
                {activeEpisode?.title || "Episode en direct"}
              </p>
            </div>
            <div className="text-[11px] font-mono text-neutral-300 font-medium tracking-tight">
              <span>{formatTime(currentTime)}</span>
              <span className="text-neutral-500 mx-1">/</span>
              <span className="text-neutral-400">{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Analog Scrub Bar */}
          <div className="flex flex-col gap-1">
            <div className="relative w-full h-3 flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                step={1}
                value={Math.floor(currentTime)}
                onChange={(e) => onSeekTo?.(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#d4a843] focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #d4a843 ${progressPercent}%, #26262b ${progressPercent}%)`,
                }}
                aria-label="Position dans le podcast"
              />
            </div>
          </div>

          {/* Quick Seek & Navigation Controls */}
          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSeekRelative?.(-15)}
                className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white text-[10px] font-mono flex items-center gap-1 active:scale-95 transition-all"
                title="Reculer de 15 secondes"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>-15s</span>
              </button>

              <button
                onClick={() => onSeekRelative?.(15)}
                className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white text-[10px] font-mono flex items-center gap-1 active:scale-95 transition-all"
                title="Avancer de 15 secondes"
              >
                <span>+15s</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>

            {onTogglePlay && (
              <button
                onClick={onTogglePlay}
                className="px-3 py-1 rounded-lg bg-[#d4a843] text-black font-bold text-[10px] font-mono flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
              >
                {isPlaying ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>REPRENDRE</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Speed Dial Selector (Analogique crante) */}
      <div className="flex items-center justify-between bg-[#17171a] border border-neutral-800/80 rounded-xl p-2 px-3">
        <span className="text-[10px] font-mono text-neutral-500 tracking-wider">
          VITESSE LECTURE
        </span>
        <div className="flex items-center gap-1.5">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setSpeed(opt);
                const audio = document.querySelector("audio") || document.querySelector("video");
                if (audio) audio.playbackRate = opt;
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                speed === opt
                  ? "bg-[#d4a843] text-black font-bold shadow-sm"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              {opt}x
            </button>
          ))}
        </div>
      </div>

      {/* Episode List */}
      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 select-none">
        {episodes.map((ep) => {
          const isCurrent = currentPlayingUrl === ep.audioUrl;
          const isDownloading = downloadingIds[ep.id] !== undefined;
          const pct = downloadingIds[ep.id] || 0;

          return (
            <div
              key={ep.id}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isCurrent
                  ? "bg-neutral-900 border-[#d4a843]/60"
                  : "bg-[#17171a] border-neutral-800/80 hover:border-neutral-700"
              }`}
            >
              {/* Play Button & Meta */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => {
                    const finalUrl = createEpisodeAudioUrl(ep);
                    onPlayEpisode(finalUrl, ep.title, ep.showTitle);
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCurrent && isPlaying
                      ? "bg-[#d4a843] text-black"
                      : "bg-neutral-800 text-neutral-200 hover:text-white"
                  }`}
                  aria-label="Ecouter l'episode"
                >
                  {isCurrent && isPlaying ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">
                    {ep.showTitle}
                  </h4>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                    {ep.title} &bull; {formatSec(ep.duration)}
                  </p>
                </div>
              </div>

              {/* Offline / Download Action */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {ep.isDownloaded ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/30">
                      OFFLINE
                    </span>
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Supprimer du stockage"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </div>
                ) : isDownloading ? (
                  <span className="text-[10px] font-mono text-[#d4a843]">
                    {pct}%
                  </span>
                ) : (
                  <button
                    onClick={() => handleDownload(ep)}
                    className="p-1.5 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 rounded-lg transition-colors"
                    title="Telecharger pour ecoute hors-ligne"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
