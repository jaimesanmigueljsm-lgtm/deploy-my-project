import { AlertTriangle, ShieldCheck, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ProgressRing, HealthStatusBadge, SubScoreBar, Skeleton } from "@/components/nest";
import { pct } from "@/lib/format";
import type { HealthScore } from "@/core/finance";
import { useT } from "@/i18n";

// ─── Skeletons ────────────────────────────────────────────────────────────────

export function HealthCardSkeleton() {
  return (
    <div className="card-flat p-5 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-28 h-2 rounded" />
            <Skeleton className="flex-1 h-1.5 rounded-full" />
            <Skeleton className="w-6 h-2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthCardSimpleSkeleton() {
  return (
    <div className="card-flat p-5 flex items-center gap-4">
      <Skeleton className="size-16 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
    </div>
  );
}

// ─── Score color (matches HEALTH_STATUS_BANDS for 0–1000 scale) ──────────────

function scoreColor(score: number): string {
  if (score >= 850) return "var(--positive)";
  if (score >= 700) return "var(--sky)";
  if (score >= 500) return "var(--sky)";
  if (score >= 300) return "var(--warn)";
  return "var(--negative)";
}

// ─── Simplified card (dashboard) ─────────────────────────────────────────────
// Shows: large score, status badge, short human explanation.
// No technical bars or breakdowns — those live on the Analytics page.

export function HealthCardSimple({ healthScore }: { healthScore: HealthScore }) {
  const { t } = useT();
  const { total, status, explanationKey } = healthScore;

  // Status badge label from i18n
  const statusLabel = t(`health.status.${status}` as never);
  // Short explanation driven by most-impactful factor
  const explanation = t(explanationKey as never);

  return (
    <div className="card-flat p-5 flex items-center gap-4">
      {/* Ring takes 0–100 for arc; label shows the real 0–1000 score */}
      <ProgressRing
        value={total / 10}
        size={64}
        stroke={5}
        label={`${total}`}
        color={scoreColor(total)}
        glow={total >= 850}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug text-foreground/80">{explanation}</p>
        <div className="mt-1.5">
          <HealthStatusBadge status={status} label={statusLabel} />
        </div>
        <Link
          to="/app/analytics"
          className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          {t("health.cta")} <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Full card (analytics tab) ────────────────────────────────────────────────

export function HealthCard({
  healthScore,
  currency,
}: {
  healthScore: HealthScore;
  currency: string;
}) {
  const { t } = useT();
  const { total, status, subScores, risks, explanationKey } = healthScore;

  const subScoreRows: Array<{ key: string; label: string; displayValue: string }> = [
    {
      key: "savingsConsistency",
      label: t("health.sub.savingsRate"),
      displayValue: pct(subScores.savingsConsistency.rawValue * 100, 1),
    },
    {
      key: "emergencyReadiness",
      label: t("health.sub.emergencyFund"),
      displayValue: `${subScores.emergencyReadiness.rawValue.toFixed(1)} mo`,
    },
    {
      key: "fixedExpensePressure",
      label: t("health.sub.recurringPressure"),
      displayValue: pct(subScores.fixedExpensePressure.rawValue * 100, 0),
    },
    {
      key: "spendingStability",
      label: t("health.sub.expenseStability"),
      displayValue: subScores.spendingStability.label,
    },
    {
      key: "goalConsistency",
      label: t("health.sub.goalProgress"),
      displayValue: subScores.goalConsistency.label,
    },
    {
      key: "incomeReliability",
      label: t("health.sub.incomeConsistency"),
      displayValue: subScores.incomeReliability.label,
    },
  ];

  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const warningRisks  = risks.filter((r) => r.severity === "warning");
  const statusLabel   = t(`health.status.${status}` as never);

  return (
    <div className="card-flat overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-4 border-b border-border-subtle">
        <ProgressRing
          value={total / 10}
          size={64}
          stroke={5}
          label={`${total}`}
          color={scoreColor(total)}
          glow={total >= 850}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug text-foreground/80 mb-1.5">
            {t(explanationKey as never)}
          </p>
          <HealthStatusBadge status={status} label={statusLabel} />
        </div>
      </div>

      {/* Sub-scores — each 0–100 internally */}
      <div className="px-5 py-4 space-y-2.5">
        {subScoreRows.map((row) => (
          <SubScoreBar
            key={row.key}
            label={row.label}
            score={(subScores as Record<string, { value: number }>)[row.key].value}
            value={row.displayValue}
          />
        ))}
      </div>

      {/* Risk flags */}
      {(criticalRisks.length > 0 || warningRisks.length > 0) && (
        <div className="border-t border-border-subtle px-5 py-3.5 space-y-2">
          {criticalRisks.slice(0, 2).map((r) => (
            <div key={r.code} className="flex items-start gap-2.5">
              <div className="size-5 rounded-lg bg-negative-soft grid place-items-center shrink-0 mt-0.5">
                <AlertTriangle className="size-3 text-negative" />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{r.description}</p>
            </div>
          ))}
          {warningRisks.slice(0, 1).map((r) => (
            <div key={r.code} className="flex items-start gap-2.5">
              <div className="size-5 rounded-lg bg-warn-soft grid place-items-center shrink-0 mt-0.5">
                <AlertTriangle className="size-3 text-warn" />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{r.description}</p>
            </div>
          ))}
        </div>
      )}

      {risks.length === 0 && (
        <div className="border-t border-border-subtle px-5 py-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-positive" />
          <p className="text-xs text-muted-foreground">{t("analytics.risk.none")}</p>
        </div>
      )}
    </div>
  );
}
