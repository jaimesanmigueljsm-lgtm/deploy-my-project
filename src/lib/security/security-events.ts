// Lightweight, privacy-safe security event log.
// Stores the last 50 events per user in localStorage.
// No PII — only event type, timestamp, and anonymous device ID.
// Ready for backend sync: replace the localStorage calls with API calls.

import { getDeviceId } from "@/lib/device";

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
  | "biometric_disabled";

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
  try {
    const raw = localStorage.getItem(EVENTS_KEY(uid));
    const events: SecurityEvent[] = raw ? (JSON.parse(raw) as SecurityEvent[]) : [];
    localStorage.setItem(EVENTS_KEY(uid), JSON.stringify([event, ...events].slice(0, MAX_EVENTS)));
  } catch {} // eslint-disable-line no-empty
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
