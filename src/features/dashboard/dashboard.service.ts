import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SharedExpense } from "@/features/family/family.service";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DashboardProfile = Pick<
  Tables<"profiles">,
  "full_name" | "currency" | "monthly_savings_target" | "health_score" | "priorities"
>;

export type DashboardGoal = Pick<
  Tables<"savings_goals">,
  | "id"
  | "name"
  | "target_amount"
  | "current_amount"
  | "monthly_contribution"
  | "deadline"
  | "priority"
>;

export type DashboardRecommendation = Pick<
  Tables<"recommendations">,
  "id" | "title" | "body" | "severity" | "created_at"
>;

// ─── Fetch functions (called by useQueries in use-dashboard.ts) ───────────────

export async function fetchDashboardProfile(userId: string): Promise<DashboardProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, currency, monthly_savings_target, health_score, priorities")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DashboardProfile | null;
}

export async function fetchMonthIncomeTotal(
  userId: string,
  start: string,
  end: string,
): Promise<number> {
  // Both queries run in parallel — no waterfall when the month has no entries yet.
  const [monthRes, recurringRes] = await Promise.all([
    supabase
      .from("incomes")
      .select("amount")
      .eq("user_id", userId)
      .gte("received_at", start)
      .lte("received_at", end),
    supabase
      .from("incomes")
      .select("amount")
      .eq("user_id", userId)
      .eq("recurring", true),
  ]);

  if (monthRes.error) throw new Error(monthRes.error.message);
  if (recurringRes.error) throw new Error(recurringRes.error.message);

  const periodTotal = (monthRes.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  if (periodTotal > 0) return periodTotal;

  // No income recorded this month — fall back to recurring so the dashboard
  // always reflects the user's expected monthly income.
  return (recurringRes.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

export async function fetchDashboardGoals(userId: string): Promise<DashboardGoal[]> {
  const { data, error } = await supabase
    .from("savings_goals")
    .select("id, name, target_amount, current_amount, monthly_contribution, deadline, priority")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    target_amount: Number(r.target_amount),
    current_amount: Number(r.current_amount),
  })) as DashboardGoal[];
}

/**
 * Fetch user's shared expenses for current month (for dashboard calculation).
 * Returns expenses from all families the user belongs to, filtered by date range.
 */
export async function fetchDashboardSharedExpenses(
  userId: string,
  startDate: string,
  endDate: string
): Promise<SharedExpense[]> {
  // 1. Get user's families
  const { data: memberships } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId);

  if (!memberships || memberships.length === 0) return [];

  const familyIds = memberships.map(m => m.family_id);

  // 2. Get shared expenses for those families in date range
  const { data, error } = await supabase
    .from('shared_expenses')
    .select(`
      *,
      shared_expense_participants(user_id)
    `)
    .in('family_id', familyIds)
    .gte('spent_at', startDate)
    .lte('spent_at', endDate)
    .order('spent_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SharedExpense[];
}

export async function fetchRecommendations(userId: string): Promise<DashboardRecommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("id, title, body, severity, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardRecommendation[];
}

// ─── AI insights ──────────────────────────────────────────────────────────────

export async function generateInsights(): Promise<void> {
  const { error } = await supabase.functions.invoke("generate-insights");
  if (error) throw new Error(error.message);
}
