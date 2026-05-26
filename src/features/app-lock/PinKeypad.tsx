import { memo } from "react";
import { Delete } from "lucide-react";

interface PinKeypadProps {
  onDigit:  (d: string) => void;
  onDelete: () => void;
  disabled?: boolean;
  /** "dark" = lock screen (white on dark), "light" = setup screen (foreground on bg) */
  variant?: "dark" | "light";
}

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["",  "0", "del"],
] as const;

export const PinKeypad = memo(function PinKeypad({
  onDigit, onDelete, disabled, variant = "dark",
}: PinKeypadProps) {
  const isDark = variant === "dark";

  const keyBase = isDark
    ? "bg-white/10 text-white active:bg-white/25"
    : "bg-muted text-foreground active:bg-foreground/10";

  const delBase = isDark
    ? "text-white/60 active:bg-white/10"
    : "text-muted-foreground active:bg-muted";

  return (
    <div className="grid gap-3 w-full max-w-xs mx-auto">
      {ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-3">
          {row.map((key, ki) => {
            if (key === "") return <div key={ki} />;

            if (key === "del") {
              return (
                <button
                  key={ki}
                  onPointerDown={(e) => { e.preventDefault(); if (!disabled) onDelete(); }}
                  disabled={disabled}
                  className={`h-[68px] rounded-2xl flex items-center justify-center ${delBase} active:scale-95 transition-transform select-none disabled:opacity-30 touch-manipulation`}
                  aria-label="Delete"
                >
                  <Delete className="size-5" />
                </button>
              );
            }

            return (
              <button
                key={ki}
                onPointerDown={(e) => { e.preventDefault(); if (!disabled) onDigit(key); }}
                disabled={disabled}
                className={`h-[68px] rounded-2xl ${keyBase} text-[26px] font-medium flex items-center justify-center active:scale-95 transition-all select-none disabled:opacity-30 touch-manipulation`}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
