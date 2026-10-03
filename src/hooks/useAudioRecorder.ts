"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  saveRecordingToDB,
  getAllRecordingsFromDB,
  deleteRecordingFromDB,
  StoredRecording,
} from "@/lib/recordingsStorage";

export interface RecordedTrack {
  id: string;
  stationName: string;
  trackTitle?: string;
  timestamp: number;
  durationSec: number;
  blobUrl: string;
  blobSize: number;
  mimeType: string;
  blob: Blob;
}

interface UseAudioRecorderProps {
  mediaElRef: React.MutableRefObject<HTMLMediaElement | null>;
  ctxRef?: React.MutableRefObject<AudioContext | null>;
  gainRef?: React.MutableRefObject<GainNode | null>;
  currentStationName?: string;
  currentSongTitle?: string | null;
  currentStreamUrl?: string | null;
  onRecordingFinished?: (track: RecordedTrack) => void;
}

export function useAudioRecorder({
  mediaElRef,
  ctxRef,
  gainRef,
  currentStationName = "RadioFR",
  currentSongTitle,
  currentStreamUrl,
  onRecordingFinished,
}: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordings, setRecordings] = useState<RecordedTrack[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Keep track of active blob URLs for cleanup
  const activeUrlsRef = useRef<string[]>([]);
  const onFinishedCallbackRef = useRef(onRecordingFinished);
  onFinishedCallbackRef.current = onRecordingFinished;

  // Load existing recordings from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    getAllRecordingsFromDB().then((storedList) => {
      if (!mounted) return;
      const loaded: RecordedTrack[] = storedList.map((item) => {
        const url = URL.createObjectURL(item.blob);
        activeUrlsRef.current.push(url);
        return {
          id: item.id,
          stationName: item.stationName,
          trackTitle: item.trackTitle,
          timestamp: item.timestamp,
          durationSec: item.durationSec,
          blobUrl: url,
          blobSize: item.blobSize,
          mimeType: item.mimeType,
          blob: item.blob,
        };
      });
      setRecordings(loaded);
    }).catch(() => {});

    return () => {
      mounted = false;
      // Revoke any created blob URLs
      activeUrlsRef.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
    };
  }, []);

  // Clear timer and ongoing recorders on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortCtrlRef.current) {
        try { abortCtrlRef.current.abort(); } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, []);

  const handleNewRecording = useCallback(async (blob: Blob, mimeType: string) => {
    const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    const blobUrl = URL.createObjectURL(blob);
    activeUrlsRef.current.push(blobUrl);

    const newRec: RecordedTrack = {
      id: `rec_${Date.now()}`,
      stationName: currentStationName,
      trackTitle: currentSongTitle || undefined,
      timestamp: Date.now(),
      durationSec: duration,
      blobUrl,
      blobSize: blob.size,
      mimeType,
      blob,
    };

    // Save to IndexedDB for persistent storage across refreshes
    try {
      const storedItem: StoredRecording = {
        id: newRec.id,
        stationName: newRec.stationName,
        trackTitle: newRec.trackTitle,
        timestamp: newRec.timestamp,
        durationSec: newRec.durationSec,
        blobSize: newRec.blobSize,
        mimeType: newRec.mimeType,
        blob: newRec.blob,
      };
      await saveRecordingToDB(storedItem);
    } catch (e) {
      console.error("Failed to save recording to IndexedDB", e);
    }

    setRecordings((prev) => [newRec, ...prev]);
    if (onFinishedCallbackRef.current) {
      onFinishedCallbackRef.current(newRec);
    }
  }, [currentStationName, currentSongTitle]);

  const startStreamFetchRecording = useCallback(async (url: string) => {
    try {
      const abortCtrl = new AbortController();
      abortCtrlRef.current = abortCtrl;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      // Route through local edge proxy to bypass CORS restrictions
      const proxyUrl = `/api/audio?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: abortCtrl.signal });

      if (!res.ok || !res.body) {
        throw new Error(`Erreur flux (${res.status})`);
      }

      const reader = res.body.getReader();
      chunksRef.current = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done || abortCtrl.signal.aborted) break;
        if (value && value.byteLength > 0) {
          chunksRef.current.push(new Blob([value]));
        }
      }

      // Finish recording
      if (chunksRef.current.length > 0) {
        const mime = "audio/mpeg";
        const blob = new Blob(chunksRef.current, { type: mime });
        await handleNewRecording(blob, mime);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError("Erreur lors de l'enregistrement du flux.");
      }
    } finally {
      setIsRecording(false);
      setRecordingSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      abortCtrlRef.current = null;
    }
  }, [handleNewRecording]);

  const startRecording = useCallback(() => {
    setError(null);
    chunksRef.current = [];

    let stream: MediaStream | null = null;

    // 1. Try via Web Audio MediaStreamDestinationNode if ctx and gain exist
    if (ctxRef?.current && gainRef?.current) {
      try {
        const dest = ctxRef.current.createMediaStreamDestination();
        gainRef.current.connect(dest);
        stream = dest.stream;
      } catch (err) {
        // Fallback below
      }
    }

    // 2. Fallback to HTMLMediaElement.captureStream() or mozCaptureStream()
    if (!stream && mediaElRef.current) {
      try {
        const el = mediaElRef.current as any;
        if (typeof el.captureStream === "function") {
          stream = el.captureStream();
        } else if (typeof el.mozCaptureStream === "function") {
          stream = el.mozCaptureStream();
        }
      } catch (err) {
        // Fallback
      }
    }

    // 3. If browser blocks stream capture due to CORS, use Direct Stream Fetch recording
    if (!stream || stream.getAudioTracks().length === 0) {
      if (currentStreamUrl) {
        startStreamFetchRecording(currentStreamUrl);
        return;
      }
      setError("Flux protégé ou non capturable.");
      return;
    }

    activeStreamRef.current = stream;

    // Choose preferred mimeType
    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/aac",
    ];
    let selectedMime = "";
    for (const m of mimeTypes) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    try {
      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mr = new MediaRecorder(stream, options);

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mr.onstop = async () => {
        const mime = selectedMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        await handleNewRecording(blob, mime);

        setIsRecording(false);
        setRecordingSeconds(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      startTimeRef.current = Date.now();
      mr.start(1000); // 1-second slices
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (e: any) {
      setError(e?.message || "Impossible de démarrer l'enregistrement.");
      setIsRecording(false);
    }
  }, [ctxRef, gainRef, mediaElRef, currentStreamUrl, handleNewRecording, startStreamFetchRecording]);

  const stopRecording = useCallback(() => {
    if (abortCtrlRef.current) {
      try { abortCtrlRef.current.abort(); } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        setIsRecording(false);
      }
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const deleteRecording = useCallback((id: string) => {
    deleteRecordingFromDB(id).catch(() => {});
    setRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.blobUrl) {
        try { URL.revokeObjectURL(target.blobUrl); } catch {}
      }
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  return {
    isRecording,
    recordingSeconds,
    recordings,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
    deleteRecording,
  };
}
