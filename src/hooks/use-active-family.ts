import { useState } from "react";

const STORAGE_KEY = "nest.active_family_id";

/**
 * Lightweight multi-group switcher.
 *
 * Reads the active group from localStorage and falls back to the
 * profile.family_id passed in. This keeps the new multi-group system
 * completely isolated from the existing profile/query/realtime wiring.
 *
 * profile.family_id is NEVER written by this hook — it stays as the
 * legacy default and continues to work for single-group users exactly
 * as before.
 */
export function useActiveFamily(profileFamilyId: string | null) {
  const [storedId, setStoredId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const activeFamilyId = storedId ?? profileFamilyId;

  function switchGroup(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* sandboxed */
    }
    setStoredId(id);
  }

  function clearOverride() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sandboxed */
    }
    setStoredId(null);
  }

  return { activeFamilyId, switchGroup, clearOverride };
}
