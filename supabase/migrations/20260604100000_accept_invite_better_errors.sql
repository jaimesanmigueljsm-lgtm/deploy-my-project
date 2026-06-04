-- =============================================================================
-- Improve accept_family_invite error messages for better UX
-- 2026-06-04
--
-- Changes:
--   1. Differentiate between "already accepted", "expired", and "not found"
--      using specific ERRCODEs that the frontend can catch and translate
--   2. Check conditions separately to provide precise error messages
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
  -- Check if invitation exists at all
  SELECT * INTO v_invite
  FROM public.family_invitations
  WHERE id = p_invitation_id
    AND invited_user_id = auth.uid();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or you are not the invited user'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Check if already accepted
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted'
      USING ERRCODE = '23505'; -- unique_violation (semantically: already done)
  END IF;

  -- Check if expired
  IF v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation has expired'
      USING ERRCODE = '22023'; -- invalid_parameter_value (expired token)
  END IF;

  -- Lock the row for update (prevents race conditions)
  SELECT * INTO v_invite
  FROM public.family_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

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
