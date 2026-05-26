/**
 * recommendation-cards.tsx — Engine-powered Recommendation Cards.
 *
 * Renders a prioritised list of Recommendation objects from the engine.
 * Each card shows:
 *   · Severity indicator (colored border-left accent)
 *   · Title + explanation (via catalog → t())
 *   · Suggested action
 *   · Financial impact chip
 *   · Confidence bar
 *
 * Critical recommendations always appear first regardless of count.
 */

import { AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { shortMoney } from "@/lib/format";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";
import { ImpactChip, Skeleton } from "@/components/nest";
import type { Recommendation, RecommendationSeverity, RecommendationParams } from "@/core/finance";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { getCatalogEntry } from "@/features/recommendations/catalog";

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  RecommendationSeverity,
  { icon: typeof AlertTriangle; iconClass: string; borderClass: string; badgeClass: string }
> = {
  critical: {
    icon: AlertTriangle,
    iconClass: "text-negative",
    borderClass: "border-l-negative",
    badgeClass: "bg-negative-soft text-negative",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-warn",
    borderClass: "border-l-warn",
    badgeClass: "bg-warn-soft text-warn",
  },
  info: {
    icon: Info,
    iconClass: "text-sky",
    borderClass: "border-l-sky",
    badgeClass: "bg-sky/15 text-sky",
  },
  positive: {
    icon: CheckCircle2,
    iconClass: "text-positive",
    borderClass: "border-l-positive",
    badgeClass: "bg-positive-soft text-positive",
  },
};

// ─── Param formatting ─────────────────────────────────────────────────────────

function formatParams(
  raw: RecommendationParams,
  moneyParams: string[] | undefined,
  percentParams: string[] | undefined,
  currency: string,
  convert: (n: number) => number = (n) => n,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (moneyParams?.includes(k)) {
      out[k] = shortMoney(convert(Number(v)), currency);
    } else if (percentParams?.includes(k)) {
      out[k] = `${v}%`;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

// ─── Single card ──────────────────────────────────────────────────────────────

function RecommendationCard({ rec, currency }: { rec: Recommendation; currency: string }) {
  const { t } = useT();
  const convert = useCurrencyConvert();
  const [expanded, setExpanded] = useState(rec.severity === "critical");
  const cfg = SEVERITY_CONFIG[rec.severity];
  const Icon = cfg.icon;

  const entry = getCatalogEntry(rec.id);
  const fmtParams = entry
    ? formatParams(rec.params, entry.moneyParams, entry.percentParams, currency, convert)
    : {};

  const title = entry ? t(entry.titleKey as never, fmtParams) : rec.id;
  const explanation = entry ? t(entry.explanationKey as never, fmtParams) : "";
  const action = entry ? t(entry.actionKey as never, fmtParams) : "";

  const severityLabel = t(`rec.severity.${rec.severity}` as never);

  const { estimatedAmount, impactKey } = rec.financialImpact;
  const impactLabel =
    estimatedAmount != null
      ? t(impactKey as never, { amount: shortMoney(convert(estimatedAmount), currency) })
      : t(impactKey as never);

  return (
    <div className={cn("card-flat overflow-hidden border-l-2", cfg.borderClass)}>
      {/* Header row — always visible */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div
          className={cn(
            "size-8 rounded-xl grid place-items-center shrink-0 mt-0.5",
            cfg.badgeClass,
          )}
        >
          <Icon className={cn("size-4", cfg.iconClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold leading-snug">{title}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                cfg.badgeClass,
              )}
            >
              {severityLabel}
            </span>
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-1">
              {explanation}
            </p>
          )}
        </div>
        <span className="text-muted-foreground shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-3">
          <p className="text-xs text-foreground/75 leading-relaxed">{explanation}</p>

          <div className="card-sunken px-3 py-2.5 rounded-xl">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">
              {t("analytics.risk.action")}
            </p>
            <p className="text-xs font-medium leading-relaxed">{action}</p>
          </div>

          <div className="flex items-center justify-between">
            <ImpactChip label={impactLabel} />
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full",
                      i < Math.round(rec.confidence * 5) ? "bg-positive" : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground num">
                {Math.round(rec.confidence * 100)}% {t("analytics.confidence")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function RecommendationsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-flat p-4 flex gap-3">
          <Skeleton className="size-8 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3 w-2/3 rounded" />
            <Skeleton className="h-2 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function RecommendationCards({
  recommendations,
  currency,
}: {
  recommendations: Recommendation[];
  currency: string;
}) {
  if (recommendations.length === 0) return null;

  // Show top 5 — engine already sorts by severity + priority
  const visible = recommendations.slice(0, 5);

  return (
    <div className="space-y-2">
      {visible.map((rec) => (
        <RecommendationCard key={rec.id} rec={rec} currency={currency} />
      ))}
    </div>
  );
}
