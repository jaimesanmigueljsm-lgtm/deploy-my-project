-- =============================================================================
-- Fix get_family_members_profiles column ambiguity error
-- 2026-06-04
--
-- Issue: RPC fails with "column reference user_id is ambiguous" error
-- because user_id exists in both family_members table and as implicit variable.
--
-- Solution: Qualify all column references with table alias (fm., p.)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_family_members_profiles(p_family_id uuid)
RETURNS TABLE (
  member_id          uuid,
  user_id            uuid,
  role               text,
  relationship_type  text,
  joined_at          timestamptz,
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
  -- Check access: user must be a member of this family
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.family_id = p_family_id AND fm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Return all members with their profile data
  RETURN QUERY
  SELECT
    fm.id                                    AS member_id,
    fm.user_id                               AS user_id,
    fm.role                                  AS role,
    fm.relationship_type                     AS relationship_type,
    COALESCE(fm.joined_at, fm.created_at)    AS joined_at,
    p.first_name                             AS first_name,
    p.last_name_1                            AS last_name_1,
    p.financial_username                     AS financial_username,
    p.full_name                              AS full_name,
    p.avatar_url                             AS avatar_url
  FROM public.family_members fm
  JOIN public.profiles p ON fm.user_id = p.id
  WHERE fm.family_id = p_family_id
  ORDER BY CASE fm.role WHEN 'owner' THEN 0 ELSE 1 END, fm.created_at;
END;
$$;

COMMENT ON FUNCTION public.get_family_members_profiles IS
  'Returns all members of a family with their profile data. Fixed column ambiguity by qualifying all references with table aliases.';

-- Verification: test the RPC (replace with your family_id)
-- SELECT * FROM public.get_family_members_profiles('8dbf626c-fafc-41c3-8392-be51b69e6d21');
