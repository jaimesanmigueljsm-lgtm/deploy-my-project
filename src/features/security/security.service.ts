/**
 * security.service.ts — Backend security operations
 *
 * Provides type-safe API for security-critical operations:
 * - PIN verification with rate limiting
 * - Security event logging
 * - Trusted device management
 *
 * Architecture: Backend is source of truth, localStorage is read-through cache
 *
 * Migration applied ✓
 * Types regenerated ✓ (after updating src/integrations/supabase/types.ts)
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

export interface UserSecurity {
  user_id: string;
  pin_hash: string;
  failed_unlock_count: number;
  locked_until: string | null;
  last_active_at: string;
  auto_lock_ms: number;
  hide_balances: boolean;
  biometric_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id: string;
  event_type: SecurityEventType;
  device_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface TrustedDevice {
  id: string;
  user_id: string;
  device_id: string;
  name: string;
  platform: string;
  browser: string;
  trusted_at: string;
  last_active_at: string;
  revoked_at: string | null;
}

export type SecurityEventType =
  | "login"
  | "logout"
  | "pin_set"
  | "pin_changed"
  | "pin_removed"
  | "failed_unlock"
  | "lockout_triggered"
  | "device_trusted"
  | "device_revoked"
  | "session_expired"
  | "password_changed"
  | "biometric_enabled"
  | "biometric_disabled"
  | "offline_unlock"
  | "offline_biometric_unlock";

export interface VerifyPinAttemptResult {
  success: boolean;
  reason?: "unauthorized" | "not_found" | "locked";
  message?: string;
  pin_hash?: string;
  failed_count?: number;
  locked_until?: string | null;
}

export interface RecordFailedUnlockResult {
  success: boolean;
  reason?: string;
  failed_count?: number;
  locked_until?: string | null;
  is_locked?: boolean;
}

// ============================================================================
// USER SECURITY
// ============================================================================

/**
 * Initialize or migrate user security settings to backend
 */
export async function initializeUserSecurity(
  pinHash: string,
  options?: {
    autoLockMs?: number;
    hideBalances?: boolean;
    biometricEnabled?: boolean;
  }
): Promise<void> {
  const { data, error } = await (supabase as any).rpc("initialize_user_security", {
    p_pin_hash: pinHash,
    p_auto_lock_ms: options?.autoLockMs ?? 300000,
    p_hide_balances: options?.hideBalances ?? false,
    p_biometric_enabled: options?.biometricEnabled ?? false,
  });

  if (error) throw new Error(`Failed to initialize security: ${error.message}`);
  if (!data?.success) throw new Error("Security initialization failed");
}

/**
 * Fetch user security settings from backend
 */
export async function getUserSecurity(userId: string): Promise<UserSecurity | null> {
  const { data, error } = await (supabase as any)
    .from("user_security")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch security settings: ${error.message}`);
  }

  return data;
}

/**
 * Update user security settings
 */
export async function updateUserSecurity(
  userId: string,
  updates: Partial<Pick<UserSecurity, "auto_lock_ms" | "hide_balances" | "biometric_enabled">>
): Promise<void> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.auto_lock_ms !== undefined) payload.auto_lock_ms = updates.auto_lock_ms;
  if (updates.hide_balances !== undefined) payload.hide_balances = updates.hide_balances;
  if (updates.biometric_enabled !== undefined)
    payload.biometric_enabled = updates.biometric_enabled;

  const { error } = await (supabase as any)
    .from("user_security")
    .update(payload)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to update security settings: ${error.message}`);
}

/**
 * Update PIN hash in backend
 */
export async function updatePinHash(userId: string, newPinHash: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("user_security")
    .update({
      pin_hash: newPinHash,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to update PIN: ${error.message}`);
}

// ============================================================================
// UNLOCK / RATE LIMITING
// ============================================================================

/**
 * Verify PIN attempt with backend rate limiting
 * Returns current security state (app verifies hash client-side)
 */
export async function verifyPinAttempt(): Promise<VerifyPinAttemptResult> {
  const { data, error } = await (supabase as any).rpc("verify_pin_attempt");

  if (error) throw new Error(`Failed to verify PIN attempt: ${error.message}`);

  return data as VerifyPinAttemptResult;
}

/**
 * Record a failed unlock attempt (increments counter)
 */
export async function recordFailedUnlock(): Promise<RecordFailedUnlockResult> {
  const { data, error } = await (supabase as any).rpc("record_failed_unlock");

  if (error) throw new Error(`Failed to record failed unlock: ${error.message}`);

  return data as RecordFailedUnlockResult;
}

/**
 * Record a successful unlock (resets counter)
 */
export async function recordSuccessfulUnlock(): Promise<void> {
  const { data, error } = await (supabase as any).rpc("record_successful_unlock");

  if (error) throw new Error(`Failed to record successful unlock: ${error.message}`);
  if (!data?.success) throw new Error("Failed to record successful unlock");
}

// ============================================================================
// SECURITY EVENTS
// ============================================================================

/**
 * Log a security event to backend
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  deviceId: string,
  metadata?: Record<string, any>
): Promise<string> {
  const { data, error } = await (supabase as any).rpc("log_security_event", {
    p_event_type: eventType,
    p_device_id: deviceId,
    p_metadata: metadata ? (metadata as any) : null,
  });

  if (error) throw new Error(`Failed to log security event: ${error.message}`);

  return data as string; // Returns event ID
}

/**
 * Fetch security events for current user
 */
export async function getSecurityEvents(
  userId: string,
  limit = 50
): Promise<SecurityEvent[]> {
  const { data, error } = await (supabase as any)
    .from("security_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch security events: ${error.message}`);

  return data || [];
}

/**
 * Fetch security events for specific device
 */
export async function getDeviceSecurityEvents(
  userId: string,
  deviceId: string,
  limit = 20
): Promise<SecurityEvent[]> {
  const { data, error } = await (supabase as any)
    .from("security_events")
    .select("*")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch device security events: ${error.message}`);

  return data || [];
}

// ============================================================================
// TRUSTED DEVICES
// ============================================================================

/**
 * Add or update trusted device in backend
 */
export async function trustDevice(
  userId: string,
  deviceId: string,
  deviceInfo: {
    name: string;
    platform: string;
    browser: string;
  }
): Promise<TrustedDevice> {
  const { data, error } = await (supabase as any)
    .from("trusted_devices")
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        name: deviceInfo.name,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        last_active_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,device_id",
      }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to trust device: ${error.message}`);

  return data;
}

/**
 * Update device last active timestamp
 */
export async function updateDeviceLastActive(
  userId: string,
  deviceId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from("trusted_devices")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("device_id", deviceId);

  if (error) throw new Error(`Failed to update device last active: ${error.message}`);
}

/**
 * Fetch all trusted devices for user
 */
export async function getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  const { data, error } = await (supabase as any)
    .from("trusted_devices")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch trusted devices: ${error.message}`);

  return data || [];
}

/**
 * Revoke a trusted device
 */
export async function revokeDevice(userId: string, deviceId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("trusted_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("device_id", deviceId);

  if (error) throw new Error(`Failed to revoke device: ${error.message}`);
}
