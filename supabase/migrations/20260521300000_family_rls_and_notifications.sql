-- Migration: Fix family RLS policies + add notify_family_members RPC
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (uses CREATE OR REPLACE / DROP IF EXISTS).

-- ─── 1. families — any member (not just owner) can read their family ───────────

DROP POLICY IF EXISTS "families_member_select" ON families;
DROP POLICY IF EXISTS "families read own" ON families;
DROP POLICY IF EXISTS "families_select" ON families;

CREATE POLICY "families_member_select" ON families
  FOR SELECT USING (
    id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Owner can update family name
DROP POLICY IF EXISTS "families_owner_update" ON families;
CREATE POLICY "families_owner_update" ON families
  FOR UPDATE USING (owner_id = auth.uid());

-- ─── 2. family_members — all members of the same family can see each other ─────

DROP POLICY IF EXISTS "family_members_same_family_select" ON family_members;
DROP POLICY IF EXISTS "family_members_select" ON family_members;
DROP POLICY IF EXISTS "family_members read own" ON family_members;

CREATE POLICY "family_members_same_family_select" ON family_members
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM family_members fm WHERE fm.user_id = auth.uid()
    )
  );

-- Members can insert their own row (handled by accept_family_invite RPC, but
-- keeping as safety net)
DROP POLICY IF EXISTS "family_members_insert_self" ON family_members;
CREATE POLICY "family_members_insert_self" ON family_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── 3. shared_goals — all family members can read and write shared goals ──────

DROP POLICY IF EXISTS "shared_goals_member_select" ON shared_goals;
DROP POLICY IF EXISTS "shared_goals_member_insert" ON shared_goals;
DROP POLICY IF EXISTS "shared_goals_member_update" ON shared_goals;
DROP POLICY IF EXISTS "shared_goals_select" ON shared_goals;
DROP POLICY IF EXISTS "shared_goals_insert" ON shared_goals;
DROP POLICY IF EXISTS "shared_goals_update" ON shared_goals;

CREATE POLICY "shared_goals_member_select" ON shared_goals
  FOR SELECT USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "shared_goals_member_insert" ON shared_goals
  FOR INSERT WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "shared_goals_member_update" ON shared_goals
  FOR UPDATE USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- ─── 4. notify_family_members — SECURITY DEFINER so it can write notifications
--        to other users, bypassing their notifications RLS ─────────────────────

CREATE OR REPLACE FUNCTION notify_family_members(
  p_family_id uuid,
  p_type      text,
  p_title     text,
  p_body      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, read)
  SELECT fm.user_id, p_type, p_title, p_body, false
  FROM   family_members fm
  WHERE  fm.family_id = p_family_id
    AND  fm.user_id  != auth.uid();  -- don't notify yourself
END;
$$;

GRANT EXECUTE ON FUNCTION notify_family_members TO authenticated;
