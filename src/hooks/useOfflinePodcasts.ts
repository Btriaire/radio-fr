"use client";
import { useState, useEffect, useCallback } from "react";
import {
  OfflineEpisode,
  getOfflineEpisodes,
  saveOfflineEpisode,
  deleteOfflineEpisode,
  clearAllOfflineEpisodes,
  getOfflineBlobUrl
} from "@/lib/offlineStorage";

export function useOfflinePodcasts() {
  const [offlineEpisodes, setOfflineEpisodes] = useState<OfflineEpisode[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const items = await getOfflineEpisodes();
      setOfflineEpisodes(items);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isDownloaded = useCallback(
    (audioUrl: string) => offlineEpisodes.some((e) => e.id === audioUrl),
    [offlineEpisodes]
  );

  const downloadEpisode = useCallback(
    async (
      ep: { title: string; audioUrl: string; duration: string; pubDate: string; fileSize?: number; isVideo?: boolean },
      pod: { trackName: string; artworkUrl600?: string; artworkUrl100?: string }
    ) => {
      setDownloadingIds((prev) => ({ ...prev, [ep.audioUrl]: 10 }));
      try {
        await saveOfflineEpisode(ep, pod, (pct) => {
          setDownloadingIds((prev) => ({ ...prev, [ep.audioUrl]: pct }));
        });
        await refresh();
      } catch (err: any) {
        alert("Erreur de téléchargement : " + (err?.message || "inconnue"));
      } finally {
        setDownloadingIds((prev) => {
          const next = { ...prev };
          delete next[ep.audioUrl];
          return next;
        });
      }
    },
    [refresh]
  );

  const removeEpisode = useCallback(
    async (id: string) => {
      try {
        await deleteOfflineEpisode(id);
        await refresh();
      } catch {}
    },
    [refresh]
  );

  const clearAll = useCallback(async () => {
    try {
      await clearAllOfflineEpisodes();
      await refresh();
    } catch {}
  }, [refresh]);

  const totalBytes = offlineEpisodes.reduce((acc, ep) => acc + (ep.sizeBytes || 0), 0);

  return {
    offlineEpisodes,
    downloadingIds,
    isDownloaded,
    downloadEpisode,
    removeEpisode,
    clearAll,
    totalBytes,
    loading,
    refresh,
    getOfflineBlobUrl,
  };
}
