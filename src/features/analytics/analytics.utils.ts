import { shortMonth } from "@/lib/format";
import type { AnalyticsExpense, MonthlySeries, WeekdaySeries } from "@/types/finance";

export type IncomeExpensePoint = {
  label: string;
  income: number;
  expenses: number;
  net: number;
};

/**
 * Aggregates expenses into a 6-month bar chart series.
 * Pure function — no side effects, fully unit-testable.
 */
export function buildMonthlySeries(expenses: AnalyticsExpense[]): MonthlySeries[] {
  const map = new Map<string, number>();

  for (const e of expenses) {
    const d = new Date(e.spent_at);
    // zero-padded month key e.g. "2025-04"
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }

  const now = new Date();
  const out: MonthlySeries[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    out.push({ label: shortMonth(d), value: Math.round(map.get(key) ?? 0) });
  }
  return out;
}

/**
 * Aggregates expenses by weekday (average daily spend per day-of-week).
 * Pure function — no side effects, fully unit-testable.
 */
export function buildWeekdaySeries(expenses: AnalyticsExpense[]): WeekdaySeries[] {
  const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const sum = new Array(7).fill(0) as number[];
  const cnt = new Array(7).fill(0) as number[];

  for (const e of expenses) {
    const day = new Date(e.spent_at).getDay();
    sum[day] += e.amount;
    cnt[day] += 1;
  }

  return LABELS.map((name, i) => ({
    name,
    value: cnt[i] ? Math.round(sum[i] / cnt[i]) : 0,
  }));
}

/**
 * Builds a monthly income vs expenses series for the given window of months.
 */
export function buildIncomeExpenseSeries(
  expenses: { amount: number; spent_at: string }[],
  incomes: { amount: number; received_at: string }[],
  months = 6,
): IncomeExpensePoint[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const inc = incomes
      .filter((x) => { const r = new Date(x.received_at); return r.getFullYear() === yr && r.getMonth() === mo; })
      .reduce((s, x) => s + x.amount, 0);
    const exp = expenses
      .filter((x) => { const r = new Date(x.spent_at); return r.getFullYear() === yr && r.getMonth() === mo; })
      .reduce((s, x) => s + x.amount, 0);
    return { label: shortMonth(d), income: Math.round(inc), expenses: Math.round(exp), net: Math.round(inc - exp) };
  });
}

/**
 * Returns the top N spending categories for the given date range.
 */
export function buildTopCategories(
  expenses: AnalyticsExpense[],
  categories: { id: string; name: string }[],
  start: string,
  end: string,
  limit = 5,
): { name: string; total: number }[] {
  const map = new Map<string, number>();

  for (const e of expenses.filter((x) => x.spent_at >= start && x.spent_at <= end)) {
    const cat = categories.find((c) => c.id === e.category_id);
    const key = cat?.name ?? "Other";
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, total]) => ({ name, total }));
}
