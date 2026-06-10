-- =============================================================================
-- Fix shared_expense_participants RLS policies
-- 2026-06-10
--
-- PROBLEM: The INSERT policy for participants still required paid_by = auth.uid(),
-- but we fixed shared_expenses to allow any member to register expenses for others.
-- This mismatch caused participants to fail inserting, leaving orphaned expenses.
--
-- ADDITIONAL ISSUES:
-- - No DELETE policy for participants (blocks cleanup)
-- - DELETE policy for expenses only allows payer (not registrar)
--
-- SOLUTION: Make all policies consistent - any family member can manage expenses
-- =============================================================================

-- ─── Fix INSERT policy for participants ───────────────────────────────────────

DROP POLICY IF EXISTS "Expense payer can add participants" ON public.shared_expense_participants;

CREATE POLICY "Family members can add participants"
  ON public.shared_expense_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = expense_id
        AND public.is_family_member(auth.uid(), se.family_id)
    )
  );

COMMENT ON POLICY "Family members can add participants" ON public.shared_expense_participants IS
  'Allows any family member to add participants when creating an expense, matching the shared_expenses INSERT policy';

-- ─── Add DELETE policy for participants ───────────────────────────────────────

CREATE POLICY "Family members can delete participants"
  ON public.shared_expense_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = expense_id
        AND public.is_family_member(auth.uid(), se.family_id)
    )
  );

COMMENT ON POLICY "Family members can delete participants" ON public.shared_expense_participants IS
  'Allows any family member to remove participants (e.g., for cleanup or corrections)';

-- ─── Fix DELETE policy for expenses ───────────────────────────────────────────

DROP POLICY IF EXISTS "Payer can delete own expense" ON public.shared_expenses;

CREATE POLICY "Family members can delete expenses"
  ON public.shared_expenses FOR DELETE
  USING (public.is_family_member(auth.uid(), family_id));

COMMENT ON POLICY "Family members can delete expenses" ON public.shared_expenses IS
  'Allows any family member to delete expenses, not just the payer (since anyone can register expenses on behalf of others)';
