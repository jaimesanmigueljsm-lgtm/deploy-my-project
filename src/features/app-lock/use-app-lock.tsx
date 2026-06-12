import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hashPin, verifyPin, isLegacyHash } from "@/lib/pin-crypto";
import { pinStore, metaStore, promptStore, type LockMeta } from "./app-lock-store";
import { LockScreen } from "./LockScreen";
import { PinSetupScreen } from "./PinSetupScreen";
import {
  isBiometricAvailable as checkBiometric,
  authenticateBiometric,
  hasBiometricCredential,
} from "@/lib/biometric";
import { logSecurityEvent } from "@/lib/security/security-events";
import { trustCurrentDevice, updateDeviceLastActive } from "@/lib/device";
import {
  verifyPinAttempt,
  recordFailedUnlock,
  recordSuccessfulUnlock,
  initializeUserSecurity,
} from "@/features/security/security.service";
import {
  canUnlockOffline,
  incrementOfflineUnlock,
  resetOfflineUnlock,
  getRemainingOfflineUnlocks,
  getOfflineUnlockMetadata,
  OFFLINE_LIMITS,
} from "@/lib/offline-unlock-store";
import { startAutoSync, stopAutoSync, syncPendingOperations } from "@/lib/sync-queue";
import { toast } from "sonner";

// ─── Context ──────────────────────────────────────────────────────────────────

export interface AppLockCtx {
  isPinSet: boolean;
  isLocked: boolean;
  meta: LockMeta;
  biometricAvailable: boolean;
  unlock: (pin: string) => Promise<boolean>;
  unlockBiometric: () => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  verifyCurrentPin: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  removePin: () => void;
  lockNow: () => void;
  openSetup: (mode?: "setup" | "change") => void;
  updateMeta: (patch: Partial<LockMeta>) => void;
}

const Ctx = createContext<AppLockCtx | null>(null);

export function useAppLock(): AppLockCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppLock must be inside AppLockProvider");
  return ctx;
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const [isPinSet, setIsPinSet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [meta, setMeta] = useState<LockMeta>(() => metaStore.read(""));
  const [setupMode, setSetupMode] = useState<"setup" | "change" | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [biometricAvailableState, setBiometricAvailable] = useState(false);

  useEffect(() => {
    void checkBiometric().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    if (!uid) {
      setIsPinSet(false);
      setIsLocked(false);
      setShowPrompt(false);
      return;
    }

    const pinHash = pinStore.read(uid);
    const m = metaStore.read(uid);
    const pinIsSet = !!pinHash;

    setIsPinSet(pinIsSet);
    setMeta(m);

    if (pinIsSet && m.autoLockMs !== 0) {
      const path = typeof window !== "undefined" ? window.location.pathname : "/";
      const isPublic = path.startsWith("/auth") || path.startsWith("/onboarding");
      if (!isPublic) {
        const elapsed = Date.now() - m.lastActiveAt;
        if (m.autoLockMs === -1 || elapsed > m.autoLockMs) {
          setIsLocked(true);
        }
      }
    }

    if (!pinIsSet && !promptStore.wasShown(uid)) {
      const id = setTimeout(() => setShowPrompt(true), 800);
      return () => clearTimeout(id);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    function onVisibility() {
      if (document.hidden) {
        metaStore.write(uid, { lastActiveAt: Date.now() });
        const m = metaStore.read(uid);
        if (m.hideBalances) {
          document.documentElement.setAttribute("data-app-hidden", "1");
        }
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

  useEffect(() => {
    if (meta.hideBalances) {
      document.documentElement.setAttribute("data-privacy", "1");
    } else {
      document.documentElement.removeAttribute("data-privacy");
      document.documentElement.removeAttribute("data-app-hidden");
    }
  }, [meta.hideBalances]);

  useEffect(() => {
    if (!uid) {
      stopAutoSync();
      return;
    }

    startAutoSync(uid);

    function handleOnline() {
      if (!uid) return;
      console.log("[app-lock] Connection restored, verifying offline activity...");
      void syncPendingOperations(uid);
      const offlineMetadata = getOfflineUnlockMetadata(uid);
      if (offlineMetadata.suspicious) {
        console.warn("[app-lock] Suspicious offline activity detected:", offlineMetadata);
        setIsLocked(true);
        toast.error("Suspicious activity detected. Please unlock again to verify your identity.");
        logSecurityEvent(uid, "lockout_triggered", {
          reason: "suspicious_offline_activity",
          ...offlineMetadata,
        });
      } else if (offlineMetadata.offline_unlock_count > 0) {
        logSecurityEvent(uid, "login", {
          offline_unlocks_used: offlineMetadata.offline_unlock_count,
        });
        resetOfflineUnlock(uid);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    return () => {
      stopAutoSync();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
    };
  }, [uid]);

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!uid) return false;
      try {
        const backendState = await verifyPinAttempt();
        if (!backendState.success) {
          if (backendState.reason === "locked") {
            toast.error("Account locked. Too many failed attempts.");
            logSecurityEvent(uid, "lockout_triggered");
            return false;
          }
          throw new Error(backendState.message || "Backend verification failed");
        }
        const storedHash = backendState.pin_hash || pinStore.read(uid);
        if (!storedHash) { setIsLocked(false); return true; }
        const pinValid = await verifyPin(uid, pin, storedHash);
        if (pinValid) {
          await recordSuccessfulUnlock();
          if (isLegacyHash(storedHash)) {
            void hashPin(uid, pin).then((newHash) => {
              pinStore.write(uid, newHash);
              void initializeUserSecurity(newHash, {
                autoLockMs: meta.autoLockMs,
                hideBalances: meta.hideBalances,
                biometricEnabled: meta.biometricEnabled,
              });
            });
          }
          metaStore.write(uid, { failedCount: 0, lockoutUntil: 0, lastActiveAt: Date.now() });
          setMeta(metaStore.read(uid));
          setIsLocked(false);
          trustCurrentDevice(uid);
          updateDeviceLastActive(uid);
          logSecurityEvent(uid, "login");
          resetOfflineUnlock(uid);
          return true;
        } else {
          await recordFailedUnlock();
          const m = metaStore.read(uid);
          const newCount = m.failedCount + 1;
          const lockout = newCount >= 5 ? Date.now() + 30_000 : 0;
          metaStore.write(uid, { failedCount: newCount, lockoutUntil: lockout });
          setMeta(metaStore.read(uid));
          logSecurityEvent(uid, "failed_unlock", { attempt: newCount });
          if (lockout) logSecurityEvent(uid, "lockout_triggered");
          return false;
        }
      } catch (backendError) {
        console.warn("[unlock] Backend unavailable, attempting offline unlock:", backendError);
        if (!canUnlockOffline(uid)) {
          const remaining = getRemainingOfflineUnlocks(uid);
          toast.error(
            "For your security, online verification is required.\nPlease check your internet connection.\n(" +
              remaining + "/" + OFFLINE_LIMITS.MAX_UNLOCKS + " offline unlocks remaining)"
          );
          return false;
        }
        const m = metaStore.read(uid);
        if (m.lockoutUntil > Date.now()) {
          toast.error("Account temporarily locked. Please wait.");
          return false;
        }
        const storedHash = pinStore.read(uid);
        if (!storedHash) { setIsLocked(false); return true; }
        const pinValid = await verifyPin(uid, pin, storedHash);
        if (!pinValid) {
          const newCount = m.failedCount + 1;
          const lockout = newCount >= 5 ? Date.now() + 30_000 : 0;
          metaStore.write(uid, { failedCount: newCount, lockoutUntil: lockout });
          setMeta(metaStore.read(uid));
          logSecurityEvent(uid, "failed_unlock", { attempt: newCount, offline: true });
          if (lockout) logSecurityEvent(uid, "lockout_triggered");
          return false;
        }
        if (meta.biometricEnabled && biometricAvailableState) {
          logSecurityEvent(uid, "offline_biometric_unlock");
        } else {
          logSecurityEvent(uid, "offline_unlock");
        }
        const offlineState = incrementOfflineUnlock(uid);
        const remaining = getRemainingOfflineUnlocks(uid);
        metaStore.write(uid, { failedCount: 0, lockoutUntil: 0, lastActiveAt: Date.now() });
        setMeta(metaStore.read(uid));
        setIsLocked(false);
        trustCurrentDevice(uid);
        updateDeviceLastActive(uid);
        toast.warning(
          "Unlocked offline (" + offlineState.count + "/" + OFFLINE_LIMITS.MAX_UNLOCKS +
            " used).\nConnect to internet to restore full access.",
          { duration: 5000 }
        );
        return true;
      }
    },
    [uid, meta, biometricAvailableState],
  );

  // Biometric unlock — independent from PIN. A failed bio attempt does NOT
  // increment the PIN failure counter; the user can always fall back to PIN.
  const unlockBiometric = useCallback(async (): Promise<boolean> => {
    if (!uid) return false;
    if (!meta.biometricEnabled) return false;
    if (!hasBiometricCredential(uid)) return false;
    try {
      const ok = await authenticateBiometric(uid);
      if (!ok) return false;
      metaStore.write(uid, { failedCount: 0, lockoutUntil: 0, lastActiveAt: Date.now() });
      setMeta(metaStore.read(uid));
      setIsLocked(false);
      trustCurrentDevice(uid);
      updateDeviceLastActive(uid);
      logSecurityEvent(uid, "login", { method: "biometric" });
      resetOfflineUnlock(uid);
      return true;
    } catch (e) {
      console.warn("[unlockBiometric] failed:", e);
      return false;
    }
  }, [uid, meta.biometricEnabled]);

  const setupPin = useCallback(
    async (pin: string): Promise<void> => {
      if (!uid) return;
      const alreadySet = !!pinStore.read(uid);
      const hash = await hashPin(uid, pin);
      pinStore.write(uid, hash);
      metaStore.write(uid, { failedCount: 0, lockoutUntil: 0, lastActiveAt: Date.now() });
      try {
        await initializeUserSecurity(hash, {
          autoLockMs: meta.autoLockMs,
          hideBalances: meta.hideBalances,
          biometricEnabled: meta.biometricEnabled,
        });
      } catch (error) {
        console.error("[setupPin] Failed to initialize backend security:", error);
      }
      setIsPinSet(true);
      setIsLocked(false);
      setMeta(metaStore.read(uid));
      trustCurrentDevice(uid);
      logSecurityEvent(uid, alreadySet ? "pin_changed" : "pin_set");
    },
    [uid, meta],
  );

  const verifyCurrentPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!uid) return true;
      const storedHash = pinStore.read(uid);
      if (!storedHash) return true;
      return verifyPin(uid, pin, storedHash);
    },
    [uid],
  );

  const changePin = useCallback(
    async (currentPin: string, newPin: string): Promise<boolean> => {
      if (!uid) return false;
      const ok = await verifyCurrentPin(currentPin);
      if (!ok) return false;
      await setupPin(newPin);
      return true;
    },
    [uid, verifyCurrentPin, setupPin],
  );

  const removePin = useCallback(() => {
    if (!uid) return;
    pinStore.clear(uid);
    setIsPinSet(false);
    setIsLocked(false);
    logSecurityEvent(uid, "pin_removed");
  }, [uid]);

  const lockNow = useCallback(() => {
    if (isPinSet) setIsLocked(true);
  }, [isPinSet]);

  const openSetup = useCallback((mode: "setup" | "change" = "setup") => {
    setSetupMode(mode);
  }, []);

  const updateMeta = useCallback(
    (patch: Partial<LockMeta>) => {
      if (!uid) return;
      metaStore.write(uid, patch);
      setMeta(metaStore.read(uid));
    },
    [uid],
  );

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
    biometricAvailable: biometricAvailableState,
    unlock,
    unlockBiometric,
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
      {showPrompt && !setupMode && !isLocked && uid && (
        <PinSetupScreen mode="setup" onComplete={handleSetupDone} onSkip={handlePromptSkip} />
      )}
      {setupMode && !isLocked && (
        <PinSetupScreen
          mode={setupMode}
          onComplete={handleSetupDone}
          onSkip={() => setSetupMode(null)}
        />
      )}
      {isLocked && isPinSet && <LockScreen />}
    </Ctx.Provider>
  );
}
