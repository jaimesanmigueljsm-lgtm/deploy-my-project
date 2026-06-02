-- ─── Delete family (owner only) ────────────────────────────────────────────
-- Atomically deletes a family and all related data.
-- Only the owner can delete the family.
-- Cascades to: family_members, family_invitations, shared_goals,
-- goal_contributions, family_activity, shared_expenses

CREATE OR REPLACE FUNCTION delete_family(
  p_family_id uuid,
  p_user_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Verify ownership
  SELECT owner_id INTO v_owner_id
    FROM families
   WHERE id = p_family_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Family not found';
  END IF;

  IF v_owner_id != p_user_id THEN
    RAISE EXCEPTION 'Only the family owner can delete the family';
  END IF;

  -- Delete all related data (cascades via foreign keys)
  -- Order matters: delete children first, then parent

  -- 1. Delete shared expense participants
  DELETE FROM shared_expense_participants
   WHERE expense_id IN (
     SELECT id FROM shared_expenses WHERE family_id = p_family_id
   );

  -- 2. Delete shared expenses
  DELETE FROM shared_expenses WHERE family_id = p_family_id;

  -- 3. Delete goal contributions
  DELETE FROM goal_contributions
   WHERE goal_id IN (
     SELECT id FROM shared_goals WHERE family_id = p_family_id
   );

  -- 4. Delete shared goals
  DELETE FROM shared_goals WHERE family_id = p_family_id;

  -- 5. Delete family activity
  DELETE FROM family_activity WHERE family_id = p_family_id;

  -- 6. Delete pending invitations
  DELETE FROM family_invitations WHERE family_id = p_family_id;

  -- 7. Delete family members
  DELETE FROM family_members WHERE family_id = p_family_id;

  -- 8. Finally, delete the family itself
  DELETE FROM families WHERE id = p_family_id;

  -- Clear family_id from all members' profiles
  UPDATE profiles
     SET family_id = NULL
   WHERE family_id = p_family_id;

END;
$$;

GRANT EXECUTE ON FUNCTION delete_family(uuid, uuid) TO authenticated;
