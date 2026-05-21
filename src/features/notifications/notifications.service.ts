import { supabase as _supabase } from "@/integrations/supabase/client";

// The notifications table is added via migration 20260521100000_notifications.sql.
// Until Supabase types are regenerated the table is not in the generated type union,
// so we use a typed wrapper that bypasses the strict relation check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = _supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = "invite_accepted" | "contribution_added" | "goal_updated";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("id, user_id, type, title, body, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await db
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new Error(error.message);
}
