-- =============================================================================
-- Fix invitations.invited_by orphan risk (P1 CRITICAL fix)
-- 2026-06-04
--
-- Issue: family_invitations.invited_by has REFERENCES auth.users(id) without
-- CASCADE or SET NULL. If a user who created invitations deletes their account,
-- the FK constraint blocks the deletion.
--
-- Solution: Change to ON DELETE SET NULL and update get_my_invitations RPC
-- to handle NULL invited_by gracefully (show "System" instead of crashing).
-- =============================================================================

-- Step 1: Recreate FK constraint with SET NULL
ALTER TABLE public.family_invitations
  DROP CONSTRAINT IF EXISTS family_invitations_invited_by_fkey,
  ADD CONSTRAINT family_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Remove NOT NULL constraint (allow NULL after user deletion)
ALTER TABLE public.family_invitations
  ALTER COLUMN invited_by DROP NOT NULL;

-- Step 3: Update get_my_invitations RPC to handle NULL invited_by
-- This RPC exists in multiple migrations, we override with final safe version
CREATE OR REPLACE FUNCTION public.get_my_invitations()
RETURNS TABLE(
  id                      uuid,
  family_id               uuid,
  family_name             text,
  invited_by_first_name   text,
  invited_by_last_name_1  text,
  invited_by_username     text,
  role                    text,
  expires_at              timestamptz,
  created_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    fi.id,
    fi.family_id,
    f.name           AS family_name,
    -- If invited_by is NULL (user deleted), show 'System' instead of NULL
    COALESCE(p.first_name, 'System')     AS invited_by_first_name,
    COALESCE(p.last_name_1, '')          AS invited_by_last_name_1,
    COALESCE(p.financial_username, '')   AS invited_by_username,
    fi.role,
    fi.expires_at,
    fi.created_at
  FROM public.family_invitations fi
  JOIN public.families f ON fi.family_id = f.id
  -- Changed from JOIN to LEFT JOIN to handle NULL invited_by
  LEFT JOIN public.profiles p ON fi.invited_by = p.id
  WHERE fi.invited_user_id = auth.uid()
    AND fi.accepted_at     IS NULL
    AND fi.expires_at      > now()
  ORDER BY fi.created_at DESC;
END;
$$;

COMMENT ON CONSTRAINT family_invitations_invited_by_fkey ON public.family_invitations IS
  'ON DELETE SET NULL: When inviter account is deleted, invitation remains but shows "System" as inviter.';

-- Verification query (run this after migration to check):
-- SELECT id, invited_by, email FROM public.family_invitations WHERE invited_by IS NULL;
