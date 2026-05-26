import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { hashPin, verifyPin } from "@/lib/pin-crypto";
import { pinStore, metaStore, promptStore, type LockMeta } from "./app-lock-store";
import { LockScreen } from "./LockScreen";
import { PinSetupScreen } from "./PinSetupScreen";

// ─── Biometric abstraction ────────────────────────────────────────────────────
// Web always returns false. Capacitor/native can override this.
export function isBiometricAvailable(): boolean {
  return false;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface AppLockCtx {
  isPinSet:          boolean;
  isLocked:          boolean;
  meta:              LockMeta;
  biometricAvailable: boolean;
  unlock:            (pin: string) => Promise<boolean>;
  setupPin:          (pin: string) => Promise<void>;
  verifyCurrentPin:  (pin: string) => Promise<boolean>;
  changePin:         (currentPin: string, newPin: string) => Promise<boolean>;
  removePin:         () => void;
  lockNow:           () => void;
  openSetup:         (mode?: "setup" | "change") => void;
  updateMeta:        (patch: Partial<LockMeta>) => void;
}

const Ctx = createContext<AppLockCtx | null>(null);

export function useAppLock(): AppLockCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppLock must be inside AppLockProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const [isPinSet,   setIsPinSet]   = useState(false);
  const [isLocked,   setIsLocked]   = useState(false);
  const [meta,       setMeta]       = useState<LockMeta>(() => metaStore.read(""));
  const [setupMode,  setSetupMode]  = useState<"setup" | "change" | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // ── Bootstrap when uid becomes available ──────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setIsPinSet(false);
      setIsLocked(false);
      setShowPrompt(false);
      return;
    }

    const pinHash  = pinStore.read(uid);
    const m        = metaStore.read(uid);
    const pinIsSet = !!pinHash;

    setIsPinSet(pinIsSet);
    setMeta(m);

    if (pinIsSet && m.autoLockMs !== 0) {
      // Don't lock on public routes (/auth, /onboarding)
      const path = typeof window !== "undefined" ? window.location.pathname : "/";
      const isPublic = path.startsWith("/auth") || path.startsWith("/onboarding");
      if (!isPublic) {
        const elapsed = Date.now() - m.lastActiveAt;
        if (m.autoLockMs === -1 || elapsed > m.autoLockMs) {
          setIsLocked(true);
        }
      }
    }

    // Prompt for PIN setup on first authenticated session if no PIN exists
    if (!pinIsSet && !promptStore.wasShown(uid)) {
      // Small delay so the app renders before the overlay appears
      const id = setTimeout(() => setShowPrompt(true), 800);
      return () => clearTimeout(id);
    }
  }, [uid]);

  // ── Visibility change → auto-lock ─────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    function onVisibility() {
      if (document.hidden) {
        metaStore.write(uid, { lastActiveAt: Date.now() });
        const m = metaStore.read(uid);
        // Apply background privacy blur if hide-balances is on
        if (m.hideBalances) {
          document.documentElement.setAttribute("data-app-hidden", "1");
        }
        // Immediate lock
        if (pinStore.read(uid) && m.autoLockMs === -1) {
          setIsLocked(true);
        }
      } else {
        document.documentElement.removeAttribute("data-app-hidden");
        const m = metaStore.read(uid);
        if (pinStore.read(uid) && m.autoLockMs > 0) {
          const elapsed = Date.now() - m.lastActiveAt;
          if (elapsed > m.autoLockMs) {
            setIsLocked(true);
          }
        }
        setMeta(metaStore.read(uid));
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [uid]);

  // ── Privacy mode CSS attribute ─────────────────────────────────────────────
  useEffect(() => {
    if (meta.hideBalances) {
      document.documentElement.setAttribute("data-privacy", "1");
    } else {
      document.documentElement.removeAttribute("data-privacy");
      document.documentElement.removeAttribute("data-app-hidden");
    }
  }, [meta.hideBalances]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    if (!uid) return false;
    const m = metaStore.read(uid);
    if (m.lockoutUntil > Date.now()) return false;

    const storedHash = pinStore.read(uid);
    if (!storedHash) { setIsLocked(false); return true; }

    const ok = await verifyPin(uid, pin, storedHash);
    if (ok) {
      metaStore.write(uid, { failedCount: 0, lockoutUntil: 0, lastActiveAt: Date.now() });
      setMeta(metaStore.read(uid));
      setIsLocked(false);
      return true;
    }
    const newCount = m.failedCount + 1;
    const lockout  = newCount >= 5 ? Date.now() + 30_000 : 0;
    metaStore.write(uid, { failedCount: newCount, lockoutUntil: lockout });
    setMeta(metaStore.read(uid));
    return false;
  }, [uid]);

  const setupPin = useCallback(async (pin: string): Promise<void> => {
    if (!uid) return;
    const hash = await hashPin(uid, pin);
    pinStore.write(uid, hash);
    metaStore.write(uid, { failedCount: 0, lockoutUntil: 0, lastActiveAt: Date.now() });
    setIsPinSet(true);
    setIsLocked(false);
    setMeta(metaStore.read(uid));
  }, [uid]);

  const verifyCurrentPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!uid) return true;
    const storedHash = pinStore.read(uid);
    if (!storedHash) return true;
    return verifyPin(uid, pin, storedHash);
  }, [uid]);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    if (!uid) return false;
    const ok = await verifyCurrentPin(currentPin);
    if (!ok) return false;
    await setupPin(newPin);
    return true;
  }, [uid, verifyCurrentPin, setupPin]);

  const removePin = useCallback(() => {
    if (!uid) return;
    pinStore.clear(uid);
    setIsPinSet(false);
    setIsLocked(false);
  }, [uid]);

  const lockNow = useCallback(() => {
    if (isPinSet) setIsLocked(true);
  }, [isPinSet]);

  const openSetup = useCallback((mode: "setup" | "change" = "setup") => {
    setSetupMode(mode);
  }, []);

  const updateMeta = useCallback((patch: Partial<LockMeta>) => {
    if (!uid) return;
    metaStore.write(uid, patch);
    setMeta(metaStore.read(uid));
  }, [uid]);

  function handleSetupDone() {
    setSetupMode(null);
    setShowPrompt(false);
    if (uid) promptStore.markShown(uid);
  }

  function handlePromptSkip() {
    setShowPrompt(false);
    if (uid) promptStore.markShown(uid);
  }

  const ctx: AppLockCtx = {
    isPinSet,
    isLocked,
    meta,
    biometricAvailable: isBiometricAvailable(),
    unlock,
    setupPin,
    verifyCurrentPin,
    changePin,
    removePin,
    lockNow,
    openSetup,
    updateMeta,
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}

      {/* First-run PIN setup prompt (dismissible) */}
      {showPrompt && !setupMode && !isLocked && uid && (
        <PinSetupScreen mode="setup" onComplete={handleSetupDone} onSkip={handlePromptSkip} />
      )}

      {/* Settings-triggered PIN setup/change */}
      {setupMode && !isLocked && (
        <PinSetupScreen mode={setupMode} onComplete={handleSetupDone} onSkip={() => setSetupMode(null)} />
      )}

      {/* Lock screen — no skip, highest z-index */}
      {isLocked && isPinSet && <LockScreen />}
    </Ctx.Provider>
  );
}
