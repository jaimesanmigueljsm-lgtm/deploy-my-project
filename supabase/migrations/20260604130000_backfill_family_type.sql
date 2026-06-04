-- =============================================================================
-- Backfill family type column (P4 fix)
-- 2026-06-04
--
-- Issue: Migration 20260602200000 added 'type' column to families,
-- but existing families created before that migration have NULL type.
-- Queries filtering by type (e.g., WHERE type = 'expense') may exclude old families.
--
-- Solution: Backfill all NULL types with 'expense' (the default for existing families).
-- Then add NOT NULL constraint to prevent future NULL values.
-- =============================================================================

-- Backfill: set all NULL types to 'expense' (existing families were expense-focused)
UPDATE public.families
SET type = 'expense'
WHERE type IS NULL;

-- Add NOT NULL constraint to prevent future NULL values
ALTER TABLE public.families
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'expense';

-- Add CHECK constraint to ensure valid types
ALTER TABLE public.families
  DROP CONSTRAINT IF EXISTS families_type_check,
  ADD CONSTRAINT families_type_check
    CHECK (type IN ('expense', 'goals'));

COMMENT ON COLUMN public.families.type IS
  'Family type: expense (shared expense groups) or goals (shared savings goals groups). Defaults to expense for backwards compatibility.';
