
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  monthly_savings_target NUMERIC(12,2) NOT NULL DEFAULT 0,
  priorities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'wallet',
  color TEXT NOT NULL DEFAULT 'mint',
  kind TEXT NOT NULL DEFAULT 'variable',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cats" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT true,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own incomes" ON public.incomes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variable',
  recurring BOOLEAN NOT NULL DEFAULT false,
  spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX expenses_user_date_idx ON public.expenses(user_id, spent_at DESC);

CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.savings_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recs" ON public.recommendations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS health_score numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"alerts":true,"weekly":true,"insights":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light';

CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'stock',
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

CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  due_day int NOT NULL DEFAULT 1,
  category text,
  paid_this_month boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bills" ON public.bills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "leave family" ON public.family_members
  FOR DELETE USING (auth.uid() = user_id);

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
CREATE POLICY "own contribs" ON public.goal_contributions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contribs_goal ON public.goal_contributions(goal_id, contributed_at DESC);

ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.investment_history
  ADD CONSTRAINT investment_history_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bills
  ADD CONSTRAINT bills_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.families
  ADD CONSTRAINT families_owner_fk FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_goal_fk FOREIGN KEY (goal_id) REFERENCES public.savings_goals(id) ON DELETE CASCADE;
ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);
ALTER TABLE public.incomes ADD CONSTRAINT incomes_amount_positive CHECK (amount > 0);
ALTER TABLE public.bills ADD CONSTRAINT bills_amount_positive CHECK (amount > 0);
ALTER TABLE public.goal_contributions ADD CONSTRAINT contributions_amount_positive CHECK (amount > 0);
ALTER TABLE public.savings_goals ADD CONSTRAINT goals_target_positive CHECK (target_amount > 0);
ALTER TABLE public.savings_goals ADD CONSTRAINT goals_current_nonneg CHECK (current_amount >= 0);
ALTER TABLE public.savings_goals ADD CONSTRAINT goals_monthly_nonneg CHECK (monthly_contribution >= 0);
ALTER TABLE public.investments ADD CONSTRAINT investments_quantity_nonneg CHECK (quantity >= 0);
ALTER TABLE public.investments ADD CONSTRAINT investments_avg_cost_nonneg CHECK (avg_cost >= 0);
ALTER TABLE public.investments ADD CONSTRAINT investments_price_nonneg CHECK (current_price >= 0);
ALTER TABLE public.investment_history ADD CONSTRAINT inv_history_value_nonneg CHECK (value >= 0);
ALTER TABLE public.shared_goals ADD CONSTRAINT shared_goals_target_positive CHECK (target_amount > 0);
ALTER TABLE public.shared_goals ADD CONSTRAINT shared_goals_current_nonneg CHECK (current_amount >= 0);
ALTER TABLE public.bills ADD CONSTRAINT bills_due_day_valid CHECK (due_day BETWEEN 1 AND 31);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_kind_valid CHECK (kind IN ('fixed', 'variable'));
ALTER TABLE public.categories ADD CONSTRAINT categories_kind_valid CHECK (kind IN ('fixed', 'variable', 'income'));
ALTER TABLE public.investments ADD CONSTRAINT investments_type_valid CHECK (type IN ('stock', 'etf', 'crypto', 'savings', 'other'));
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_severity_valid CHECK (severity IN ('info', 'success', 'warning'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_valid CHECK (theme IN ('light', 'dark'));
ALTER TABLE public.savings_goals ADD CONSTRAINT goals_priority_valid CHECK (priority IN ('high', 'medium', 'low'));
ALTER TABLE public.family_members ADD CONSTRAINT family_members_role_valid CHECK (role IN ('owner', 'member', 'child'));

CREATE INDEX IF NOT EXISTS idx_incomes_user ON public.incomes(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_user ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user ON public.investments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investment_history_user ON public.investment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user ON public.goal_contributions(user_id, contributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON public.recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_families_owner ON public.families(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);

CREATE OR REPLACE FUNCTION public.is_family_owner(_user_id uuid, _family_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.families WHERE id = _family_id AND owner_id = _user_id);
$$;
REVOKE ALL ON FUNCTION public.is_family_owner FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_owner TO authenticated;

CREATE POLICY "owner adds members" ON public.family_members
  FOR INSERT WITH CHECK (public.is_family_owner(auth.uid(), family_id));
CREATE POLICY "owner updates members" ON public.family_members
  FOR UPDATE USING (public.is_family_owner(auth.uid(), family_id))
  WITH CHECK (public.is_family_owner(auth.uid(), family_id));

CREATE POLICY "members insert shared goals" ON public.shared_goals
  FOR INSERT WITH CHECK (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "members update shared goals" ON public.shared_goals
  FOR UPDATE USING (public.is_family_member(auth.uid(), family_id))
  WITH CHECK (public.is_family_member(auth.uid(), family_id));
CREATE POLICY "owner deletes shared goals" ON public.shared_goals
  FOR DELETE USING (public.is_family_owner(auth.uid(), family_id));

CREATE TABLE IF NOT EXISTS public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  email text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'child')),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations
  ADD CONSTRAINT family_invitations_family_user_unique UNIQUE (family_id, invited_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.family_invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_family ON public.family_invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_user ON public.family_invitations (invited_user_id) WHERE accepted_at IS NULL;

CREATE POLICY "owner manages invitations" ON public.family_invitations
  FOR ALL USING (public.is_family_owner(auth.uid(), family_id))
  WITH CHECK (public.is_family_owner(auth.uid(), family_id));
CREATE POLICY "invitee views own invitations" ON public.family_invitations
  FOR SELECT USING (invited_user_id = auth.uid() AND accepted_at IS NULL AND expires_at > now());

CREATE OR REPLACE FUNCTION public.add_goal_contribution(
  p_user_id uuid, p_goal_id uuid, p_amount numeric, p_note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_goal_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.savings_goals WHERE id = p_goal_id AND user_id = p_user_id) INTO v_goal_exists;
  IF NOT v_goal_exists THEN RAISE EXCEPTION 'Goal not found or access denied'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Contribution amount must be positive'; END IF;
  INSERT INTO public.goal_contributions (user_id, goal_id, amount, note) VALUES (p_user_id, p_goal_id, p_amount, p_note);
  UPDATE public.savings_goals SET current_amount = current_amount + p_amount WHERE id = p_goal_id AND user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_goal_contribution FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_goal_contribution TO authenticated;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  row_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit events" ON public.audit_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "no direct insert" ON public.audit_events FOR INSERT WITH CHECK (false);
CREATE POLICY "no direct update" ON public.audit_events FOR UPDATE USING (false);
CREATE POLICY "no direct delete" ON public.audit_events FOR DELETE USING (false);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON public.audit_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_financial_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_events (user_id, action, table_name, row_id, old_data, new_data)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_financial_change FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();
CREATE TRIGGER audit_incomes AFTER INSERT OR UPDATE OR DELETE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();
CREATE TRIGGER audit_bills AFTER INSERT OR UPDATE OR DELETE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();
CREATE TRIGGER audit_savings_goals AFTER INSERT OR UPDATE OR DELETE ON public.savings_goals FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();
CREATE TRIGGER audit_goal_contributions AFTER INSERT OR UPDATE OR DELETE ON public.goal_contributions FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();
CREATE TRIGGER audit_investments AFTER INSERT OR UPDATE OR DELETE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name_1 TEXT,
  ADD COLUMN IF NOT EXISTS last_name_2 TEXT,
  ADD COLUMN IF NOT EXISTS financial_username TEXT;

CREATE OR REPLACE FUNCTION public.generate_financial_username(p_first_name text, p_last_name_1 text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base text; v_candidate text; v_counter integer := 0;
BEGIN
  v_base := regexp_replace(unaccent(lower(trim(p_first_name))), '[^a-z0-9]', '', 'g')
    || '.' || regexp_replace(regexp_replace(unaccent(lower(trim(p_last_name_1))), '\s+', '', 'g'), '[^a-z0-9]', '', 'g');
  IF length(replace(v_base, '.', '')) < 2 THEN
    v_base := 'user.' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  v_candidate := v_base;
  LOOP
    PERFORM pg_advisory_xact_lock(('x' || substr(md5(v_candidate), 1, 15))::bit(60)::bigint);
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE financial_username = v_candidate) THEN
      RETURN v_candidate;
    END IF;
    v_counter := v_counter + 1;
    v_candidate := v_base || v_counter::text;
    IF v_counter > 9999 THEN
      RETURN v_base || '_' || substr(gen_random_uuid()::text, 1, 6);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_financial_username FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_first_name text; v_last_name_1 text; v_last_name_2 text; v_username text; v_full_name text;
BEGIN
  v_first_name := trim(COALESCE(NEW.raw_user_meta_data->>'first_name',
    split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1),
    split_part(NEW.email, '@', 1)));
  v_last_name_1 := trim(COALESCE(NEW.raw_user_meta_data->>'last_name_1',
    NULLIF(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2), ''),
    'User'));
  v_last_name_2 := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name_2', '')), '');
  v_full_name := trim(v_first_name || ' ' || v_last_name_1 || COALESCE(' ' || v_last_name_2, ''));
  v_username := public.generate_financial_username(v_first_name, v_last_name_1);
  INSERT INTO public.profiles (id, first_name, last_name_1, last_name_2, financial_username, full_name)
  VALUES (NEW.id, v_first_name, v_last_name_1, v_last_name_2, v_username, v_full_name);
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name_1 SET NOT NULL,
  ALTER COLUMN financial_username SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_financial_username_unique UNIQUE (financial_username);
CREATE INDEX IF NOT EXISTS idx_profiles_financial_username ON public.profiles (lower(financial_username));

CREATE OR REPLACE FUNCTION public.find_user_by_username(p_username text)
RETURNS TABLE(id uuid, first_name text, last_name_1 text, financial_username text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY SELECT p.id, p.first_name, p.last_name_1, p.financial_username
    FROM public.profiles p
    WHERE p.financial_username = lower(trim(p_username)) AND p.id <> auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.find_user_by_username FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_user_by_username TO authenticated;

CREATE OR REPLACE FUNCTION public.send_family_invite(p_family_id uuid, p_username text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invited_id uuid; v_invited_email text; v_invitation_id uuid;
BEGIN
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Only the family owner can send invitations'; END IF;
  SELECT p.id INTO v_invited_id FROM public.profiles p WHERE p.financial_username = lower(trim(p_username));
  IF v_invited_id IS NULL THEN RAISE EXCEPTION 'User not found: %', p_username USING ERRCODE = 'no_data_found'; END IF;
  IF v_invited_id = auth.uid() THEN RAISE EXCEPTION 'Cannot invite yourself'; END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE family_id = p_family_id AND user_id = v_invited_id) THEN
    RAISE EXCEPTION 'User is already a member of this family'; END IF;
  SELECT email INTO v_invited_email FROM auth.users WHERE id = v_invited_id;
  INSERT INTO public.family_invitations (family_id, invited_by, invited_user_id, email, role)
  VALUES (p_family_id, auth.uid(), v_invited_id, v_invited_email, 'member')
  ON CONFLICT (family_id, invited_user_id) DO UPDATE
    SET expires_at = now() + INTERVAL '7 days', token = gen_random_uuid()
  RETURNING id INTO v_invitation_id;
  RETURN v_invitation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_family_invite FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_family_invite TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_family_invite(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite RECORD;
BEGIN
  SELECT * INTO v_invite FROM public.family_invitations
    WHERE id = p_invitation_id AND invited_user_id = auth.uid() AND accepted_at IS NULL AND expires_at > now() FOR UPDATE;
  IF v_invite IS NULL THEN RAISE EXCEPTION 'Invitation not found, already accepted, or expired' USING ERRCODE = 'no_data_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND family_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already belong to a family. Leave it before accepting a new invitation.'; END IF;
  INSERT INTO public.family_members (family_id, user_id, role) VALUES (v_invite.family_id, auth.uid(), v_invite.role)
    ON CONFLICT (family_id, user_id) DO NOTHING;
  UPDATE public.profiles SET family_id = v_invite.family_id WHERE id = auth.uid();
  UPDATE public.family_invitations SET accepted_at = now() WHERE id = p_invitation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_family_invite FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_family_invite TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_family_invite(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.family_invitations WHERE id = p_invitation_id AND accepted_at IS NULL
    AND (invited_user_id = auth.uid() OR public.is_family_owner(auth.uid(), family_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found or already accepted' USING ERRCODE = 'no_data_found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_family_invite FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_family_invite TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_invitations()
RETURNS TABLE(id uuid, family_id uuid, family_name text, invited_by_first_name text, invited_by_last_name_1 text,
  invited_by_username text, role text, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY SELECT fi.id, fi.family_id, f.name, p.first_name, p.last_name_1, p.financial_username,
    fi.role, fi.expires_at, fi.created_at
    FROM public.family_invitations fi
    JOIN public.families f ON fi.family_id = f.id
    JOIN public.profiles p ON fi.invited_by = p.id
    WHERE fi.invited_user_id = auth.uid() AND fi.accepted_at IS NULL AND fi.expires_at > now()
    ORDER BY fi.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_invitations FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_invitations TO authenticated;

CREATE OR REPLACE FUNCTION public.get_family_sent_invitations(p_family_id uuid)
RETURNS TABLE(id uuid, invited_user_id uuid, invited_first_name text, invited_last_name_1 text,
  invited_username text, role text, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT fi.id, fi.invited_user_id, p.first_name, p.last_name_1, p.financial_username,
    fi.role, fi.expires_at, fi.created_at
    FROM public.family_invitations fi
    JOIN public.profiles p ON fi.invited_user_id = p.id
    WHERE fi.family_id = p_family_id AND fi.accepted_at IS NULL AND fi.expires_at > now()
    ORDER BY fi.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_family_sent_invitations FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_family_sent_invitations TO authenticated;
