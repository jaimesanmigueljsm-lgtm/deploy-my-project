import { TrendingDown, TrendingUp, Minus, Wallet, PiggyBank } from "lucide-react";
import { shortMoney } from "@/lib/format";
import type { BudgetForecast } from "@/core/finance";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/nest";
import { useT } from "@/i18n";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ForecastSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-flat p-3.5 space-y-2">
          <Skeleton className="h-2.5 w-12 rounded" />
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-2 w-10 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sublabel,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone: "positive" | "warn" | "negative" | "neutral";
  icon: React.ReactNode;
}) {
  const toneClasses = {
    positive: "text-positive",
    warn:     "text-warn",
    negative: "text-negative",
    neutral:  "text-muted-foreground",
  };
  const toneIconBg = {
    positive: "bg-positive-soft text-positive",
    warn:     "bg-warn-soft text-warn",
    negative: "bg-negative-soft text-negative",
    neutral:  "bg-muted text-muted-foreground",
  };
  return (
    <div className="card-flat p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="label-overline">{label}</span>
        <span className={cn("size-5 rounded-lg grid place-items-center", toneIconBg[tone])}>
          {icon}
        </span>
      </div>
      <div className={cn("num text-xl font-semibold tracking-tight leading-none", toneClasses[tone])}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground leading-tight">{sublabel}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ForecastWidget({
  forecast,
  currency,
  savedSoFar,
}: {
  forecast: BudgetForecast;
  currency: string;
  savedSoFar?: number;
}) {
  const { t } = useT();
  const convert = useCurrencyConvert();

  // Tile 1 — Today's budget
  const spendTone: "positive" | "warn" | "negative" =
    forecast.safeToSpendPerDay > 0 ? "positive" :
    forecast.safeToSpendPerDay === 0 ? "warn" : "negative";

  // Tile 2 — Saved this month (actual, not projected)
  const saved = savedSoFar ?? 0;
  const savedTone: "positive" | "warn" | "neutral" =
    saved > 0 ? "positive" : saved < 0 ? "warn" : "neutral";

  // Tile 3 — Closing balance: income − already spent − pending bills (Task 6)
  const closing = forecast.projectedClosingBalance;
  const closingTone: "positive" | "warn" | "negative" =
    closing > 0 ? "positive" : closing > -50 ? "warn" : "negative";
  const ClosingIcon = closing > 0 ? TrendingUp : closing > -50 ? Minus : TrendingDown;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Tile
        label={t("dashboard.forecast.daily")}
        value={shortMoney(convert(Math.max(0, forecast.safeToSpendPerDay)), currency)}
        sublabel={t("dashboard.forecast.daily.tip")}
        tone={spendTone}
        icon={<Wallet className="size-3" />}
      />
      <Tile
        label={t("dashboard.forecast.saved")}
        value={shortMoney(convert(Math.max(0, saved)), currency)}
        sublabel={t("dashboard.forecast.saved.sub")}
        tone={savedTone}
        icon={<PiggyBank className="size-3" />}
      />
      <Tile
        label={t("dashboard.forecast.closing")}
        value={
          closing < 0
            ? `-${shortMoney(convert(Math.abs(closing)), currency)}`
            : shortMoney(convert(closing), currency)
        }
        sublabel={
          closing < 0
            ? `${shortMoney(convert(Math.abs(closing)), currency)} ${t("dashboard.forecast.outlook.over")}`
            : `${shortMoney(convert(closing), currency)} ${t("dashboard.forecast.closing.saves")}`
        }
        tone={closingTone}
        icon={<ClosingIcon className="size-3" />}
      />
    </div>
  );
}
