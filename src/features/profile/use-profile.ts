import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchProfile,
  updateProfile,
  type ProfileUpdate,
} from "./profile.service";

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Returns the current user's profile.
 * staleTime is 5 min — profile data (name, currency, theme) changes rarely.
 */
export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * Optimistically updates the profile cache before the server responds so the
 * settings UI never appears to lag.
 */
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
