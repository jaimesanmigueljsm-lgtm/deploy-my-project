import { useQueries, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import { fetchProfile } from "@/features/profile/profile.service";
import {
  fetchAnalyticsCategories,
  fetchSixMonthExpenses,
  fetchSixMonthIncomes,
  sixMonthWindowStart,
} from "./analytics.service";

/**
 * Runs all analytics queries in parallel.
 * The 6-month expense window is stable within a calendar month, so the
 * cache key only changes on month turn-over.
 */
export function useAnalyticsData() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const windowStart = sixMonthWindowStart();

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.analytics(uid, windowStart),
        queryFn: () => fetchSixMonthExpenses(uid, windowStart),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.categories(uid),
        queryFn: () => fetchAnalyticsCategories(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.profile(uid),
        queryFn: () => fetchProfile(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        select: (p: Awaited<ReturnType<typeof fetchProfile>>) => p?.currency ?? "EUR",
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.analyticsIncomes(uid, windowStart),
        queryFn: () => fetchSixMonthIncomes(uid, windowStart),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
    ],
  });

  const [expensesQ, categoriesQ, currencyQ, incomesQ] = results;

  return {
    expenses: expensesQ.data ?? [],
    incomes:
      (incomesQ.data as { amount: number; received_at: string; source: string }[] | undefined) ??
      [],
    categories: categoriesQ.data ?? [],
    currency: (currencyQ.data as string | undefined) ?? "EUR",
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    windowStart,
  };
}
