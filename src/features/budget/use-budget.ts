import { useMutation, useQueries, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import { fetchProfile } from "@/features/profile/profile.service";
import { fetchExpenses } from "@/features/expenses/expenses.service";
import {
  addBill,
  addIncome,
  deleteBill,
  deleteIncome,
  fetchBills,
  fetchCategories,
  fetchIncomes,
  toggleBill,
  updateIncome,
  type AddBillPayload,
  type AddIncomePayload,
  type Bill,
  type Income,
  type UpdateIncomePayload,
} from "./budget.service";

// ─── Aggregate read ───────────────────────────────────────────────────────────

/**
 * Runs all budget queries in parallel via useQueries.
 * Each entity has its own cache entry, so targeted invalidation after
 * mutations (e.g. adding an expense) only refetches what changed.
 */
export function useBudgetData(start: string, end: string) {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.expenses(uid).byMonth(start, end),
        queryFn: () => fetchExpenses(uid, start, end),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.categories(uid),
        queryFn: () => fetchCategories(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.bills(uid),
        queryFn: () => fetchBills(uid),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.incomes(uid).all,
        queryFn: () => fetchIncomes(uid),
        enabled: !!uid,
        staleTime: 60_000,
        placeholderData: keepPreviousData,
      },
      {
        queryKey: queryKeys.profile(uid),
        queryFn: () => fetchProfile(uid),
        enabled: !!uid,
        staleTime: 5 * 60_000,
        select: (profile: Awaited<ReturnType<typeof fetchProfile>>) => profile?.currency ?? "EUR",
        placeholderData: keepPreviousData,
      },
    ],
  });

  const [expensesQ, categoriesQ, billsQ, incomesQ, currencyQ] = results;

  return {
    expenses: expensesQ.data ?? [],
    categories: categoriesQ.data ?? [],
    bills: billsQ.data ?? [],
    incomes: incomesQ.data ?? [],
    currency: (currencyQ.data as string | undefined) ?? "EUR",
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

// ─── Bill mutations ───────────────────────────────────────────────────────────

export function useAddBill() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddBillPayload) => addBill(user!.id, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills(user!.id) });
      toast.success("Bill added");
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add bill");
    },
  });
}

/**
 * Optimistic toggle: the paid/unpaid checkbox must feel instant.
 */
export function useToggleBill() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, paidThisMonth }: { id: string; paidThisMonth: boolean }) =>
      toggleBill(id, paidThisMonth),

    onMutate: async ({ id, paidThisMonth }) => {
      const key = queryKeys.bills(user!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Bill[]>(key);

      queryClient.setQueryData<Bill[]>(key, (old) =>
        (old ?? []).map((b) => (b.id === id ? { ...b, paid_this_month: paidThisMonth } : b)),
      );

      return { previous, key };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error("Failed to update bill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills(user!.id) });
    },
  });
}

export function useDeleteBill() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBill(id),

    onMutate: async (deletedId) => {
      const key = queryKeys.bills(user!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Bill[]>(key);
      queryClient.setQueryData<Bill[]>(key, (old) => (old ?? []).filter((b) => b.id !== deletedId));
      return { previous, key };
    },

    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error("Failed to delete bill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills(user!.id) });
    },
  });
}

// ─── Income mutations ─────────────────────────────────────────────────────────

export function useAddIncome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddIncomePayload) => addIncome(user!.id, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes(user!.id).all });
      queryClient.invalidateQueries({ queryKey: ["analytics-incomes", user!.id] });
      toast.success("Income added");
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add income");
    },
  });
}

export function useUpdateIncome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIncomePayload }) =>
      updateIncome(id, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes(user!.id).all });
      queryClient.invalidateQueries({ queryKey: ["analytics-incomes", user!.id] });
      toast.success("Income updated");
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update income");
    },
  });
}

/**
 * Optimistic delete: income rows disappear immediately.
 */
export function useDeleteIncome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteIncome(id),

    onMutate: async (deletedId) => {
      const key = queryKeys.incomes(user!.id).all;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Income[]>(key);

      queryClient.setQueryData<Income[]>(key, (old) =>
        (old ?? []).filter((i) => i.id !== deletedId),
      );

      return { previous, key };
    },

    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error("Failed to delete income");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes(user!.id).all });
      queryClient.invalidateQueries({ queryKey: ["analytics-incomes", user!.id] });
    },
  });
}
