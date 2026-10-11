"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-white/80 text-base font-semibold">Une erreur est survenue dans l'écran.</p>
      <p className="text-white/40 text-xs max-w-xs">Ta musique et tes favoris sont conservés.</p>
      <button onClick={reset}
        className="min-h-[44px] px-5 rounded-xl text-sm font-semibold text-white"
        style={{ background: "var(--accent)" }}>
        Réessayer
      </button>
    </div>
  );
}
