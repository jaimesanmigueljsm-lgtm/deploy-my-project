// Lightweight, privacy-safe security event log.
// Hybrid architecture: localStorage cache + backend sync
// - localStorage: fast access, offline support, last 50 events
// - Backend: persistent audit log, cross-device visibility
// - Sync queue: retry failed backend writes

import { getDeviceId } from "@/lib/device";
import { logSecurityEvent as logToBackend } from "@/features/security/security.service";
import { queueOperation } from "@/lib/sync-queue";

const EVENTS_KEY = (uid: string) => `nooly.security_events.${uid}`;
const MAX_EVENTS = 50;

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

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  deviceId: string;
  ts: number;
  meta?: Record<string, string | number | boolean>;
}

export function logSecurityEvent(
  uid: string,
  type: SecurityEventType,
  meta?: SecurityEvent["meta"],
): void {
  if (!uid || typeof window === "undefined") return;
  const event: SecurityEvent = {
    id: crypto.randomUUID(),
    type,
    deviceId: getDeviceId(),
    ts: Date.now(),
    ...(meta ? { meta } : {}),
  };

  // 1. Write to localStorage (fast path, offline support)
  try {
    const raw = localStorage.getItem(EVENTS_KEY(uid));
    const events: SecurityEvent[] = raw ? (JSON.parse(raw) as SecurityEvent[]) : [];
    localStorage.setItem(EVENTS_KEY(uid), JSON.stringify([event, ...events].slice(0, MAX_EVENTS)));
  } catch {} // eslint-disable-line no-empty

  // 2. Sync to backend (async, non-blocking)
  syncEventToBackend(uid, event);
}

/**
 * Sync event to backend (with queue fallback)
 */
function syncEventToBackend(uid: string, event: SecurityEvent): void {
  // Don't block the caller
  void (async () => {
    try {
      await logToBackend(event.type, event.deviceId, event.meta || undefined);
    } catch (error) {
      // Backend failed → queue for retry
      console.warn("[security-events] Backend sync failed, queuing for retry:", error);
      queueOperation(uid, "log_event", {
        event_type: event.type,
        device_id: event.deviceId,
        metadata: event.meta || null,
      });
    }
  })();
}

export function getSecurityEvents(uid: string): SecurityEvent[] {
  if (!uid || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY(uid));
    return raw ? (JSON.parse(raw) as SecurityEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearSecurityEvents(uid: string): void {
  if (!uid) return;
  try {
    localStorage.removeItem(EVENTS_KEY(uid));
  } catch {} // eslint-disable-line no-empty
}
