-- =============================================================================
-- NEST Identity & Family Architecture Migration
-- Applied: 2026-05-14
--
-- This migration implements:
--   1. Structured name identity (first_name, last_name_1, last_name_2)
--   2. Auto-generated, unique, race-condition-safe financial_username
--   3. Username search RPC (SECURITY DEFINER — exposes only minimum fields)
--   4. Invitation-based family linking (replaces manual member addition)
--   5. Accept / reject RPC functions (atomic, properly authorized)
--
-- Design decisions:
--   · financial_username lives on profiles (not a separate identity table) so
--     every query that needs name+username is a single table scan.
--   · Username generation is 100% server-side (PostgreSQL function + trigger).
--     The frontend can show a preview using the same normalisation rules but
--     the DB is the authoritative source and handles collision resolution.
--   · Advisory locks (pg_advisory_xact_lock) prevent the same candidate
--     username being assigned to two concurrent signups.  The UNIQUE
--     constraint is the unconditional last line of defence.
--   · All cross-user data access goes through SECURITY DEFINER RPCs that
--     return only the minimum fields needed.  Direct profile reads still
--     only return the requesting user's own row.
-- =============================================================================


-- =============================================================================
-- 0. PREREQUISITES
-- =============================================================================

-- unaccent strips diacritics (á → a, ñ → n, etc.) without locale tables.
-- Available in Supabase by default.
CREATE EXTENSION IF NOT EXISTS unaccent;


-- =============================================================================
-- 1. PROFILE IDENTITY COLUMNS
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name    TEXT,
  ADD COLUMN IF NOT EXISTS last_name_1   TEXT,
  ADD COLUMN IF NOT EXISTS last_name_2   TEXT,   -- optional: not everyone has two surnames
  ADD COLUMN IF NOT EXISTS financial_username TEXT;


-- =============================================================================
-- 2. USERNAME GENERATION FUNCTION
-- =============================================================================
-- Inputs  : first_name, last_name_1 (raw user input from signup metadata)
-- Output  : a unique lowercase slug like "jaime.sanmiguel" or "jaime.sanmiguel2"
--
-- Race-condition safety:
--   pg_advisory_xact_lock(hashtext(candidate)) serialises concurrent attempts
--   to claim the same candidate username within a transaction.  Two concurrent
--   signups for "Jaime Sánchez" will serialize: one gets "jaime.sanchez",
--   the other iterates to "jaime.sanchez2".  The UNIQUE constraint is the
--   unconditional fallback if something bypasses the function.

CREATE OR REPLACE FUNCTION public.generate_financial_username(
  p_first_name  text,
  p_last_name_1 text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base      text;
  v_candidate text;
  v_counter   integer := 0;
BEGIN
  -- Step 1: normalise each part independently
  --   unaccent removes combining diacritics (works for Latin-script languages)
  --   regexp_replace strips anything that is not [a-z0-9]
  --   The dot separator is kept in the base but stripped from each part.
  v_base := regexp_replace(
    unaccent(lower(trim(p_first_name))),
    '[^a-z0-9]', '', 'g'
  )
  || '.'
  || regexp_replace(
    regexp_replace(unaccent(lower(trim(p_last_name_1))), '\s+', '', 'g'),
    '[^a-z0-9]', '', 'g'
  );

  -- Ensure the base is non-trivially short (edge case: emoji-only names, etc.)
  IF length(replace(v_base, '.', '')) < 2 THEN
    v_base := 'user.' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  -- Step 2: find the first unclaimed candidate
  v_candidate := v_base;
  LOOP
    -- Advisory lock: only one transaction can test this exact candidate at a time.
    -- The lock is automatically released at transaction end.
    PERFORM pg_advisory_xact_lock(('x' || substr(md5(v_candidate), 1, 15))::bit(60)::bigint);

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE financial_username = v_candidate
    ) THEN
      RETURN v_candidate;
    END IF;

    v_counter   := v_counter + 1;
    v_candidate := v_base || v_counter::text;

    -- Hard upper bound: after 9999 collisions, append a random suffix.
    IF v_counter > 9999 THEN
      RETURN v_base || '_' || substr(gen_random_uuid()::text, 1, 6);
    END IF;
  END LOOP;
END;
$$;

-- Not directly callable by end users.  Only the trigger (and tests) use it.
REVOKE ALL ON FUNCTION public.generate_financial_username FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- 3. UPDATE handle_new_user TRIGGER FUNCTION
-- =============================================================================
-- Reads structured name parts from raw_user_meta_data (sent by the signup form).
-- Falls back gracefully if parts are missing (e.g. Google OAuth).
-- Also keeps full_name populated for backwards compatibility with existing queries.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name  text;
  v_last_name_1 text;
  v_last_name_2 text;
  v_username    text;
  v_full_name   text;
BEGIN
  -- Extract structured name parts from signup metadata
  v_first_name  := trim(COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1),
    split_part(NEW.email, '@', 1)
  ));
  v_last_name_1 := trim(COALESCE(
    NEW.raw_user_meta_data->>'last_name_1',
    -- If full_name provided (e.g. Google OAuth), use 2nd word as last_name_1
    NULLIF(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2), ''),
    'User'
  ));
  v_last_name_2 := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name_2', '')), '');

  -- Compute full_name for backwards-compatible queries
  v_full_name := trim(
    v_first_name || ' ' || v_last_name_1
    || COALESCE(' ' || v_last_name_2, '')
  );

  -- Generate unique username at DB level (race-condition safe)
  v_username := public.generate_financial_username(v_first_name, v_last_name_1);

  INSERT INTO public.profiles (
    id,
    first_name, last_name_1, last_name_2,
    financial_username,
    full_name
  ) VALUES (
    NEW.id,
    v_first_name, v_last_name_1, v_last_name_2,
    v_username,
    v_full_name
  );

  RETURN NEW;
END;
$$;

-- Trigger already exists from the first migration; the function replacement above
-- is sufficient — no need to recreate the trigger.


-- =============================================================================
-- 4. BACKFILL EXISTING USERS
-- =============================================================================
-- Generate identity columns for any profiles that predate this migration.
-- Runs as a DO block so it's transactional with the rest of the migration.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, full_name FROM public.profiles
    WHERE financial_username IS NULL
    ORDER BY created_at
  LOOP
    UPDATE public.profiles
    SET
      first_name  = COALESCE(
        NULLIF(split_part(trim(COALESCE(r.full_name, '')), ' ', 1), ''),
        'User'
      ),
      last_name_1 = COALESCE(
        NULLIF(split_part(trim(COALESCE(r.full_name, '')), ' ', 2), ''),
        'Nest'
      ),
      financial_username = public.generate_financial_username(
        COALESCE(NULLIF(split_part(trim(COALESCE(r.full_name, '')), ' ', 1), ''), 'user'),
        COALESCE(NULLIF(split_part(trim(COALESCE(r.full_name, '')), ' ', 2), ''), 'nest')
      )
    WHERE id = r.id;
  END LOOP;
END;
$$;


-- =============================================================================
-- 5. APPLY CONSTRAINTS
-- =============================================================================

-- Set NOT NULL on required identity columns (safe now that backfill ran)
ALTER TABLE public.profiles
  ALTER COLUMN first_name         SET NOT NULL,
  ALTER COLUMN last_name_1        SET NOT NULL,
  ALTER COLUMN financial_username SET NOT NULL;
-- last_name_2 intentionally nullable (not everyone has two surnames)

-- UNIQUE constraint — the unconditional last line of defence against duplicates
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_financial_username_unique
  UNIQUE (financial_username);

-- Index for fast exact lookups (used by find_user_by_username RPC)
-- lower() makes it case-insensitive in case a legacy row slipped through.
CREATE INDEX IF NOT EXISTS idx_profiles_financial_username
  ON public.profiles (lower(financial_username));


-- =============================================================================
-- 6. USERNAME SEARCH RPC (minimum-exposure cross-user lookup)
-- =============================================================================
-- Only authenticated users can call this.
-- Returns only the fields needed to build a preview card: id, name, username.
-- The caller's own profile is excluded (you can't invite yourself).
-- Searches by exact lowercase match — the client normalises before calling.

CREATE OR REPLACE FUNCTION public.find_user_by_username(p_username text)
RETURNS TABLE(
  id                 uuid,
  first_name         text,
  last_name_1        text,
  financial_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name_1,
    p.financial_username
  FROM public.profiles p
  WHERE p.financial_username = lower(trim(p_username))
    AND p.id <> auth.uid();   -- can't look yourself up
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_username FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.find_user_by_username TO authenticated;


-- =============================================================================
-- 7. FAMILY_MEMBERS: ADD UNIQUE CONSTRAINT
-- =============================================================================
-- Required by accept_family_invite's ON CONFLICT clause.
-- Clean up any duplicate rows first (defensive — shouldn't exist in practice).

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY family_id, user_id ORDER BY created_at) AS rn
  FROM public.family_members
)
DELETE FROM public.family_members WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_family_user_unique
  UNIQUE (family_id, user_id);


-- =============================================================================
-- 8. FAMILY_INVITATIONS: REDESIGN FOR USERNAME-BASED FLOW
-- =============================================================================
-- The table already exists (from security_hardening migration).
-- We extend it to support the new username-based invitation architecture.

-- Add the target user column
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS invited_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make email nullable (was NOT NULL — we'll keep it for potential email
-- notifications but it's no longer the primary invite identifier)
ALTER TABLE public.family_invitations
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN email SET DEFAULT NULL;

-- Drop old email-based uniqueness; add user-based uniqueness instead
ALTER TABLE public.family_invitations
  DROP CONSTRAINT IF EXISTS family_invitations_family_id_email_key;

ALTER TABLE public.family_invitations
  ADD CONSTRAINT family_invitations_family_user_unique
  UNIQUE (family_id, invited_user_id);

-- Index: invited user quickly finds their pending invitations
CREATE INDEX IF NOT EXISTS idx_invitations_invited_user
  ON public.family_invitations (invited_user_id)
  WHERE accepted_at IS NULL;

-- =============================================================================
-- 9. FAMILY_INVITATIONS: RLS REDESIGN
-- =============================================================================

-- Drop old blanket owner policy (we need finer control now)
DROP POLICY IF EXISTS "owner manages invitations" ON public.family_invitations;

-- Owner: full control over invitations for their family
CREATE POLICY "owner manages invitations" ON public.family_invitations
  FOR ALL
  USING  (public.is_family_owner(auth.uid(), family_id))
  WITH CHECK (public.is_family_owner(auth.uid(), family_id));

-- Invited user: can SELECT their own pending invitations (to show inbox)
CREATE POLICY "invitee views own invitations" ON public.family_invitations
  FOR SELECT
  USING (
    invited_user_id = auth.uid()
    AND accepted_at IS NULL
    AND expires_at  > now()
  );


-- =============================================================================
-- 10. SEND FAMILY INVITE RPC
-- =============================================================================
-- Atomically looks up a user by username, validates the invite, and creates
-- the invitation record.  Returns the invitation id.

CREATE OR REPLACE FUNCTION public.send_family_invite(
  p_family_id uuid,
  p_username  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_id   uuid;
  v_invited_email text;
  v_invitation_id uuid;
BEGIN
  -- Caller must be the family owner
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Only the family owner can send invitations';
  END IF;

  -- Look up target user by exact username (case-insensitive)
  SELECT p.id INTO v_invited_id
  FROM public.profiles p
  WHERE p.financial_username = lower(trim(p_username));

  IF v_invited_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_username
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_invited_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot invite yourself';
  END IF;

  -- Ensure not already an active family member
  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = v_invited_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this family';
  END IF;

  -- Fetch their email for potential future notification (best-effort)
  SELECT email INTO v_invited_email FROM auth.users WHERE id = v_invited_id;

  -- Upsert: refreshes token + expiry if a pending invite already exists
  INSERT INTO public.family_invitations (
    family_id, invited_by, invited_user_id, email, role
  ) VALUES (
    p_family_id, auth.uid(), v_invited_id, v_invited_email, 'member'
  )
  ON CONFLICT (family_id, invited_user_id) DO UPDATE
    SET expires_at = now() + INTERVAL '7 days',
        token      = gen_random_uuid()
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_family_invite FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_family_invite TO authenticated;


-- =============================================================================
-- 11. ACCEPT FAMILY INVITE RPC
-- =============================================================================
-- Atomically validates the invitation, adds the user to family_members,
-- updates their profile's family_id, and marks the invite accepted.
-- All four operations are in one transaction — no partial state possible.

CREATE OR REPLACE FUNCTION public.accept_family_invite(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Lock and fetch the invitation in one step
  SELECT * INTO v_invite
  FROM public.family_invitations
  WHERE id               = p_invitation_id
    AND invited_user_id  = auth.uid()
    AND accepted_at      IS NULL
    AND expires_at       > now()
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, or expired'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Guard: user must not already belong to a different family
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND family_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already belong to a family. Leave it before accepting a new invitation.';
  END IF;

  -- Add to family_members (idempotent — owner may already have a row)
  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (v_invite.family_id, auth.uid(), v_invite.role)
  ON CONFLICT (family_id, user_id) DO NOTHING;

  -- Update profile
  UPDATE public.profiles
  SET family_id = v_invite.family_id
  WHERE id = auth.uid();

  -- Stamp accepted_at
  UPDATE public.family_invitations
  SET accepted_at = now()
  WHERE id = p_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_family_invite FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_family_invite TO authenticated;


-- =============================================================================
-- 12. REJECT / CANCEL FAMILY INVITE RPC
-- =============================================================================
-- Both the invitee (rejecting) and the family owner (cancelling) can call this.

CREATE OR REPLACE FUNCTION public.reject_family_invite(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.family_invitations
  WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND (
      invited_user_id = auth.uid()                             -- invitee rejects
      OR public.is_family_owner(auth.uid(), family_id)         -- owner cancels
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already accepted'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_family_invite FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_family_invite TO authenticated;


-- =============================================================================
-- 13. GET MY INVITATIONS RPC (inbox for invited user)
-- =============================================================================
-- Returns pending invitations addressed to the calling user, enriched with
-- the inviting user's name and the family name.

CREATE OR REPLACE FUNCTION public.get_my_invitations()
RETURNS TABLE(
  id                      uuid,
  family_id               uuid,
  family_name             text,
  invited_by_first_name   text,
  invited_by_last_name_1  text,
  invited_by_username     text,
  role                    text,
  expires_at              timestamptz,
  created_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    fi.id,
    fi.family_id,
    f.name           AS family_name,
    p.first_name     AS invited_by_first_name,
    p.last_name_1    AS invited_by_last_name_1,
    p.financial_username AS invited_by_username,
    fi.role,
    fi.expires_at,
    fi.created_at
  FROM public.family_invitations fi
  JOIN public.families f ON fi.family_id = f.id
  JOIN public.profiles  p ON fi.invited_by = p.id
  WHERE fi.invited_user_id = auth.uid()
    AND fi.accepted_at     IS NULL
    AND fi.expires_at      > now()
  ORDER BY fi.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_invitations FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_invitations TO authenticated;


-- =============================================================================
-- 14. GET FAMILY SENT INVITATIONS RPC (owner dashboard)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_family_sent_invitations(p_family_id uuid)
RETURNS TABLE(
  id                   uuid,
  invited_user_id      uuid,
  invited_first_name   text,
  invited_last_name_1  text,
  invited_username     text,
  role                 text,
  expires_at           timestamptz,
  created_at           timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_family_owner(auth.uid(), p_family_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    fi.id,
    fi.invited_user_id,
    p.first_name       AS invited_first_name,
    p.last_name_1      AS invited_last_name_1,
    p.financial_username AS invited_username,
    fi.role,
    fi.expires_at,
    fi.created_at
  FROM public.family_invitations fi
  JOIN public.profiles p ON fi.invited_user_id = p.id
  WHERE fi.family_id  = p_family_id
    AND fi.accepted_at IS NULL
    AND fi.expires_at  > now()
  ORDER BY fi.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_family_sent_invitations FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_family_sent_invitations TO authenticated;
