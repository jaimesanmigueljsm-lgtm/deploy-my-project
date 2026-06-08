/**
 * sync-queue.ts — Offline operations queue with retry logic
 *
 * Queues security operations that fail due to network issues:
 * - Security event logging
 * - Device trust/revocation
 * - Settings updates
 *
 * Features:
 * - Persistent queue in localStorage
 * - Exponential backoff retry (max 3 attempts)
 * - Auto-sync on reconnect
 * - Deduplication by operation type + payload hash
 *
 * Architecture: Queue operations locally, sync to backend when online
 */

import {
  logSecurityEvent,
  trustDevice,
  updateUserSecurity,
  type SecurityEventType,
} from "@/features/security/security.service";

// ============================================================================
// TYPES
// ============================================================================

export type PendingOperationType = "log_event" | "trust_device" | "update_settings";

export interface PendingOperation {
  id: string;
  type: PendingOperationType;
  payload: any;
  timestamp: number;
  retries: number;
  lastRetryAt: number;
}

// ============================================================================
// STORAGE
// ============================================================================

const QUEUE_KEY = (uid: string) => `nooly.sync_queue.${uid}`;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 60000]; // 5s, 15s, 60s

const safe = typeof window !== "undefined";

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

function getQueue(uid: string): PendingOperation[] {
  if (!safe || !uid) return [];

  try {
    const raw = localStorage.getItem(QUEUE_KEY(uid));
    return raw ? (JSON.parse(raw) as PendingOperation[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(uid: string, queue: PendingOperation[]): void {
  if (!safe || !uid) return;

  try {
    localStorage.setItem(QUEUE_KEY(uid), JSON.stringify(queue));
  } catch (error) {
    console.error("[sync-queue] Failed to save queue:", error);
  }
}

/**
 * Generate a simple hash for deduplication
 */
function hashPayload(type: string, payload: any): string {
  const str = JSON.stringify({ type, payload });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Add operation to queue (with deduplication)
 */
export function queueOperation(
  uid: string,
  type: PendingOperationType,
  payload: any
): void {
  if (!safe || !uid) return;

  const queue = getQueue(uid);
  const payloadHash = hashPayload(type, payload);

  // Check for duplicate
  const existing = queue.find(
    (op) => op.type === type && hashPayload(op.type, op.payload) === payloadHash
  );

  if (existing) {
    console.log(`[sync-queue] Operation already queued, skipping duplicate: ${type}`);
    return;
  }

  const operation: PendingOperation = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
    lastRetryAt: 0,
  };

  queue.push(operation);
  saveQueue(uid, queue);

  console.log(`[sync-queue] Queued operation: ${type} (queue size: ${queue.length})`);
}

/**
 * Get queue size
 */
export function getQueueSize(uid: string): number {
  return getQueue(uid).length;
}

/**
 * Clear all pending operations (use with caution)
 */
export function clearQueue(uid: string): void {
  if (!safe || !uid) return;

  try {
    localStorage.removeItem(QUEUE_KEY(uid));
    console.log("[sync-queue] Queue cleared");
  } catch (error) {
    console.error("[sync-queue] Failed to clear queue:", error);
  }
}

// ============================================================================
// SYNC EXECUTION
// ============================================================================

/**
 * Execute a single queued operation
 */
async function executeOperation(uid: string, op: PendingOperation): Promise<boolean> {
  console.log(`[sync-queue] Executing operation: ${op.type} (attempt ${op.retries + 1})`);

  try {
    switch (op.type) {
      case "log_event":
        await logSecurityEvent(
          op.payload.event_type as SecurityEventType,
          op.payload.device_id,
          op.payload.metadata
        );
        break;

      case "trust_device":
        await trustDevice(uid, op.payload.device_id, {
          name: op.payload.name,
          platform: op.payload.platform,
          browser: op.payload.browser,
        });
        break;

      case "update_settings":
        await updateUserSecurity(uid, op.payload);
        break;

      default:
        console.error(`[sync-queue] Unknown operation type: ${op.type}`);
        return false;
    }

    console.log(`[sync-queue] ✓ Operation successful: ${op.type}`);
    return true;
  } catch (error) {
    console.error(`[sync-queue] ✗ Operation failed: ${op.type}`, error);
    return false;
  }
}

/**
 * Sync all pending operations
 * Returns: { succeeded: number, failed: number, remaining: number }
 */
export async function syncPendingOperations(
  uid: string
): Promise<{ succeeded: number; failed: number; remaining: number }> {
  if (!safe || !uid) return { succeeded: 0, failed: 0, remaining: 0 };

  const queue = getQueue(uid);
  if (queue.length === 0) {
    return { succeeded: 0, failed: 0, remaining: 0 };
  }

  console.log(`[sync-queue] Syncing ${queue.length} pending operations...`);

  const results = await Promise.allSettled(
    queue.map(async (op) => {
      const success = await executeOperation(uid, op);

      if (success) {
        return { status: "success" as const, id: op.id };
      } else {
        // Increment retry counter
        op.retries += 1;
        op.lastRetryAt = Date.now();

        if (op.retries >= MAX_RETRIES) {
          console.warn(
            `[sync-queue] Operation ${op.id} failed after ${MAX_RETRIES} attempts, discarding`
          );
          return { status: "discard" as const, id: op.id };
        } else {
          console.log(
            `[sync-queue] Operation ${op.id} failed, will retry (${op.retries}/${MAX_RETRIES})`
          );
          return { status: "retry" as const, id: op.id, op };
        }
      }
    })
  );

  // Process results
  const succeededIds = new Set<string>();
  const discardedIds = new Set<string>();
  const remaining: PendingOperation[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      if (result.value.status === "success") {
        succeededIds.add(result.value.id);
      } else if (result.value.status === "discard") {
        discardedIds.add(result.value.id);
      } else if (result.value.status === "retry") {
        remaining.push(result.value.op);
      }
    }
  });

  // Save updated queue (only operations that need retry)
  saveQueue(uid, remaining);

  const stats = {
    succeeded: succeededIds.size,
    failed: discardedIds.size,
    remaining: remaining.length,
  };

  console.log(
    `[sync-queue] Sync complete: ${stats.succeeded} succeeded, ${stats.failed} failed, ${stats.remaining} remaining`
  );

  return stats;
}

/**
 * Sync with exponential backoff
 * Waits appropriate delay based on retry count before syncing
 */
export async function syncWithBackoff(uid: string): Promise<void> {
  const queue = getQueue(uid);
  if (queue.length === 0) return;

  // Find minimum retry delay needed
  let minDelay = 0;
  for (const op of queue) {
    if (op.retries > 0 && op.lastRetryAt > 0) {
      const delayNeeded = RETRY_DELAYS[Math.min(op.retries - 1, RETRY_DELAYS.length - 1)];
      const elapsed = Date.now() - op.lastRetryAt;
      const remaining = Math.max(0, delayNeeded - elapsed);
      minDelay = Math.max(minDelay, remaining);
    }
  }

  if (minDelay > 0) {
    console.log(`[sync-queue] Waiting ${minDelay}ms before retry...`);
    await new Promise((resolve) => setTimeout(resolve, minDelay));
  }

  await syncPendingOperations(uid);
}

// ============================================================================
// AUTO-SYNC SETUP
// ============================================================================

let syncInterval: ReturnType<typeof setInterval> | null = null;
let currentUserId: string | null = null;

/**
 * Start auto-sync (call when user logs in)
 */
export function startAutoSync(uid: string): void {
  if (syncInterval) {
    stopAutoSync();
  }

  currentUserId = uid;

  // Sync immediately on start
  void syncPendingOperations(uid);

  // Sync every 30 seconds
  syncInterval = setInterval(() => {
    if (navigator.onLine && currentUserId) {
      void syncWithBackoff(currentUserId);
    }
  }, 30_000);

  // Sync on reconnect
  if (safe) {
    window.addEventListener("online", handleOnline);
  }

  console.log("[sync-queue] Auto-sync started");
}

/**
 * Stop auto-sync (call when user logs out)
 */
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  if (safe) {
    window.removeEventListener("online", handleOnline);
  }

  currentUserId = null;

  console.log("[sync-queue] Auto-sync stopped");
}

function handleOnline() {
  if (currentUserId && navigator.onLine) {
    console.log("[sync-queue] Connection restored, syncing...");
    void syncPendingOperations(currentUserId);
  }
}
