-- =============================================================================
-- Clean up orphaned shared expenses
-- 2026-06-10
--
-- PROBLEM: Due to the RLS policy mismatch, expenses were created without
-- participants. These "orphaned" expenses don't contribute to balance
-- calculations (skipped when participants.length === 0) and cause confusion.
--
-- SOLUTION: Delete all expenses that have zero participants.
-- Users will need to re-create them properly with the fixed RLS policies.
-- =============================================================================

-- Delete orphaned expenses (those with zero participants)
DELETE FROM public.shared_expenses
WHERE id IN (
  SELECT se.id
  FROM public.shared_expenses se
  LEFT JOIN public.shared_expense_participants sep ON se.id = sep.expense_id
  WHERE sep.expense_id IS NULL
);

-- Log the cleanup result
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % orphaned expense(s) with no participants', deleted_count;
  ELSE
    RAISE NOTICE 'No orphaned expenses found - database is clean';
  END IF;
END $$;

-- Verify cleanup
DO $$
DECLARE
  remaining_orphaned INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO remaining_orphaned
  FROM public.shared_expenses se
  LEFT JOIN public.shared_expense_participants sep ON se.id = sep.expense_id
  WHERE sep.expense_id IS NULL;

  IF remaining_orphaned > 0 THEN
    RAISE WARNING 'Still have % orphaned expenses remaining', remaining_orphaned;
  END IF;
END $$;
