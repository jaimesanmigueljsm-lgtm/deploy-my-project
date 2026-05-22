-- Fix: send_family_invite ON CONFLICT must reset accepted_at so a re-invite
-- becomes visible in both get_my_invitations and get_family_sent_invitations.
-- Root cause: ON CONFLICT previously only updated expires_at + token, leaving
-- accepted_at non-null for users who were removed after accepting an invite.

CREATE OR REPLACE FUNCTION public.send_family_invite(
  p_family_id uuid,
  p_username  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_id    uuid;
  v_invited_email text;
  v_invitation_id uuid;
  v_family_name   text;
  v_sender_name   text;
BEGIN
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Only the family owner can send invitations';
  END IF;

  SELECT p.id INTO v_invited_id
  FROM public.profiles p
  WHERE p.financial_username = lower(trim(p_username));

  IF v_invited_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_username
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_invited_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot invite yourself';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = v_invited_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this family';
  END IF;

  SELECT email INTO v_invited_email FROM auth.users WHERE id = v_invited_id;
  SELECT name  INTO v_family_name   FROM public.families WHERE id = p_family_id;
  SELECT first_name || ' ' || last_name_1 INTO v_sender_name
    FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.family_invitations (
    family_id, invited_by, invited_user_id, email, role
  ) VALUES (
    p_family_id, auth.uid(), v_invited_id, v_invited_email, 'member'
  )
  ON CONFLICT (family_id, invited_user_id) DO UPDATE
    SET expires_at  = now() + INTERVAL '7 days',
        token       = gen_random_uuid(),
        accepted_at = NULL,
        invited_by  = EXCLUDED.invited_by
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    v_invited_id,
    'family_invite',
    'Invitación familiar — ' || v_family_name,
    v_sender_name || ' te ha invitado a unirse a la familia ' || v_family_name,
    false
  )
  ON CONFLICT DO NOTHING;

  RETURN v_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_family_invite FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_family_invite TO authenticated;
