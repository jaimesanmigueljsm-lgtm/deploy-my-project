import { useEffect, useState } from "react";

/** Returns true when the browser has network access. */
export function useOnlineStatus(): boolean {
  // Always start "online" on both server and client to avoid SSR hydration mismatches.
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Sync with actual browser state after hydration.
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
