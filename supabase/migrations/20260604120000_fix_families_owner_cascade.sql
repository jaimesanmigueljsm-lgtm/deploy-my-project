-- =============================================================================
-- Fix families.owner_id orphan risk (P2 fix)
-- 2026-06-04
--
-- Issue: families.owner_id doesn't have ON DELETE CASCADE constraint.
-- If an owner is deleted from auth.users, families become orphaned.
--
-- Solution: Add trigger that transfers ownership to longest-standing member
-- when owner is deleted. If no members remain, delete the family.
-- =============================================================================

-- First, add the foreign key constraint with NO ACTION
-- (we handle deletion logic in trigger, not cascade)
ALTER TABLE public.families
  DROP CONSTRAINT IF EXISTS families_owner_fk,
  ADD CONSTRAINT families_owner_fk
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE NO ACTION;

-- Trigger function: transfer ownership or delete family when owner is deleted
CREATE OR REPLACE FUNCTION public.handle_family_owner_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family RECORD;
  v_new_owner_id uuid;
BEGIN
  -- Find all families owned by the deleted user
  FOR v_family IN
    SELECT id FROM public.families WHERE owner_id = OLD.id
  LOOP
    -- Try to find the longest-standing member (excluding the deleted owner)
    SELECT user_id INTO v_new_owner_id
    FROM public.family_members
    WHERE family_id = v_family.id
      AND user_id != OLD.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_new_owner_id IS NOT NULL THEN
      -- Transfer ownership to longest-standing member
      UPDATE public.families
      SET owner_id = v_new_owner_id
      WHERE id = v_family.id;

      -- Optionally: log activity
      INSERT INTO public.family_activity (family_id, user_id, type, actor_name, meta)
      VALUES (
        v_family.id,
        v_new_owner_id,
        'ownership_transferred',
        'System',
        jsonb_build_object('previous_owner_id', OLD.id, 'reason', 'owner_deleted')
      )
      ON CONFLICT DO NOTHING;
    ELSE
      -- No members left, delete the family
      -- This will cascade to all related tables (shared_goals, invitations, etc.)
      DELETE FROM public.families WHERE id = v_family.id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

-- Trigger on auth.users deletion (BEFORE DELETE to modify families before FK check)
DROP TRIGGER IF EXISTS on_family_owner_deleted ON auth.users;
CREATE TRIGGER on_family_owner_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_family_owner_deletion();

COMMENT ON FUNCTION public.handle_family_owner_deletion() IS
  'Transfers family ownership to longest-standing member when owner is deleted. Deletes family if no members remain.';
