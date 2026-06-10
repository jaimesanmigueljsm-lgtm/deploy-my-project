-- =============================================================================
-- Add spent_at column to shared_expenses
-- 2026-06-10
--
-- The application code expects this field but it was missing from the original
-- migration. This aligns shared_expenses with the personal expenses table.
-- =============================================================================

-- Add spent_at column (date of the actual expense, vs created_at = date registered)
ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS spent_at timestamptz NOT NULL DEFAULT now();

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_shared_expenses_spent_at
  ON public.shared_expenses (family_id, spent_at DESC);

-- Comment for documentation
COMMENT ON COLUMN public.shared_expenses.spent_at IS
  'Fecha real en que se realizó el gasto (puede ser anterior al registro)';
