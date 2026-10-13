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
  "audio.bfmtv.com",          // BFM Radio, BFM Business & RMC → ACAO echoes Origin
  "stream.srg-ssr.ch",        // Radio Swiss Pop/Jazz/Classic & RTS → ACAO: *
  "chantefrance.ice.infomaniak.ch",
  "generationfm.ice.infomaniak.ch",
  "start-latina.ice.infomaniak.ch",
  "start-voltage.ice.infomaniak.ch",
  "start-adofm.ice.infomaniak.ch",
  "mfm.ice.infomaniak.ch",
  "vibration.ice.infomaniak.ch",
  "direct.croonerradio.fr",
  "kexp.streamguys1.com",
  "stream.live.vc.bbcmedia.co.uk",
  "radiofg.impek.com",
  "radios.rtbf.be",
];

export function isEqCompatible(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return EQ_CORS_HOSTS.includes(host);
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
    id: "bfm-radio",
    name: "BFM Radio",
    tagline: "Première radio d'info en continu",
    streamUrl: "https://audio.bfmtv.com/bfmradio_128.mp3",
    streams: [
      { label: "Standard", url: "https://audio.bfmtv.com/bfmradio_128.mp3", bitrate: "128 kbps" },
      { label: "Miroir",   url: "http://audio.bfmtv.com/bfmradio_128.mp3",  bitrate: "128 kbps" },
    ],
    logo: DDG("bfmtv.com"), color: "#0045e6", genre: "Info", freq: "102.8 FM",
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
      { label: "Miroir",   url: "http://audio.bfmtv.com/rmcradio_128.mp3",  bitrate: "128 kbps" },
    ],
    logo: DDG("rmc.bfmtv.com"), color: "#dc2626", genre: "Généraliste", freq: "103.1 FM",
  },
  {
    id: "rfm",
    name: "RFM",
    tagline: "Le meilleur de la musique",
    streamUrl: "https://rfm.lmn.fm/rfm.mp3",
    streams: [
      { label: "Standard", url: "https://rfm.lmn.fm/rfm.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("rfm.fr"), color: "#e11d48", genre: "Variété", freq: "103.9 FM",
  },
  {
    id: "europe2",
    name: "Europe 2",
    tagline: "Pop-rock & hits",
    streamUrl: "https://europe2.lmn.fm/europe2.mp3",
    streams: [
      { label: "Standard", url: "https://europe2.lmn.fm/europe2.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("europe2.fr"), color: "#7c3aed", genre: "Hits", freq: "103.5 FM",
  },
  {
    id: "sud-radio",
    name: "Sud Radio",
    tagline: "Parlons vrai",
    streamUrl: "https://ice.creacast.com/sudradio",
    streams: [
      { label: "Standard", url: "https://ice.creacast.com/sudradio", bitrate: "128 kbps" },
    ],
    logo: DDG("sudradio.fr"), color: "#0891b2", genre: "Généraliste", freq: "99.9 FM",
  },
  {
    id: "bfm-business",
    name: "BFM Business",
    tagline: "L'éco en continu",
    streamUrl: "https://audio.bfmtv.com/bfmbusiness_128.mp3",
    streams: [
      { label: "Standard", url: "https://audio.bfmtv.com/bfmbusiness_128.mp3", bitrate: "128 kbps" },
      { label: "Miroir",   url: "http://audio.bfmtv.com/bfmbusiness_128.mp3",  bitrate: "128 kbps" },
      { label: "Direct Web", url: "https://audio.bfmtv.com/bfmbusiness_128.mp3?aw_0_1st.playerId=BFMBusiness_audio_web&aggregator=BFMBusiness_audio_web", bitrate: "128 kbps" },
    ],
    logo: DDG("bfmtv.com"), color: "#1d4ed8", genre: "Info", freq: "96.4 FM",
  },
  {
    id: "radio-meuh",
    name: "Radio Meuh",
    tagline: "Le grand n'importe quoi musical",
    streamUrl: "https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3",
    streams: [
      { label: "Standard", url: "https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3", bitrate: "128 kbps" },
      { label: "Miroir",   url: "https://radiomeuh2.ice.infomaniak.ch/radiomeuh2-128.mp3", bitrate: "128 kbps" },
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
    logo: DDG("alouette.fr"), color: "#0ea5e9", genre: "Variété", freq: "92.9 FM",
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

  // ── Nouvelles radios francophones & thématiques vérifiées ────────────
  {
    id: "chante-france",
    name: "Chante France",
    tagline: "Les plus belles chansons françaises",
    streamUrl: "https://chantefrance.ice.infomaniak.ch/chantefrance-128.mp3",
    streams: [
      { label: "Standard", url: "https://chantefrance.ice.infomaniak.ch/chantefrance-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("chantefrance.com"), color: "#e11d48", genre: "Variété", freq: "90.9 FM",
  },
  {
    id: "m-radio",
    name: "M Radio",
    tagline: "Numéro 1 sur la chanson française",
    streamUrl: "https://mfm.ice.infomaniak.ch/mfm-128.mp3",
    streams: [
      { label: "Standard", url: "https://mfm.ice.infomaniak.ch/mfm-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("mradio.fr"), color: "#ef4444", genre: "Variété", freq: "102.7 FM",
  },
  {
    id: "radio-fg",
    name: "Radio FG",
    tagline: "Feel Good Dance & Electro",
    streamUrl: "https://radiofg.impek.com/fg.mp3",
    streams: [
      { label: "Standard", url: "https://radiofg.impek.com/fg.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("radiofg.com"), color: "#06b6d4", genre: "Électro", freq: "98.2 FM",
  },
  {
    id: "fg-chic",
    name: "FG Chic",
    tagline: "Lounge, Nu-Disco & Deep House",
    streamUrl: "https://radiofg.impek.com/fgc.mp3",
    streams: [
      { label: "Standard", url: "https://radiofg.impek.com/fgc.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fgchic.com"), color: "#a855f7", genre: "Électro",
  },
  {
    id: "generations",
    name: "Générations",
    tagline: "Hip-Hop Soul Radio",
    streamUrl: "https://generationfm.ice.infomaniak.ch/generationfm-high.mp3",
    streams: [
      { label: "Standard", url: "https://generationfm.ice.infomaniak.ch/generationfm-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("generations.fr"), color: "#eab308", genre: "Hits", freq: "88.2 FM",
  },
  {
    id: "swigg",
    name: "Swigg",
    tagline: "100% Cultures Urbaines",
    streamUrl: "https://start-adofm.ice.infomaniak.ch/start-adofm-high.mp3",
    streams: [
      { label: "Standard", url: "https://start-adofm.ice.infomaniak.ch/start-adofm-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("swigg.fr"), color: "#f97316", genre: "Hits", freq: "97.8 FM",
  },
  {
    id: "latina",
    name: "Latina",
    tagline: "Salsa, Bachata, Reggaeton",
    streamUrl: "https://start-latina.ice.infomaniak.ch/start-latina-high.mp3",
    streams: [
      { label: "Standard", url: "https://start-latina.ice.infomaniak.ch/start-latina-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("latina.fr"), color: "#ea580c", genre: "Pop", freq: "99.0 FM",
  },
  {
    id: "voltage",
    name: "Voltage",
    tagline: "Connecteur de hits",
    streamUrl: "https://start-voltage.ice.infomaniak.ch/start-voltage-high.mp3",
    streams: [
      { label: "Standard", url: "https://start-voltage.ice.infomaniak.ch/start-voltage-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("voltage.fr"), color: "#3b82f6", genre: "Hits", freq: "96.9 FM",
  },
  {
    id: "vibration",
    name: "Vibration",
    tagline: "Vibrez avec vos hits préférés",
    streamUrl: "https://vibration.ice.infomaniak.ch/vibration-high.mp3",
    streams: [
      { label: "Standard", url: "https://vibration.ice.infomaniak.ch/vibration-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("vibration.fr"), color: "#ec4899", genre: "Pop", freq: "103.9 FM",
  },
  {
    id: "tropiques-fm",
    name: "Tropiques FM",
    tagline: "La radio des musiques du soleil",
    streamUrl: "https://listen.radioking.com/radio/8916/stream/19088",
    streams: [
      { label: "Standard", url: "https://listen.radioking.com/radio/8916/stream/19088", bitrate: "128 kbps" },
    ],
    logo: DDG("tropiquesfm.com"), color: "#eab308", genre: "Éclectique", freq: "92.6 FM",
  },
  {
    id: "beur-fm",
    name: "Beur FM",
    tagline: "La radio méditerranéenne & d'ouverture",
    streamUrl: "https://beurfm.ice.infomaniak.ch/beurfm-high.mp3",
    streams: [
      { label: "Standard", url: "https://beurfm.ice.infomaniak.ch/beurfm-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("beurfm.net"), color: "#10b981", genre: "Généraliste", freq: "106.7 FM",
  },
  {
    id: "france-maghreb-2",
    name: "France Maghreb 2",
    tagline: "Le trait d'union des cultures",
    streamUrl: "https://francemaghreb2.ice.infomaniak.ch/francemaghreb2-high.mp3",
    streams: [
      { label: "Standard", url: "https://francemaghreb2.ice.infomaniak.ch/francemaghreb2-high.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemaghreb2.fr"), color: "#059669", genre: "Généraliste", freq: "99.5 FM",
  },
  {
    id: "radio-courtoisie",
    name: "Radio Courtoisie",
    tagline: "La radio libre de la culture française",
    streamUrl: "https://ice.creacast.com/radio-courtoisie",
    streams: [
      { label: "Standard", url: "https://ice.creacast.com/radio-courtoisie", bitrate: "128 kbps" },
    ],
    logo: DDG("radiocourtoisie.fr"), color: "#6366f1", genre: "Culture", freq: "95.6 FM",
  },
  {
    id: "crooner-radio",
    name: "Crooner Radio",
    tagline: "Great American Songbook & Jazz Vocal",
    streamUrl: "https://direct.croonerradio.fr/croonerradio-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.croonerradio.fr/croonerradio-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("croonerradio.fr"), color: "#ca8a04", genre: "Jazz",
  },
  {
    id: "grosse-radio-rock",
    name: "La Grosse Radio Rock",
    tagline: "100% Rock alternatif & indépendant",
    streamUrl: "https://hd.lagrosseradio.info/lagrosseradio-rock-192.mp3",
    streams: [
      { label: "Haute", url: "https://hd.lagrosseradio.info/lagrosseradio-rock-192.mp3", bitrate: "192 kbps" },
    ],
    logo: DDG("lagrosseradio.com"), color: "#dc2626", genre: "Rock",
  },
  {
    id: "grosse-radio-metal",
    name: "La Grosse Radio Métal",
    tagline: "Heavy metal & sons puissants",
    streamUrl: "https://hd.lagrosseradio.info/lagrosseradio-metal-192.mp3",
    streams: [
      { label: "Haute", url: "https://hd.lagrosseradio.info/lagrosseradio-metal-192.mp3", bitrate: "192 kbps" },
    ],
    logo: DDG("lagrosseradio.com"), color: "#475569", genre: "Rock",
  },
  {
    id: "classic-21",
    name: "Classic 21",
    tagline: "Écoutez l'original rock (RTBF)",
    streamUrl: "https://radios.rtbf.be/classic21-128.mp3",
    streams: [
      { label: "Standard", url: "https://radios.rtbf.be/classic21-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("rtbf.be"), color: "#f97316", genre: "Rock",
  },
  {
    id: "radio-swiss-pop",
    name: "Radio Swiss Pop",
    tagline: "Pop & mélodies sans pub (SRG SSR)",
    streamUrl: "https://stream.srg-ssr.ch/m/rsp/mp3_128",
    streams: [
      { label: "Audiophile", url: "https://stream.srg-ssr.ch/m/rsp/mp3_128", bitrate: "128 kbps" },
    ],
    logo: DDG("radioswisspop.ch"), color: "#0ea5e9", genre: "Pop",
  },
  {
    id: "radio-swiss-jazz",
    name: "Radio Swiss Jazz",
    tagline: "Standards du jazz, soul & blues (SRG SSR)",
    streamUrl: "https://stream.srg-ssr.ch/m/rsj/mp3_128",
    streams: [
      { label: "Audiophile", url: "https://stream.srg-ssr.ch/m/rsj/mp3_128", bitrate: "128 kbps" },
    ],
    logo: DDG("radioswissjazz.ch"), color: "#8b5cf6", genre: "Jazz",
  },
  {
    id: "radio-swiss-classic",
    name: "Radio Swiss Classic",
    tagline: "Chefs-d'œuvre de la musique classique (SRG SSR)",
    streamUrl: "https://stream.srg-ssr.ch/m/rsc_de/mp3_128",
    streams: [
      { label: "Audiophile", url: "https://stream.srg-ssr.ch/m/rsc_de/mp3_128", bitrate: "128 kbps" },
    ],
    logo: DDG("radioswissclassic.ch"), color: "#d97706", genre: "Classique",
  },
  {
    id: "rts-la-1ere",
    name: "RTS Première",
    tagline: "L'info & la culture suisse romande",
    streamUrl: "https://stream.srg-ssr.ch/m/la-1ere/mp3_128",
    streams: [
      { label: "Standard", url: "https://stream.srg-ssr.ch/m/la-1ere/mp3_128", bitrate: "128 kbps" },
    ],
    logo: DDG("srgssr.ch"), color: "#dc2626", genre: "Info",
  },
  {
    id: "bbc-world",
    name: "BBC World Service",
    tagline: "The world's newsroom in English",
    streamUrl: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
    streams: [
      { label: "Standard", url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service", bitrate: "128 kbps" },
    ],
    logo: DDG("bbc.co.uk"), color: "#bb1919", genre: "International",
  },
  {
    id: "kexp",
    name: "KEXP Seattle",
    tagline: "Where the music matters",
    streamUrl: "https://kexp.streamguys1.com/kexp128.mp3",
    streams: [
      { label: "Standard", url: "https://kexp.streamguys1.com/kexp128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("kexp.org"), color: "#eab308", genre: "Éclectique",
  },
  {
    id: "fm-bo",
    name: "La B.O. France Musique",
    tagline: "Musiques de films & bandes originales",
    streamUrl: "https://icecast.radiofrance.fr/francemusiquelabo-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francemusiquelabo-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francemusique.fr"), color: "#f59e0b", genre: "Classique",
  },
  {
    id: "fip-sacre-francais",
    name: "FIP Sacré Français",
    tagline: "Le meilleur de la scène française",
    streamUrl: "https://icecast.radiofrance.fr/fipsacrefrancais-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipsacrefrancais-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#10b981", genre: "Variété",
  },
  {
    id: "fip-metal",
    name: "FIP Métal",
    tagline: "De Led Zep au métal moderne",
    streamUrl: "https://icecast.radiofrance.fr/fipmetal-midfi.mp3",
    streams: [
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/fipmetal-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("fip.fr"), color: "#64748b", genre: "Rock",
  },
  {
    id: "hotmix-dance",
    name: "Hotmixradio Dance",
    tagline: "Club, dance & electro non-stop",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-dance-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-dance-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#06b6d4", genre: "Électro",
  },
  {
    id: "hotmix-80",
    name: "Hotmixradio 80",
    tagline: "Les années 80 non-stop",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-80-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-80-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#d946ef", genre: "Variété",
  },
  {
    id: "hotmix-90",
    name: "Hotmixradio 90",
    tagline: "Le son des années 90",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-90-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-90-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#8b5cf6", genre: "Variété",
  },
  {
    id: "hotmix-rock",
    name: "Hotmixradio Rock",
    tagline: "Le son 100% Rock",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-rock-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-rock-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#ef4444", genre: "Rock",
  },
  {
    id: "hotmix-frenchy",
    name: "Hotmixradio Frenchy",
    tagline: "100% Tubes francophones",
    streamUrl: "https://streaming.hotmixradio.com/hotmix-frenchy-en-mp3",
    streams: [
      { label: "Standard", url: "https://streaming.hotmixradio.com/hotmix-frenchy-en-mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("hotmixradio.com"), color: "#3b82f6", genre: "Variété",
  },
  {
    id: "jazz-manouche",
    name: "Jazz Radio Manouche",
    tagline: "Swing manouche & guitares virtuoses",
    streamUrl: "https://jazz-wr02.ice.infomaniak.ch/jazz-wr02-128.mp3",
    streams: [
      { label: "Haute", url: "https://jazz-wr02.ice.infomaniak.ch/jazz-wr02-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("jazzradio.fr"), color: "#b45309", genre: "Jazz",
  },
  {
    id: "jazz-funk",
    name: "Jazz Radio Funk",
    tagline: "Funk, groove & soul vintage",
    streamUrl: "https://jazz-wr06.ice.infomaniak.ch/jazz-wr06-128.mp3",
    streams: [
      { label: "Haute", url: "https://jazz-wr06.ice.infomaniak.ch/jazz-wr06-128.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("jazzradio.fr"), color: "#a855f7", genre: "Jazz",
  },

  // ── France Bleu Régions (flux direct.francebleu.fr) ─────────────────
  {
    id: "fb-nord",
    name: "ici Nord",
    tagline: "Radio locale Lille & Hauts-de-France",
    streamUrl: "https://direct.francebleu.fr/live/fbnord-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbnord-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "94.7 FM",
  },
  {
    id: "fb-gironde",
    name: "ici Gironde",
    tagline: "Radio locale Bordeaux & Gironde",
    streamUrl: "https://direct.francebleu.fr/live/fbgironde-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbgironde-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "100.1 FM",
  },
  {
    id: "fb-provence",
    name: "ici Provence",
    tagline: "Radio locale Marseille, Aix & Toulon",
    streamUrl: "https://direct.francebleu.fr/live/fbprovence-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbprovence-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "103.6 FM",
  },
  {
    id: "fb-armorique",
    name: "ici Armorique",
    tagline: "Radio locale Rennes & Bretagne",
    streamUrl: "https://direct.francebleu.fr/live/fbarmorique-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbarmorique-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "103.1 FM",
  },
  {
    id: "fb-azur",
    name: "ici Azur",
    tagline: "Radio locale Nice & Côte d'Azur",
    streamUrl: "https://direct.francebleu.fr/live/fbazur-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbazur-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "103.8 FM",
  },
  {
    id: "fb-alsace",
    name: "ici Alsace",
    tagline: "Radio locale Strasbourg & Alsace",
    streamUrl: "https://direct.francebleu.fr/live/fbalsace-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbalsace-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "101.4 FM",
  },
  {
    id: "fb-toulouse",
    name: "ici Toulouse",
    tagline: "Radio locale Toulouse & Haute-Garonne",
    streamUrl: "https://direct.francebleu.fr/live/fbtoulouse-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbtoulouse-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "90.5 FM",
  },
  {
    id: "fb-loire-ocean",
    name: "ici Loire Océan",
    tagline: "Radio locale Nantes & Loire-Atlantique",
    streamUrl: "https://direct.francebleu.fr/live/fbloireocean-midfi.mp3",
    streams: [
      { label: "Standard", url: "https://direct.francebleu.fr/live/fbloireocean-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#0284c7", genre: "Local", freq: "101.8 FM",
  },
];

export const GENRES = ["Tous", "Zen", "Généraliste", "Info", "Culture", "Musique", "Classique", "Jazz", "Rock", "Électro", "Reggae", "Hits", "Variété", "Pop", "Humour", "Éclectique", "International", "Local"];
