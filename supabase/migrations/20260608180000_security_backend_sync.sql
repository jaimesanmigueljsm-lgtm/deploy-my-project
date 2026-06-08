-- ============================================================================
-- Security Backend Sync Migration
-- ============================================================================
-- This migration moves security-critical data from localStorage to backend:
-- 1. PIN hash and lock metadata (rate limiting, lockout state)
-- 2. Security events (audit log)
-- 3. Trusted devices (multi-device management)
--
-- Security model: Hybrid architecture with Option B fallback
-- - Backend is source of truth for rate limiting
-- - localStorage is read-through cache
-- - 1 offline unlock permitted, then requires online verification
-- - Biometric required for offline unlock if available
-- ============================================================================

-- ============================================================================
-- TABLE: user_security
-- Stores PIN hash and lock metadata (replaces localStorage lock_meta + pin_hash)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PIN authentication
  pin_hash text NOT NULL,

  -- Rate limiting (critical for preventing brute force)
  failed_unlock_count smallint NOT NULL DEFAULT 0,
  locked_until timestamptz,

  -- Activity tracking
  last_active_at timestamptz NOT NULL DEFAULT NOW(),

  -- User preferences
  auto_lock_ms integer NOT NULL DEFAULT 300000,  -- 5 minutes default
  hide_balances boolean NOT NULL DEFAULT false,
  biometric_enabled boolean NOT NULL DEFAULT false,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Index for lockout queries
CREATE INDEX idx_user_security_locked ON user_security(user_id, locked_until)
  WHERE locked_until IS NOT NULL;

-- ============================================================================
-- TABLE: security_events
-- Audit log of security-related events (replaces localStorage events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_type text NOT NULL,
  device_id text NOT NULL,
  metadata jsonb,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Index for user event queries (most recent first)
CREATE INDEX idx_security_events_user_time ON security_events(user_id, created_at DESC);

-- Index for device-specific queries
CREATE INDEX idx_security_events_device ON security_events(user_id, device_id, created_at DESC);

-- ============================================================================
-- TABLE: trusted_devices
-- Multi-device management (replaces localStorage trusted devices)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device fingerprint
  device_id text NOT NULL,

  -- Device metadata
  name text NOT NULL,
  platform text NOT NULL,
  browser text NOT NULL,

  -- Timestamps
  trusted_at timestamptz NOT NULL DEFAULT NOW(),
  last_active_at timestamptz NOT NULL DEFAULT NOW(),
  revoked_at timestamptz,

  -- Unique constraint: one entry per user+device
  UNIQUE(user_id, device_id)
);

-- Index for active devices queries
CREATE INDEX idx_trusted_devices_active ON trusted_devices(user_id, revoked_at)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- RLS POLICIES
-- Only the owner can read/write their own security data
-- ============================================================================

ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

-- user_security policies
CREATE POLICY "Users can manage own security settings"
  ON user_security
  FOR ALL
  USING (auth.uid() = user_id);

-- security_events policies (read-only for users, insert via RPC)
CREATE POLICY "Users can read own security events"
  ON security_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security events"
  ON security_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- trusted_devices policies
CREATE POLICY "Users can manage own trusted devices"
  ON trusted_devices
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- RPC: verify_pin_attempt
-- Critical function for rate limiting enforcement
-- Returns: success status + current security state
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_pin_attempt()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_failed_count smallint;
  v_locked_until timestamptz;
  v_pin_hash text;
  v_result jsonb;
BEGIN
  -- Verify authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'unauthorized',
      'message', 'Not authenticated'
    );
  END IF;

  -- Lock row to prevent race conditions
  SELECT failed_unlock_count, locked_until, pin_hash
  INTO v_failed_count, v_locked_until, v_pin_hash
  FROM user_security
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Check if row exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not_found',
      'message', 'Security settings not initialized'
    );
  END IF;

  -- Check lockout status
  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'locked',
      'message', 'Account temporarily locked',
      'locked_until', v_locked_until,
      'failed_count', v_failed_count
    );
  END IF;

  -- Return current state (app will verify PIN hash client-side)
  v_result := jsonb_build_object(
    'success', true,
    'pin_hash', v_pin_hash,
    'failed_count', v_failed_count,
    'locked_until', v_locked_until
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- RPC: record_failed_unlock
-- Increments failed unlock counter and applies lockout if threshold exceeded
-- ============================================================================

CREATE OR REPLACE FUNCTION record_failed_unlock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_count smallint;
  v_lockout_until timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  -- Increment counter and apply lockout if >= 5 attempts
  UPDATE user_security
  SET
    failed_unlock_count = failed_unlock_count + 1,
    locked_until = CASE
      WHEN failed_unlock_count + 1 >= 5 THEN NOW() + INTERVAL '30 seconds'
      ELSE locked_until
    END,
    updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING failed_unlock_count, locked_until
  INTO v_new_count, v_lockout_until;

  RETURN jsonb_build_object(
    'success', true,
    'failed_count', v_new_count,
    'locked_until', v_lockout_until,
    'is_locked', v_lockout_until IS NOT NULL AND v_lockout_until > NOW()
  );
END;
$$;

-- ============================================================================
-- RPC: record_successful_unlock
-- Resets failed unlock counter and updates last active timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION record_successful_unlock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  UPDATE user_security
  SET
    failed_unlock_count = 0,
    locked_until = NULL,
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- RPC: initialize_user_security
-- Creates security record for new user or migrates from localStorage
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_user_security(
  p_pin_hash text,
  p_auto_lock_ms integer DEFAULT 300000,
  p_hide_balances boolean DEFAULT false,
  p_biometric_enabled boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  -- Upsert security settings
  INSERT INTO user_security (
    user_id,
    pin_hash,
    auto_lock_ms,
    hide_balances,
    biometric_enabled
  )
  VALUES (
    v_user_id,
    p_pin_hash,
    p_auto_lock_ms,
    p_hide_balances,
    p_biometric_enabled
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    pin_hash = EXCLUDED.pin_hash,
    auto_lock_ms = EXCLUDED.auto_lock_ms,
    hide_balances = EXCLUDED.hide_balances,
    biometric_enabled = EXCLUDED.biometric_enabled,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- RPC: log_security_event
-- Inserts a new security event
-- ============================================================================

CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_device_id text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO security_events (user_id, event_type, device_id, metadata)
  VALUES (v_user_id, p_event_type, p_device_id, p_metadata)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- FUNCTION: cleanup_old_security_events
-- Deletes events older than 90 days (retention policy)
-- Run via pg_cron or manual maintenance
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- Allow authenticated users to execute RPCs
-- ============================================================================

GRANT EXECUTE ON FUNCTION verify_pin_attempt() TO authenticated;
GRANT EXECUTE ON FUNCTION record_failed_unlock() TO authenticated;
GRANT EXECUTE ON FUNCTION record_successful_unlock() TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_user_security(text, integer, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(text, text, jsonb) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_security IS 'User security settings and rate limiting state (backend source of truth)';
COMMENT ON TABLE security_events IS 'Audit log of security-related events (login, failed unlock, etc.)';
COMMENT ON TABLE trusted_devices IS 'Multi-device management for PIN unlock';

COMMENT ON FUNCTION verify_pin_attempt() IS 'Returns current security state for unlock attempt (checks rate limit)';
COMMENT ON FUNCTION record_failed_unlock() IS 'Increments failed unlock counter and applies lockout after 5 attempts';
COMMENT ON FUNCTION record_successful_unlock() IS 'Resets failed unlock counter on successful unlock';
COMMENT ON FUNCTION initialize_user_security(text, integer, boolean, boolean) IS 'Initializes or migrates user security settings from localStorage';
COMMENT ON FUNCTION log_security_event(text, text, jsonb) IS 'Logs a security event to audit trail';
COMMENT ON FUNCTION cleanup_old_security_events() IS 'Maintenance function to delete events older than 90 days';
