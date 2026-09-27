"use client";
import { useEffect, useState } from "react";

// App-wide connectivity, independent of whether a station/podcast happens to
// be loaded — useAudioPlayer's own `offline` flag only exists once something
// is playing. This one is available anywhere (header banner, disabling
// network-only tabs) from the moment the page loads.
export function useOnlineStatus(): boolean {
  // navigator.onLine is undefined during SSR; assume online until the effect
  // below reads the real value on mount (avoids a false "offline" flash).
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
