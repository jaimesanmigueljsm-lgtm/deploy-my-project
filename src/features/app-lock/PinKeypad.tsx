import { memo } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";

interface PinKeypadProps {
  onDigit: (d: string) => void;
  onDelete: () => void;
  disabled?: boolean;
  /** "dark" = lock screen (white on dark), "light" = setup screen (foreground on bg) */
  variant?: "dark" | "light";
}

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "del"],
] as const;

const SPRING = { type: "spring" as const, stiffness: 600, damping: 30 };

export const PinKeypad = memo(function PinKeypad({
  onDigit,
  onDelete,
  disabled,
  variant = "dark",
}: PinKeypadProps) {
  const isDark = variant === "dark";

  return (
    <div className="grid gap-3 w-full max-w-xs mx-auto">
      {ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-3">
          {row.map((key, ki) => {
            if (key === "") return <div key={ki} />;

            if (key === "del") {
              return (
                <motion.button
                  key={ki}
                  whileTap={{ scale: 0.88 }}
                  transition={SPRING}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (!disabled) onDelete();
                  }}
                  disabled={disabled}
                  className="h-[66px] rounded-2xl flex items-center justify-center disabled:opacity-30 touch-manipulation select-none"
                  style={
                    isDark
                      ? { color: "rgba(255,255,255,0.55)" }
                      : { color: "var(--color-muted-foreground)" }
                  }
                  aria-label="Delete"
                >
                  <Delete className="size-5" />
                </motion.button>
              );
            }

            return (
              <motion.button
                key={ki}
                whileTap={{ scale: 0.88 }}
                transition={SPRING}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (!disabled) onDigit(key);
                }}
                disabled={disabled}
                className="h-[66px] rounded-2xl text-[24px] font-semibold flex items-center justify-center disabled:opacity-30 touch-manipulation select-none"
                style={
                  isDark
                    ? {
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        color: "rgba(255,255,255,0.90)",
                        fontFamily: "var(--font-display)",
                      }
                    : {
                        background: "var(--color-muted)",
                        color: "var(--color-foreground)",
                        fontFamily: "var(--font-display)",
                      }
                }
              >
                {key}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
