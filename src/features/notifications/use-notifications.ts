import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service";

const notifKeys = {
  all: (userId: string) => ["notifications", userId] as const,
};

export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: notifKeys.all(user?.id ?? ""),
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read).length;
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.all(user!.id) });
    },
  });
}

export function useMarkAllRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.all(user!.id) });
    },
  });
}
