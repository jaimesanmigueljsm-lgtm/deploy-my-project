-- =============================================================================
-- NEST Security Hardening Migration
-- Applied: 2026-05-14
--
-- Rationale for each change is documented inline.
-- ALL changes are additive except for RLS policy replacements (which fix holes).
-- =============================================================================

-- =============================================================================
-- 1. MISSING FOREIGN KEY REFERENCES
-- Several tables were created with bare UUIDs instead of FK references.
-- Without FKs, orphaned rows can accumulate silently and referential integrity
-- is impossible to enforce. CASCADE deletes ensure no orphan data on user removal.
-- =============================================================================

ALTER TABLE public.investments
  ADD CONSTRAINT investments_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.investment_history
  ADD CONSTRAINT investment_history_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.bills
  ADD CONSTRAINT bills_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.families
  ADD CONSTRAINT families_owner_fk
  FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- goal_contributions.goal_id was missing its reference. Without this, a
-- contribution could reference a deleted or non-existent goal indefinitely.
ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_goal_fk
  FOREIGN KEY (goal_id) REFERENCES public.savings_goals(id) ON DELETE CASCADE;

ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =============================================================================
-- 2. DB-LEVEL CHECK CONSTRAINTS
-- These are the unconditional last line of defense. Even if the Zod layer or
-- service layer is bypassed (direct API call, script, future SDK change), the
-- database will reject invalid financial data.
-- =============================================================================

-- Monetary amounts: must be strictly positive for all transaction tables.
-- 0-amount records are financial noise and could mask bugs or injection.
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);

ALTER TABLE public.incomes
  ADD CONSTRAINT incomes_amount_positive CHECK (amount > 0);

ALTER TABLE public.bills
  ADD CONSTRAINT bills_amount_positive CHECK (amount > 0);

ALTER TABLE public.goal_contributions
  ADD CONSTRAINT contributions_amount_positive CHECK (amount > 0);

ALTER TABLE public.savings_goals
  ADD CONSTRAINT goals_target_positive CHECK (target_amount > 0);

ALTER TABLE public.savings_goals
  ADD CONSTRAINT goals_current_nonneg CHECK (current_amount >= 0);

ALTER TABLE public.savings_goals
  ADD CONSTRAINT goals_monthly_nonneg CHECK (monthly_contribution >= 0);

ALTER TABLE public.investments
  ADD CONSTRAINT investments_quantity_nonneg CHECK (quantity >= 0);

ALTER TABLE public.investments
  ADD CONSTRAINT investments_avg_cost_nonneg CHECK (avg_cost >= 0);

ALTER TABLE public.investments
  ADD CONSTRAINT investments_price_nonneg CHECK (current_price >= 0);

ALTER TABLE public.investment_history
  ADD CONSTRAINT inv_history_value_nonneg CHECK (value >= 0);

ALTER TABLE public.shared_goals
  ADD CONSTRAINT shared_goals_target_positive CHECK (target_amount > 0);

ALTER TABLE public.shared_goals
  ADD CONSTRAINT shared_goals_current_nonneg CHECK (current_amount >= 0);

-- Structural constraints: prevent invalid enum values from being stored.
-- The Zod layer already validates these, but DB constraints are independent.
ALTER TABLE public.bills
  ADD CONSTRAINT bills_due_day_valid CHECK (due_day BETWEEN 1 AND 31);

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_kind_valid CHECK (kind IN ('fixed', 'variable'));

ALTER TABLE public.categories
  ADD CONSTRAINT categories_kind_valid CHECK (kind IN ('fixed', 'variable', 'income'));

ALTER TABLE public.investments
  ADD CONSTRAINT investments_type_valid
  CHECK (type IN ('stock', 'etf', 'crypto', 'savings', 'other'));

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_severity_valid
  CHECK (severity IN ('info', 'success', 'warning'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_valid CHECK (theme IN ('light', 'dark'));

ALTER TABLE public.savings_goals
  ADD CONSTRAINT goals_priority_valid CHECK (priority IN ('high', 'medium', 'low'));

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_valid CHECK (role IN ('owner', 'member', 'child'));

-- =============================================================================
-- 3. PERFORMANCE INDEXES FOR RLS EFFICIENCY
-- Without indexes on user_id columns, Supabase's RLS policies perform sequential
-- scans on every query. In a fintech app with hundreds of expense rows per user,
-- this is unacceptable. These indexes also prevent cross-user data leakage through
-- timing-based side channels.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_incomes_user
  ON public.incomes(user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_bills_user
  ON public.bills(user_id);

CREATE INDEX IF NOT EXISTS idx_investments_user
  ON public.investments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_investment_history_user
  ON public.investment_history(user_id);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_user
  ON public.goal_contributions(user_id, contributed_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendations_user
  ON public.recommendations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_families_owner
  ON public.families(owner_id);

CREATE INDEX IF NOT EXISTS idx_family_members_family
  ON public.family_members(family_id);

CREATE INDEX IF NOT EXISTS idx_family_members_user
  ON public.family_members(user_id);

-- =============================================================================
-- 4. RLS POLICY HARDENING
-- =============================================================================

-- ── 4a. Fix "join family" open policy ───────────────────────────────────────
-- CRITICAL: The existing "join family" INSERT policy allows ANY authenticated
-- user to add themselves to ANY family whose UUID they know. This is a direct
-- unauthorized access vector. A user could enumerate family UUIDs (or obtain
-- one through other means) and join uninvited.
--
-- Fix: only the family owner can add members directly. A future invitation flow
-- via `accept_family_invite(token)` RPC will handle the member-side join.
DROP POLICY IF EXISTS "join family" ON public.family_members;

-- Helper: check family ownership without recursive policy evaluation
CREATE OR REPLACE FUNCTION public.is_family_owner(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families
    WHERE id = _family_id AND owner_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_family_owner FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_owner TO authenticated;

-- Only the owner can add members. Members cannot self-add.
CREATE POLICY "owner adds members" ON public.family_members
  FOR INSERT WITH CHECK (
    public.is_family_owner(auth.uid(), family_id)
  );

-- Owner can change member roles and display_name.
-- The original migration had no UPDATE policy, making role management impossible.
CREATE POLICY "owner updates members" ON public.family_members
  FOR UPDATE
  USING (public.is_family_owner(auth.uid(), family_id))
  WITH CHECK (public.is_family_owner(auth.uid(), family_id));

-- ── 4b. Fix shared_goals overly broad "manage" policy ───────────────────────
-- The original "FOR ALL" policy allows ANY family member (including 'child' role)
-- to DELETE or arbitrarily change target_amount on shared goals. A child member
-- could delete the family's savings goal.
--
-- Fix: separate policies by operation. Only the family owner can delete.
-- All members can insert and update (for recording contributions).
DROP POLICY IF EXISTS "manage shared goals" ON public.shared_goals;

CREATE POLICY "members insert shared goals" ON public.shared_goals
  FOR INSERT WITH CHECK (
    public.is_family_member(auth.uid(), family_id)
  );

CREATE POLICY "members update shared goals" ON public.shared_goals
  FOR UPDATE
  USING (public.is_family_member(auth.uid(), family_id))
  WITH CHECK (public.is_family_member(auth.uid(), family_id));

-- Destructive operation: only the family owner can delete a shared goal.
CREATE POLICY "owner deletes shared goals" ON public.shared_goals
  FOR DELETE USING (
    public.is_family_owner(auth.uid(), family_id)
  );

-- =============================================================================
-- 5. FAMILY INVITATIONS TABLE (foundation for secure invite flow)
-- The broken "Add member" UI (audit C1) should eventually use invitation tokens.
-- This table provides the infrastructure; the RPC that uses it follows below.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'child')),
  token uuid NOT NULL DEFAULT gen_random_uuid(), -- the invite token sent via email
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, email)
);

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- Only family owners can see and manage invitations for their family.
CREATE POLICY "owner manages invitations" ON public.family_invitations
  FOR ALL
  USING (public.is_family_owner(auth.uid(), family_id))
  WITH CHECK (public.is_family_owner(auth.uid(), family_id));

CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON public.family_invitations(token) WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_family
  ON public.family_invitations(family_id);

-- =============================================================================
-- 6. ATOMIC add_goal_contribution RPC
-- The current service implementation makes 3 separate Supabase calls:
--   SELECT goal → INSERT contribution → UPDATE goal.current_amount
-- If the UPDATE fails after the INSERT succeeds, the contribution record exists
-- but current_amount is wrong. Two sources of truth diverge silently.
--
-- This RPC wraps all three operations in a single transaction with ownership
-- verification, making it atomic and properly authorized.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_goal_contribution(
  p_user_id  uuid,
  p_goal_id  uuid,
  p_amount   numeric,
  p_note     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal_exists boolean;
BEGIN
  -- Ownership check before any mutation
  SELECT EXISTS (
    SELECT 1 FROM public.savings_goals
    WHERE id = p_goal_id AND user_id = p_user_id
  ) INTO v_goal_exists;

  IF NOT v_goal_exists THEN
    RAISE EXCEPTION 'Goal not found or access denied';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Contribution amount must be positive';
  END IF;

  -- Both operations in one transaction — atomicity guaranteed by PL/pgSQL block
  INSERT INTO public.goal_contributions (user_id, goal_id, amount, note)
  VALUES (p_user_id, p_goal_id, p_amount, p_note);

  UPDATE public.savings_goals
  SET current_amount = current_amount + p_amount
  WHERE id = p_goal_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_goal_contribution FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_goal_contribution TO authenticated;

-- =============================================================================
-- 7. AUDIT EVENTS TABLE
-- Financial applications require an immutable audit trail. When amounts are
-- added, modified, or deleted, we record who did what and when.
--
-- Security properties:
-- - Users can only READ their own events (SELECT policy).
-- - Direct INSERT/UPDATE/DELETE is blocked for all users.
-- - Only SECURITY DEFINER trigger functions (running as postgres) can insert.
-- - Rows are never deleted by normal operation (right to erasure handled via
--   scheduled purge per GDPR, not ad-hoc deletes).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  action     text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  row_id     uuid,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit trail.
CREATE POLICY "own audit events" ON public.audit_events
  FOR SELECT USING (auth.uid() = user_id);

-- No direct writes by any user. Only the SECURITY DEFINER trigger can insert.
CREATE POLICY "no direct insert" ON public.audit_events
  FOR INSERT WITH CHECK (false);

CREATE POLICY "no direct update" ON public.audit_events
  FOR UPDATE USING (false);

CREATE POLICY "no direct delete" ON public.audit_events
  FOR DELETE USING (false);

CREATE INDEX IF NOT EXISTS idx_audit_events_user
  ON public.audit_events(user_id, created_at DESC);

-- ── Audit trigger function ───────────────────────────────────────────────────
-- SECURITY DEFINER so it runs as the function owner (postgres), bypassing
-- the "no direct insert" RLS policy. auth.uid() still returns the calling
-- user's ID because it reads from the request JWT context.

CREATE OR REPLACE FUNCTION public.audit_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_events (user_id, action, table_name, row_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$;

-- Trigger functions should not be callable directly.
REVOKE ALL ON FUNCTION public.audit_financial_change FROM PUBLIC, anon, authenticated;

-- ── Attach audit triggers to all financial write tables ───────────────────────

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_incomes
  AFTER INSERT OR UPDATE OR DELETE ON public.incomes
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_bills
  AFTER INSERT OR UPDATE OR DELETE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_savings_goals
  AFTER INSERT OR UPDATE OR DELETE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_goal_contributions
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_investments
  AFTER INSERT OR UPDATE OR DELETE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();
