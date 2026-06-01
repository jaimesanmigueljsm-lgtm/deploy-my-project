import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useT } from "@/i18n";
import {
  getUserFamilies,
  loadFamilyData,
  createSharedGoal,
  addGoalContribution,
  type UserFamily,
  type SharedGoal,
} from "./shared-goals.service";

export type { SharedGoal, UserFamily };

const keys = {
  families: (uid: string) => ["user-families", uid] as const,
  familyData: (familyId: string) => ["family-data", familyId] as const,
};

export function useUserFamilies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.families(user?.id ?? ""),
    queryFn: () => getUserFamilies(),
    enabled: !!user,
  });
}

export function useFamilyGoals(familyId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.familyData(familyId ?? ""),
    queryFn: () => loadFamilyData(familyId!, user!.id),
    enabled: !!user && !!familyId,
    select: (data) => data.goals,
  });
}

export function useCreateSharedGoal(familyId: string | null) {
  const { t } = useT();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      targetAmount,
      currentAmount,
      deadline,
    }: {
      name: string;
      targetAmount: number;
      currentAmount?: number;
      deadline?: string | null;
    }) => createSharedGoal(familyId!, name, targetAmount, currentAmount, deadline),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.familyData(familyId ?? "") });
      toast.success(t("goals.shared.toast.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddSharedContribution(familyId: string | null) {
  const { t } = useT();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      goalId,
      currentAmount,
      delta,
    }: {
      goalId: string;
      currentAmount: number;
      delta: number;
    }) => addGoalContribution(goalId, currentAmount, delta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.familyData(familyId ?? "") });
      toast.success(t("goals.contrib.success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
