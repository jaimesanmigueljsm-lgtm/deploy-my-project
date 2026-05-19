
-- ===== profiles enrichment =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS health_score numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"alerts":true,"weekly":true,"insights":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light';

-- ===== investments =====
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'stock', -- stock | etf | crypto | savings | other
  ticker text,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  current_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  notes text,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments" ON public.investments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== investment history =====
CREATE TABLE IF NOT EXISTS public.investment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investment history" ON public.investment_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_inv_hist_inv ON public.investment_history(investment_id, date);

-- ===== bills =====
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  due_day int NOT NULL DEFAULT 1, -- day of month
  category text,
  paid_this_month boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bills" ON public.bills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== families =====
CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- ===== family_members =====
CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'member', -- owner | member | child
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive policies
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id
  );
$$;

CREATE POLICY "view own families" ON public.families
  FOR SELECT USING (auth.uid() = owner_id OR public.is_family_member(auth.uid(), id));
CREATE POLICY "create own family" ON public.families
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "update own family" ON public.families
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "delete own family" ON public.families
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "view family members" ON public.family_members
  FOR SELECT USING (auth.uid() = user_id OR public.is_family_member(auth.uid(), family_id));
CREATE POLICY "join family" ON public.family_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave family" ON public.family_members
  FOR DELETE USING (auth.uid() = user_id);

-- ===== shared_goals =====
CREATE TABLE IF NOT EXISTS public.shared_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view shared goals" ON public.shared_goals
  FOR SELECT USING (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "manage shared goals" ON public.shared_goals
  FOR ALL USING (public.is_family_member(auth.uid(), family_id))
  WITH CHECK (public.is_family_member(auth.uid(), family_id));
