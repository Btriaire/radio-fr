export interface Alarm {
  id: string;
  label: string;
  time: string; // 'HH:MM'
  enabled: boolean;
  days: number[]; // 0=dimanche, 1=lundi..6=samedi. [] = une seule fois
  stationId: string; // ID station ou 'current'
  targetVolume: number; // 0.1 a 1.0
  sunriseMinutes: number; // 0, 1, 2, 5, 10, 15 min
  snoozeMinutes: number; // 5, 9, 10, 15 min
}

export type NightstandTheme = 'minimal' | 'flip' | 'amber' | 'digital';
