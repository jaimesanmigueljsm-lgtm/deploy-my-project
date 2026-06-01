-- =============================================================================
-- Sprint 1 — Shared expenses + participants
-- 2026-06-01
--
-- Creates two new tables:
--   shared_expenses           — one row per group expense
--   shared_expense_participants — relational split list (one row per person)
--
-- Balance calculations remain entirely in TypeScript (no DB triggers).
-- =============================================================================

-- shared_expenses
CREATE TABLE IF NOT EXISTS public.shared_expenses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  paid_by     uuid        NOT NULL REFERENCES auth.users(id),
  description text        NOT NULL,
  amount      numeric     NOT NULL CONSTRAINT shared_expenses_amount_positive CHECK (amount > 0),
  category    text        NULL,
  notes       text        NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_expenses_family
  ON public.shared_expenses (family_id, created_at DESC);

-- shared_expense_participants
CREATE TABLE IF NOT EXISTS public.shared_expense_participants (
  expense_id  uuid NOT NULL REFERENCES public.shared_expenses(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_expense_participants_expense
  ON public.shared_expense_participants (expense_id);

CREATE INDEX IF NOT EXISTS idx_shared_expense_participants_user
  ON public.shared_expense_participants (user_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expense_participants ENABLE ROW LEVEL SECURITY;

-- shared_expenses policies
DROP POLICY IF EXISTS "Members can view family shared expenses" ON public.shared_expenses;
CREATE POLICY "Members can view family shared expenses"
  ON public.shared_expenses FOR SELECT
  USING (public.is_family_member(auth.uid(), family_id));

DROP POLICY IF EXISTS "Members can insert shared expenses" ON public.shared_expenses;
CREATE POLICY "Members can insert shared expenses"
  ON public.shared_expenses FOR INSERT
  WITH CHECK (
    public.is_family_member(auth.uid(), family_id)
    AND paid_by = auth.uid()
  );

DROP POLICY IF EXISTS "Payer can delete own expense" ON public.shared_expenses;
CREATE POLICY "Payer can delete own expense"
  ON public.shared_expenses FOR DELETE
  USING (paid_by = auth.uid());

-- shared_expense_participants policies
DROP POLICY IF EXISTS "Family members can view expense participants" ON public.shared_expense_participants;
CREATE POLICY "Family members can view expense participants"
  ON public.shared_expense_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = expense_id
        AND public.is_family_member(auth.uid(), se.family_id)
    )
  );

DROP POLICY IF EXISTS "Expense payer can add participants" ON public.shared_expense_participants;
CREATE POLICY "Expense payer can add participants"
  ON public.shared_expense_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_expenses se
      WHERE se.id = expense_id
        AND se.paid_by = auth.uid()
    )
  );

-- =============================================================================
-- Realtime — reuse existing nest-fam-{familyId} channel pattern
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'shared_expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_expenses;
  END IF;
END;
$$;
