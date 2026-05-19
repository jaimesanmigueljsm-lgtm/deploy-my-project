
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS monthly_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'target',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'mint';

CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL,
  amount numeric NOT NULL,
  note text,
  contributed_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own contribs" ON public.goal_contributions;
CREATE POLICY "own contribs" ON public.goal_contributions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goal_contribs_goal ON public.goal_contributions(goal_id, contributed_at DESC);
