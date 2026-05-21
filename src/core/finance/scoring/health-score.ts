/**
 * health-score.ts — Composite Financial Health Score (0–1000).
 *
 * Philosophy: measures financial STABILITY and PEACE OF MIND.
 * Users are NEVER penalised for not investing or not diversifying.
 *
 * 6 factors (weights sum to 1.0):
 *   savingsConsistency    0.25 — building a monthly surplus
 *   emergencyReadiness    0.25 — safety net in months of essential expenses
 *   fixedExpensePressure  0.20 — fixed costs as % of income
 *   spendingStability     0.15 — spending predictability (CV)
 *   goalConsistency       0.10 — progress and contributions toward goals
 *   incomeReliability     0.05 — income predictability (CV)
 *
 * The composite sub-score is 0–100 internally; the final total is ×10 → 0–1000.
 */

import type { FinancialEngineContext, HealthScore, SubScore, RiskIndicator } from "../types";
import {
  HEALTH_SCORE_WEIGHTS,
  SAVINGS_RATE_THRESHOLDS,
  EMERGENCY_FUND_THRESHOLDS,
  FIXED_EXPENSE_PRESSURE_THRESHOLDS,
  EXPENSE_STABILITY_THRESHOLDS,
  INCOME_CONSISTENCY_THRESHOLDS,
  HEALTH_STATUS_BANDS,
  ESSENTIAL_CATEGORY_KEYWORDS,
} from "../constants";
import {
  safeDivide,
  clamp,
  mean,
  cv,
  weightedSum,
  lookupThreshold,
} from "../utils/math";
import {
  groupExpensesByMonth,
  groupIncomesByMonth,
  buildMonthBuckets,
  monthKey,
} from "../utils/date";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSubScore(
  value: number,
  weight: number,
  label: string,
  rawValue: number,
  rawUnit: string,
): SubScore {
  return { value: clamp(Math.round(value), 0, 100), weight, label, rawValue, rawUnit };
}

function monthlyTotals(
  monthMap: Map<string, number>,
  buckets: ReturnType<typeof buildMonthBuckets>,
): number[] {
  return buckets.map((b) => monthMap.get(b.key) ?? 0);
}

/**
 * Compute essential monthly expenses:
 *   1. All active bills (rent, utilities, phone, subscriptions — always essential)
 *   2. Recent expenses whose category matches essential keywords
 *   3. Floor at 50% of avg total expenses so the metric never collapses to zero
 *
 * This is used to measure emergency readiness against real survival costs,
 * not inflated total spending that includes leisure or discretionary items.
 */
function computeEssentialExpenses(
  ctx: FinancialEngineContext,
  avgMonthlyExpenses: number,
): number {
  const monthlyBills = ctx.bills
    .filter((b) => b.active)
    .reduce((s, b) => s + b.amount, 0);

  const thirtyDaysAgo = new Date(ctx.asOf.getTime() - 30 * 24 * 60_000 * 60);
  const essentialKeywordsLower = ESSENTIAL_CATEGORY_KEYWORDS.map((k) => k.toLowerCase());

  const recentEssential = ctx.expenses
    .filter(
      (e) =>
        e.spentAt >= thirtyDaysAgo &&
        essentialKeywordsLower.some((kw) => e.categoryName.toLowerCase().includes(kw)),
    )
    .reduce((s, e) => s + e.amount, 0);

  // Floor: never go below half of avg spending (keeps metric meaningful without data)
  const floor = avgMonthlyExpenses * 0.50;
  return Math.max(monthlyBills + recentEssential, floor);
}

// ─── Sub-score calculators ────────────────────────────────────────────────────

function scoreSavingsConsistency(avgIncome: number, avgExpenses: number): SubScore {
  const rate = safeDivide(avgIncome - avgExpenses, avgIncome, -1);
  const entry = lookupThreshold(SAVINGS_RATE_THRESHOLDS, "maxRate", rate);
  return makeSubScore(
    entry.score,
    HEALTH_SCORE_WEIGHTS.savingsConsistency,
    entry.label,
    rate,
    "%",
  );
}

function scoreEmergencyReadiness(
  ctx: FinancialEngineContext,
  essentialMonthlyExpenses: number,
): SubScore {
  // Primary: savings accounts explicitly flagged as emergency fund
  const emergencyAccountBalance = ctx.savingsAccounts
    .filter((a) => a.isEmergencyFund)
    .reduce((s, a) => s + a.balance, 0);

  // Secondary: emergency-tagged savings goals
  const emergencyGoals = ctx.goals.filter(
    (g) =>
      g.name.toLowerCase().includes("emergency") ||
      g.category.toLowerCase().includes("emergency"),
  );
  const goalBalance = emergencyGoals.reduce((s, g) => s + g.currentAmount, 0);

  // Tertiary: savings-type investments (legacy fallback)
  const savingsInvestments = ctx.investments
    .filter((i) => i.type === "savings")
    .reduce((s, i) => s + i.quantity * i.currentPrice, 0);

  const totalReserves = emergencyAccountBalance + goalBalance + savingsInvestments;
  const months = safeDivide(totalReserves, essentialMonthlyExpenses, 0);

  const entry = lookupThreshold(EMERGENCY_FUND_THRESHOLDS, "maxMonths", months);
  return makeSubScore(
    entry.score,
    HEALTH_SCORE_WEIGHTS.emergencyReadiness,
    entry.label,
    months,
    "months",
  );
}

function scoreFixedExpensePressure(
  ctx: FinancialEngineContext,
  avgMonthlyIncome: number,
  buckets: ReturnType<typeof buildMonthBuckets>,
): SubScore {
  // Average of monthly fixed-kind expense totals across the window.
  // Uses the same data source as Budget > Fixed tab (expenses with kind="fixed").
  const fixedByMonth = new Map<string, number>();
  for (const e of ctx.expenses) {
    if (e.kind !== "fixed") continue;
    const k = monthKey(e.spentAt);
    fixedByMonth.set(k, (fixedByMonth.get(k) ?? 0) + e.amount);
  }
  const nonZeroMonths = buckets.map((b) => fixedByMonth.get(b.key) ?? 0).filter((v) => v > 0);
  const avgMonthlyFixed = nonZeroMonths.length > 0 ? mean(nonZeroMonths) : 0;

  const ratio = safeDivide(avgMonthlyFixed, avgMonthlyIncome, 1);

  const entry = lookupThreshold(FIXED_EXPENSE_PRESSURE_THRESHOLDS, "maxRatio", ratio);
  return makeSubScore(
    entry.score,
    HEALTH_SCORE_WEIGHTS.fixedExpensePressure,
    entry.label,
    ratio,
    "ratio",
  );
}

function scoreSpendingStability(
  expensesByMonth: Map<string, number>,
  buckets: ReturnType<typeof buildMonthBuckets>,
): SubScore {
  const totals = monthlyTotals(expensesByMonth, buckets);
  const nonZero = totals.filter((v) => v > 0);
  const cvValue = nonZero.length >= 2 ? cv(nonZero) : 0;

  const entry = lookupThreshold(EXPENSE_STABILITY_THRESHOLDS, "maxCV", cvValue);
  return makeSubScore(
    entry.score,
    HEALTH_SCORE_WEIGHTS.spendingStability,
    entry.label,
    cvValue,
    "index",
  );
}

function scoreGoalConsistency(
  ctx: FinancialEngineContext,
  avgMonthlyIncome: number,
): SubScore {
  if (ctx.goals.length === 0) {
    return makeSubScore(50, HEALTH_SCORE_WEIGHTS.goalConsistency, "No goals set", 0, "%");
  }

  const priorityWeight = { high: 3, medium: 2, low: 1 } as const;
  let weightedCompletion = 0;
  let totalWeight = 0;

  for (const g of ctx.goals) {
    const w = priorityWeight[g.priority];
    const completion = clamp(safeDivide(g.currentAmount, g.targetAmount, 0), 0, 1);
    weightedCompletion += completion * w;
    totalWeight += w;
  }

  const avgCompletion = safeDivide(weightedCompletion, totalWeight, 0);

  const totalMonthlyContrib = ctx.goals.reduce((s, g) => s + g.monthlyContribution, 0);
  const contribRate = safeDivide(totalMonthlyContrib, avgMonthlyIncome, 0);
  const contribBonus = clamp(contribRate * 20, 0, 20);

  const rawScore = clamp(avgCompletion * 80 + contribBonus, 0, 100);
  const label =
    avgCompletion >= 0.75
      ? "On track"
      : avgCompletion >= 0.40
        ? "In progress"
        : avgCompletion >= 0.10
          ? "Early stage"
          : "Not started";

  return makeSubScore(rawScore, HEALTH_SCORE_WEIGHTS.goalConsistency, label, avgCompletion, "%");
}

function scoreIncomeReliability(
  incomesByMonth: Map<string, number>,
  buckets: ReturnType<typeof buildMonthBuckets>,
): SubScore {
  const totals = monthlyTotals(incomesByMonth, buckets);
  const nonZero = totals.filter((v) => v > 0);
  const cvValue = nonZero.length >= 2 ? cv(nonZero) : 0;

  const entry = lookupThreshold(INCOME_CONSISTENCY_THRESHOLDS, "maxCV", cvValue);
  return makeSubScore(
    entry.score,
    HEALTH_SCORE_WEIGHTS.incomeReliability,
    entry.label,
    cvValue,
    "index",
  );
}

// ─── Risk indicators ──────────────────────────────────────────────────────────

function buildRiskIndicators(
  ctx: FinancialEngineContext,
  avgMonthlyIncome: number,
  essentialMonthlyExpenses: number,
  avgMonthlyExpenses: number,
  fixedRatio: number,
): RiskIndicator[] {
  const risks: RiskIndicator[] = [];

  const savingsRate = safeDivide(
    avgMonthlyIncome - avgMonthlyExpenses,
    avgMonthlyIncome,
    -1,
  );

  if (savingsRate < 0) {
    risks.push({
      code: "SAVINGS_NEGATIVE",
      severity: "critical",
      description: `Your expenses exceed your income by ${Math.round(Math.abs(avgMonthlyExpenses - avgMonthlyIncome))} per month.`,
    });
  } else if (savingsRate < 0.10) {
    risks.push({
      code: "SAVINGS_LOW",
      severity: "warning",
      description: `You're saving ${Math.round(savingsRate * 100)}% of your income — building this up will give you more resilience.`,
    });
  }

  // Emergency readiness — mirrors scoreEmergencyReadiness sources
  const emergencyAccountBalance = ctx.savingsAccounts
    .filter((a) => a.isEmergencyFund)
    .reduce((s, a) => s + a.balance, 0);
  const emergencyGoals = ctx.goals.filter(
    (g) =>
      g.name.toLowerCase().includes("emergency") ||
      g.category.toLowerCase().includes("emergency"),
  );
  const emergencyBalance =
    emergencyAccountBalance +
    emergencyGoals.reduce((s, g) => s + g.currentAmount, 0) +
    ctx.investments
      .filter((i) => i.type === "savings")
      .reduce((s, i) => s + i.quantity * i.currentPrice, 0);

  const emergencyMonths = safeDivide(emergencyBalance, essentialMonthlyExpenses, 0);
  if (emergencyMonths < 1) {
    risks.push({
      code: "EMERGENCY_FUND_CRITICAL",
      severity: "critical",
      description: "Your safety net covers less than 1 month of essential costs — a single unexpected event could destabilise your finances.",
    });
  } else if (emergencyMonths < 3) {
    risks.push({
      code: "EMERGENCY_FUND_LOW",
      severity: "warning",
      description: `Your safety net covers ${emergencyMonths.toFixed(1)} months of essential costs — aim for 3–6 months.`,
    });
  }

  // Fixed expense pressure (ratio passed in from scoreFixedExpensePressure — single source of truth)
  if (fixedRatio > 0.70) {
    risks.push({
      code: "FIXED_PRESSURE_CRITICAL",
      severity: "critical",
      description: `Fixed costs consume ${Math.round(fixedRatio * 100)}% of your income — very little room for savings or unexpected expenses.`,
    });
  } else if (fixedRatio > 0.55) {
    risks.push({
      code: "FIXED_PRESSURE_HIGH",
      severity: "warning",
      description: `Fixed costs are ${Math.round(fixedRatio * 100)}% of your income — reducing this would free up meaningful breathing room.`,
    });
  }

  return risks;
}

// ─── Explanation key selection ────────────────────────────────────────────────

function pickExplanationKey(
  savingsRate: number,
  emergencyMonths: number,
  fixedRatio: number,
  total: number,
): string {
  if (savingsRate < 0)          return "health.explain.overspending";
  if (emergencyMonths < 1)      return "health.explain.noEmergencyFund";
  if (fixedRatio > 0.70)        return "health.explain.fixedCritical";
  if (savingsRate < 0.10)       return "health.explain.savingsLow";
  if (emergencyMonths < 3)      return "health.explain.emergencyLow";
  if (fixedRatio > 0.55)        return "health.explain.fixedHigh";
  if (total >= 850)             return "health.explain.excellent";
  if (total >= 700)             return "health.explain.strong";
  return "health.explain.healthy";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeHealthScore(ctx: FinancialEngineContext): HealthScore {
  const buckets = buildMonthBuckets(ctx.asOf, 6);
  const expensesByMonth = groupExpensesByMonth(ctx.expenses);
  const incomesByMonth  = groupIncomesByMonth(ctx.incomes);

  const expenseTotals = buckets.map((b) => expensesByMonth.get(b.key) ?? 0);
  const incomeTotals  = buckets.map((b) => incomesByMonth.get(b.key) ?? 0);

  const nonZeroExpenses = expenseTotals.filter((v) => v > 0);
  const nonZeroIncomes  = incomeTotals.filter((v) => v > 0);

  const avgMonthlyExpenses = nonZeroExpenses.length > 0 ? mean(nonZeroExpenses) : 0;
  const avgMonthlyIncome   = nonZeroIncomes.length > 0  ? mean(nonZeroIncomes)  : 0;

  const essentialMonthlyExpenses = computeEssentialExpenses(ctx, avgMonthlyExpenses);

  const savingsConsistency   = scoreSavingsConsistency(avgMonthlyIncome, avgMonthlyExpenses);
  const emergencyReadiness   = scoreEmergencyReadiness(ctx, essentialMonthlyExpenses);
  const fixedExpensePressure = scoreFixedExpensePressure(ctx, avgMonthlyIncome, buckets);
  const spendingStability    = scoreSpendingStability(expensesByMonth, buckets);
  const goalConsistency      = scoreGoalConsistency(ctx, avgMonthlyIncome);
  const incomeReliability    = scoreIncomeReliability(incomesByMonth, buckets);

  // Composite 0–100, then scaled ×10 → 0–1000
  const rawComposite = weightedSum([
    { score: savingsConsistency.value,   weight: savingsConsistency.weight },
    { score: emergencyReadiness.value,   weight: emergencyReadiness.weight },
    { score: fixedExpensePressure.value, weight: fixedExpensePressure.weight },
    { score: spendingStability.value,    weight: spendingStability.weight },
    { score: goalConsistency.value,      weight: goalConsistency.weight },
    { score: incomeReliability.value,    weight: incomeReliability.weight },
  ]);

  const total = clamp(Math.round(rawComposite * 10), 0, 1000);

  const statusBand =
    HEALTH_STATUS_BANDS.find((b) => total >= b.minScore) ??
    HEALTH_STATUS_BANDS[HEALTH_STATUS_BANDS.length - 1];

  const savingsRate = safeDivide(avgMonthlyIncome - avgMonthlyExpenses, avgMonthlyIncome, -1);
  const fixedRatio  = fixedExpensePressure.rawValue;
  const emergencyMonths = emergencyReadiness.rawValue;

  const risks = buildRiskIndicators(
    ctx,
    avgMonthlyIncome,
    essentialMonthlyExpenses,
    avgMonthlyExpenses,
    fixedRatio,
  );

  const explanationKey = pickExplanationKey(savingsRate, emergencyMonths, fixedRatio, total);

  return {
    total,
    status: statusBand.status,
    explanationKey,
    subScores: {
      savingsConsistency,
      emergencyReadiness,
      fixedExpensePressure,
      spendingStability,
      goalConsistency,
      incomeReliability,
    },
    risks,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    essentialMonthlyExpenses,
    asOf: ctx.asOf,
  };
}
