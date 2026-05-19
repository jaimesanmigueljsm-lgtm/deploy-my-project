import { supabase } from "@/integrations/supabase/client";
import type { AnalyticsExpense, CategorySummary } from "@/types/finance";

/**
 * Returns all expenses from the last 6 months (inclusive of the current month).
 * The window start is computed from the caller and included in the query key
 * so the cache refreshes automatically each month.
 */
export async function fetchSixMonthExpenses(
  userId: string,
  windowStart: string,
): Promise<AnalyticsExpense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount, spent_at, category_id, kind")
    .eq("user_id", userId)
    .gte("spent_at", windowStart);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as AnalyticsExpense[];
}

export async function fetchAnalyticsCategories(userId: string): Promise<CategorySummary[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, kind")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []) as CategorySummary[];
}

export async function fetchSixMonthIncomes(
  userId: string,
  windowStart: string,
): Promise<{ amount: number; received_at: string; source: string }[]> {
  const { data, error } = await supabase
    .from("incomes")
    .select("amount, received_at, source")
    .eq("user_id", userId)
    .gte("received_at", windowStart);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Returns the ISO date string for the first day of the month 5 months ago. */
export function sixMonthWindowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
