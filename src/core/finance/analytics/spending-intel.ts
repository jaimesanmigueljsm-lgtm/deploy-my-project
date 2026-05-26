/**
 * spending-intel.ts — Spending Intelligence Engine.
 *
 * Analyses expense patterns to surface category trends, anomalies, behavioural
 * patterns (weekend spending, month-end concentration), and the overall
 * month-over-month trajectory.
 */

import type {
  FinancialEngineContext,
  SpendingIntelligence,
  CategoryTrend,
  SpendingAnomaly,
  TrendDirection,
} from "../types";
import { ANOMALY_Z_THRESHOLDS } from "../constants";
import { safeDivide, mean, stdDev, zScore } from "../utils/math";
import { monthKey, buildMonthBuckets, expensesWithinDays, isWeekend } from "../utils/date";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trendDirection(changeRatio: number): TrendDirection {
  if (changeRatio > 0.05) return "increasing";
  if (changeRatio < -0.05) return "decreasing";
  return "stable";
}

/** Group expenses by categoryName → map of monthKey → total */
function groupByCategoryMonth(ctx: FinancialEngineContext): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const e of ctx.expenses) {
    const catName = e.categoryName;
    const mk = monthKey(e.spentAt);
    if (!result.has(catName)) result.set(catName, new Map());
    const inner = result.get(catName)!;
    inner.set(mk, (inner.get(mk) ?? 0) + e.amount);
  }

  return result;
}

// ─── Category trends (30-day rolling) ────────────────────────────────────────

function computeCategoryTrends(ctx: FinancialEngineContext): CategoryTrend[] {
  const recentExpenses = expensesWithinDays(ctx.expenses, ctx.asOf, 30);
  const priorExpenses = ctx.expenses.filter((e) => {
    const msSince = ctx.asOf.getTime() - e.spentAt.getTime();
    const daysSince = msSince / (1000 * 60 * 60 * 24);
    return daysSince > 30 && daysSince <= 60;
  });

  // Collect all unique categories from both windows
  const allCategories = new Map<string, { id: string | null; name: string }>();
  for (const e of [...recentExpenses, ...priorExpenses]) {
    if (!allCategories.has(e.categoryName)) {
      allCategories.set(e.categoryName, { id: e.categoryId, name: e.categoryName });
    }
  }

  const trends: CategoryTrend[] = [];

  for (const [catName, catMeta] of allCategories) {
    const recentTotal = recentExpenses
      .filter((e) => e.categoryName === catName)
      .reduce((s, e) => s + e.amount, 0);
    const priorTotal = priorExpenses
      .filter((e) => e.categoryName === catName)
      .reduce((s, e) => s + e.amount, 0);

    // Annualise: skip categories with negligible spend in both windows
    if (recentTotal === 0 && priorTotal === 0) continue;

    const changeRatio =
      priorTotal === 0
        ? recentTotal > 0
          ? 1
          : 0
        : safeDivide(recentTotal - priorTotal, priorTotal, 0);

    trends.push({
      categoryId: catMeta.id,
      categoryName: catMeta.name,
      recentTotal,
      priorTotal,
      changeRatio,
      direction: trendDirection(changeRatio),
    });
  }

  return trends;
}

// ─── Anomaly detection ────────────────────────────────────────────────────────

function computeAnomalies(
  ctx: FinancialEngineContext,
  byCategory: Map<string, Map<string, number>>,
): SpendingAnomaly[] {
  const buckets = buildMonthBuckets(ctx.asOf, 6);
  const currentKey = monthKey(ctx.asOf);
  // Prior months only for baseline
  const priorBuckets = buckets.filter((b) => b.key !== currentKey);

  const anomalies: SpendingAnomaly[] = [];

  for (const [catName, monthMap] of byCategory) {
    const historicalTotals = priorBuckets.map((b) => monthMap.get(b.key) ?? 0);
    const historicMeanVal = mean(historicalTotals);
    const historicStdVal = stdDev(historicalTotals);

    // Pace current month to full month
    const currentTotal = monthMap.get(currentKey) ?? 0;
    const daysElapsed = Math.max(ctx.asOf.getDate(), 1);
    const daysTotal = new Date(ctx.asOf.getFullYear(), ctx.asOf.getMonth() + 1, 0).getDate();
    const currentMonthPaced = (currentTotal / daysElapsed) * daysTotal;

    if (historicMeanVal === 0) continue; // no baseline

    const z = zScore(currentMonthPaced, historicMeanVal, historicStdVal);

    if (z < ANOMALY_Z_THRESHOLDS.low) continue;

    const severity =
      z >= ANOMALY_Z_THRESHOLDS.high ? "high" : z >= ANOMALY_Z_THRESHOLDS.medium ? "medium" : "low";

    const multiple = safeDivide(currentMonthPaced, historicMeanVal, 1);
    const description = `${catName} is tracking ${multiple.toFixed(1)}× your usual monthly spend`;

    anomalies.push({
      categoryName: catName,
      currentMonthPaced,
      historicalMean: historicMeanVal,
      historicalStdDev: historicStdVal,
      zScore: z,
      severity,
      description,
    });
  }

  // Sort by severity then z-score
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return anomalies.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.zScore - a.zScore,
  );
}

// ─── Behavioural patterns ─────────────────────────────────────────────────────

function computeWeekendRatio(ctx: FinancialEngineContext): number {
  const recent = expensesWithinDays(ctx.expenses, ctx.asOf, 60);
  const weekdayAmounts = recent.filter((e) => !isWeekend(e.spentAt));
  const weekendAmounts = recent.filter((e) => isWeekend(e.spentAt));

  // Count unique weekdays/weekend days in the window to normalise
  const uniqueDays = new Map<string, boolean>();
  for (const e of recent) {
    const key = e.spentAt.toISOString().slice(0, 10);
    uniqueDays.set(key, isWeekend(e.spentAt));
  }

  let weekdayDays = 0;
  let weekendDays = 0;
  for (const isWe of uniqueDays.values()) {
    if (isWe) weekendDays++;
    else weekdayDays++;
  }

  const avgWeekdaySpend = safeDivide(
    weekdayAmounts.reduce((s, e) => s + e.amount, 0),
    weekdayDays || 1,
    0,
  );
  const avgWeekendSpend = safeDivide(
    weekendAmounts.reduce((s, e) => s + e.amount, 0),
    weekendDays || 1,
    0,
  );

  return safeDivide(avgWeekendSpend, avgWeekdaySpend, 1);
}

function computeMonthEndConcentration(ctx: FinancialEngineContext): number {
  const currentKey = monthKey(ctx.asOf);
  const thisMonthExpenses = ctx.expenses.filter((e) => monthKey(e.spentAt) === currentKey);
  const totalThisMonth = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  if (totalThisMonth === 0) return 0;

  // "Month-end" = last 7 calendar days of the month
  const daysTotal = new Date(ctx.asOf.getFullYear(), ctx.asOf.getMonth() + 1, 0).getDate();
  const last7 = thisMonthExpenses.filter((e) => e.spentAt.getDate() >= daysTotal - 6);
  const last7Total = last7.reduce((s, e) => s + e.amount, 0);

  return safeDivide(last7Total, totalThisMonth, 0);
}

// ─── MoM trajectory ───────────────────────────────────────────────────────────

function computeSpendingTrajectory(ctx: FinancialEngineContext): {
  trajectory: SpendingIntelligence["spendingTrajectory"];
  totalMoMChange: number;
} {
  const buckets = buildMonthBuckets(ctx.asOf, 4);
  const byMonth = new Map<string, number>();
  for (const e of ctx.expenses)
    byMonth.set(monthKey(e.spentAt), (byMonth.get(monthKey(e.spentAt)) ?? 0) + e.amount);

  const totals = buckets.map((b) => byMonth.get(b.key) ?? 0);
  const [m3, m2, m1, m0] = totals; // oldest → newest (current may be partial)

  // Compare last complete month to 3-month average
  const threeMonthAvg = (m3 + m2 + m1) / 3;
  const totalMoMChange = safeDivide(m1 - m2, m2 || 1, 0);

  const trajectory: SpendingIntelligence["spendingTrajectory"] =
    m1 < threeMonthAvg * 0.95
      ? "improving"
      : m1 > threeMonthAvg * 1.05
        ? "deteriorating"
        : "stable";

  void m0; // current partial month — not used for trajectory

  return { trajectory, totalMoMChange };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeSpendingIntelligence(ctx: FinancialEngineContext): SpendingIntelligence {
  const categoryTrends = computeCategoryTrends(ctx);
  const byCategory = groupByCategoryMonth(ctx);
  const spendingAnomalies = computeAnomalies(ctx, byCategory);
  const weekendSpendingRatio = computeWeekendRatio(ctx);
  const monthEndConcentration = computeMonthEndConcentration(ctx);
  const { trajectory, totalMoMChange } = computeSpendingTrajectory(ctx);

  const topGrowingCategories = [...categoryTrends]
    .filter((t) => t.direction === "increasing" && t.priorTotal > 0)
    .sort((a, b) => b.changeRatio - a.changeRatio)
    .slice(0, 3);

  const topShrinkingCategories = [...categoryTrends]
    .filter((t) => t.direction === "decreasing" && t.priorTotal > 0)
    .sort((a, b) => a.changeRatio - b.changeRatio)
    .slice(0, 3);

  const highGrowthCategories = categoryTrends
    .filter((t) => t.changeRatio > 0.2)
    .map((t) => t.categoryName);

  return {
    categoryTrends,
    topGrowingCategories,
    topShrinkingCategories,
    spendingAnomalies,
    weekendSpendingRatio,
    monthEndConcentration,
    spendingTrajectory: trajectory,
    totalSpendMoMChange: totalMoMChange,
    highGrowthCategories,
  };
}
