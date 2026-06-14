import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "RadioFR — Radios & Podcasts Français",
  description: "Écoute les meilleures radios et podcasts français avec égaliseur intégré.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "var(--bg-0)" }}>
        <ThemeProvider>
          {/* Ambient blobs */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-700"
              style={{ background: "var(--blob-1)" }} />
            <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-700"
              style={{ background: "var(--blob-2)" }} />
            <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full blur-[120px] transition-colors duration-700"
              style={{ background: "var(--blob-3)" }} />
            {/* Metal texture overlay */}
            <div className="absolute inset-0 metal-texture opacity-100" />
            <div className="absolute inset-0 bg-noise opacity-40" />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
