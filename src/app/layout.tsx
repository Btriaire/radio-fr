import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Silkscreen, Space_Mono } from "next/font/google";
import "./globals.css";

// Polices auto-hébergées par Next (servies depuis notre domaine, préchargées,
// mises en cache par le service worker) : plus de chaîne bloquante
// CSS Google -> CSS -> fichiers de police, coûteuse en latence sur la 4G.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], display: "swap", variable: "--nf-grotesk" });
const silkscreen = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--nf-silkscreen", preload: false });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--nf-mono", preload: false });
import { ThemeProvider } from "@/context/ThemeContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "RadioFR — Radios & Podcasts Français",
  description: "Écoute les meilleures radios et podcasts français avec égaliseur intégré.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    // No transparency and no pre-rounded corners here — iOS applies its own
    // squircle mask over the raw square PNG and ignores alpha.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  applicationName: "RadioFR",
  appleWebApp: { capable: true, title: "RadioFR", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#060a14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import ErrorBoundary from "@/components/ErrorBoundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${grotesk.variable} ${silkscreen.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen antialiased" style={{ background: "var(--bg-0)" }}>
        <ServiceWorkerRegister />
        <ThemeProvider>
          {/* Ambient blobs */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 ambient-bg">
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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
