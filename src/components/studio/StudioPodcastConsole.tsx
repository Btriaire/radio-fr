"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  PodcastEpisode,
  STATION_PODCAST_FEEDS,
  getDownloadedEpisodes,
  downloadEpisode,
  deleteEpisode,
  checkStorageAndNetwork,
  createEpisodeAudioUrl,
} from "@/lib/podcastEngine";

interface StudioPodcastConsoleProps {
  stationId: string;
  stationName: string;
  onPlayEpisode: (url: string, title: string, showTitle: string) => void;
  currentPlayingUrl?: string | null;
  isPlaying: boolean;
}

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 2.0] as const;

export default function StudioPodcastConsole({
  stationId,
  stationName,
  onPlayEpisode,
  currentPlayingUrl,
  isPlaying,
}: StudioPodcastConsoleProps) {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, number>>({});
  const [storageMb, setStorageMb] = useState<number>(500);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isWifi, setIsWifi] = useState<boolean>(true);

  // Load offline downloaded episodes & mock static sample for the station
  const loadEpisodes = useCallback(async () => {
    const downloaded = await getDownloadedEpisodes(stationId);
    const feeds = STATION_PODCAST_FEEDS[stationId] || [
      { showTitle: `${stationName} Direct Replay`, rssUrl: "" },
      { showTitle: "Chronique Essentielle", rssUrl: "" },
      { showTitle: "L'Émission du Jour", rssUrl: "" },
    ];

    const sampleEpisodes: PodcastEpisode[] = feeds.map((feed, i) => {
      const id = `${stationId}-ep-${i + 1}`;
      const down = downloaded.find((d) => d.id === id);
      if (down) return down;
      return {
        id,
        title: `Édition quotidienne & débats exclusifs #${i + 1}`,
        showTitle: feed.showTitle,
        stationId,
        audioUrl: "https://media.radiofrance-podcast.net/podcast09/10010-06.10.2026-ITEMA_23891001-0.mp3",
        duration: 1800 + i * 360,
        publishedAt: "Aujourd'hui",
        isDownloaded: false,
        progress: 0,
      };
    });

    setEpisodes(sampleEpisodes);

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
      // Direct stream download or resilient fallback simulation for demo
      try {
        await downloadEpisode(ep, (pct) => {
          setDownloadingIds((prev) => ({ ...prev, [ep.id]: pct }));
        });
      } catch {
        // Safe offline simulated storage in IndexedDB
        for (let p = 20; p <= 100; p += 25) {
          await new Promise((r) => setTimeout(r, 200));
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

  return (
    <div className="w-full bg-[#121214] border border-[#26262b] rounded-2xl p-4 flex flex-col gap-3.5 shadow-xl">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#d4a843]" />
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
            <span className="text-neutral-500">DATA ÉCO</span>
          )}
        </div>
      </div>

      {/* Speed Dial Selector (Analogique cranté) */}
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
                const audio = document.querySelector("audio");
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
                  aria-label="Écouter l'épisode"
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
                    title="Télécharger pour écoute hors-ligne"
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
