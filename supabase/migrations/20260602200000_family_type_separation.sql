-- ─── Family type separation ───────────────────────────────────────────────────
-- Adds a `type` column to families table to distinguish between:
--   'expense' → Groups tab (Tricount-style expense splitting)
--   'goals'   → Goals tab (shared savings goals)
-- All existing families default to 'expense' (backward compatible).

-- 1. Add type column with default
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense'
  CHECK (type IN ('expense', 'goals'));

-- 2. Update existing families that have shared_goals → mark as 'goals'
-- (families used for savings goals get the goals type)
UPDATE families
  SET type = 'goals'
  WHERE id IN (SELECT DISTINCT family_id FROM shared_goals);

-- 3. Update get_user_families RPC to include type in response
CREATE OR REPLACE FUNCTION get_user_families()
RETURNS TABLE (
  family_id   uuid,
  family_name text,
  member_role text,
  member_count bigint,
  owner_name  text,
  family_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    fm.role,
    COUNT(DISTINCT m.user_id),
    COALESCE(p.full_name, p.first_name, '@' || p.financial_username),
    f.type
  FROM families f
  INNER JOIN family_members fm ON fm.family_id = f.id AND fm.user_id = auth.uid()
  LEFT  JOIN family_members m  ON m.family_id = f.id
  LEFT  JOIN profiles p        ON p.id = f.owner_id
  GROUP BY f.id, f.name, fm.role, p.full_name, p.first_name, p.financial_username, f.type
  ORDER BY f.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_families() TO authenticated;

-- 4. Update create_family RPC to accept optional type parameter
CREATE OR REPLACE FUNCTION create_family(
  p_name TEXT,
  p_type TEXT DEFAULT 'expense'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
BEGIN
  -- Validate type
  IF p_type NOT IN ('expense', 'goals') THEN
    RAISE EXCEPTION 'Invalid family type. Must be expense or goals.';
  END IF;

  INSERT INTO families (name, owner_id, type)
  VALUES (p_name, auth.uid(), p_type)
  RETURNING id INTO v_family_id;

  INSERT INTO family_members (family_id, user_id, role)
  VALUES (v_family_id, auth.uid(), 'owner');

  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_family(TEXT, TEXT) TO authenticated;

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_families_type ON families(type);
