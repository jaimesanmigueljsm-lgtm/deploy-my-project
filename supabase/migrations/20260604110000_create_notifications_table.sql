-- =============================================================================
-- Create notifications table (P3 fix)
-- 2026-06-04
--
-- Issue: Code references notifications table but it doesn't exist in schema.
-- This causes send_family_invite and notify_family_members RPCs to fail.
--
-- Creates notifications table with proper RLS and indexes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only SECURITY DEFINER RPCs can insert notifications
-- (prevent users from creating fake notifications)
CREATE POLICY "system inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (false);

-- Index for fetching user's unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read = false;

-- Index for fetching all user's notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON public.notifications(user_id, created_at DESC);

COMMENT ON TABLE public.notifications IS 'User notifications for invitations, family activity, goals, etc.';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: family_invite, invite_accepted, contribution_added, goal_updated, etc.';
COMMENT ON COLUMN public.notifications.data IS 'Additional JSON data for the notification (e.g., invitation_id, family_id, goal_id)';
