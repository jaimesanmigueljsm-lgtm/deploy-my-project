import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online";

/**
 * Renders a slim banner below the status bar when the device is offline.
 * Uses safe-area-inset-top to stay clear of iPhone notch / Dynamic Island.
 * Animates in/out with a slide — does not cause layout shift for page content.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex items-center justify-center gap-2 bg-warn px-4 py-2 text-[11px] font-semibold text-background animate-in slide-in-from-top duration-300"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="size-3 shrink-0" />
      <span>Offline — changes will sync when reconnected</span>
    </div>
  );
}
