import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`nooly-notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: notifKeys.all(user.id) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, queryClient]);

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
