'use client';

import React, { useState, useEffect } from 'react';
import { Station } from '@/lib/stations';
import { useAlarmClock } from '@/hooks/useAlarmClock';
import { Alarm } from '@/types/alarm';

interface AlarmClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  alarmState: ReturnType<typeof useAlarmClock>;
  stations: Station[];
  currentStation?: Station | null;
}

const DAY_LABELS = [
  { day: 1, label: 'L', full: 'Lun' },
  { day: 2, label: 'M', full: 'Mar' },
  { day: 3, label: 'M', full: 'Mer' },
  { day: 4, label: 'J', full: 'Jeu' },
  { day: 5, label: 'V', full: 'Ven' },
  { day: 6, label: 'S', full: 'Sam' },
  { day: 0, label: 'D', full: 'Dim' },
];

export const AlarmClockModal: React.FC<AlarmClockModalProps> = ({
  isOpen,
  onClose,
  alarmState,
  stations,
  currentStation,
}) => {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [isNewAlarmOpen, setIsNewAlarmOpen] = useState(false);

  // Formulaire d'ajout
  const [time, setTime] = useState('07:00');
  const [label, setLabel] = useState('Reveil');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [stationId, setStationId] = useState(currentStation?.id || 'franceinfo');
  const [targetVolume, setTargetVolume] = useState(0.8);
  const [sunriseMinutes, setSunriseMinutes] = useState(5);
  const [snoozeMinutes, setSnoozeMinutes] = useState(9);

  // Horloge en temps réel pour le mode chevet et la modale
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDateStr(
        now.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen && !alarmState.nightstandOpen && !alarmState.isRinging) {
    return null;
  }

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleQuickDays = (type: 'weekdays' | 'weekend' | 'all' | 'once') => {
    if (type === 'weekdays') setSelectedDays([1, 2, 3, 4, 5]);
    else if (type === 'weekend') setSelectedDays([6, 0]);
    else if (type === 'all') setSelectedDays([1, 2, 3, 4, 5, 6, 0]);
    else if (type === 'once') setSelectedDays([]);
  };

  const handleAddAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    alarmState.addAlarm({
      time,
      label: label.trim() || 'Reveil',
      days: selectedDays,
      stationId,
      targetVolume,
      sunriseMinutes,
      snoozeMinutes,
      enabled: true,
    });
    setIsNewAlarmOpen(false);
  };

  // Affichage Horloge de Chevet Immersif (Nightstand)
  if (alarmState.nightstandOpen) {
    const dimRatio = Math.max(0.1, alarmState.nightstandBrightness / 100);

    return (
      <div
        className="fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between p-6 select-none transition-opacity duration-300"
        style={{ opacity: dimRatio }}
      >
        {/* Barre supérieure chevet */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs text-white/80 border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  alarmState.wakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-mono uppercase tracking-wider">
                {alarmState.wakeLockActive ? 'WAKE LOCK ACTIF' : 'WAKE LOCK VEILLE'}
              </span>
            </div>

            {currentStation && (
              <span className="text-xs text-white/60 font-mono hidden sm:inline">
                RADIO : {currentStation.name}
              </span>
            )}
          </div>

          <button
            onClick={() => alarmState.setNightstandOpen(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase tracking-wider transition-colors border border-white/10"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Quitter Chevet
          </button>
        </div>

        {/* Centre : Affichage Heure Géante */}
        <div className="text-center my-auto flex flex-col items-center">
          <div className="font-mono font-bold tracking-tighter text-7xl sm:text-9xl md:text-[11rem] leading-none text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.15)]">
            {currentTimeStr.slice(0, 5)}
          </div>
          <div className="mt-2 font-mono text-sm sm:text-base text-white/50 tracking-widest uppercase">
            {currentTimeStr.slice(6, 8)} SECONDES
          </div>
          <div className="mt-4 text-base sm:text-xl text-white/80 font-medium capitalize tracking-wide">
            {currentDateStr}
          </div>

          {/* Bandeau d'alarme active si déclenchée */}
          {alarmState.isRinging && (
            <div className="mt-8 w-full max-w-lg p-5 rounded-2xl bg-amber-500/20 border border-amber-500/40 backdrop-blur-md animate-pulse">
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300">
                {alarmState.isSunrise
                  ? 'SUNRISE AUDIO ACTIF (PROGRESSION LOGARITHMIQUE)'
                  : alarmState.isBackupChime
                  ? 'CARILLON DE SECOURS ACTIF (STREAM INDISPONIBLE)'
                  : 'REVEIL RADIO EN COURS'}
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {alarmState.activeAlarm?.label || 'Reveil'}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => alarmState.snooze()}
                  className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
                >
                  SNOOZE (+{alarmState.activeAlarm?.snoozeMinutes || 9} MIN)
                </button>
                <button
                  onClick={() => alarmState.stopAlarm()}
                  className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
                >
                  ARRETER
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pied : Réglage Luminosité OLED */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-4 max-w-xl mx-auto w-full">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <svg className="w-4 h-4 text-white/60 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <input
              type="range"
              min="10"
              max="100"
              value={alarmState.nightstandBrightness}
              onChange={(e) => alarmState.setNightstandBrightness(Number(e.target.value))}
              className="w-full sm:w-44 accent-white cursor-pointer"
            />
            <span className="font-mono text-xs text-white/60 w-10 text-right">
              {alarmState.nightstandBrightness}%
            </span>
          </div>

          <div className="text-xs text-white/40 font-mono tracking-wider">
            TOUCHER LE BOUTON FERMER POUR SORTIR
          </div>
        </div>
      </div>
    );
  }

  // Modale Standard
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* En-tête de la modale */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="13" r="8" strokeWidth={2} />
                <path strokeWidth={2} strokeLinecap="round" d="M12 9v4l2.5 2.5M5 3L2 6M19 3l3 3" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                REVEIL HI-FI & SUNRISE AUDIO
              </h2>
              <p className="text-xs text-neutral-400">
                Reveils multiples, montee progressive du volume et secours offline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alarmState.setNightstandOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono uppercase tracking-wider text-neutral-200 border border-neutral-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Mode Chevet
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Fermer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Alerte si alarme sonne */}
        {alarmState.isRinging && (
          <div className="p-4 bg-amber-500/20 border-b border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <div>
                <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                  {alarmState.isSunrise
                    ? 'SUNRISE AUDIO ACTIF'
                    : alarmState.isBackupChime
                    ? 'CARILLON DE SECOURS WEB AUDIO'
                    : 'REVEIL RADIO EN COURS'}
                </div>
                <div className="text-sm font-semibold text-white">
                  {alarmState.activeAlarm?.label || 'Reveil'} • {alarmState.activeAlarm?.time}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => alarmState.snooze()}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Snooze (+{alarmState.activeAlarm?.snoozeMinutes || 9}m)
              </button>
              <button
                onClick={() => alarmState.stopAlarm()}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Arreter
              </button>
            </div>
          </div>
        )}

        {/* Corps principal : Liste & Formulaire */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Liste des alarmes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                Mes Reveils ({alarmState.alarms.length})
              </h3>
              <button
                onClick={() => setIsNewAlarmOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${isNewAlarmOpen ? 'rotate-45' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isNewAlarmOpen ? 'Fermer' : 'Nouveau Reveil'}
              </button>
            </div>

            {alarmState.alarms.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs font-mono">
                AUCUN REVEIL CONFIGURE
              </div>
            ) : (
              <div className="space-y-2">
                {alarmState.alarms.map((alarm) => {
                  const targetStation = stations.find((s) => s.id === alarm.stationId);

                  return (
                    <div
                      key={alarm.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        alarm.enabled
                          ? 'bg-neutral-800/60 border-neutral-700/80'
                          : 'bg-neutral-900/40 border-neutral-800 text-neutral-500'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <button
                          onClick={() => alarmState.toggleAlarm(alarm.id)}
                          className={`w-11 h-6 rounded-full p-1 transition-colors relative flex items-center ${
                            alarm.enabled ? 'bg-amber-500' : 'bg-neutral-700'
                          }`}
                          aria-label="Activer ou desactiver"
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              alarm.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-2xl font-bold tracking-tight text-white">
                              {alarm.time}
                            </span>
                            <span className="text-xs text-neutral-400 font-medium">
                              {alarm.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-neutral-400 font-mono">
                              {targetStation ? targetStation.name : 'France Info'}
                            </span>
                            {alarm.sunriseMinutes > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                                Sunrise {alarm.sunriseMinutes}m
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 font-mono">
                              Vol {Math.round(alarm.targetVolume * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Jours */}
                        <div className="flex gap-1">
                          {DAY_LABELS.map((d) => {
                            const isSelected = alarm.days.includes(d.day);
                            return (
                              <span
                                key={d.day}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono ${
                                  isSelected
                                    ? 'bg-neutral-700 text-white font-bold'
                                    : 'text-neutral-600'
                                }`}
                              >
                                {d.label}
                              </span>
                            );
                          })}
                        </div>

                        {/* Bouton supprimer */}
                        <button
                          onClick={() => alarmState.deleteAlarm(alarm.id)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-700/50 transition-colors"
                          aria-label="Supprimer"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulaire ajout nouveau réveil */}
          {isNewAlarmOpen && (
            <form
              onSubmit={handleAddAlarm}
              className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-4 animate-fade-in"
            >
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                Programmer un Nouveau Reveil
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1.5">
                    HEURE DU REVEIL
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-xl focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1.5">
                    INTITULE / LIBELLE
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Ex: Reveil Matin"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Jours actifs */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-neutral-400">
                    JOURS DE REPETITION
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickDays('weekdays')}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Semaine
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDays('weekend')}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Week-end
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDays('all')}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Tous
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDays('once')}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Une fois
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS.map((d) => {
                    const isSelected = selectedDays.includes(d.day);
                    return (
                      <button
                        type="button"
                        key={d.day}
                        onClick={() => handleDayToggle(d.day)}
                        className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow-sm'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                      >
                        {d.full}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Station radio & Volume */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1.5">
                    STATION RADIO CIBLE
                  </label>
                  <select
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-xs focus:border-amber-500 outline-none"
                  >
                    <option value="current">Derniere station ecoutee</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono text-neutral-400">
                      VOLUME FINAL
                    </label>
                    <span className="text-xs font-mono text-amber-400">
                      {Math.round(targetVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={targetVolume}
                    onChange={(e) => setTargetVolume(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Sunrise Audio & Snooze */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1.5">
                    FONDU SUNRISE AUDIO
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 2, 5, 10].map((mins) => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setSunriseMinutes(mins)}
                        className={`py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          sunriseMinutes === mins
                            ? 'bg-purple-600 text-white font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                      >
                        {mins === 0 ? 'Direct' : `${mins} min`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-neutral-400 mb-1.5">
                    DUREE DE SNOOZE
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 9, 10, 15].map((mins) => (
                      <button
                        type="button"
                        key={mins}
                        onClick={() => setSnoozeMinutes(mins)}
                        className={`py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          snoozeMinutes === mins
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Enregistrer le Reveil
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewAlarmOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs font-mono transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
