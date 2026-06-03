-- =============================================================================
-- Multi-group: fix accept_family_invite to allow joining multiple groups
-- 2026-06-01
--
-- Changes:
--   1. Remove the "You already belong to a family" guard (lines 110-115
--      of 20260522100000_family_activity.sql) — users can now belong to
--      as many groups as they want.
--   2. Only update profile.family_id when it is currently NULL (first group).
--      Subsequent group joins do NOT overwrite the active group pointer.
-- =============================================================================

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

  -- Add to group (ON CONFLICT DO NOTHING = safe to call twice)
  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_invite.family_id, auth.uid(), v_invite.role)
  ON CONFLICT (family_id, user_id) DO NOTHING;

  -- Only set profile.family_id on the very first group join.
  -- If the user already has an active group, leave it untouched.
  UPDATE public.profiles
  SET family_id = v_invite.family_id
  WHERE id = auth.uid() AND family_id IS NULL;

  UPDATE public.family_invitations
  SET accepted_at = now()
  WHERE id = p_invitation_id;

  -- Log activity
  SELECT first_name || ' ' || last_name_1 INTO v_actor_name
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.family_activity (family_id, user_id, type, actor_name, meta)
  VALUES (v_invite.family_id, auth.uid(), 'member_joined', v_actor_name, '{}');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_family_invite FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_family_invite TO authenticated;
