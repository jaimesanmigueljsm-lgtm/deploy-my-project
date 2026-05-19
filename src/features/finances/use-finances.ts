import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import { fetchProfile } from "@/features/profile/profile.service";
import type { Investment } from "@/types/finance";
import {
  addInvestment,
  deleteInvestment,
  fetchInvestments,
  seedDemoInvestments,
  type AddInvestmentPayload,
} from "./finances.service";

// ─── Aggregate read ───────────────────────────────────────────────────────────

export function useFinancesData() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.investments(uid),
        queryFn:  () => fetchInvestments(uid),
        enabled:  !!uid,
        staleTime: 60_000,
      },
      {
        queryKey: queryKeys.profile(uid),
        queryFn:  () => fetchProfile(uid),
        enabled:  !!uid,
        staleTime: 5 * 60_000,
        select: (p: Awaited<ReturnType<typeof fetchProfile>>) => p?.currency ?? "EUR",
      },
    ],
  });

  const [invQ, currencyQ] = results;

  return {
    investments: invQ.data ?? [],
    currency:    (currencyQ.data as string | undefined) ?? "EUR",
    isLoading:   results.some((r) => r.isLoading),
    isError:     results.some((r) => r.isError),
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useAddInvestment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddInvestmentPayload) => addInvestment(user!.id, payload),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investments(user!.id) });
      toast.success("Holding added");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add holding"),
  });
}

export function useDeleteInvestment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteInvestment(id),

    onMutate: async (deletedId) => {
      const key = queryKeys.investments(user!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Investment[]>(key);
      queryClient.setQueryData<Investment[]>(key, (old) =>
        (old ?? []).filter((i) => i.id !== deletedId),
      );
      return { previous, key };
    },

    onError: (_err, _id, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(context.key, context.previous);
      toast.error("Failed to delete holding");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investments(user!.id) });
    },
  });
}

export function useSeedDemoInvestments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => seedDemoInvestments(user!.id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investments(user!.id) });
      toast.success("Demo portfolio loaded");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to load demo data"),
  });
}
