import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchProfile,
  updateProfile,
  type ProfileUpdate,
} from "./profile.service";

// ─── localStorage persistence ─────────────────────────────────────────────────

const CACHE_KEY = (id: string) => `nest.profile.${id}`;

function readCachedProfile(id: string) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(id));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedProfile(id: string, data: unknown) {
  try { localStorage.setItem(CACHE_KEY(id), JSON.stringify(data)); } catch {}
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function useProfile() {
  const { user } = useAuth();
  const id = user?.id ?? "";

  // Snapshot localStorage once per user — used as instant initial data
  const cached = useMemo(() => readCachedProfile(id), [id]);

  return useQuery({
    queryKey: queryKeys.profile(id),
    queryFn: async () => {
      const data = await fetchProfile(user!.id);
      writeCachedProfile(user!.id, data);
      return data;
    },
    enabled: !!id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Show cached data instantly; React Query refetches in background because
    // initialDataUpdatedAt: 0 marks it as always stale.
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached ? 0 : undefined,
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: ProfileUpdate) => updateProfile(user!.id, updates),

    onMutate: async (updates) => {
      const key = queryKeys.profile(user!.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: unknown) =>
        old ? { ...(old as object), ...updates } : old,
      );
      return { previous };
    },

    onError: (_err, _updates, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.profile(user!.id), context.previous);
      }
      toast.error("Failed to save profile");
    },

    onSuccess: () => {
      toast.success("Profile saved");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(user!.id) });
    },
  });
}
