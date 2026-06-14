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

const DDG = (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

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
    streamUrl: "https://streaming.radio.rtl.fr/rtl-1-44-96",
    streams: [
      { label: "Standard", url: "https://streaming.radio.rtl.fr/rtl-1-44-96", bitrate: "96 kbps" },
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
    streamUrl: "https://icecast.radiofrance.fr/rfi-monde-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/rfi-monde-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/rfi-monde-midfi.mp3", bitrate: "128 kbps" },
    ],
    logo: DDG("rfi.fr"), color: "#2d6a4f", genre: "International", freq: "89.0 FM",
  },
  {
    id: "nostalgie",
    name: "Nostalgie",
    tagline: "Les hits d'hier",
    streamUrl: "https://scdn.nrjaudio.fm/adwz1/fr/30601/mp3_128.mp3",
    streams: [
      { label: "Basse",    url: "https://scdn.nrjaudio.fm/adwz1/fr/30601/mp3_56.mp3",  bitrate: "56 kbps" },
      { label: "Standard", url: "https://scdn.nrjaudio.fm/adwz1/fr/30601/mp3_128.mp3", bitrate: "128 kbps" },
      { label: "Haute",    url: "https://scdn.nrjaudio.fm/adwz1/fr/30601/aac_192.aac", bitrate: "192 kbps" },
    ],
    logo: DDG("nostalgie.fr"), color: "#d4a017", genre: "Variété", freq: "96.5 FM",
  },
  {
    id: "nrj",
    name: "NRJ",
    tagline: "Hit music only",
    streamUrl: "https://scdn.nrjaudio.fm/adwz1/fr/30001/mp3_128.mp3",
    streams: [
      { label: "Basse",    url: "https://scdn.nrjaudio.fm/adwz1/fr/30001/mp3_56.mp3",  bitrate: "56 kbps" },
      { label: "Standard", url: "https://scdn.nrjaudio.fm/adwz1/fr/30001/mp3_128.mp3", bitrate: "128 kbps" },
      { label: "Haute",    url: "https://scdn.nrjaudio.fm/adwz1/fr/30001/aac_192.aac", bitrate: "192 kbps" },
    ],
    logo: DDG("nrj.fr"), color: "#ff0033", genre: "Hits", freq: "100.3 FM",
  },
  {
    id: "cherie",
    name: "Chérie FM",
    tagline: "La radio positive",
    streamUrl: "https://scdn.nrjaudio.fm/adwz1/fr/30201/mp3_128.mp3",
    streams: [
      { label: "Basse",    url: "https://scdn.nrjaudio.fm/adwz1/fr/30201/mp3_56.mp3",  bitrate: "56 kbps" },
      { label: "Standard", url: "https://scdn.nrjaudio.fm/adwz1/fr/30201/mp3_128.mp3", bitrate: "128 kbps" },
      { label: "Haute",    url: "https://scdn.nrjaudio.fm/adwz1/fr/30201/aac_192.aac", bitrate: "192 kbps" },
    ],
    logo: DDG("cheriefm.fr"), color: "#e91e8c", genre: "Pop", freq: "95.9 FM",
  },
  {
    id: "france-bleu",
    name: "France Bleu",
    tagline: "Radio locale IDF",
    streamUrl: "https://icecast.radiofrance.fr/francebleuidf-midfi.mp3",
    streams: [
      { label: "Basse",   url: "https://icecast.radiofrance.fr/francebleuidf-lofi.mp3",  bitrate: "32 kbps" },
      { label: "Moyenne", url: "https://icecast.radiofrance.fr/francebleuidf-midfi.mp3", bitrate: "128 kbps" },
      { label: "Haute",   url: "https://icecast.radiofrance.fr/francebleuidf-hifi.aac",  bitrate: "320 kbps" },
    ],
    logo: DDG("francebleu.fr"), color: "#2196f3", genre: "Local", freq: "107.1 FM",
  },
];

export const GENRES = ["Tous", "Généraliste", "Info", "Culture", "Musique", "Hits", "Variété", "Pop", "International", "Local"];
