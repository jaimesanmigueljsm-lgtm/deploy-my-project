import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { monthRange } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  addExpense,
  deleteExpense,
  fetchExpenses,
  type AddExpensePayload,
  type Expense,
} from "./expenses.service";

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Fetches expenses for the given ISO date range.
 * Call with monthRange().start / .end from the parent component so the
 * query key is stable within the same calendar month.
 */
export function useExpenses(start: string, end: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.expenses(user?.id ?? "").byMonth(start, end),
    queryFn: () => fetchExpenses(user!.id, start, end),
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Adds an expense, then invalidates:
 *  - the current month's expense cache (budget list)
 *  - the dashboard aggregate cache (dashboard total)
 */
export function useAddExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const range = monthRange();

  return useMutation({
    mutationFn: (payload: AddExpensePayload) => addExpense(user!.id, payload),

    onSuccess: () => {
      // Invalidate all expense queries for this user (any month).
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses(user!.id).all,
      });
      // Bust the dashboard aggregate so the hero card total stays in sync.
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard(user!.id, range.start),
      });
      toast.success("Expense added");
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add expense");
    },
  });
}

/**
 * Deletes an expense with an optimistic update:
 *  1. Remove from cache immediately so the list updates without a flash.
 *  2. Roll back if the server rejects the delete.
 *  3. Invalidate to sync truth from the server.
 */
export function useDeleteExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const range = monthRange();

  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),

    onMutate: async (deletedId) => {
      const key = queryKeys.expenses(user!.id).byMonth(range.start, range.end);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Expense[]>(key);

      queryClient.setQueryData<Expense[]>(key, (old) =>
        (old ?? []).filter((e) => e.id !== deletedId),
      );

      return { previous, key };
    },

    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error("Failed to delete expense");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses(user!.id).all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard(user!.id, range.start),
      });
    },
  });
}
