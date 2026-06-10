-- =============================================================================
-- Fix shared_expenses RLS policy to allow registering expenses paid by others
-- 2026-06-10
--
-- PROBLEM: UI allows selecting any group member as payer, but RLS policy
-- requires paid_by = auth.uid(), causing "violates row-level security" errors.
--
-- SOLUTION: Allow any group member to register expenses, as long as both
-- the user registering AND the payer are members of the family.
-- =============================================================================

DROP POLICY IF EXISTS "Members can insert shared expenses" ON public.shared_expenses;

CREATE POLICY "Members can insert shared expenses"
  ON public.shared_expenses FOR INSERT
  WITH CHECK (
    -- User registering the expense must be a member
    public.is_family_member(auth.uid(), family_id)
    -- Payer must also be a member of the same family
    AND public.is_family_member(paid_by, family_id)
  );

-- Comment for documentation
COMMENT ON POLICY "Members can insert shared expenses" ON public.shared_expenses IS
  'Allows any family member to register expenses on behalf of other members, as long as the payer is also a member';
