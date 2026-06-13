export interface Station {
  id: string;
  name: string;
  tagline: string;
  streamUrl: string;
  logo: string;
  color: string;
  genre: string;
  freq?: string;
}

export const STATIONS: Station[] = [
  {
    id: "france-inter",
    name: "France Inter",
    tagline: "Culture & Actu",
    streamUrl: "https://icecast.radiofrance.fr/franceinter-midfi.mp3",
    logo: "🎙️",
    color: "#e63946",
    genre: "Généraliste",
    freq: "87.8 FM",
  },
  {
    id: "france-info",
    name: "franceinfo",
    tagline: "Info en continu",
    streamUrl: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3",
    logo: "📻",
    color: "#4361ee",
    genre: "Info",
    freq: "105.5 FM",
  },
  {
    id: "france-culture",
    name: "France Culture",
    tagline: "Arts & Idées",
    streamUrl: "https://icecast.radiofrance.fr/franceculture-midfi.mp3",
    logo: "🎭",
    color: "#7b2d8b",
    genre: "Culture",
    freq: "93.5 FM",
  },
  {
    id: "france-musique",
    name: "France Musique",
    tagline: "Classique & Jazz",
    streamUrl: "https://icecast.radiofrance.fr/francemusique-midfi.mp3",
    logo: "🎼",
    color: "#f77f00",
    genre: "Musique",
    freq: "91.7 FM",
  },
  {
    id: "fip",
    name: "FIP",
    tagline: "Éclectique & Cool",
    streamUrl: "https://icecast.radiofrance.fr/fip-midfi.mp3",
    logo: "🎵",
    color: "#06d6a0",
    genre: "Musique",
    freq: "105.1 FM",
  },
  {
    id: "rtl",
    name: "RTL",
    tagline: "La radio numéro 1",
    streamUrl: "https://streaming.radio.rtl.fr/rtl-1-44-96",
    logo: "⭐",
    color: "#ff6600",
    genre: "Généraliste",
    freq: "104.3 FM",
  },
  {
    id: "europe1",
    name: "Europe 1",
    tagline: "Toute l'actualité",
    streamUrl: "https://europe1.lmn.fm/europe1.mp3",
    logo: "🌍",
    color: "#0077b6",
    genre: "Généraliste",
    freq: "104.7 FM",
  },
  {
    id: "rfi",
    name: "RFI",
    tagline: "Radio Mondiale",
    streamUrl: "https://icecast.radiofrance.fr/rfi-monde-midfi.mp3",
    logo: "🌐",
    color: "#2d6a4f",
    genre: "International",
    freq: "89.0 FM",
  },
  {
    id: "nostalgie",
    name: "Nostalgie",
    tagline: "Les hits d'hier",
    streamUrl: "https://scdn.nrjaudio.fm/adwz1/fr/30601/mp3_128.mp3",
    logo: "🕰️",
    color: "#d4a017",
    genre: "Variété",
    freq: "96.5 FM",
  },
  {
    id: "nrj",
    name: "NRJ",
    tagline: "Hit music only",
    streamUrl: "https://scdn.nrjaudio.fm/adwz1/fr/30001/mp3_128.mp3",
    logo: "🔥",
    color: "#ff0033",
    genre: "Hits",
    freq: "100.3 FM",
  },
  {
    id: "cherie",
    name: "Chérie FM",
    tagline: "La radio positive",
    streamUrl: "https://scdn.nrjaudio.fm/adwz1/fr/30201/mp3_128.mp3",
    logo: "💖",
    color: "#e91e8c",
    genre: "Pop",
    freq: "95.9 FM",
  },
  {
    id: "france-bleu",
    name: "France Bleu",
    tagline: "Radio locale",
    streamUrl: "https://icecast.radiofrance.fr/francebleuidf-midfi.mp3",
    logo: "🔵",
    color: "#2196f3",
    genre: "Local",
    freq: "107.1 FM",
  },
];

export const GENRES = ["Tous", "Généraliste", "Info", "Culture", "Musique", "Hits", "Variété", "Pop", "International", "Local"];
