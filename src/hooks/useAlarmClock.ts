import { useState, useEffect, useRef, useCallback } from 'react';
import { Alarm, NightstandTheme } from '../types/alarm';

const STORAGE_KEY = 'radio_fr_alarms_v1';

const DEFAULT_ALARMS: Alarm[] = [
  {
    id: 'default-weekday',
    label: 'Reveil Semaine',
    time: '07:00',
    days: [1, 2, 3, 4, 5],
    stationId: 'franceinfo',
    targetVolume: 0.8,
    sunriseMinutes: 5,
    snoozeMinutes: 9,
    enabled: true,
  },
  {
    id: 'default-weekend',
    label: 'Reveil Week-end',
    time: '09:00',
    days: [0, 6],
    stationId: 'fip',
    targetVolume: 0.7,
    sunriseMinutes: 3,
    snoozeMinutes: 9,
    enabled: true,
  },
];

export function useAlarmClock({
  onPlayStation,
  onSetVolume,
  currentStationId,
  isPlaying,
}: {
  onPlayStation: (stationId: string) => void;
  onSetVolume: (volume: number) => void;
  currentStationId?: string;
  isPlaying: boolean;
}) {
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_ALARMS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved alarms', e);
    }
    return DEFAULT_ALARMS;
  });

  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [isSunrise, setIsSunrise] = useState(false);
  const [isBackupChime, setIsBackupChime] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [nightstandOpen, setNightstandOpen] = useState(false);
  const [nightstandBrightness, setNightstandBrightness] = useState(60);
  const [nightstandTheme, setNightstandTheme] = useState<NightstandTheme>('minimal');

  const lastTriggeredMinuteRef = useRef<string>('');
  const sunriseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sauvegarde persistante
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    } catch (e) {
      console.error('Failed to save alarms to localStorage', e);
    }
  }, [alarms]);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);

        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock request refused or not supported:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignorer
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  // Gestion du maintien WakeLock lors du changement de visibilité
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && (isRinging || nightstandOpen) && !wakeLockActive) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRinging, nightstandOpen, wakeLockActive, requestWakeLock]);

  // Si le mode chevet est ouvert, acquérir le WakeLock automatiquement
  useEffect(() => {
    if (nightstandOpen) {
      requestWakeLock();
    } else if (!isRinging) {
      releaseWakeLock();
    }
  }, [nightstandOpen, isRinging, requestWakeLock, releaseWakeLock]);

  const stopSunrise = useCallback(() => {
    if (sunriseIntervalRef.current) {
      clearInterval(sunriseIntervalRef.current);
      sunriseIntervalRef.current = null;
    }
    setIsSunrise(false);
  }, []);

  const playBackupChime = useCallback(() => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      setIsBackupChime(true);

      const notes = [261.63, 329.63, 392.0, 523.25]; // Do4, Mi4, Sol4, Do5
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 1400;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.22);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.4, now + idx * 0.22 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.22 + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.22);
        osc.stop(now + idx * 0.22 + 1.3);
      });
    } catch (err) {
      console.error('Backup chime error:', err);
    }
  }, []);

  const startSunrise = useCallback((alarm: Alarm) => {
    const startTime = Date.now();
    const duration = Math.max(1, alarm.sunriseMinutes) * 60 * 1000;

    if (sunriseIntervalRef.current) clearInterval(sunriseIntervalRef.current);

    sunriseIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / duration, 1);

      // Courbe logarithmique douce pour l'oreille humaine
      const newVol = 0.05 + (alarm.targetVolume - 0.05) * Math.log10(1 + 9 * ratio);
      onSetVolume(Math.min(1, Math.max(0.05, newVol)));

      if (elapsed >= duration) {
        stopSunrise();
        onSetVolume(alarm.targetVolume);
      }
    }, 500);
  }, [onSetVolume, stopSunrise]);

  const triggerAlarm = useCallback((alarm: Alarm) => {
    setActiveAlarm(alarm);
    setIsRinging(true);
    setIsSunrise(alarm.sunriseMinutes > 0);

    const stationId = alarm.stationId === 'current'
      ? (currentStationId || 'franceinfo')
      : alarm.stationId;

    if (alarm.sunriseMinutes > 0) {
      onSetVolume(0.05);
      startSunrise(alarm);
    } else {
      onSetVolume(alarm.targetVolume);
    }

    onPlayStation(stationId);
    requestWakeLock();

    // Surveillance de secours après 8s si le flux ne joue pas
    if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    watchdogTimeoutRef.current = setTimeout(() => {
      playBackupChime();
      if (chimeIntervalRef.current) clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = setInterval(() => {
        playBackupChime();
      }, 4500);
    }, 8000);
  }, [currentStationId, onPlayStation, onSetVolume, startSunrise, requestWakeLock, playBackupChime]);

  // Si le flux audio passe en lecture, couper le carillon de secours
  useEffect(() => {
    if (isPlaying && isRinging) {
      if (watchdogTimeoutRef.current) {
        clearTimeout(watchdogTimeoutRef.current);
        watchdogTimeoutRef.current = null;
      }
      if (chimeIntervalRef.current) {
        clearInterval(chimeIntervalRef.current);
        chimeIntervalRef.current = null;
      }
      setIsBackupChime(false);
    }
  }, [isPlaying, isRinging]);

  // Boucle de détection des alarmes chaque seconde
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const day = now.getDay(); // 0 = dimanche, 1 = lundi, etc.

      const currentMinuteToken = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${currentTime}`;
      if (currentMinuteToken === lastTriggeredMinuteRef.current) return;

      const matchedAlarm = alarms.find((alarm) => {
        if (!alarm.enabled) return false;
        if (alarm.time !== currentTime) return false;
        if (alarm.days.length === 0) return true; // une seule fois
        return alarm.days.includes(day);
      });

      if (matchedAlarm && !isRinging) {
        lastTriggeredMinuteRef.current = currentMinuteToken;
        triggerAlarm(matchedAlarm);

        // Si l'alarme n'avait pas de jours de récurrence, on la désactive pour les prochaines fois
        if (matchedAlarm.days.length === 0) {
          setAlarms((prev) =>
            prev.map((a) => (a.id === matchedAlarm.id ? { ...a, enabled: false } : a))
          );
        }
      }
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [alarms, isRinging, triggerAlarm]);

  const stopAlarm = useCallback(() => {
    setIsRinging(false);
    setIsSunrise(false);
    setIsBackupChime(false);
    setActiveAlarm(null);
    stopSunrise();

    if (watchdogTimeoutRef.current) {
      clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = null;
    }
    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }

    if (!nightstandOpen) {
      releaseWakeLock();
    }
  }, [stopSunrise, nightstandOpen, releaseWakeLock]);

  const snooze = useCallback(() => {
    if (!activeAlarm) return;

    const now = new Date();
    const snoozeMinutes = activeAlarm.snoozeMinutes || 9;
    const snoozeDate = new Date(now.getTime() + snoozeMinutes * 60000);
    const newHours = String(snoozeDate.getHours()).padStart(2, '0');
    const newMinutes = String(snoozeDate.getMinutes()).padStart(2, '0');
    const newTime = `${newHours}:${newMinutes}`;

    setAlarms((prev) =>
      prev.map((a) => (a.id === activeAlarm.id ? { ...a, time: newTime, enabled: true } : a))
    );

    stopAlarm();
  }, [activeAlarm, stopAlarm]);

  const addAlarm = useCallback((alarmData: Omit<Alarm, 'id'>) => {
    const newAlarm: Alarm = {
      ...alarmData,
      id: `alarm-${Date.now()}`,
    };
    setAlarms((prev) => [...prev, newAlarm]);
  }, []);

  const updateAlarm = useCallback((id: string, updates: Partial<Alarm>) => {
    setAlarms((prev) =>
      prev.map((alarm) => (alarm.id === id ? { ...alarm, ...updates } : alarm))
    );
  }, []);

  const deleteAlarm = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((alarm) => alarm.id !== id));
  }, []);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms((prev) =>
      prev.map((alarm) => (alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm))
    );
  }, []);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (sunriseIntervalRef.current) clearInterval(sunriseIntervalRef.current);
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      if (chimeIntervalRef.current) clearInterval(chimeIntervalRef.current);
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    alarms,
    activeAlarm,
    isRinging,
    isSunrise,
    isBackupChime,
    wakeLockActive,
    nightstandOpen,
    nightstandBrightness,
    nightstandTheme,
    setNightstandOpen,
    setNightstandBrightness,
    setNightstandTheme,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm,
    snooze,
    stopAlarm,
    requestWakeLock,
    releaseWakeLock,
    playBackupChime,
  };
}
