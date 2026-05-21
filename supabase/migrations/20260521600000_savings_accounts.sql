-- ─── Savings Accounts ────────────────────────────────────────────────────────
-- Stores manually-declared savings balances so the engine can compute:
--   • Emergency fund coverage (is_emergency_fund = true accounts)
--   • Total savings balance
--   • Net worth (savings + investments)

CREATE TABLE public.savings_accounts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  type              TEXT        NOT NULL DEFAULT 'savings'
                                CHECK (type IN ('checking','savings','cash','emergency','other')),
  balance           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency          TEXT        NOT NULL DEFAULT 'EUR',
  institution_name  TEXT,
  is_emergency_fund BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-level security: users only see / touch their own accounts
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_accounts_own"
  ON public.savings_accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_savings_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER savings_accounts_updated_at
  BEFORE UPDATE ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_savings_accounts_updated_at();
