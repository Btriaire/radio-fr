"use client";
import { useEffect } from "react";

// Registered only in production: in dev, a service worker caching hashed
// chunks fights Next.js's own hot-reload (stale JS served from cache) far
// more than it helps — offline support only matters for the deployed app.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
