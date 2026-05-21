import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchSavingsAccounts,
  addSavingsAccount,
  updateSavingsAccount,
  deleteSavingsAccount,
  type SavingsAccountPayload,
} from "./savings.service";

export function useSavingsAccounts() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.savings(uid),
    queryFn: () => fetchSavingsAccounts(uid),
    enabled: !!uid,
    staleTime: 5 * 60_000,
  });
}

export function useAddSavingsAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SavingsAccountPayload) => addSavingsAccount(user!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savings(user!.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSavingsAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SavingsAccountPayload> }) =>
      updateSavingsAccount(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savings(user!.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSavingsAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSavingsAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savings(user!.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
