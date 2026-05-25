import { useMutation, useQueries, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { monthRange, previousMonthRange } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { fetchCategories } from "@/features/budget/budget.service";
import { fetchBills } from "@/features/budget/budget.service";
import { fetchExpenses, fetchPrevMonthTotal } from "@/features/expenses/expenses.service";
import {
  fetchDashboardGoals,
  fetchDashboardProfile,
  fetchMonthIncomeTotal,
  fetchRecommendations,
  generateInsights,
} from "./dashboard.service";

// ─── Aggregate dashboard hook ─────────────────────────────────────────────────

/**
 * Runs all 8 dashboard queries in parallel, each with its own cache entry.
 *
 * Caching strategy:
 *  - Profile, categories, goals: 5 min stale — change rarely.
 *  - Expenses, incomes, bills: 60 s stale — change within a session.
 *  - Recommendations: 60 s stale — generated on-demand.
 *
 * When the user adds an expense in the budget tab, invalidating
 * queryKeys.expenses(userId).all causes only the expense slice to refetch
 * when the user navigates back here. Profile/categories serve from cache.
 */
export function useDashboard() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const range = monthRange();
  const prevRange = previousMonthRange();

  const results = useQueries({
    queries: [
      // 0 — Profile
      {
        queryKey: queryKeys.profile(uid),
        queryFn: () => fetchDashboardProfile(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      // 1 — Current month expenses
      {
        queryKey: queryKeys.expenses(uid).byMonth(range.start, range.end),
        queryFn: () => fetchExpenses(uid, range.start, range.end),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
      // 2 — Previous month total (for trend badge)
      {
        queryKey: ["expenses", uid, "prevTotal", prevRange.start, prevRange.end],
        queryFn: () => fetchPrevMonthTotal(uid, prevRange.start, prevRange.end),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      // 3 — Current month income total
      {
        queryKey: ["incomes", uid, "monthTotal", range.start, range.end],
        queryFn: () => fetchMonthIncomeTotal(uid, range.start, range.end),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
      // 4 — Categories (for spending distribution)
      {
        queryKey: queryKeys.categories(uid),
        queryFn: () => fetchCategories(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      // 5 — Active bills (for upcoming bills section)
      {
        queryKey: queryKeys.bills(uid),
        queryFn: () => fetchBills(uid),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
      // 6 — Savings goals
      {
        queryKey: queryKeys.goals(uid),
        queryFn: () => fetchDashboardGoals(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      // 7 — AI recommendations
      {
        queryKey: queryKeys.recommendations(uid),
        queryFn: () => fetchRecommendations(uid),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
    ],
  });

  const [profileQ, expensesQ, prevTotalQ, incomeTotalQ, categoriesQ, billsQ, goalsQ, recsQ] =
    results;

  return {
    profile: profileQ.data ?? null,
    expenses: expensesQ.data ?? [],
    prevMonthTotal: (prevTotalQ.data as number | undefined) ?? 0,
    incomeTotal: (incomeTotalQ.data as number | undefined) ?? 0,
    categories: categoriesQ.data ?? [],
    bills: billsQ.data ?? [],
    goals: goalsQ.data ?? [],
    recommendations: recsQ.data ?? [],
    // Show the skeleton only until the above-the-fold data is ready.
    isLoading: profileQ.isLoading || expensesQ.isLoading || incomeTotalQ.isLoading,
    isError: results.some((r) => r.isError),
    range,
  };
}

// ─── Generate AI insights ─────────────────────────────────────────────────────

/**
 * Calls the generate-insights edge function then invalidates the
 * recommendations cache so the new cards appear automatically.
 */
export function useGenerateInsights() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateInsights,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations(user!.id),
      });
      toast.success("Fresh insights ready");
    },

    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not generate insights",
      );
    },
  });
}
