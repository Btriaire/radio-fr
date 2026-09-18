/**
 * Acoustic processing profiles and DSP equal loudness compensation.
 * Designed and sequenced with Falken-Smart.
 */

export type AudioDspPreset =
  | "flat"
  | "voice_clarity"
  | "music_hd"
  | "bass_punch"
  | "night_calm"
  | "podcast_intelligibility";

export interface DspProfileConfig {
  id: AudioDspPreset;
  name: string;
  description: string;
  gains: number[]; // exactly 10 bands: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k in dB
}

export const DSP_PROFILES: Record<AudioDspPreset, DspProfileConfig> = {
  flat: {
    id: "flat",
    name: "Neutre",
    description: "Reproduction sonore lineaire et fidele au mixage d'origine",
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  voice_clarity: {
    id: "voice_clarity",
    name: "Voix Nette",
    description: "Attenuation des grondements graves et renfort d'intelligibilite des voix (1-4 kHz)",
    gains: [-6, -4, -2, -1, 0, 2, 4, 3, 1, -2],
  },
  music_hd: {
    id: "music_hd",
    name: "Musique Haute Definition",
    description: "Chaleur des basses frequences et brillance cristalline des aigus",
    gains: [3, 4, 2, 0, -1, 1, 2, 3, 4, 3],
  },
  bass_punch: {
    id: "bass_punch",
    name: "Bass Boost & Punch",
    description: "Accentuation puissante des sous-basses et de la dynamique rythmique",
    gains: [5, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  },
  night_calm: {
    id: "night_calm",
    name: "Ecoute Nocturne",
    description: "Reduction de l'agressivite des aigus et des extremes graves pour un son reposant",
    gains: [-5, -3, 0, 0, 1, 1, 0, -2, -4, -6],
  },
  podcast_intelligibility: {
    id: "podcast_intelligibility",
    name: "Special Podcast",
    description: "Elimination des bruits de micro et maximisation de la clarte d'elocution",
    gains: [-7, -5, -2, 0, 1, 3, 4, 2, 0, -3],
  },
};

/**
 * Computes Fletcher-Munson dynamic loudness compensation offsets (in dB).
 * Human hearing loses sensitivity to bass and treble at lower sound pressures.
 * When currentVolume is low (< 0.7), this progressively restores perceived fullness.
 */
export function computeLoudnessCompensation(currentVolume: number): number[] {
  const safeVol = Math.max(0, Math.min(1, currentVolume));
  if (safeVol >= 0.7) {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  const factor = (0.7 - safeVol) / 0.7; // 0 at vol=0.7 -> 1.0 at vol=0
  const bassOffset = Math.round(factor * 4.5 * 10) / 10;
  const midBassOffset = Math.round(factor * 2.5 * 10) / 10;
  const trebleOffset = Math.round(factor * 2.5 * 10) / 10;

  return [
    bassOffset,
    bassOffset,
    midBassOffset,
    0,
    0,
    0,
    0,
    0,
    trebleOffset,
    trebleOffset,
  ];
}
