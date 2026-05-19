/**
 * Canonical domain types for the NEST fintech app.
 *
 * All types are derived from the Supabase DB schema via Pick<Tables<"table">, ...>
 * so they can never drift from the actual database columns.
 *
 * Import from here — never re-define types locally in route or component files.
 */
import type { Tables } from "@/integrations/supabase/types";

// ─── Profile ──────────────────────────────────────────────────────────────────

export type Profile = Tables<"profiles">;

export type NotificationPrefs = {
  alerts?: boolean;
  weekly?: boolean;
  insights?: boolean;
};

// ─── Expenses ────────────────────────────────────────────────────────────────

export type Expense = Tables<"expenses">;

/** Minimal shape used by the dashboard and analytics views. */
export type ExpenseSummary = Pick<
  Expense,
  "id" | "amount" | "description" | "spent_at" | "kind" | "category_id" | "recurring"
>;

/** Shape used by the analytics 6-month window. */
export type AnalyticsExpense = Pick<
  Expense,
  "amount" | "spent_at" | "category_id" | "kind"
>;

// ─── Categories ──────────────────────────────────────────────────────────────

export type Category = Tables<"categories">;
export type CategorySummary = Pick<Category, "id" | "name" | "color" | "kind">;

// ─── Bills ───────────────────────────────────────────────────────────────────

export type Bill = Tables<"bills">;
export type BillSummary = Pick<
  Bill,
  "id" | "name" | "amount" | "due_day" | "paid_this_month"
>;

// ─── Incomes ─────────────────────────────────────────────────────────────────

export type Income = Tables<"incomes">;
export type IncomeSummary = Pick<
  Income,
  "id" | "source" | "amount" | "recurring" | "received_at"
>;

// ─── Goals ───────────────────────────────────────────────────────────────────

export type Goal = Tables<"savings_goals">;
export type GoalContribution = Tables<"goal_contributions">;

// ─── Investments ─────────────────────────────────────────────────────────────

export type Investment = Tables<"investments">;
export type InvestmentType = "stock" | "etf" | "crypto" | "savings" | "other";

// ─── Recommendations ─────────────────────────────────────────────────────────

export type Recommendation = Tables<"recommendations">;
export type RecommendationSeverity = "info" | "warning" | "success";

// ─── Analytics ───────────────────────────────────────────────────────────────

export type MonthlySeries = { label: string; value: number };
export type WeekdaySeries  = { name: string; value: number };
export type CategoryStat   = { name: string; total: number };
