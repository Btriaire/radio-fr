export interface StreamQuality {
  label: string;
  url: string;
  bitrate: string;
}

export interface Station {
  id: string;
  name: string;
  tagline: string;
  streamUrl: string;           // default (medium quality)
  streams?: StreamQuality[];   // all available qualities
  logo: string;
  color: string;
  genre: string;
  freq?: string;
  votes?: number;
  clickcount?: number;
}

// High-res brand logo from Google's favicon service (128px PNG). Far crisper and
// more reliable than DuckDuckGo's 16px .ico — these are all well-known domains so
// Google always has them. StationLogo falls back to DDG, then initials, on error.
const DDG = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// The raw domain, so StationLogo can build its own fallback URLs on image error.
export function logoDomain(logoUrl: string): string | null {
  const m = /[?&]domain=([^&]+)/.exec(logoUrl) || /ip3\/([^/]+)\.ico/.exec(logoUrl);
  return m ? decodeURIComponent(m[1]) : null;
}

// Hosts that return permissive CORS headers, so the Web Audio graph can tap the
// stream and the 10-band EQ actually processes the sound. Any host NOT listed
// here loads without crossOrigin (see useAudioPlayer) — most radio CDNs don't
// send CORS headers, and forcing crossOrigin="anonymous" on those breaks
// playback outright (the browser refuses the opaque redirect/response).
const EQ_CORS_HOSTS = [
  "icecast.radiofrance.fr",
  "direct.francebleu.fr",
  "europe1.lmn.fm",
  "europe2.lmn.fm",   // same lmn.fm infra as Europe 1 → ACAO: *
  "rfm.lmn.fm",       // same lmn.fm infra → ACAO: *
  "streaming.hotmixradio.com",
  "icecast.rtl.fr",           // RTL/RTL2 new CDN (2026-07-18) → ACAO echoes Origin
  "icecast.funradio.fr",      // same Audiomeans infra as RTL → ACAO echoes Origin
  "streaming.nrjaudio.fm",    // NRJ group's new CDN (2026-07-18) → ACAO: *
  "cdnradio.streamakaci.com", // Chérie FM's CDN → ACAO: *
];

export function isEqCompatible(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return EQ_CORS_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Mode "Économie de données" — when on, every station play routes through its
// lowest-bitrate tier (streams[0], always the "Basse"/cheapest entry by
// construction) instead of the usual default (streams[1], "Moyenne"). Reading
// localStorage per-call (not cached) keeps this correct even if the user
// flips the setting mid-session without needing to thread the flag through
// every call site.
export function preferredStreamUrl(station: { streamUrl: string; streams?: StreamQuality[] }): string {
  try {
    if (localStorage.getItem("radiofr_low_bandwidth") === "1" && station.streams?.length) {
      return station.streams[0].url;
    }
  } catch {}
  return station.streamUrl;
}

export const STATIONS: Station[] = [
  {
    id: "france-inter",
    name: "France Inter",
    tagline: "Culture & Actu",
    streamUrl: "https://icecast.radiofrance.fr/franceinter-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/franceinter-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/franceinter-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/franceinter-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("franceinter.fr"), color: "#e63946", genre: "Généraliste", freq: "87.8 FM",
  },
  {
    id: "france-info",
    name: "franceinfo",
    tagline: "Info en continu",
    streamUrl: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/franceinfo-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/franceinfo-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("franceinfo.fr"), color: "#4361ee", genre: "Info", freq: "105.5 FM",
  },
  {
    id: "france-culture",
    name: "France Culture",
    tagline: "Arts & Idées",
    streamUrl: "https://icecast.radiofrance.fr/franceculture-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/franceculture-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/franceculture-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/franceculture-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("franceculture.fr"), color: "#7b2d8b", genre: "Culture", freq: "93.5 FM",
  },
  {
    id: "france-musique",
    name: "France Musique",
    tagline: "Classique & Jazz",
    streamUrl: "https://icecast.radiofrance.fr/francemusique-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/francemusique-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusique-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/francemusique-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#f77f00", genre: "Musique", freq: "91.7 FM",
  },
  {
    id: "fip",
    name: "FIP",
    tagline: "Éclectique & Cool",
    streamUrl: "https://icecast.radiofrance.fr/fip-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/fip-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fip-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/fip-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#06d6a0", genre: "Musique", freq: "105.1 FM",
  },
  {
    id: "rtl",
    name: "RTL",
    tagline: "La radio numéro 1",
    // streaming.radio.rtl.fr is a dead host (302 → 404) — RTL migrated their
    // CDN to icecast.rtl.fr, verified live 2026-07-18.
    streamUrl: "https://icecast.rtl.fr/rtl-1-44-128",
    streams: [
      { label: "Standard", url: "https://icecast.rtl.fr/rtl-1-44-128", bitrate: "128 kbps" },
    ],
    logo: DDG("rtl.fr"), color: "#ff6600", genre: "Généraliste", freq: "104.3 FM",
  },
  {
    id: "europe1",
    name: "Europe 1",
    tagline: "Toute l'actualité",
    streamUrl: "https://europe1.lmn.fm/europe1.mp3",
    streams: [
      { label: "Standard", url: "https://europe1.lmn.fm/europe1.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("europe1.fr"), color: "#0077b6", genre: "Généraliste", freq: "104.7 FM",
  },
  {
    id: "rfi",
    name: "RFI",
    tagline: "Radio Mondiale",
    // icecast.radiofrance.fr no longer serves rfi-monde-* (404) — RFI's own
    // feed lives on Infomaniak, verified live 2026-07-18.
    streamUrl: "https://rfimonde64k.ice.infomaniak.ch/rfimonde-64.mp3",
    streams: [
      { label: "Standard", url: "https://rfimonde64k.ice.infomaniak.ch/rfimonde-64.mp3", bitrate: "64 kbps" },
    ],
    logo: DDG("rfi.fr"), color: "#2d6a4f", genre: "International", freq: "89.0 FM",
  },
  {
    id: "nostalgie",
    name: "Nostalgie",
    tagline: "Les hits d'hier",
    // scdn.nrjaudio.fm/adwz1 is a dead host (404) — the NRJ group moved every
    // station to streaming.nrjaudio.fm behind opaque per-station IDs (no more
    // multi-bitrate variants), verified live 2026-07-18.
    streamUrl: "https://streaming.nrjaudio.fm/oua8a3w2dqao",
    streams: [
      { label: "Standard", url: "https://streaming.nrjaudio.fm/oua8a3w2dqao", bitrate: "128 kbps" },
    ],
    logo: DDG("nostalgie.fr"), color: "#d4a017", genre: "Variété", freq: "96.5 FM",
  },
  {
    id: "nrj",
    name: "NRJ",
    tagline: "Hit music only",
    streamUrl: "https://streaming.nrjaudio.fm/ou5k6tirv93h",
    streams: [
      { label: "Standard", url: "https://streaming.nrjaudio.fm/ou5k6tirv93h", bitrate: "128 kbps" },
    ],
    logo: DDG("nrj.fr"), color: "#ff0033", genre: "Hits", freq: "100.3 FM",
  },
  {
    id: "cherie",
    name: "Chérie FM",
    tagline: "La radio positive",
    streamUrl: "https://cdnradio.streamakaci.com/cheriefm1.mp3",
    streams: [
      { label: "Standard", url: "https://cdnradio.streamakaci.com/cheriefm1.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("cheriefm.fr"), color: "#e91e8c", genre: "Pop", freq: "95.9 FM",
  },
  {
    id: "france-bleu",
    name: "France Bleu",
    tagline: "Radio locale IDF",
    // icecast.radiofrance.fr no longer serves francebleuidf-* (404 on every
    // tier) — France Bleu Paris moved to direct.francebleu.fr, verified 2026-07-18.
    streamUrl: "https://direct.francebleu.fr/live/fb1071-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fb1071-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#2196f3", genre: "Local", freq: "107.1 FM",
  },
  {
    id: "ici-herault",
    name: "ici Hérault",
    tagline: "Radio locale Hérault",
    // ex-France Bleu Hérault (rebrand "ici"), verified 2026-08-21.
    streamUrl: "https://direct.francebleu.fr/live/fbherault-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbherault-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#2196f3", genre: "Local", freq: "Hérault",
  },

  {
    id: "mouv",
    name: "Mouv'",
    tagline: "Rap & cultures urbaines",
    streamUrl: "https://icecast.radiofrance.fr/mouv-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/mouv-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/mouv-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/mouv-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("mouv.fr"), color: "#fbbf24", genre: "Hits",
  },

  // ── FIP webradios (CORS OK → EQ dispo) ────────────────────────────
  {
    id: "fip-rock",
    name: "FIP Rock",
    tagline: "Le meilleur du rock",
    streamUrl: "https://icecast.radiofrance.fr/fiprock-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fiprock-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#ef4444", genre: "Rock",
  },
  {
    id: "fip-jazz",
    name: "FIP Jazz",
    tagline: "Jazz sous toutes ses formes",
    streamUrl: "https://icecast.radiofrance.fr/fipjazz-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipjazz-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#f59e0b", genre: "Jazz",
  },
  {
    id: "fip-groove",
    name: "FIP Groove",
    tagline: "Funk, soul & groove",
    streamUrl: "https://icecast.radiofrance.fr/fipgroove-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipgroove-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#8b5cf6", genre: "Musique",
  },
  {
    id: "fip-reggae",
    name: "FIP Reggae",
    tagline: "Vibrations reggae",
    streamUrl: "https://icecast.radiofrance.fr/fipreggae-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipreggae-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#22c55e", genre: "Reggae",
  },
  {
    id: "fip-electro",
    name: "FIP Electro",
    tagline: "Électro & beats",
    streamUrl: "https://icecast.radiofrance.fr/fipelectro-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipelectro-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#06b6d4", genre: "Électro",
  },
  {
    id: "fip-pop",
    name: "FIP Pop",
    tagline: "Pop d'hier et d'aujourd'hui",
    streamUrl: "https://icecast.radiofrance.fr/fippop-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fippop-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#ec4899", genre: "Pop",
  },
  {
    id: "fip-hiphop",
    name: "FIP Hip-Hop",
    tagline: "Le meilleur du hip-hop",
    streamUrl: "https://icecast.radiofrance.fr/fiphiphop-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fiphiphop-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#a855f7", genre: "Hits",
  },
  {
    id: "fip-monde",
    name: "FIP Monde",
    tagline: "Musiques du monde",
    streamUrl: "https://icecast.radiofrance.fr/fipworld-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipworld-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#14b8a6", genre: "International",
  },

  // ── France Musique webradios (CORS OK → EQ dispo) ─────────────────
  {
    id: "fm-classique-plus",
    name: "Classique Plus",
    tagline: "Les grandes œuvres",
    streamUrl: "https://icecast.radiofrance.fr/francemusiqueclassiqueplus-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiqueclassiqueplus-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#fb923c", genre: "Classique",
  },
  {
    id: "fm-concerts",
    name: "Concerts Radio France",
    tagline: "Concerts en intégralité",
    streamUrl: "https://icecast.radiofrance.fr/francemusiqueconcertsradiofrance-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiqueconcertsradiofrance-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#f97316", genre: "Classique",
  },
  {
    id: "fm-la-jazz",
    name: "La Jazz",
    tagline: "France Musique côté jazz",
    streamUrl: "https://icecast.radiofrance.fr/francemusiquelajazz-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiquelajazz-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#eab308", genre: "Jazz",
  },
  {
    id: "fm-contemporaine",
    name: "La Contemporaine",
    tagline: "Création & musiques d'aujourd'hui",
    streamUrl: "https://icecast.radiofrance.fr/francemusiquelacontemporaine-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiquelacontemporaine-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#d946ef", genre: "Classique",
  },

  // ── Autres radios privées ─────────────────────────────────────────
  {
    id: "rtl2",
    name: "RTL2",
    tagline: "Le son Pop-Rock",
    // Same dead-host fix as RTL — migrated to icecast.rtl.fr.
    streamUrl: "https://icecast.rtl.fr/rtl2-1-44-128",
    streams: [
      { label: "Standard", url: "https://icecast.rtl.fr/rtl2-1-44-128", bitrate: "128 kbps" },
    ],
    logo: DDG("rtl2.fr"), color: "#e11d48", genre: "Rock",
  },
  {
    id: "fun-radio",
    name: "Fun Radio",
    tagline: "Le son dancefloor",
    // streaming.radio.rtl.fr is dead — Fun Radio's own CDN is icecast.funradio.fr.
    streamUrl: "https://icecast.funradio.fr/fun-1-44-128",
    streams: [
      { label: "Standard", url: "https://icecast.funradio.fr/fun-1-44-128", bitrate: "128 kbps" },
    ],
    logo: DDG("funradio.fr"), color: "#facc15", genre: "Électro",
  },
  {
    id: "rire-chansons",
    name: "Rire & Chansons",
    tagline: "L'humour non-stop",
    streamUrl: "https://streaming.nrjaudio.fm/ou8o8xgk7oiu",
    streams: [
      { label: "Standard", url: "https://streaming.nrjaudio.fm/ou8o8xgk7oiu", bitrate: "128 kbps" },
    ],
    logo: DDG("rireetchansons.fr"), color: "#f43f5e", genre: "Humour",
  },
  {
    id: "nova",
    name: "Radio Nova",
    tagline: "Le grand mix",
    streamUrl: "https://novazz.ice.infomaniak.ch/novazz-128.mp3",
    streams: [
      { label: "Standard", url: "https://novazz.ice.infomaniak.ch/novazz-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("nova.fr"), color: "#f59e0b", genre: "Éclectique",
  },
  {
    id: "tsf-jazz",
    name: "TSF Jazz",
    tagline: "La radio 100% jazz",
    streamUrl: "https://tsfjazz.ice.infomaniak.ch/tsfjazz-high.mp3",
    streams: [
      { label: "Haute", url: "https://tsfjazz.ice.infomaniak.ch/tsfjazz-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("tsfjazz.com"), color: "#0ea5e9", genre: "Jazz",
  },
  {
    id: "jazz-radio",
    name: "Jazz Radio",
    tagline: "Jazz, soul & blues",
    streamUrl: "https://jazzradio.ice.infomaniak.ch/jazzradio-high.mp3",
    streams: [
      { label: "Haute", url: "https://jazzradio.ice.infomaniak.ch/jazzradio-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("jazzradio.fr"), color: "#6366f1", genre: "Jazz",
  },
  {
    id: "ouifm",
    name: "OÜI FM",
    tagline: "La radio rock",
    streamUrl: "https://ouifm.ice.infomaniak.ch/ouifm-high.mp3",
    streams: [
      { label: "Haute", url: "https://ouifm.ice.infomaniak.ch/ouifm-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("ouifm.fr"), color: "#dc2626", genre: "Rock",
  },
  {
    id: "radio-classique",
    name: "Radio Classique",
    tagline: "Le classique au quotidien",
    streamUrl: "https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3",
    streams: [
      { label: "Haute", url: "https://radioclassique.ice.infomaniak.ch/radioclassique-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("radioclassique.fr"), color: "#b45309", genre: "Classique",
  },

  // ── Zen / Relaxation ──────────────────────────────────────────────
  {
    id: "hotmix-zen",
    name: "Hotmixradio Zen",
    tagline: "Relaxation & détente",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-zen-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-zen-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#5eead4", genre: "Zen",
  },
  {
    id: "hotmix-lounge",
    name: "Hotmixradio Lounge",
    tagline: "Lounge & chill",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-lounge-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-lounge-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#38bdf8", genre: "Zen",
  },
  {
    id: "fm-classique-easy",
    name: "Classique Easy",
    tagline: "Classique apaisant",
    streamUrl: "https://icecast.radiofrance.fr/francemusiqueeasyclassique-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiqueeasyclassique-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#a7f3d0", genre: "Zen",
  },
  {
    id: "fm-ocora",
    name: "Ocora Musiques du Monde",
    tagline: "Sons du monde méditatifs",
    streamUrl: "https://icecast.radiofrance.fr/francemusiqueocoramonde-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiqueocoramonde-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#86efac", genre: "Zen",
  },
  {
    id: "fm-baroque",
    name: "La Baroque",
    tagline: "Baroque serein",
    streamUrl: "https://icecast.radiofrance.fr/francemusiquebaroque-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiquebaroque-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#c4b5fd", genre: "Zen",
  },

  // ── Plus de radios (flux directs https vérifiés) ──────────────────
  {
    id: "skyrock",
    name: "Skyrock",
    tagline: "Premier sur le rap",
    streamUrl: "https://icecast.skyrock.net/s/natio_mp3_128k",
    streams: [
      { label: "Standard", url: "https://icecast.skyrock.net/s/natio_mp3_128k", bitrate: "128 kbps" },
    ],
    logo: DDG("skyrock.com"), color: "#f97316", genre: "Hits",
  },
  {
    id: "rmc",
    name: "RMC",
    tagline: "Info, talk & sport",
    streamUrl: "https://audio.bfmtv.com/rmcradio_128.mp3",
    streams: [
      { label: "Standard", url: "https://audio.bfmtv.com/rmcradio_128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("rmc.bfmtv.com"), color: "#dc2626", genre: "Généraliste",
  },
  {
    id: "rfm",
    name: "RFM",
    tagline: "Le meilleur de la musique",
    streamUrl: "https://rfm.lmn.fm/rfm.mp3",
    streams: [
      { label: "Standard", url: "https://rfm.lmn.fm/rfm.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("rfm.fr"), color: "#e11d48", genre: "Variété",
  },
  {
    id: "europe2",
    name: "Europe 2",
    tagline: "Pop-rock & hits",
    streamUrl: "https://europe2.lmn.fm/europe2.mp3",
    streams: [
      { label: "Standard", url: "https://europe2.lmn.fm/europe2.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("europe2.fr"), color: "#7c3aed", genre: "Hits",
  },
  {
    id: "sud-radio",
    name: "Sud Radio",
    tagline: "Parlons vrai",
    streamUrl: "https://ice.creacast.com/sudradio",
    streams: [
      { label: "Standard", url: "https://ice.creacast.com/sudradio", bitrate: "128 kbps" },
    ],
    logo: DDG("sudradio.fr"), color: "#0891b2", genre: "Généraliste",
  },
  {
    id: "bfm-business",
    name: "BFM Business",
    tagline: "L'éco en continu",
    streamUrl: "https://audio.bfmtv.com/bfmbusiness_128.mp3",
    streams: [
      { label: "Standard", url: "https://audio.bfmtv.com/bfmbusiness_128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("bfmtv.com"), color: "#1d4ed8", genre: "Info",
  },
  {
    id: "radio-meuh",
    name: "Radio Meuh",
    tagline: "Le grand n'importe quoi musical",
    streamUrl: "https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3",
    streams: [
      { label: "Standard", url: "https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("radiomeuh.com"), color: "#84cc16", genre: "Éclectique",
  },
  {
    id: "alouette",
    name: "Alouette",
    tagline: "La radio qui vous en met plein les oreilles",
    streamUrl: "https://alouette.ice.infomaniak.ch/alouette-high.mp3",
    streams: [
      { label: "Haute", url: "https://alouette.ice.infomaniak.ch/alouette-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("alouette.fr"), color: "#0ea5e9", genre: "Variété",
  },
  {
    id: "grosse-radio-reggae",
    name: "La Grosse Radio Reggae",
    tagline: "100% reggae & dub",
    streamUrl: "https://hd.lagrosseradio.info/lagrosseradio-reggae-192.mp3",
    streams: [
      { label: "Haute", url: "https://hd.lagrosseradio.info/lagrosseradio-reggae-192.mp3", bitrate: "192 kbps" },
    ],
    logo: DDG("lagrosseradio.com"), color: "#16a34a", genre: "Reggae",
  },
  {
    id: "jazz-radio-blues",
    name: "Jazz Radio Blues",
    tagline: "Le blues sous toutes ses notes",
    streamUrl: "https://jazzblues.ice.infomaniak.ch/jazzblues-high.mp3",
    streams: [
      { label: "Haute", url: "https://jazzblues.ice.infomaniak.ch/jazzblues-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("jazzradio.fr"), color: "#4338ca", genre: "Jazz",
  },
];

export const GENRES = ["Tous", "Zen", "Généraliste", "Info", "Culture", "Musique", "Classique", "Jazz", "Rock", "Électro", "Reggae", "Hits", "Variété", "Pop", "Humour", "Éclectique", "International", "Local"];
