-- Fix: remove_family_member must also clear profiles.family_id for the removed user.
-- Root cause: DELETE from family_members was happening without updating profiles,
-- so the removed user's profile still referenced the old family_id, blocking
-- any future accept_family_invite call with "You already belong to a family."

CREATE OR REPLACE FUNCTION remove_family_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id      uuid;
  v_owner_id       uuid;
  v_member_user_id uuid;
  v_actor_name     text;
BEGIN
  SELECT family_id, user_id INTO v_family_id, v_member_user_id
  FROM family_members WHERE id = p_member_id;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT owner_id INTO v_owner_id FROM families WHERE id = v_family_id;

  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the family owner can remove members';
  END IF;

  DELETE FROM family_members WHERE id = p_member_id;

  -- Clear the removed user's profile so they can join another family later
  UPDATE profiles SET family_id = NULL WHERE id = v_member_user_id;

  SELECT first_name || ' ' || last_name_1 INTO v_actor_name
  FROM profiles WHERE id = v_member_user_id;

  INSERT INTO family_activity (family_id, user_id, type, actor_name, meta)
  VALUES (v_family_id, v_member_user_id, 'member_removed', v_actor_name, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION remove_family_member TO authenticated;
