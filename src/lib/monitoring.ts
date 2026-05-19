/**
 * monitoring.ts — DISABLED during stability rebuild phase.
 * All functions are no-ops. Re-enable by restoring Sentry integration.
 */

export async function initMonitoring(): Promise<void> {}
export function setMonitoringUser(_userId: string): void {}
export function clearMonitoringUser(): void {}
export function captureError(error: unknown, _context?: Record<string, unknown>): void {
  console.error("[error]", error);
}
