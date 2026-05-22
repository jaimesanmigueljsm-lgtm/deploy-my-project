-- Migration: family_activity table + log function + updated RPCs
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- ─── 1. family_activity table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_activity (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id   uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        text        NOT NULL,
  actor_name  text,
  meta        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_activity_family_created
  ON family_activity (family_id, created_at DESC);

ALTER TABLE family_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_activity_member_read" ON family_activity;
CREATE POLICY "family_activity_member_read" ON family_activity
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- All writes go through log_family_activity (SECURITY DEFINER)
DROP POLICY IF EXISTS "family_activity_no_direct_insert" ON family_activity;
CREATE POLICY "family_activity_no_direct_insert" ON family_activity
  FOR INSERT WITH CHECK (false);

-- ─── 2. Enable realtime for the new table ────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE family_activity;
EXCEPTION WHEN OTHERS THEN NULL; END;
$$;
-- Also ensure core family tables are in the publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE family_members;
EXCEPTION WHEN OTHERS THEN NULL; END;
$$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shared_goals;
EXCEPTION WHEN OTHERS THEN NULL; END;
$$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE family_invitations;
EXCEPTION WHEN OTHERS THEN NULL; END;
$$;

-- ─── 3. log_family_activity — called by the frontend after mutations ──────────

CREATE OR REPLACE FUNCTION log_family_activity(
  p_family_id  uuid,
  p_type       text,
  p_actor_name text,
  p_meta       jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this family';
  END IF;

  INSERT INTO family_activity (family_id, user_id, type, actor_name, meta)
  VALUES (p_family_id, auth.uid(), p_type, p_actor_name, p_meta);
END;
$$;

GRANT EXECUTE ON FUNCTION log_family_activity TO authenticated;

-- ─── 4. Update accept_family_invite to log member_joined ─────────────────────

CREATE OR REPLACE FUNCTION public.accept_family_invite(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite     RECORD;
  v_actor_name text;
BEGIN
  SELECT * INTO v_invite
  FROM public.family_invitations
  WHERE id              = p_invitation_id
    AND invited_user_id = auth.uid()
    AND accepted_at     IS NULL
    AND expires_at      > now()
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, or expired'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND family_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already belong to a family.';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_invite.family_id, auth.uid(), v_invite.role)
  ON CONFLICT (family_id, user_id) DO NOTHING;

  UPDATE public.profiles SET family_id = v_invite.family_id WHERE id = auth.uid();

  UPDATE public.family_invitations SET accepted_at = now() WHERE id = p_invitation_id;

  -- Log activity (insert directly since the member row now exists)
  SELECT first_name || ' ' || last_name_1 INTO v_actor_name
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.family_activity (family_id, user_id, type, actor_name, meta)
  VALUES (v_invite.family_id, auth.uid(), 'member_joined', v_actor_name, '{}');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_family_invite FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_family_invite TO authenticated;

-- ─── 5. Update remove_family_member to log member_removed ────────────────────

CREATE OR REPLACE FUNCTION remove_family_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id      uuid;
  v_owner_id       uuid;
  v_member_user_id uuid;
  v_actor_name     text;
BEGIN
  SELECT family_id, user_id INTO v_family_id, v_member_user_id
  FROM family_members WHERE id = p_member_id;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT owner_id INTO v_owner_id FROM families WHERE id = v_family_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the family owner can remove members';
  END IF;

  DELETE FROM family_members WHERE id = p_member_id;

  SELECT first_name || ' ' || last_name_1 INTO v_actor_name
  FROM profiles WHERE id = v_member_user_id;

  INSERT INTO family_activity (family_id, user_id, type, actor_name, meta)
  VALUES (v_family_id, v_member_user_id, 'member_removed', v_actor_name, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION remove_family_member TO authenticated;
