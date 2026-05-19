/**
 * smart-insights.tsx — Spending Intelligence feed.
 *
 * Surfaces anomaly detection results and behavioral patterns as concise,
 * contextual cards. Returns null if there are no notable signals so the
 * dashboard section hides completely when there's nothing to say.
 */

import { TrendingUp, TrendingDown, AlertTriangle, Moon, Calendar, Zap } from "lucide-react";
import type { SpendingIntelligence } from "@/core/finance";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/nest";

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightTone = "warn" | "sky" | "mint" | "violet";

interface InsightItem {
  id: string;
  tone: InsightTone;
  icon: React.ReactNode;
  title: string;
  body: string;
}

// ─── Tone styles ──────────────────────────────────────────────────────────────

const TONE_ICON_CLASS: Record<InsightTone, string> = {
  warn:   "bg-warn-soft text-warn",
  sky:    "bg-sky-soft text-sky",
  mint:   "bg-positive-soft text-positive",
  violet: "bg-violet-soft text-violet",
};

// ─── Build insight items from engine output ───────────────────────────────────

function buildInsights(intel: SpendingIntelligence): InsightItem[] {
  const items: InsightItem[] = [];

  // Spending anomalies (highest severity first — already sorted by engine)
  for (const anomaly of intel.spendingAnomalies.slice(0, 2)) {
    const tone: InsightTone = anomaly.severity === "high" ? "warn" : "sky";
    items.push({
      id: `anomaly-${anomaly.categoryName}`,
      tone,
      icon: <AlertTriangle className="size-4" />,
      title: anomaly.description,
      body: `Historical average: ${anomaly.historicalMean.toFixed(0)} · z-score ${anomaly.zScore.toFixed(1)}`,
    });
  }

  // Weekend spending pattern
  if (intel.weekendSpendingRatio > 1.5) {
    items.push({
      id: "weekend-pattern",
      tone: "violet",
      icon: <Moon className="size-4" />,
      title: `Weekend spending is ${intel.weekendSpendingRatio.toFixed(1)}× weekday average`,
      body: "Your discretionary spending rises significantly on weekends. Setting a weekend budget can help.",
    });
  }

  // Month-end concentration
  if (intel.monthEndConcentration > 0.4) {
    items.push({
      id: "month-end-concentration",
      tone: "sky",
      icon: <Calendar className="size-4" />,
      title: `${Math.round(intel.monthEndConcentration * 100)}% of this month's spend in the last 7 days`,
      body: "End-of-month spending spikes can strain your budget. Try spreading purchases more evenly.",
    });
  }

  // Spending trajectory
  if (intel.spendingTrajectory === "deteriorating") {
    items.push({
      id: "trajectory-deteriorating",
      tone: "warn",
      icon: <TrendingUp className="size-4" />,
      title: "Spending is trending higher than your 3-month average",
      body: `Month-over-month change: +${(intel.totalSpendMoMChange * 100).toFixed(1)}%. Check your top growing categories below.`,
    });
  } else if (intel.spendingTrajectory === "improving") {
    items.push({
      id: "trajectory-improving",
      tone: "mint",
      icon: <TrendingDown className="size-4" />,
      title: "Spending is below your 3-month average — great momentum",
      body: "Keep it up. Consistent lower spending compounds into meaningful savings over time.",
    });
  }

  // High-growth categories
  if (intel.highGrowthCategories.length > 0) {
    const cats = intel.highGrowthCategories.slice(0, 2).join(", ");
    items.push({
      id: "high-growth-categories",
      tone: "sky",
      icon: <Zap className="size-4" />,
      title: `${cats} spending grew 20%+ vs last month`,
      body: "These categories are growing faster than usual. Check if these are one-off spikes or a new trend.",
    });
  }

  return items.slice(0, 4);
}

// ─── Components ───────────────────────────────────────────────────────────────

function SmartInsightItem({ item }: { item: InsightItem }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0">
      <div className={cn("size-8 rounded-xl grid place-items-center shrink-0 mt-0.5", TONE_ICON_CLASS[item.tone])}>
        {item.icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.body}</p>
      </div>
    </div>
  );
}

export function SmartInsightsSkeleton() {
  return (
    <div className="card-flat overflow-hidden">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0">
          <Skeleton className="size-8 rounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-2 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SmartInsightsFeed({
  intelligence,
}: {
  intelligence: SpendingIntelligence;
}) {
  const items = buildInsights(intelligence);
  if (items.length === 0) return null;

  return (
    <div className="card-flat overflow-hidden">
      {items.map((item) => (
        <SmartInsightItem key={item.id} item={item} />
      ))}
    </div>
  );
}
