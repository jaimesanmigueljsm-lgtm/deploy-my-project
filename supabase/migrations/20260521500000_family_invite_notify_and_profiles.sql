-- Migration: Fix family invite notifications + profiles cross-read + family name RPC
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- ─── 1. Allow family members to read each other's profiles ────────────────────
-- Needed so "¿Quiénes somos?" can show member names/avatars.

DROP POLICY IF EXISTS "own profile select"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_family_read" ON public.profiles;

CREATE POLICY "profiles_read_own_or_family" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      family_id IS NOT NULL
      AND family_id = get_my_family_id()
    )
  );

-- ─── 2. Fix send_family_invite — notify the invited user ──────────────────────

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
    SET expires_at = now() + INTERVAL '7 days',
        token      = gen_random_uuid()
  RETURNING id INTO v_invitation_id;

  -- Notify the invited user so the bell rings immediately
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

-- ─── 3. update_family_name RPC (owner only) ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_family_name(
  p_family_id uuid,
  p_name      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Only the family owner can rename the family';
  END IF;

  UPDATE public.families
  SET name = trim(p_name)
  WHERE id = p_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_family_name TO authenticated;

-- ─── 4. get_family_members_profiles RPC ──────────────────────────────────────
-- Returns enriched member list (name + avatar) for "¿Quiénes somos?"

CREATE OR REPLACE FUNCTION public.get_family_members_profiles(p_family_id uuid)
RETURNS TABLE (
  member_id          uuid,
  user_id            uuid,
  role               text,
  first_name         text,
  last_name_1        text,
  financial_username text,
  full_name          text,
  avatar_url         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be a member of this family
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fm.id           AS member_id,
    fm.user_id,
    fm.role,
    p.first_name,
    p.last_name_1,
    p.financial_username,
    p.full_name,
    p.avatar_url
  FROM public.family_members fm
  JOIN public.profiles p ON fm.user_id = p.id
  WHERE fm.family_id = p_family_id
  ORDER BY CASE fm.role WHEN 'owner' THEN 0 ELSE 1 END, fm.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_family_members_profiles TO authenticated;
