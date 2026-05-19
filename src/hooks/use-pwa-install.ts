import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstall {
  canInstall: boolean;
  isInstalled: boolean;
  triggerInstall: () => Promise<boolean>;
}

/** Exposes the browser's PWA install prompt. */
export function usePWAInstall(): PWAInstall {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) setIsInstalled(true);

    function handlePrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function triggerInstall(): Promise<boolean> {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return outcome === "accepted";
  }

  return { canInstall: !!prompt && !isInstalled, isInstalled, triggerInstall };
}
