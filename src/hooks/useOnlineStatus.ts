"use client";

import { useEffect, useState } from "react";

type OnlineStatus = {
  online: boolean;
  reconnected: boolean;
};

export const useOnlineStatus = (): OnlineStatus => {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [reconnected, setReconnected] = useState<boolean>(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleOnline = () => {
      if (!online) {
        setOnline(true);
        timeoutId = setTimeout(() => {
          setReconnected(true);
          setTimeout(() => {
            setReconnected(false);
          }, 3500);
        }, 0);
      }
    };

    const handleOffline = () => {
      setOnline(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [online]);

  return { online, reconnected };
};