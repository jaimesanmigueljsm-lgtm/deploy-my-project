/**
 * use-financial-engine.ts — React Query hook that runs the financial engine.
 *
 * Strategy:
 *  - Re-uses existing cache keys (profile, categories, bills, goals) so React Query
 *    deduplicates against queries already issued by useDashboard().
 *  - Adds three new queries: 6-month expense window, all incomes, investments.
 *  - Runs buildEngineContext + runFinancialEngine inside useMemo so the engine
 *    only re-executes when the underlying data actually changes.
 *  - Returns null output while loading — callers render skeletons in that state.
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { monthRange } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { fetchExpenses } from "@/features/expenses/expenses.service";
import { fetchIncomes, fetchBills, fetchCategories } from "@/features/budget/budget.service";
import { fetchInvestments } from "@/features/finances/finances.service";
import { fetchSavingsAccounts } from "@/features/savings/savings.service";
import { fetchDashboardGoals, fetchDashboardProfile } from "./dashboard.service";
import { calculateUserTotalDebt } from "@/features/family/family.service";
import { buildEngineContext, runFinancialEngine } from "@/core/finance";
import type { FinancialEngineOutput } from "@/core/finance";

function sixMonthWindowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function useFinancialEngine(): {
  output: FinancialEngineOutput | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { end } = monthRange();
  // Stable across the session — recalculated only on hot-reload
  const windowStart = useMemo(() => sixMonthWindowStart(), []);

  const results = useQueries({
    queries: [
      // 0 — Profile (same key as useDashboard — served from cache immediately)
      {
        queryKey: queryKeys.profile(uid),
        queryFn: () => fetchDashboardProfile(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
      },
      // 1 — 6-month expense window (broader than the current-month-only dashboard query)
      {
        queryKey: queryKeys.expenses(uid).byMonth(windowStart, end),
        queryFn: () => fetchExpenses(uid, windowStart, end),
        enabled: !!uid,
        staleTime: 5 * 60_000,
      },
      // 2 — All incomes (full rows, not just the current-month total)
      {
        queryKey: queryKeys.incomes(uid).all,
        queryFn: () => fetchIncomes(uid),
        enabled: !!uid,
        staleTime: 2 * 60_000,
      },
      // 3 — Bills (same key as useDashboard — from cache)
      {
        queryKey: queryKeys.bills(uid),
        queryFn: () => fetchBills(uid),
        enabled: !!uid,
        staleTime: 60_000,
      },
      // 4 — Goals with extended fields (same key as useDashboard — from cache)
      {
        queryKey: queryKeys.goals(uid),
        queryFn: () => fetchDashboardGoals(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
      },
      // 5 — Investments (not fetched by useDashboard — new request)
      {
        queryKey: queryKeys.investments(uid),
        queryFn: () => fetchInvestments(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
      },
      // 6 — Categories (same key as useDashboard — from cache)
      {
        queryKey: queryKeys.categories(uid),
        queryFn: () => fetchCategories(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
      },
      // 7 — Savings accounts
      {
        queryKey: queryKeys.savings(uid),
        queryFn: () => fetchSavingsAccounts(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
      },
      // 8 — User's total group debt (net balance across all families)
      {
        queryKey: ['groupDebt', uid],
        queryFn: () => calculateUserTotalDebt(uid),
        enabled: !!uid,
        staleTime: 2 * 60_000, // Shorter stale time - debt changes frequently
      },
    ],
  });

  const [profileQ, expensesQ, incomesQ, billsQ, goalsQ, investmentsQ, categoriesQ, savingsQ, groupDebtQ] =
    results;

  const output = useMemo((): FinancialEngineOutput | null => {
    const profile = profileQ.data;
    const expenses = expensesQ.data;
    const incomes = incomesQ.data;
    const groupDebt = groupDebtQ.data ?? 0;

    // Engine requires at minimum: profile + expense history + income data
    if (!profile || !expenses || !incomes) return null;

    // Add group debt as synthetic expense if user owes money
    // This way forecast includes the obligation without affecting personal budget
    let expensesWithDebt = [...expenses];
    if (groupDebt > 0) {
      expensesWithDebt.push({
        id: '__group_debt__',
        user_id: uid,
        amount: groupDebt,
        description: 'Group debt obligation',
        spent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        category_id: null,
        kind: 'variable',
        recurring: false,
      });
    }

    const ctx = buildEngineContext({
      profile,
      expenses: expensesWithDebt,  // Personal expenses + synthetic debt expense
      incomes,
      bills: billsQ.data ?? [],
      goals: goalsQ.data ?? [],
      investments: investmentsQ.data ?? [],
      categories: categoriesQ.data ?? [],
      savingsAccounts: savingsQ.data ?? [],
    });

    return runFinancialEngine(ctx);
  }, [
    profileQ.data,
    expensesQ.data,
    incomesQ.data,
    billsQ.data,
    goalsQ.data,
    investmentsQ.data,
    categoriesQ.data,
    savingsQ.data,
    groupDebtQ.data,  // Changed from sharedExpensesQ
    uid,
  ]);

  return {
    output,
    isLoading: profileQ.isLoading || expensesQ.isLoading || incomesQ.isLoading,
    isError: results.some((r) => r.isError),
  };
}
