"use client";

export default function OfflineNotice({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
      <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <p className="text-white/70 text-sm font-semibold">Hors ligne</p>
      <p className="text-white/35 text-xs max-w-xs leading-relaxed">
        {feature} a besoin d'une connexion internet. Reviens ici une fois reconnecté — tes favoris et les radios déjà ouvertes restent disponibles en attendant.
      </p>
    </div>
  );
}
