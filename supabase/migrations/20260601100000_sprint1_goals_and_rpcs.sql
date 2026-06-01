-- =============================================================================
-- Sprint 1 — Goal lifecycle + multi-group RPCs
-- 2026-06-01
--
-- Changes:
--   1. Add status column to shared_goals  (active | completed | archived)
--   2. Add status column to savings_goals (active | completed | archived)
--   3. Replace add_shared_goal_contribution — adds auto-complete when target hit
--   4. Replace create_family — removes single-family guard (multi-group support)
--   5. Add get_user_families() — lists all groups the caller belongs to
--   6. Add leave_family_group(uuid) — leaves one specific group safely
-- =============================================================================

-- 1. Goal status — shared_goals
ALTER TABLE public.shared_goals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CONSTRAINT shared_goals_status_valid CHECK (status IN ('active', 'completed', 'archived'));

-- 2. Goal status — savings_goals (individual goals tab)
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CONSTRAINT savings_goals_status_valid CHECK (status IN ('active', 'completed', 'archived'));

-- =============================================================================
-- 3. add_shared_goal_contribution — now auto-completes when target is reached
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

  -- Atomic increment (race-condition-safe)
  UPDATE public.shared_goals
  SET current_amount = current_amount + p_delta
  WHERE id = p_goal_id;

  -- Auto-complete when target is reached
  UPDATE public.shared_goals
  SET status = 'completed'
  WHERE id = p_goal_id
    AND current_amount >= target_amount
    AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.add_shared_goal_contribution FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_shared_goal_contribution TO authenticated;

-- =============================================================================
-- 4. create_family — allow multiple groups per user
-- Removes the "already belongs to a family" guard so users can create or join
-- more than one group. profile.family_id is only set when it is currently NULL
-- (backward-compatible: existing single-family users are unaffected).
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
  p_name := trim(p_name);
  IF length(p_name) < 1 THEN
    RAISE EXCEPTION 'Family name cannot be empty';
  END IF;

  INSERT INTO public.families (name, owner_id)
  VALUES (p_name, auth.uid())
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_family_id, auth.uid(), 'owner');

  -- Only set profile.family_id when the user has no group yet (legacy compat)
  UPDATE public.profiles
  SET family_id = v_family_id
  WHERE id = auth.uid() AND family_id IS NULL;

  RETURN v_family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_family FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family TO authenticated;

-- =============================================================================
-- 5. get_user_families — list every group the calling user belongs to
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_families()
RETURNS TABLE (
  family_id    uuid,
  family_name  text,
  member_role  text,
  member_count bigint,
  owner_name   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    fm.role,
    (SELECT COUNT(*)::bigint FROM public.family_members fm2 WHERE fm2.family_id = f.id),
    COALESCE(op.full_name, op.first_name, 'Owner'::text)
  FROM public.families f
  JOIN public.family_members fm ON fm.family_id = f.id AND fm.user_id = auth.uid()
  LEFT JOIN public.profiles op ON op.id = f.owner_id
  ORDER BY fm.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_families FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_families TO authenticated;

-- =============================================================================
-- 6. leave_family_group — leave one specific group without affecting others
-- Mirrors leave_family() logic but is scoped to a single p_family_id.
-- If the leaving user was the owner and others remain, ownership transfers.
-- If they were the last member, the family is dissolved.
-- profile.family_id is updated to another group if one exists, else NULL.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.leave_family_group(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner    boolean;
  v_member_count int;
  v_new_owner   uuid;
BEGIN
  IF NOT public.is_family_member(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  v_is_owner := public.is_family_owner(auth.uid(), p_family_id);
  SELECT COUNT(*) INTO v_member_count FROM public.family_members WHERE family_id = p_family_id;

  IF v_is_owner THEN
    IF v_member_count > 1 THEN
      SELECT user_id INTO v_new_owner
      FROM public.family_members
      WHERE family_id = p_family_id AND user_id != auth.uid()
      ORDER BY created_at ASC LIMIT 1;

      UPDATE public.families SET owner_id = v_new_owner WHERE id = p_family_id;
      UPDATE public.family_members SET role = 'owner'
        WHERE family_id = p_family_id AND user_id = v_new_owner;
    ELSE
      -- Last member: dissolve (CASCADE handles goals, invitations, activity)
      DELETE FROM public.families WHERE id = p_family_id;
      UPDATE public.profiles
        SET family_id = NULL
        WHERE id = auth.uid() AND family_id = p_family_id;
      RETURN;
    END IF;
  END IF;

  DELETE FROM public.family_members WHERE family_id = p_family_id AND user_id = auth.uid();

  -- Switch profile.family_id to another group if this was the active one
  UPDATE public.profiles
  SET family_id = (
    SELECT family_id FROM public.family_members
    WHERE user_id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  )
  WHERE id = auth.uid() AND family_id = p_family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_family_group FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_family_group TO authenticated;
