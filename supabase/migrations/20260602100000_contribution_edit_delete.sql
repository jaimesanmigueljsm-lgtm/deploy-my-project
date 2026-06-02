-- ─── Delete goal contribution ─────────────────────────────────────────────────
-- Atomically removes a contribution record AND subtracts its amount from
-- savings_goals.current_amount. Ownership is verified before any mutation.

CREATE OR REPLACE FUNCTION delete_goal_contribution(
  p_contribution_id uuid,
  p_user_id         uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal_id uuid;
  v_amount  numeric;
BEGIN
  -- Fetch and lock the contribution row
  SELECT goal_id, amount
    INTO v_goal_id, v_amount
    FROM goal_contributions
   WHERE id = p_contribution_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found or not owned by user';
  END IF;

  -- Delete the contribution
  DELETE FROM goal_contributions WHERE id = p_contribution_id;

  -- Subtract from goal current_amount (floor at 0)
  UPDATE savings_goals
     SET current_amount = GREATEST(0, current_amount - v_amount),
         status = CASE
           WHEN GREATEST(0, current_amount - v_amount) < target_amount THEN 'active'
           ELSE status
         END
   WHERE id = v_goal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_goal_contribution(uuid, uuid) TO authenticated;

-- ─── Update goal contribution ─────────────────────────────────────────────────
-- Atomically updates a contribution's amount and note, and adjusts
-- savings_goals.current_amount by the delta (new - old).

CREATE OR REPLACE FUNCTION update_goal_contribution(
  p_contribution_id uuid,
  p_user_id         uuid,
  p_new_amount      numeric,
  p_new_note        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal_id   uuid;
  v_old_amount numeric;
  v_delta     numeric;
BEGIN
  IF p_new_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- Fetch and lock the contribution row
  SELECT goal_id, amount
    INTO v_goal_id, v_old_amount
    FROM goal_contributions
   WHERE id = p_contribution_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found or not owned by user';
  END IF;

  v_delta := p_new_amount - v_old_amount;

  -- Update the contribution record
  UPDATE goal_contributions
     SET amount = p_new_amount,
         note   = p_new_note
   WHERE id = p_contribution_id;

  -- Adjust goal current_amount by delta
  UPDATE savings_goals
     SET current_amount = GREATEST(0, current_amount + v_delta),
         status = CASE
           WHEN GREATEST(0, current_amount + v_delta) >= target_amount THEN 'completed'
           ELSE 'active'
         END
   WHERE id = v_goal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_goal_contribution(uuid, uuid, numeric, text) TO authenticated;
