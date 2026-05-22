-- Fix: update_member_relationship should allow the family owner to set
-- relationship types for any member, not just the member themselves.

CREATE OR REPLACE FUNCTION update_member_relationship(
  p_member_id    uuid,
  p_relationship text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
  v_owner_id  uuid;
BEGIN
  SELECT fm.family_id INTO v_family_id
  FROM family_members fm
  WHERE fm.id = p_member_id;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT f.owner_id INTO v_owner_id
  FROM families f
  WHERE f.id = v_family_id;

  -- Allow: the member themselves OR the family owner
  IF NOT EXISTS (
    SELECT 1 FROM family_members WHERE id = p_member_id AND user_id = auth.uid()
  ) AND v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE family_members
  SET relationship_type = p_relationship
  WHERE id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_member_relationship TO authenticated;
