"use client";
import { useState, useRef, useEffect, useCallback } from "react";

export interface RecordedTrack {
  id: string;
  stationName: string;
  trackTitle?: string;
  timestamp: number;
  durationSec: number;
  blobUrl: string;
  blobSize: number;
}

interface UseAudioRecorderProps {
  mediaElRef: React.MutableRefObject<HTMLMediaElement | null>;
  ctxRef?: React.MutableRefObject<AudioContext | null>;
  gainRef?: React.MutableRefObject<GainNode | null>;
  currentStationName?: string;
  currentSongTitle?: string | null;
}

export function useAudioRecorder({
  mediaElRef,
  ctxRef,
  gainRef,
  currentStationName = "RadioFR",
  currentSongTitle,
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

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, []);

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

    if (!stream || stream.getAudioTracks().length === 0) {
      setError("Enregistrement non supporté ou flux audio protégé par le navigateur.");
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

      mr.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: selectedMime || "audio/webm" });
        const blobUrl = URL.createObjectURL(blob);

        const newRec: RecordedTrack = {
          id: `rec_${Date.now()}`,
          stationName: currentStationName,
          trackTitle: currentSongTitle || undefined,
          timestamp: Date.now(),
          durationSec: duration,
          blobUrl,
          blobSize: blob.size,
        };

        setRecordings((prev) => [newRec, ...prev]);
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
  }, [ctxRef, gainRef, mediaElRef, currentStationName, currentSongTitle]);

  const stopRecording = useCallback(() => {
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
