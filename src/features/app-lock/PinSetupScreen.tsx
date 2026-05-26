import { useState, useCallback } from "react";
import { Shield, CheckCircle2, X } from "lucide-react";
import { useAppLock } from "./use-app-lock";
import { PinKeypad } from "./PinKeypad";
import { useT } from "@/i18n";

type Step = "verify_current" | "enter_new" | "confirm" | "done";

interface Props {
  mode:       "setup" | "change";
  onComplete: () => void;
  onSkip?:    () => void;
}

export function PinSetupScreen({ mode, onComplete, onSkip }: Props) {
  const { setupPin, verifyCurrentPin } = useAppLock();
  const { t } = useT();

  const initial: Step = mode === "change" ? "verify_current" : "enter_new";
  const [step,       setStep]       = useState<Step>(initial);
  const [pin,        setPin]        = useState("");
  const [firstPin,   setFirstPin]   = useState("");
  const [shaking,    setShaking]    = useState(false);
  const [errored,    setErrored]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [errorLabel, setErrorLabel] = useState("");

  function shake(label?: string) {
    setErrorLabel(label ?? "");
    setShaking(true);
    setErrored(true);
    setTimeout(() => { setShaking(false); setErrored(false); }, 600);
  }

  const onDigit = useCallback(async (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;

    if (step === "verify_current") {
      setLoading(true);
      const ok = await verifyCurrentPin(next);
      setLoading(false);
      if (!ok) {
        setPin("");
        shake(t("pin.setup.wrongCurrent"));
        return;
      }
      setPin("");
      setStep("enter_new");

    } else if (step === "enter_new") {
      setFirstPin(next);
      setPin("");
      setStep("confirm");

    } else if (step === "confirm") {
      if (next !== firstPin) {
        setPin("");
        shake(t("pin.setup.mismatch"));
        return;
      }
      setLoading(true);
      await setupPin(next);
      setLoading(false);
      setStep("done");
      setTimeout(onComplete, 1400);
    }
  }, [pin, step, firstPin, verifyCurrentPin, setupPin, onComplete, t]);

  function onDelete() {
    setPin((p) => p.slice(0, -1));
  }

  // ── Labels per step ──────────────────────────────────────────────────────
  const title = step === "done"           ? t("pin.setup.done.title")
    : step === "verify_current"           ? t("pin.setup.verifyCurrentTitle")
    : step === "enter_new"                ? t(mode === "setup" ? "pin.setup.title" : "pin.setup.newTitle")
    :                                       t("pin.setup.confirmTitle");

  const desc = step === "done"            ? t("pin.setup.done.desc")
    : step === "verify_current"           ? t("pin.setup.verifyCurrentDesc")
    : step === "enter_new"                ? t("pin.setup.desc")
    :                                       t("pin.setup.confirmDesc");

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center bg-background text-foreground animate-fade-in"
      style={{
        paddingTop:    "max(env(safe-area-inset-top), 16px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
      }}
    >
      {/* Header row */}
      <div className="w-full flex items-center justify-end px-4 pt-2">
        {onSkip && step !== "done" && (
          <button
            onClick={onSkip}
            className="size-8 rounded-full bg-muted grid place-items-center text-muted-foreground hover:bg-muted/80 transition"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {step === "done" ? (
        // ── Success state ──────────────────────────────────────────────────
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="size-20 rounded-full bg-positive/10 grid place-items-center">
            <CheckCircle2 className="size-10 text-positive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{desc}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="size-16 rounded-2xl bg-foreground/5 border border-border grid place-items-center">
              <Shield className="size-7 text-foreground/70" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </div>

            {/* PIN dots */}
            <div className={`flex gap-5 ${shaking ? "animate-shake" : ""}`}>
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                return (
                  <div
                    key={i}
                    className={`size-4 rounded-full border-2 transition-all duration-150 ${
                      filled
                        ? errored
                          ? "bg-negative border-negative scale-110"
                          : "bg-foreground border-foreground scale-110"
                        : "bg-transparent border-foreground/20"
                    }`}
                  />
                );
              })}
            </div>

            {/* Error / skip */}
            <div className="h-5 flex items-center justify-center">
              {errored && errorLabel ? (
                <p className="text-[13px] text-negative">{errorLabel}</p>
              ) : onSkip && mode === "setup" && step === "enter_new" ? (
                <button
                  onClick={onSkip}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  {t("pin.setup.skip")}
                </button>
              ) : null}
            </div>
          </div>

          {/* Keypad */}
          <div className="w-full px-6 pb-4">
            <PinKeypad
              onDigit={(d) => void onDigit(d)}
              onDelete={onDelete}
              disabled={loading}
              variant="light"
            />
          </div>
        </>
      )}
    </div>
  );
}
