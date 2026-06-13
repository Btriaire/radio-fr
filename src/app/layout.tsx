import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen bg-navy-950 antialiased">
        {/* Ambient background blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-900/20 blur-[120px]" />
          <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-cyan-900/15 blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] rounded-full bg-purple-900/15 blur-[120px]" />
          <div className="absolute inset-0 bg-noise opacity-30" />
        </div>
        {children}
      </body>
    </html>
  );
}
