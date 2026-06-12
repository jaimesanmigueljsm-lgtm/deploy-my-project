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
import { useT } from "@/i18n";

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
  warn: "bg-warn-soft text-warn",
  sky: "bg-sky-soft text-sky",
  mint: "bg-positive-soft text-positive",
  violet: "bg-violet-soft text-violet",
};

// ─── Build insight items from engine output ───────────────────────────────────

function buildInsights(intel: SpendingIntelligence, t: (k: string) => string): InsightItem[] {
  const items: InsightItem[] = [];

  // 1. Top anomalies (most actionable, max 2)
  for (const anomaly of intel.spendingAnomalies.slice(0, 2)) {
    const tone: InsightTone = anomaly.severity === "high" ? "warn" : "sky";
    items.push({
      id: `anomaly-${anomaly.categoryName}`,
      tone,
      icon: <AlertTriangle className="size-4" />,
      title: anomaly.description,
      body: t("insights.anomaly.body")
        .replace("{avg}", anomaly.historicalMean.toFixed(0))
        .replace("{z}", anomaly.zScore.toFixed(1)),
    });
  }

  // 2. Single fastest-growing category (always show if data exists — even modest
  //    growth is useful context. The warning tone only triggers when growth is
  //    aggressive (> 50%) so the user can scan severity at a glance.)
  const topGrowing = intel.topGrowingCategories[0];
  if (topGrowing && topGrowing.changeRatio > 0.05) {
    items.push({
      id: "topgrowing-category",
      tone: topGrowing.changeRatio > 0.5 ? "warn" : "sky",
      icon: <Zap className="size-4" />,
      title: t("insights.topgrowing.title")
        .replace("{cat}", topGrowing.categoryName)
        .replace("{pct}", String(Math.round(topGrowing.changeRatio * 100))),
      body: t("insights.topgrowing.body"),
    });
  }

  // 3. Top shrinking category (celebrate progress when the user has reduced
  //    something meaningfully — at least 10% drop).
  const topShrinking = intel.topShrinkingCategories[0];
  if (topShrinking && topShrinking.changeRatio < -0.1) {
    items.push({
      id: "topshrinking-category",
      tone: "mint",
      icon: <TrendingDown className="size-4" />,
      title: t("insights.topshrinking.title")
        .replace("{cat}", topShrinking.categoryName)
        .replace("{pct}", String(Math.round(Math.abs(topShrinking.changeRatio) * 100))),
      body: t("insights.topshrinking.body"),
    });
  }

  // 4. Weekend pattern — threshold lowered from 1.5 to 1.3 so the card surfaces
  //    for the much larger share of users whose weekends are noticeably (but
  //    not dramatically) more expensive than weekdays.
  if (intel.weekendSpendingRatio > 1.3) {
    items.push({
      id: "weekend-pattern",
      tone: "violet",
      icon: <Moon className="size-4" />,
      title: t("insights.weekend.title").replace("{ratio}", intel.weekendSpendingRatio.toFixed(1)),
      body: t("insights.weekend.body"),
    });
  }

  // 5. Month-end concentration — threshold lowered from 0.4 to 0.3.
  if (intel.monthEndConcentration > 0.3) {
    items.push({
      id: "month-end-concentration",
      tone: "sky",
      icon: <Calendar className="size-4" />,
      title: t("insights.monthend.title").replace(
        "{pct}",
        String(Math.round(intel.monthEndConcentration * 100)),
      ),
      body: t("insights.monthend.body"),
    });
  }

  // 6. Trajectory verdict — ALWAYS push one of the three so the section never
  //    feels empty. Stable is the new third branch.
  if (intel.spendingTrajectory === "deteriorating") {
    items.push({
      id: "trajectory-deteriorating",
      tone: "warn",
      icon: <TrendingUp className="size-4" />,
      title: t("insights.traj.bad.title"),
      body: t("insights.traj.bad.body").replace(
        "{pct}",
        (intel.totalSpendMoMChange * 100).toFixed(1),
      ),
    });
  } else if (intel.spendingTrajectory === "improving") {
    items.push({
      id: "trajectory-improving",
      tone: "mint",
      icon: <TrendingDown className="size-4" />,
      title: t("insights.traj.good.title"),
      body: t("insights.traj.good.body"),
    });
  } else {
    items.push({
      id: "trajectory-stable",
      tone: "sky",
      icon: <TrendingDown className="size-4" />,
      title: t("insights.traj.stable.title"),
      body: t("insights.traj.stable.body").replace(
        "{pct}",
        (intel.totalSpendMoMChange * 100).toFixed(1),
      ),
    });
  }

  return items.slice(0, 4);
}

// ─── Components ───────────────────────────────────────────────────────────────

function SmartInsightItem({ item }: { item: InsightItem }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0">
      <div
        className={cn(
          "size-8 rounded-xl grid place-items-center shrink-0 mt-0.5",
          TONE_ICON_CLASS[item.tone],
        )}
      >
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
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0"
        >
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

export function SmartInsightsFeed({ intelligence }: { intelligence: SpendingIntelligence }) {
  const { t } = useT();
  const items = buildInsights(intelligence, t);
  if (items.length === 0) return null;

  return (
    <div className="card-flat overflow-hidden">
      {items.map((item) => (
        <SmartInsightItem key={item.id} item={item} />
      ))}
    </div>
  );
}
