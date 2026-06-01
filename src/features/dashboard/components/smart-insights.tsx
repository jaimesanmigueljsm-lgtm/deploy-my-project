import { TrendingUp, TrendingDown, AlertTriangle, Moon, Calendar, Zap } from "lucide-react";
import type { SpendingIntelligence } from "@/core/finance";
import { Skeleton, InsightCard } from "@/components/nest";
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

// ─── Build insight items from engine output ───────────────────────────────────

function buildInsights(intel: SpendingIntelligence, t: (k: string) => string): InsightItem[] {
  const items: InsightItem[] = [];

  for (const anomaly of intel.spendingAnomalies.slice(0, 2)) {
    const tone: InsightTone = anomaly.severity === "high" ? "warn" : "sky";
    const multiple = (
      anomaly.historicalMean > 0 ? anomaly.currentMonthPaced / anomaly.historicalMean : 1
    ).toFixed(1);
    items.push({
      id: `anomaly-${anomaly.categoryName}`,
      tone,
      icon: <AlertTriangle className="size-4" />,
      title: t("insights.anomaly.title")
        .replace("{category}", anomaly.categoryName)
        .replace("{multiple}", multiple),
      body: t("insights.anomaly.body")
        .replace("{avg}", anomaly.historicalMean.toFixed(0))
        .replace("{z}", anomaly.zScore.toFixed(1)),
    });
  }

  if (intel.weekendSpendingRatio > 1.5) {
    items.push({
      id: "weekend-pattern",
      tone: "violet",
      icon: <Moon className="size-4" />,
      title: t("insights.weekend.title").replace("{ratio}", intel.weekendSpendingRatio.toFixed(1)),
      body: t("insights.weekend.body"),
    });
  }

  if (intel.monthEndConcentration > 0.4) {
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
  }

  if (intel.highGrowthCategories.length > 0) {
    const cats = intel.highGrowthCategories.slice(0, 2).join(", ");
    items.push({
      id: "high-growth-categories",
      tone: "sky",
      icon: <Zap className="size-4" />,
      title: t("insights.highgrowth.title").replace("{cats}", cats),
      body: t("insights.highgrowth.body"),
    });
  }

  return items.slice(0, 3);
}

// ─── Components ───────────────────────────────────────────────────────────────

export function SmartInsightsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-flat p-4 flex gap-3">
          <Skeleton className="size-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-2/3 rounded" />
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
    <div className="space-y-2">
      {items.map((item) => (
        <InsightCard
          key={item.id}
          tone={item.tone}
          icon={item.icon}
          title={item.title}
          body={item.body}
        />
      ))}
    </div>
  );
}
