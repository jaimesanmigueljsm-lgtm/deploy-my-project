-- Migration: relationship_type + joined_at on family_members
--            update_member_relationship SECURITY DEFINER function
--            updated get_family_members_profiles returning new fields
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- ─── 1. New columns ───────────────────────────────────────────────────────────

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS relationship_type text,
  ADD COLUMN IF NOT EXISTS joined_at         timestamptz;

-- Backfill joined_at from created_at for existing rows
UPDATE family_members SET joined_at = created_at WHERE joined_at IS NULL;

-- Default for new rows
ALTER TABLE family_members ALTER COLUMN joined_at SET DEFAULT now();

-- ─── 2. update_member_relationship — SECURITY DEFINER (column-safe) ──────────

CREATE OR REPLACE FUNCTION update_member_relationship(
  p_member_id    uuid,
  p_relationship text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE family_members
  SET    relationship_type = p_relationship
  WHERE  id      = p_member_id
    AND  user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found or not authorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_member_relationship TO authenticated;

-- ─── 3. Updated get_family_members_profiles returning new fields ──────────────

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
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fm.id                                    AS member_id,
    fm.user_id,
    fm.role,
    fm.relationship_type,
    COALESCE(fm.joined_at, fm.created_at)    AS joined_at,
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
