import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { monthRange } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import type { Goal } from "@/types/finance";
import { getContributionToast } from "./goals.utils";
import {
  addContribution,
  addGoal,
  deleteGoal,
  fetchGoalContributions,
  fetchGoals,
  seedDemoGoals,
  updateGoal,
  type AddContributionPayload,
  type AddGoalPayload,
  type UpdateGoalPayload,
} from "./goals.service";
import { fetchMonthIncomeTotal } from "@/features/dashboard/dashboard.service";
import { useProfile } from "@/features/profile/use-profile";

// ─── Re-export useProfile for convenience in the goals route ─────────────────
export { useProfile };

// ─── Read ─────────────────────────────────────────────────────────────────────

export function useGoals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.goals(user?.id ?? ""),
    queryFn:  () => fetchGoals(user!.id),
    enabled:  !!user?.id,
    staleTime: 60_000,
  });
}

export function useGoalContributions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.contributions(user?.id ?? ""),
    queryFn:  () => fetchGoalContributions(user!.id),
    enabled:  !!user?.id,
    staleTime: 60_000,
  });
}

export function useMonthIncomeTotal() {
  const { user } = useAuth();
  const range = monthRange();

  return useQuery({
    queryKey: ["incomes", user?.id ?? "", "monthTotal", range.start, range.end],
    queryFn:  () => fetchMonthIncomeTotal(user!.id, range.start, range.end),
    enabled:  !!user?.id,
    staleTime: 5 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function useInvalidateGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.goals(user!.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.contributions(user!.id) });
  };
}

export function useAddGoal() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();

  return useMutation({
    mutationFn: (payload: AddGoalPayload) => addGoal(user!.id, payload),
    onSuccess:  () => { invalidate(); toast.success("Goal created"); },
    onError:    (err) => toast.error(err instanceof Error ? err.message : "Failed to create goal"),
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoals();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGoalPayload }) =>
      updateGoal(id, payload),
    onSuccess:  () => { invalidate(); toast.success("Goal updated"); },
    onError:    (err) => toast.error(err instanceof Error ? err.message : "Failed to update goal"),
  });
}

export function useDeleteGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),

    onMutate: async (deletedId) => {
      const key = queryKeys.goals(user!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Goal[]>(key);
      queryClient.setQueryData<Goal[]>(key, (old) =>
        (old ?? []).filter((g) => g.id !== deletedId),
      );
      return { previous, key };
    },

    onError: (_err, _id, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(context.key, context.previous);
      toast.error("Failed to delete goal");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals(user!.id) });
    },
  });
}

export function useAddContribution() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const invalidate = useInvalidateGoals();

  return useMutation({
    mutationFn: (payload: AddContributionPayload) => addContribution(user!.id, payload),

    onSuccess: (_data, variables, _context) => {
      invalidate();
      // We don't have the new percentage here, so we fetch and derive it after invalidation.
      // The toast is fired with a generic success for now; GoalCard will reflect the update.
      toast.success("Contribution added");
    },

    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add contribution"),
  });
}

export function useSeedDemoGoals() {
  const { user } = useAuth();
  const invalidate = useInvalidateGoals();

  return useMutation({
    mutationFn: () => seedDemoGoals(user!.id),
    onSuccess:  () => { invalidate(); toast.success("Example goals added"); },
    onError:    (err) => toast.error(err instanceof Error ? err.message : "Failed to seed goals"),
  });
}
