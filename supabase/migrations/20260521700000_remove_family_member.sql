-- Migration: Add remove_family_member SECURITY DEFINER function
-- Only the family owner can call this. Verifies ownership before deleting.
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION remove_family_member(
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id    uuid;
  v_owner_id     uuid;
BEGIN
  SELECT family_id INTO v_family_id
  FROM   family_members
  WHERE  id = p_member_id;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM   families
  WHERE  id = v_family_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the family owner can remove members';
  END IF;

  DELETE FROM family_members WHERE id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_family_member TO authenticated;
