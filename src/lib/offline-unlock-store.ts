/**
 * offline-unlock-store.ts — Tracks offline unlock attempts
 *
 * Option B Security Strategy:
 * - User gets 1 offline unlock
 * - After that, must connect to backend for verification
 * - Counter resets on successful backend verification
 * - 24h window: after 24h offline, requires reconnection regardless of count
 *
 * Architecture: localStorage for offline state, cleared on backend verification
 */

const OFFLINE_UNLOCK_KEY = (uid: string) => `nooly.offline_unlocks.${uid}`;
const OFFLINE_UNLOCK_LIMIT = 1; // Only 1 offline unlock permitted
const OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface OfflineUnlockState {
  count: number;
  firstUnlockAt: number; // epoch ms
  lastUnlockAt: number; // epoch ms
}

const DEFAULT_STATE: OfflineUnlockState = {
  count: 0,
  firstUnlockAt: 0,
  lastUnlockAt: 0,
};

const safe = typeof window !== "undefined";

// ============================================================================
// READ STATE
// ============================================================================

export function getOfflineUnlockState(uid: string): OfflineUnlockState {
  if (!safe || !uid) return { ...DEFAULT_STATE };

  try {
    const raw = localStorage.getItem(OFFLINE_UNLOCK_KEY(uid));
    if (!raw) return { ...DEFAULT_STATE };

    const state: OfflineUnlockState = JSON.parse(raw);

    // Check if window expired (24h since first unlock)
    if (state.firstUnlockAt > 0) {
      const elapsed = Date.now() - state.firstUnlockAt;
      if (elapsed > OFFLINE_WINDOW_MS) {
        // Window expired → reset and require backend
        localStorage.removeItem(OFFLINE_UNLOCK_KEY(uid));
        return { ...DEFAULT_STATE };
      }
    }

    return state;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function getOfflineUnlockCount(uid: string): number {
  return getOfflineUnlockState(uid).count;
}

// ============================================================================
// CHECK LIMITS
// ============================================================================

/**
 * Check if offline unlock is allowed
 * Returns: true if allowed, false if limit reached or window expired
 */
export function canUnlockOffline(uid: string): boolean {
  const state = getOfflineUnlockState(uid);

  // Check count limit
  if (state.count >= OFFLINE_UNLOCK_LIMIT) {
    return false;
  }

  // Check window (if exists)
  if (state.firstUnlockAt > 0) {
    const elapsed = Date.now() - state.firstUnlockAt;
    if (elapsed > OFFLINE_WINDOW_MS) {
      return false; // Window expired
    }
  }

  return true;
}

/**
 * Get remaining offline unlocks
 */
export function getRemainingOfflineUnlocks(uid: string): number {
  const state = getOfflineUnlockState(uid);
  return Math.max(0, OFFLINE_UNLOCK_LIMIT - state.count);
}

/**
 * Check if window is expired
 */
export function isOfflineWindowExpired(uid: string): boolean {
  const state = getOfflineUnlockState(uid);

  if (state.firstUnlockAt === 0) return false;

  const elapsed = Date.now() - state.firstUnlockAt;
  return elapsed > OFFLINE_WINDOW_MS;
}

// ============================================================================
// WRITE STATE
// ============================================================================

/**
 * Increment offline unlock counter
 * Should only be called AFTER successful PIN verification
 */
export function incrementOfflineUnlock(uid: string): OfflineUnlockState {
  if (!safe || !uid) return { ...DEFAULT_STATE };

  const state = getOfflineUnlockState(uid);

  const newState: OfflineUnlockState = {
    count: state.count + 1,
    firstUnlockAt: state.firstUnlockAt || Date.now(),
    lastUnlockAt: Date.now(),
  };

  try {
    localStorage.setItem(OFFLINE_UNLOCK_KEY(uid), JSON.stringify(newState));
  } catch (error) {
    console.error("[offline-unlock] Failed to save state:", error);
  }

  return newState;
}

/**
 * Reset offline unlock counter
 * Called after successful backend verification
 */
export function resetOfflineUnlock(uid: string): void {
  if (!safe || !uid) return;

  try {
    localStorage.removeItem(OFFLINE_UNLOCK_KEY(uid));
  } catch (error) {
    console.error("[offline-unlock] Failed to reset:", error);
  }
}

// ============================================================================
// RECONNECTION
// ============================================================================

/**
 * Check if suspicious offline activity occurred
 * Returns: true if activity looks suspicious (many offline unlocks, etc.)
 */
export function hasSuspiciousOfflineActivity(uid: string): boolean {
  const state = getOfflineUnlockState(uid);

  // More than limit is suspicious (shouldn't be possible, but could indicate tampering)
  if (state.count > OFFLINE_UNLOCK_LIMIT) {
    return true;
  }

  // Multiple unlocks in very short time (< 1 minute) is suspicious
  if (state.count > 0 && state.firstUnlockAt > 0) {
    const duration = state.lastUnlockAt - state.firstUnlockAt;
    if (duration < 60_000 && state.count >= 3) {
      // 3+ unlocks in < 1 minute
      return true;
    }
  }

  return false;
}

/**
 * Get offline unlock metadata for logging
 */
export function getOfflineUnlockMetadata(uid: string): Record<string, any> {
  const state = getOfflineUnlockState(uid);

  return {
    offline_unlock_count: state.count,
    first_unlock_at: state.firstUnlockAt || null,
    last_unlock_at: state.lastUnlockAt || null,
    window_expired: isOfflineWindowExpired(uid),
    suspicious: hasSuspiciousOfflineActivity(uid),
  };
}

// ============================================================================
// CONSTANTS (exported for UI display)
// ============================================================================

export const OFFLINE_LIMITS = {
  MAX_UNLOCKS: OFFLINE_UNLOCK_LIMIT,
  WINDOW_MS: OFFLINE_WINDOW_MS,
  WINDOW_HOURS: OFFLINE_WINDOW_MS / (60 * 60 * 1000),
} as const;
