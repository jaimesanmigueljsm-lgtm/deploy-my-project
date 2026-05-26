-- =============================================================================
-- NEST Security Phase 2: Family atomicity + notification/membership hardening
-- 2026-05-26
--
-- Issues fixed:
--   1. notifications INSERT policy was open (with check (true)) — forging hole
--   2. family_members "insert_self" policy re-opened the self-join vulnerability
--      that security_hardening.sql had already closed
--   3. leaveFamily client code cleared profiles.family_id but never deleted
--      the family_members row — zombie membership left data inconsistent
--   4. createFamily used 3 separate non-atomic INSERT/UPDATE calls — any
--      partial failure orphaned a family with no members or wrong profile link
--   5. addGoalContribution for shared goals computed (currentAmount + delta)
--      client-side — two concurrent contributions lose one increment
-- =============================================================================

-- =============================================================================
-- 1. Fix notifications INSERT policy
-- The "Service role can insert notifications" policy used WITH CHECK (true),
-- meaning ANY authenticated user could insert a notification row for ANY
-- user_id — forging alerts, social-engineering other members, or flooding inboxes.
-- The notify_family_members SECURITY DEFINER RPC bypasses RLS and does NOT need
-- this policy. Drop it and add a strict own-user-only policy instead.
-- =============================================================================

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Only allow inserting notifications addressed to yourself.
-- Cross-user notifications go through notify_family_members (SECURITY DEFINER).
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 2. Drop the self-join vulnerability re-introduced in 20260521300000
-- "family_members_insert_self" (WITH CHECK user_id = auth.uid()) allowed any
-- authenticated user to insert themselves into ANY family whose UUID they knew.
-- The secure insert path is accept_family_invite (SECURITY DEFINER), which
-- verifies the invite token before inserting. The owner can add members via
-- the "owner adds members" policy. No open self-join policy should exist.
-- =============================================================================

DROP POLICY IF EXISTS "family_members_insert_self" ON public.family_members;

-- =============================================================================
-- 3. leave_family() — atomic family departure
-- Replaces the buggy client-side leaveFamily() which cleared profiles.family_id
-- but never deleted the family_members row, leaving the user as a "zombie" member
-- who could still see shared goals and family data via is_family_member().
--
-- Ownership transfer logic:
--   - If leaving user is NOT the owner: simple removal.
--   - If leaving user IS the owner AND other members exist: transfer to the
--     longest-standing member (oldest created_at).
--   - If leaving user IS the owner AND no other members: dissolve the family.
--     CASCADE handles shared_goals, family_invitations, family_activity.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.leave_family()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
  v_owner_id  uuid;
  v_new_owner uuid;
BEGIN
  SELECT family_id INTO v_family_id FROM public.profiles WHERE id = auth.uid();
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a family';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.families WHERE id = v_family_id;

  -- Remove the membership row first (cleans is_family_member lookups)
  DELETE FROM public.family_members
  WHERE family_id = v_family_id AND user_id = auth.uid();

  -- Clear the profile link so the user can join another family
  UPDATE public.profiles SET family_id = NULL WHERE id = auth.uid();

  -- Handle ownership consequences
  IF v_owner_id = auth.uid() THEN
    SELECT user_id INTO v_new_owner
    FROM public.family_members
    WHERE family_id = v_family_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_new_owner IS NOT NULL THEN
      -- Transfer to the longest-standing remaining member
      UPDATE public.families SET owner_id = v_new_owner WHERE id = v_family_id;
      UPDATE public.family_members
      SET role = 'owner'
      WHERE family_id = v_family_id AND user_id = v_new_owner;
    ELSE
      -- No members left: dissolve the family entirely
      DELETE FROM public.families WHERE id = v_family_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_family FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_family TO authenticated;

-- =============================================================================
-- 4. create_family() — atomic family creation
-- Replaces the 3-call client-side pattern:
--   INSERT families → INSERT family_members → UPDATE profiles
-- A failure after step 1 left an orphaned family row; after step 2 left a
-- family with an owner member but the profile still showing no family_id.
-- All three operations now run inside one PL/pgSQL transaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_family(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
BEGIN
  -- Guard: don't allow creating a second family while in one
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND family_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already belong to a family. Leave it before creating a new one.';
  END IF;

  p_name := trim(p_name);
  IF length(p_name) < 1 THEN
    RAISE EXCEPTION 'Family name cannot be empty';
  END IF;

  INSERT INTO public.families (name, owner_id)
  VALUES (p_name, auth.uid())
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_family_id, auth.uid(), 'owner');

  UPDATE public.profiles SET family_id = v_family_id WHERE id = auth.uid();

  RETURN v_family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_family FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family TO authenticated;

-- =============================================================================
-- 5. add_shared_goal_contribution() — atomic shared goal increment
-- The client computed (currentAmount + delta) where currentAmount was fetched
-- at render time. Two overlapping contributions used stale values and one delta
-- was lost. UPDATE ... SET current_amount = current_amount + p_delta is
-- evaluated inside the transaction by PostgreSQL and is race-condition-safe.
-- Membership is verified server-side before any mutation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_shared_goal_contribution(
  p_goal_id uuid,
  p_delta   numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
BEGIN
  SELECT family_id INTO v_family_id FROM public.shared_goals WHERE id = p_goal_id;
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Shared goal not found';
  END IF;

  IF NOT public.is_family_member(auth.uid(), v_family_id) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this family';
  END IF;

  IF p_delta <= 0 THEN
    RAISE EXCEPTION 'Contribution amount must be positive';
  END IF;

  UPDATE public.shared_goals
  SET current_amount = current_amount + p_delta
  WHERE id = p_goal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_shared_goal_contribution FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_shared_goal_contribution TO authenticated;
