/**
 * adapters.ts — Bridge from Supabase row types to FinancialEngineContext.
 *
 * Uses structural interfaces instead of importing from @/types/finance so that
 * both the full Tables<"..."> type and any Pick<Tables<"...">, ...> subset
 * (as returned by feature services) are assignable without casts.
 *
 * The engine itself stays framework-free; only this file bridges the gap.
 *
 * All numeric fields are cast with Number() because Supabase returns NUMERIC
 * columns as strings when using the JS client.
 */

import type {
  EngineProfile,
  EngineExpense,
  EngineIncome,
  EngineBill,
  EngineGoal,
  EngineInvestment,
  EngineCategory,
  FinancialEngineContext,
} from "./types";

// ─── Structural input interfaces ──────────────────────────────────────────────
// Accepts any object with at least these fields — compatible with both the
// full Supabase Table type and any Pick subset used by feature services.

interface RawProfile {
  currency?: string | null;
  monthly_savings_target?: number | string | null;
  priorities?: unknown[] | null;
}

interface RawExpense {
  id: string;
  amount: number;
  category_id?: string | null;
  kind?: string | null;
  recurring?: boolean | null;
  spent_at: string;
}

interface RawIncome {
  id: string;
  amount: number;
  source?: string | null;
  recurring?: boolean | null;
  received_at?: string | null;
}

interface RawBill {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  paid_this_month?: boolean | null;
  /** Optional — fetchBills pre-filters active=true so may be absent */
  active?: boolean | null;
}

interface RawGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution?: number | string | null;
  deadline?: string | null;
  priority?: string | null;
  category?: string | null;
}

interface RawInvestment {
  id: string;
  type?: string | null;
  name: string;
  ticker?: string | null;
  quantity: number;
  avg_cost: number;
  current_price: number;
  currency?: string | null;
}

interface RawCategory {
  id: string;
  name: string;
  kind?: string | null;
}

// ─── Adapter functions ────────────────────────────────────────────────────────

function resolveCategoryName(
  categoryId: string | null | undefined,
  categories: RawCategory[],
): string {
  if (!categoryId) return "Uncategorised";
  return categories.find((c) => c.id === categoryId)?.name ?? "Uncategorised";
}

export function adaptProfile(p: RawProfile): EngineProfile {
  return {
    currency: p.currency ?? "EUR",
    monthlySavingsTarget: Number(p.monthly_savings_target ?? 0),
    priorities: Array.isArray(p.priorities) ? (p.priorities as string[]) : [],
  };
}

export function adaptExpenses(
  expenses: RawExpense[],
  categories: RawCategory[],
): EngineExpense[] {
  return expenses.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    categoryId: e.category_id ?? null,
    categoryName: resolveCategoryName(e.category_id, categories),
    kind: (e.kind as "fixed" | "variable") ?? "variable",
    recurring: e.recurring ?? false,
    spentAt: new Date(e.spent_at),
  }));
}

export function adaptIncomes(incomes: RawIncome[]): EngineIncome[] {
  return incomes.map((i) => ({
    id: i.id,
    amount: Number(i.amount),
    source: i.source ?? "Unknown",
    recurring: i.recurring ?? false,
    receivedAt: new Date(i.received_at ?? new Date().toISOString()),
  }));
}

export function adaptBills(bills: RawBill[]): EngineBill[] {
  return bills.map((b) => ({
    id: b.id,
    name: b.name,
    amount: Number(b.amount),
    dueDay: b.due_day,
    paidThisMonth: b.paid_this_month ?? false,
    // fetchBills pre-filters active=true on the server; default to true when field absent
    active: b.active ?? true,
  }));
}

export function adaptGoals(goals: RawGoal[]): EngineGoal[] {
  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: Number(g.target_amount),
    currentAmount: Number(g.current_amount),
    monthlyContribution: Number(g.monthly_contribution ?? 0),
    deadline: g.deadline ? new Date(g.deadline) : null,
    priority: (g.priority as "high" | "medium" | "low") ?? "medium",
    category: g.category ?? "general",
  }));
}

export function adaptInvestments(investments: RawInvestment[]): EngineInvestment[] {
  return investments.map((i) => ({
    id: i.id,
    type: (i.type as EngineInvestment["type"]) ?? "other",
    name: i.name,
    ticker: i.ticker ?? null,
    quantity: Number(i.quantity),
    avgCost: Number(i.avg_cost),
    currentPrice: Number(i.current_price),
    currency: i.currency ?? "EUR",
  }));
}

export function adaptCategories(categories: RawCategory[]): EngineCategory[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: (c.kind as "fixed" | "variable" | "income") ?? "variable",
  }));
}

/**
 * Assemble a complete FinancialEngineContext from raw Supabase data.
 *
 * Call once per data change, then pass the context to all engine functions.
 * The structural interfaces above ensure this accepts both full Table rows
 * and any Pick<Table, ...> subset returned by feature service functions.
 */
export function buildEngineContext(params: {
  profile: RawProfile;
  expenses: RawExpense[];
  incomes: RawIncome[];
  bills: RawBill[];
  goals: RawGoal[];
  investments: RawInvestment[];
  categories: RawCategory[];
  asOf?: Date;
}): FinancialEngineContext {
  return {
    profile: adaptProfile(params.profile),
    expenses: adaptExpenses(params.expenses, params.categories),
    incomes: adaptIncomes(params.incomes),
    bills: adaptBills(params.bills),
    goals: adaptGoals(params.goals),
    investments: adaptInvestments(params.investments),
    categories: adaptCategories(params.categories),
    asOf: params.asOf ?? new Date(),
  };
}
