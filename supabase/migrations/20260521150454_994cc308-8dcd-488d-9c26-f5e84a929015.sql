CREATE OR REPLACE FUNCTION public.get_family_members_profiles(p_family_id uuid)
RETURNS TABLE(
  member_id uuid,
  user_id uuid,
  role text,
  first_name text,
  last_name_1 text,
  financial_username text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_family_member(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Not a member of this family';
  END IF;

  RETURN QUERY
    SELECT
      fm.id AS member_id,
      fm.user_id,
      fm.role,
      p.first_name,
      p.last_name_1,
      p.financial_username,
      p.full_name,
      p.avatar_url
    FROM public.family_members fm
    JOIN public.profiles p ON p.id = fm.user_id
    WHERE fm.family_id = p_family_id
    ORDER BY fm.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_family_members_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_family_members_profiles(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_family_name(p_family_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Only the family owner can rename the family';
  END IF;
  UPDATE public.families SET name = p_name WHERE id = p_family_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_family_name(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_family_name(uuid, text) TO authenticated;