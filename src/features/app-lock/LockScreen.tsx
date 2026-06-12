import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { useAppLock } from "./use-app-lock";
import { PinKeypad } from "./PinKeypad";
import { useT } from "@/i18n";

export function LockScreen() {
  const { unlock, unlockBiometric, meta, biometricAvailable } = useAppLock();
  const { t } = useT();

  const [pin, setPin] = useState("");
  const [shaking, setShaking] = useState(false);
  const [errored, setErrored] = useState(false);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [bioBusy, setBioBusy] = useState(false);

  // Only show / auto-trigger biometric if user enabled it AND the device supports it
  const bioEnabled = meta.biometricEnabled && biometricAvailable;

  // Auto-trigger biometric once when the LockScreen mounts. Single attempt —
  // if user cancels, the PIN remains as fallback. useRef guards against React
  // re-renders firing it multiple times in StrictMode.
  const triedAutoBio = useRef(false);
  useEffect(() => {
    if (triedAutoBio.current) return;
    if (!bioEnabled) return;
    triedAutoBio.current = true;
    setBioBusy(true);
    void unlockBiometric().finally(() => setBioBusy(false));
  }, [bioEnabled, unlockBiometric]);

  const handleBiometricPress = useCallback(async () => {
    if (bioBusy || !bioEnabled) return;
    setBioBusy(true);
    try {
      await unlockBiometric();
    } finally {
      setBioBusy(false);
    }
  }, [bioBusy, bioEnabled, unlockBiometric]);

  // Lockout countdown
  useEffect(() => {
    if (!meta.lockoutUntil || meta.lockoutUntil <= Date.now()) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const r = Math.max(0, Math.ceil((meta.lockoutUntil - Date.now()) / 1000));
      setCountdown(r);
      if (r <= 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [meta.lockoutUntil]);

  const isLockedOut = countdown > 0;

  const attemptUnlock = useCallback(
    async (fullPin: string) => {
      if (checking || isLockedOut) return;
      setChecking(true);
      const ok = await unlock(fullPin);
      setChecking(false);
      if (!ok) {
        setPin("");
        setErrored(true);
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setErrored(false);
        }, 600);
      }
    },
    [unlock, checking, isLockedOut],
  );

  function onDigit(d: string) {
    if (isLockedOut || checking) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) void attemptUnlock(next);
  }

  function onDelete() {
    if (checking || isLockedOut) return;
    setPin((p) => p.slice(0, -1));
  }

  const attemptsLeft = Math.max(0, 5 - (meta.failedCount ?? 0));

  return (
    <div
      className="fixed inset-0 z-[10001] flex flex-col items-center text-white overflow-hidden select-none"
      style={{
        background: "linear-gradient(160deg, #060c1c 0%, #070c18 55%, #040911 100%)",
        paddingTop: "max(env(safe-area-inset-top), 24px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
      }}
    >
      {/* ── Ambient orbs ──────────────────────────────────────────────────── */}
      <motion.div
        className="absolute -top-32 left-1/2 -translate-x-1/2 size-[420px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, oklch(0.42 0.15 158 / 0.16) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-24 -right-20 size-[320px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, oklch(0.42 0.12 210 / 0.10) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="absolute bottom-1/3 -left-16 size-[260px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, oklch(0.38 0.14 290 / 0.07) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.12, 1] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
      />

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <motion.div
        className="relative flex flex-col items-center pt-10 pb-2"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* N-mark gradient square */}
        <div
          className="size-16 rounded-3xl flex items-center justify-center mb-3"
          style={{
            background: "linear-gradient(135deg, oklch(0.68 0.14 158), oklch(0.56 0.13 175))",
            boxShadow:
              "0 0 0 1px oklch(0.68 0.14 158 / 0.25), 0 16px 48px -12px oklch(0.62 0.14 158 / 0.50)",
          }}
        >
          <span
            className="text-white font-black text-3xl leading-none"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}
          >
            N
          </span>
        </div>
        <h1
          className="text-base font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          NOOLY
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>
          {t("lock.title")}
        </p>
      </motion.div>

      <div className="flex-1" />

      {/* ── PIN dots ──────────────────────────────────────────────────────── */}
      <motion.div
        className="flex flex-col items-center gap-3 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.4 }}
      >
        <div className={`flex gap-5 ${shaking ? "animate-shake" : ""}`}>
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            return (
              <motion.div
                key={i}
                animate={filled ? { scale: [1, 1.25, 1.1], opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
                className="size-4 rounded-full border-2 transition-colors duration-150"
                style={
                  filled
                    ? errored
                      ? { background: "#f87171", borderColor: "#f87171" }
                      : {
                          background: "oklch(0.75 0.15 158)",
                          borderColor: "oklch(0.75 0.15 158)",
                          boxShadow: "0 0 10px -2px oklch(0.62 0.14 158 / 0.6)",
                        }
                    : { background: "transparent", borderColor: "rgba(255,255,255,0.22)" }
                }
              />
            );
          })}
        </div>

        {/* Status text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={
              isLockedOut
                ? "locked"
                : errored
                  ? "error"
                  : meta.failedCount > 0
                    ? "attempts"
                    : "idle"
            }
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="h-5 flex items-center justify-center"
          >
            {isLockedOut ? (
              <p className="text-[13px] font-medium" style={{ color: "#f87171" }}>
                {t("lock.lockedOut", { seconds: String(countdown) })}
              </p>
            ) : errored ? (
              <p className="text-[13px]" style={{ color: "#f87171" }}>
                {t("lock.wrongPin")}
              </p>
            ) : meta.failedCount > 0 && attemptsLeft > 0 ? (
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                {t("lock.attemptsLeft", { count: String(attemptsLeft) })}
              </p>
            ) : (
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                {t("lock.enterPin")}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Keypad ────────────────────────────────────────────────────────── */}

      {/* ── Keypad ────────────────────────────────────────────────────────── */}
      <motion.div
        className="w-full px-6 pb-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <PinKeypad
          onDigit={onDigit}
          onDelete={onDelete}
          disabled={isLockedOut || checking}
          variant="dark"
        />
      </motion.div>

      {/* ── Biometric ─────────────────────────────────────────────────────── */}
      {bioEnabled && (
        <button
          onClick={handleBiometricPress}
          disabled={bioBusy || isLockedOut}
          className="flex flex-col items-center gap-1.5 mt-2 pb-2 transition-opacity hover:opacity-70 disabled:opacity-50"
          style={{ color: "rgba(255,255,255,0.40)" }}
          aria-label={t("lock.useBiometric")}
        >
          <Fingerprint className={`size-7 ${bioBusy ? "animate-pulse" : ""}`} />
          <span className="text-[11px]">
            {bioBusy ? t("lock.biometric.checking") : t("lock.useBiometric")}
          </span>
        </button>
      )}
    </div>
  );
}
