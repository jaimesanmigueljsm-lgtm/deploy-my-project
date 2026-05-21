/**
 * forecast.ts — Budget Forecasting Engine.
 *
 * Produces a current-month budget projection based on pace-spending, pending
 * fixed costs, and the 50/30/20 target allocation. Safe-to-spend is calculated
 * as the available variable budget divided by remaining days.
 */

import type { FinancialEngineContext, BudgetForecast } from "../types";
import { BUDGET_RATIOS, MIN_DAYS_FOR_CONFIDENT_FORECAST } from "../constants";
import { safeDivide, clamp, mean } from "../utils/math";
import {
  daysInMonth,
  dayOfMonth,
  daysRemainingInMonth,
  monthKey,
  groupIncomesByMonth,
  buildMonthBuckets,
} from "../utils/date";

export function computeBudgetForecast(ctx: FinancialEngineContext): BudgetForecast {
  const asOf = ctx.asOf;
  const currentMonthKey = monthKey(asOf);

  // ── Time context ──────────────────────────────────────────────────────────
  const totalDays = daysInMonth(asOf);
  const currentDay = dayOfMonth(asOf);
  const daysElapsed = currentDay;
  const daysRemaining = daysRemainingInMonth(asOf);

  // ── Current month spend ───────────────────────────────────────────────────
  const thisMonthExpenses = ctx.expenses.filter((e) => monthKey(e.spentAt) === currentMonthKey);
  const currentSpend = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const currentFixedSpend = thisMonthExpenses.filter((e) => e.kind === "fixed").reduce((s, e) => s + e.amount, 0);
  const currentVariableSpend = thisMonthExpenses.filter((e) => e.kind === "variable").reduce((s, e) => s + e.amount, 0);

  // ── Pending fixed costs (bills not yet paid this month) ───────────────────
  const pendingFixedCosts = ctx.bills
    .filter((b) => b.active && !b.paidThisMonth)
    .reduce((s, b) => s + b.amount, 0);

  // ── Expected monthly income ───────────────────────────────────────────────
  // Use this month's income if available, else fall back to 6-month average
  const thisMonthIncome = ctx.incomes
    .filter((i) => monthKey(i.receivedAt) === currentMonthKey)
    .reduce((s, i) => s + i.amount, 0);

  const buckets = buildMonthBuckets(asOf, 6);
  const incomeByMonth = groupIncomesByMonth(ctx.incomes);
  const historicIncomeTotals = buckets
    .slice(0, -1) // exclude current month
    .map((b) => incomeByMonth.get(b.key) ?? 0)
    .filter((v) => v > 0);

  const avgHistoricIncome = historicIncomeTotals.length > 0 ? mean(historicIncomeTotals) : 0;
  const expectedMonthlyIncome = thisMonthIncome > 0 ? thisMonthIncome : avgHistoricIncome;

  // ── Pace-based projection ─────────────────────────────────────────────────
  // Only extrapolate variable spending by pace — fixed costs (bills) don't scale
  // with time. Total fixed = what's already paid + what's still pending this month.
  const dailyPace = safeDivide(currentVariableSpend, daysElapsed, 0);
  const projectedMonthEnd = dailyPace * totalDays + currentFixedSpend;
  const projectedTotalWithFixed = projectedMonthEnd + pendingFixedCosts;
  const projectedSavings = expectedMonthlyIncome - projectedTotalWithFixed;
  const projectedOverrun = projectedTotalWithFixed > expectedMonthlyIncome;

  // ── Overrun probability ───────────────────────────────────────────────────
  // Simple sigmoid-based probability from how far projected exceeds income
  // 0 = well under budget, 0.5 = at breakeven, 1 = significantly over
  const overrunRatio = safeDivide(projectedTotalWithFixed, expectedMonthlyIncome, 1);
  const overrunProbability = expectedMonthlyIncome === 0
    ? 0.5
    : clamp(1 / (1 + Math.exp(-10 * (overrunRatio - 1))), 0, 1);

  // ── Safe-to-spend calculation ─────────────────────────────────────────────
  // Variable budget = 50/30/20 → "needs" (fixed) gets 50%, "wants" (variable) gets 30%
  // Remaining variable budget = income * 0.30 - currentVariableSpend - pending variable costs
  // We treat the 30% as the entire discretionary envelope.
  const variableBudgetTarget = expectedMonthlyIncome * BUDGET_RATIOS.wants;
  const variableBudgetRemaining = Math.max(0, variableBudgetTarget - currentVariableSpend);

  const safeToSpendPerDay = daysRemaining > 0
    ? safeDivide(variableBudgetRemaining, daysRemaining, 0)
    : 0;
  const safeToSpendToday = safeToSpendPerDay;

  // ── Improved closing balance (Task 6) ────────────────────────────────────
  // income − already spent − pending fixed bills (does not pace-project variable)
  const projectedClosingBalance = expectedMonthlyIncome - currentSpend - pendingFixedCosts;

  // ── Confidence based on elapsed days ─────────────────────────────────────
  const confidence = daysElapsed < MIN_DAYS_FOR_CONFIDENT_FORECAST
    ? clamp(daysElapsed / MIN_DAYS_FOR_CONFIDENT_FORECAST, 0, 1) * 0.5
    : clamp(daysElapsed / totalDays, 0, 1);

  return {
    daysElapsed,
    daysRemaining,
    daysInMonth: totalDays,
    currentDay,
    currentSpend,
    currentFixedSpend,
    currentVariableSpend,
    pendingFixedCosts,
    projectedMonthEnd,
    projectedTotalWithFixed,
    expectedMonthlyIncome,
    projectedSavings,
    projectedOverrun,
    overrunProbability,
    projectedClosingBalance,
    safeToSpendPerDay,
    safeToSpendToday,
    variableBudgetRemaining,
    dailyPace,
    confidence,
  };
}
