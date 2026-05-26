import { useState, useEffect, useCallback } from "react";
import { Fingerprint } from "lucide-react";
import { useAppLock } from "./use-app-lock";
import { PinKeypad } from "./PinKeypad";
import { useT } from "@/i18n";

export function LockScreen() {
  const { unlock, meta, biometricAvailable } = useAppLock();
  const { t } = useT();

  const [pin,      setPin]      = useState("");
  const [shaking,  setShaking]  = useState(false);
  const [errored,  setErrored]  = useState(false);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(0);

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

  const attemptUnlock = useCallback(async (fullPin: string) => {
    if (checking || isLockedOut) return;
    setChecking(true);
    const ok = await unlock(fullPin);
    setChecking(false);
    if (!ok) {
      setPin("");
      setErrored(true);
      setShaking(true);
      setTimeout(() => { setShaking(false); setErrored(false); }, 600);
    }
    // On success the provider sets isLocked=false → this component unmounts
  }, [unlock, checking, isLockedOut]);

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
      className="fixed inset-0 z-[10001] flex flex-col items-center bg-[#080d1a] text-white overflow-hidden select-none"
      style={{
        paddingTop:    "max(env(safe-area-inset-top), 24px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

      {/* Top — logo */}
      <div className="relative flex flex-col items-center pt-10 pb-2">
        <div className="size-16 rounded-3xl bg-white/8 border border-white/12 grid place-items-center mb-3 backdrop-blur-sm">
          <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>N</span>
        </div>
        <h1 className="text-base font-semibold tracking-tight">Nest</h1>
        <p className="text-[13px] text-white/45 mt-1">{t("lock.title")}</p>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* PIN dots */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className={`flex gap-5 ${shaking ? "animate-shake" : ""}`}>
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            return (
              <div
                key={i}
                className={`size-4 rounded-full border-2 transition-all duration-150 ${
                  filled
                    ? errored
                      ? "bg-red-400 border-red-400 scale-110"
                      : "bg-white border-white scale-110"
                    : "bg-transparent border-white/30"
                }`}
              />
            );
          })}
        </div>

        {/* Status text */}
        <div className="h-5 flex items-center justify-center">
          {isLockedOut ? (
            <p className="text-[13px] text-red-400 font-medium">
              {t("lock.lockedOut", { seconds: String(countdown) })}
            </p>
          ) : errored ? (
            <p className="text-[13px] text-red-400">{t("lock.wrongPin")}</p>
          ) : meta.failedCount > 0 && attemptsLeft > 0 ? (
            <p className="text-[11px] text-white/35">
              {t("lock.attemptsLeft", { count: String(attemptsLeft) })}
            </p>
          ) : (
            <p className="text-[13px] text-white/35">{t("lock.enterPin")}</p>
          )}
        </div>
      </div>

      {/* Keypad */}
      <div className="w-full px-6 pb-4">
        <PinKeypad
          onDigit={onDigit}
          onDelete={onDelete}
          disabled={isLockedOut || checking}
          variant="dark"
        />
      </div>

      {/* Biometric placeholder — future */}
      {biometricAvailable && (
        <button className="flex flex-col items-center gap-1.5 mt-2 opacity-50 pb-2">
          <Fingerprint className="size-7" />
          <span className="text-[11px]">{t("lock.useBiometric")}</span>
        </button>
      )}
    </div>
  );
}
