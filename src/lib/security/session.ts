/**
 * session.ts — Client-side session safety utilities.
 *
 * A financial app left open on a shared computer is a real threat.
 * useIdleLogout signs the user out after a configurable period of inactivity,
 * regardless of whether the session JWT has expired.
 *
 * Default timeout: 15 minutes of no mouse, keyboard, touch, or scroll activity.
 */

import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "pointermove",
] as const;

/**
 * Signs the user out and redirects to /auth after `timeoutMs` of inactivity.
 *
 * @param timeoutMs  Inactivity window in milliseconds. Default: 15 minutes.
 *
 * Usage: call this hook once inside the AppShell component (under /app route).
 * It is a no-op on the server (SSR guard included).
 */
export function useIdleLogout(timeoutMs: number = 15 * 60_000) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [navigate]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(signOut, timeoutMs);
  }, [signOut, timeoutMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);
}

/**
 * Validates that the current Supabase session is still active.
 * Returns the user if authenticated, null otherwise.
 *
 * Uses getUser() (server-round-trip) rather than getSession() (local cache)
 * to detect revoked tokens. Slightly slower but more secure for sensitive paths.
 */
export async function getVerifiedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Asserts that the current user owns the given resource user_id.
 * Throws a generic "Access denied" error — never exposes why.
 *
 * Use in service functions that receive IDs from client input and need
 * to verify the caller is the owner before mutating.
 */
export function assertOwnership(currentUserId: string, resourceUserId: string): void {
  if (currentUserId !== resourceUserId) {
    // Intentionally vague — never reveal whether the resource exists
    throw new Error("Access denied");
  }
}
