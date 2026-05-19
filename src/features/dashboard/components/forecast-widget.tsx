import { TrendingDown, TrendingUp, Minus, Wallet, PiggyBank } from "lucide-react";
import { shortMoney } from "@/lib/format";
import type { BudgetForecast } from "@/core/finance";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/nest";
import { useT } from "@/i18n";

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

  // Tile 1 — Today's budget
  const spendTone: "positive" | "warn" | "negative" =
    forecast.safeToSpendPerDay > 0 ? "positive" :
    forecast.safeToSpendPerDay === 0 ? "warn" : "negative";

  // Tile 2 — Saved this month (actual, not projected)
  const saved = savedSoFar ?? 0;
  const savedTone: "positive" | "warn" | "neutral" =
    saved > 0 ? "positive" : saved < 0 ? "warn" : "neutral";

  // Tile 3 — Month outlook
  const overrun = forecast.projectedOverrun;
  const projectionTone: "positive" | "warn" | "negative" =
    overrun ? "negative" : forecast.overrunProbability > 0.4 ? "warn" : "positive";
  const projectionDelta = forecast.projectedTotalWithFixed - forecast.expectedMonthlyIncome;
  const TrajectoryIcon = overrun ? TrendingDown : forecast.overrunProbability > 0.4 ? Minus : TrendingUp;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Tile
        label={t("dashboard.forecast.daily")}
        value={shortMoney(Math.max(0, forecast.safeToSpendPerDay), currency)}
        sublabel={t("dashboard.forecast.daily.tip")}
        tone={spendTone}
        icon={<Wallet className="size-3" />}
      />
      <Tile
        label={t("dashboard.forecast.saved")}
        value={shortMoney(Math.max(0, saved), currency)}
        sublabel={t("dashboard.forecast.saved.sub")}
        tone={savedTone}
        icon={<PiggyBank className="size-3" />}
      />
      <Tile
        label={t("dashboard.forecast.outlook")}
        value={shortMoney(forecast.projectedTotalWithFixed, currency)}
        sublabel={
          overrun
            ? `+${shortMoney(Math.abs(projectionDelta), currency)} ${t("dashboard.forecast.outlook.over")}`
            : `${shortMoney(Math.abs(projectionDelta), currency)} ${t("dashboard.forecast.outlook.under")}`
        }
        tone={projectionTone}
        icon={<TrajectoryIcon className="size-3" />}
      />
    </div>
  );
}
