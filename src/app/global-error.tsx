"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#060a14", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>RadioFR a rencontré un problème.</p>
          <button onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 600 }}>
            Relancer
          </button>
        </div>
      </body>
    </html>
  );
}
