/**
 * date.ts — Calendar utilities for the financial engine.
 *
 * All functions treat dates as calendar-local (not UTC) to match the user's
 * perception of "this month" and "today". The `asOf` date is the engine's
 * reference point and should always be passed in rather than calling new Date()
 * inside these functions — this keeps the engine deterministic in tests.
 */

import type { MonthlyBucket, EngineExpense, EngineIncome } from "../types";

/** Number of calendar days in the month containing `date`. */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** 1-based day of month for `date`. */
export function dayOfMonth(date: Date): number {
  return date.getDate();
}

/** Calendar days remaining in the month of `date` (excluding today). */
export function daysRemainingInMonth(date: Date): number {
  return daysInMonth(date) - dayOfMonth(date);
}

/** Stable "YYYY-MM" string key for a date. */
export function monthKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${m}`;
}

/** Human-readable "Jan 2026" label. */
export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** True if the date falls on a Saturday or Sunday. */
export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Midnight of the first day of the month containing `date`. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Midnight of the last day of the month containing `date`. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Returns the Date that is `months` calendar months before `asOf`.
 * Day is clamped to the last day of the target month (e.g., Jan 31 → Feb 28).
 */
export function monthsAgo(asOf: Date, months: number): Date {
  const d = new Date(asOf.getFullYear(), asOf.getMonth() - months, 1);
  return d;
}

/**
 * Build an ordered list of monthly bucket keys for the last `count` months,
 * ending with the month that contains `asOf`.
 * Returns newest-last so indices map naturally to chart X-axes.
 */
export function buildMonthBuckets(asOf: Date, count: number): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: monthLabel(d),
      year: d.getFullYear(),
      month: d.getMonth(),
      total: 0,
      count: 0,
    });
  }
  return buckets;
}

/** Group expenses into monthly buckets keyed by "YYYY-MM". Returns a Map. */
export function groupExpensesByMonth(expenses: EngineExpense[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const k = monthKey(e.spentAt);
    map.set(k, (map.get(k) ?? 0) + e.amount);
  }
  return map;
}

/** Group incomes into monthly totals keyed by "YYYY-MM". */
export function groupIncomesByMonth(incomes: EngineIncome[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const inc of incomes) {
    const k = monthKey(inc.receivedAt);
    map.set(k, (map.get(k) ?? 0) + inc.amount);
  }
  return map;
}

/**
 * Filter expenses to a rolling window: items whose spentAt date is within
 * `days` calendar days before `asOf` (inclusive of `asOf`).
 */
export function expensesWithinDays(
  expenses: EngineExpense[],
  asOf: Date,
  days: number,
): EngineExpense[] {
  const cutoff = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000);
  return expenses.filter((e) => e.spentAt >= cutoff && e.spentAt <= asOf);
}

/**
 * Expenses in the current calendar month (year+month of `asOf`).
 */
export function expensesThisMonth(expenses: EngineExpense[], asOf: Date): EngineExpense[] {
  const key = monthKey(asOf);
  return expenses.filter((e) => monthKey(e.spentAt) === key);
}
