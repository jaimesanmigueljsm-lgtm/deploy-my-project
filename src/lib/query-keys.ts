/**
 * Centralized query key factory.
 *
 * Rules:
 *  - Every key starts with the entity name so partial invalidation works:
 *      queryClient.invalidateQueries({ queryKey: ["expenses", userId] })
 *      will wipe ALL expense queries for the user (any month range).
 *  - userId is always the second element — prevents cross-user cache pollution,
 *    which is a hard security requirement in any fintech app.
 *  - Keys are `as const` tuples so TypeScript catches typos at the call-site.
 */
export const queryKeys = {
  // ─── Profile ────────────────────────────────────────────────────────────────
  profile: (userId: string) => ["profile", userId] as const,

  // ─── Expenses ───────────────────────────────────────────────────────────────
  expenses: (userId: string) => ({
    /** Invalidate all expense queries for the user regardless of month. */
    all: ["expenses", userId] as const,
    /** Scoped to a specific ISO date range — used for per-month fetches. */
    byMonth: (start: string, end: string) =>
      ["expenses", userId, start, end] as const,
  }),

  // ─── Categories ─────────────────────────────────────────────────────────────
  categories: (userId: string) => ["categories", userId] as const,

  // ─── Bills ──────────────────────────────────────────────────────────────────
  bills: (userId: string) => ["bills", userId] as const,

  // ─── Incomes ────────────────────────────────────────────────────────────────
  incomes: (userId: string) => ({
    all: ["incomes", userId] as const,
  }),

  // ─── Goals ──────────────────────────────────────────────────────────────────
  goals: (userId: string) => ["goals", userId] as const,

  // ─── Goal contributions ──────────────────────────────────────────────────────
  contributions: (userId: string) => ["contributions", userId] as const,

  // ─── Investments ─────────────────────────────────────────────────────────────
  investments: (userId: string) => ["investments", userId] as const,

  // ─── Analytics (6-month expense window) ──────────────────────────────────────
  analytics: (userId: string, windowStart: string) =>
    ["analytics", userId, windowStart] as const,

  // ─── Recommendations ────────────────────────────────────────────────────────
  recommendations: (userId: string) => ["recommendations", userId] as const,

  // ─── Dashboard (aggregate) ──────────────────────────────────────────────────
  // Keyed by userId + month start so the cache turns over automatically each month.
  dashboard: (userId: string, monthStart: string) =>
    ["dashboard", userId, monthStart] as const,
} as const;
