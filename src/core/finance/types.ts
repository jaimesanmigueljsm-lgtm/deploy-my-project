/**
 * types.ts — The complete type system for the NEST financial intelligence engine.
 *
 * Architecture:
 *   Engine input types  →  FinancialEngineContext
 *   Engine output types →  FinancialEngineOutput
 *   Intermediate types  →  used within individual engines
 *
 * All types are independent of Supabase, React, and any framework.
 * Adapters in adapters.ts bridge from the Supabase row types to these.
 */

// =============================================================================
// ENGINE INPUT TYPES
// Normalised representations of domain entities, independent of DB schema.
// =============================================================================

export interface EngineProfile {
  currency: string;
  /** User's self-declared monthly savings target (stored in profiles.monthly_savings_target) */
  monthlySavingsTarget: number;
  /** User-defined priority labels, e.g. ["savings","family","travel"] */
  priorities: string[];
}

export interface EngineExpense {
  id: string;
  amount: number;
  categoryId: string | null;
  /** Resolved category name for display; "Uncategorised" if null */
  categoryName: string;
  kind: "fixed" | "variable";
  recurring: boolean;
  spentAt: Date;
}

export interface EngineIncome {
  id: string;
  amount: number;
  source: string;
  recurring: boolean;
  receivedAt: Date;
}

export interface EngineBill {
  id: string;
  name: string;
  amount: number;
  /** Day of month the bill is due (1–31) */
  dueDay: number;
  paidThisMonth: boolean;
  active: boolean;
}

export interface EngineGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline: Date | null;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface EngineInvestment {
  id: string;
  type: "stock" | "etf" | "crypto" | "savings" | "other";
  name: string;
  ticker: string | null;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currency: string;
}

export interface EngineCategory {
  id: string;
  name: string;
  kind: "fixed" | "variable" | "income";
}

export interface EngineSavingsAccount {
  id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "emergency" | "other";
  balance: number;
  currency: string;
  isEmergencyFund: boolean;
}

/**
 * The complete context passed to every engine function.
 *
 * Window convention:
 *   - expenses/incomes should cover the last 6 months for meaningful trend analysis
 *   - bills, goals, investments represent the current state
 *   - asOf is the reference "now" — always pass new Date() in production,
 *     but override in tests for determinism
 */
export interface FinancialEngineContext {
  profile: EngineProfile;
  /** Last 6 months of expenses (or all available if less than 6 months of data) */
  expenses: EngineExpense[];
  /** Last 6 months of income entries */
  incomes: EngineIncome[];
  /** All active bills */
  bills: EngineBill[];
  /** All savings goals */
  goals: EngineGoal[];
  /** Full investment portfolio */
  investments: EngineInvestment[];
  /** User's expense categories */
  categories: EngineCategory[];
  /** All savings accounts (checking, savings, emergency, etc.) */
  savingsAccounts: EngineSavingsAccount[];
  /** Reference date for all time-sensitive calculations */
  asOf: Date;
}

// =============================================================================
// INTERMEDIATE TYPES
// Used inside engine calculations — not intended to be the primary API surface.
// =============================================================================

/** Monthly aggregation bucket for trend analysis */
export interface MonthlyBucket {
  /** "YYYY-MM" key for stable map lookups */
  key: string;
  /** Human-readable "Jan 2026" label */
  label: string;
  year: number;
  month: number; // 0-indexed (JS Date convention)
  total: number;
  count: number;
}

/** Per-category monthly aggregation */
export interface CategoryBucket {
  categoryId: string | null;
  categoryName: string;
  monthlyTotals: Map<string, number>; // monthKey → total
}

// =============================================================================
// HEALTH SCORE OUTPUT
// =============================================================================

export type HealthStatus = "excellent" | "strong" | "healthy" | "improving" | "unstable";

/** A single component of the composite health score */
export interface SubScore {
  /** Normalised value 0–100 */
  value: number;
  /** Contribution weight in the composite score (0–1, all weights sum to 1) */
  weight: number;
  /** Human-readable label for this score level */
  label: string;
  /** The raw measured value before scoring (savings rate, months covered, etc.) */
  rawValue: number;
  /** Unit of the raw value for display ("%" | "months" | "ratio" | "index") */
  rawUnit: string;
}

/** Signals that the recommendation engine reads to generate actionable suggestions */
export interface RiskIndicator {
  code: string;
  severity: "critical" | "warning" | "info";
  description: string;
}

export interface HealthScore {
  /** Composite weighted score 0–1000 */
  total: number;
  /** Qualitative label matching the total */
  status: HealthStatus;
  /**
   * i18n key for the short human explanation shown below the score.
   * Driven by the most impactful factor — motivating, never shaming.
   */
  explanationKey: string;
  subScores: {
    savingsConsistency: SubScore;
    emergencyReadiness: SubScore;
    fixedExpensePressure: SubScore;
    spendingStability: SubScore;
    goalConsistency: SubScore;
    incomeReliability: SubScore;
  };
  /** Active risk signals for the recommendation engine */
  risks: RiskIndicator[];
  /** Average monthly income used in calculations */
  avgMonthlyIncome: number;
  /** Average monthly expenses used in calculations */
  avgMonthlyExpenses: number;
  /** Essential monthly expenses (bills + basic living) used for emergency readiness */
  essentialMonthlyExpenses: number;
  asOf: Date;
}

// =============================================================================
// BUDGET FORECAST OUTPUT
// =============================================================================

export interface BudgetForecast {
  // ── Time context ──────────────────────────────────────────────────────────
  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;
  /** Day of the month (1-based) */
  currentDay: number;

  // ── Current state ─────────────────────────────────────────────────────────
  currentSpend: number;
  currentFixedSpend: number;
  currentVariableSpend: number;
  /** Fixed bills and recurring costs expected this month (billed but not yet paid) */
  pendingFixedCosts: number;

  // ── Projections ───────────────────────────────────────────────────────────
  /** Pace-based projection: (currentSpend / daysElapsed) * daysInMonth */
  projectedMonthEnd: number;
  /** Projected month-end including pending fixed costs */
  projectedTotalWithFixed: number;
  /** Expected income for the current month */
  expectedMonthlyIncome: number;
  /** Projected savings = expectedIncome - projectedTotal */
  projectedSavings: number;
  /** Whether projected spend exceeds expected income */
  projectedOverrun: boolean;
  /** Probability 0–1 that month-end spend exceeds income */
  overrunProbability: number;
  /**
   * Simple closing balance: income − already spent − pending bills.
   * More conservative than projectedSavings — doesn't extrapolate variable pace.
   */
  projectedClosingBalance: number;

  // ── Actionable ────────────────────────────────────────────────────────────
  /** (available_variable_budget - current_variable_spend) / daysRemaining */
  safeToSpendPerDay: number;
  /** safeToSpendPerDay * 1 (today's budget) */
  safeToSpendToday: number;
  /** Total variable budget remaining for the month */
  variableBudgetRemaining: number;

  // ── Diagnostics ───────────────────────────────────────────────────────────
  dailyPace: number;
  /** Confidence 0–1 based on data completeness (days elapsed / days in month) */
  confidence: number;
}

// =============================================================================
// SPENDING INTELLIGENCE OUTPUT
// =============================================================================

export type TrendDirection = "increasing" | "stable" | "decreasing";
export type AnomalySeverity = "low" | "medium" | "high";

export interface CategoryTrend {
  categoryId: string | null;
  categoryName: string;
  /** Recent 30-day total */
  recentTotal: number;
  /** Prior 30-day total (days 31–60 ago) */
  priorTotal: number;
  /** Month-over-month change ratio — can be negative */
  changeRatio: number;
  direction: TrendDirection;
}

export interface SpendingAnomaly {
  categoryName: string;
  currentMonthPaced: number;
  historicalMean: number;
  historicalStdDev: number;
  zScore: number;
  severity: AnomalySeverity;
  /** "Dining is tracking 2.4× your usual monthly spend" */
  description: string;
}

export interface SpendingIntelligence {
  categoryTrends: CategoryTrend[];
  /** Top 3 fastest-growing categories by changeRatio */
  topGrowingCategories: CategoryTrend[];
  /** Top 3 fastest-shrinking categories (where data is meaningful) */
  topShrinkingCategories: CategoryTrend[];
  spendingAnomalies: SpendingAnomaly[];
  /** Ratio: avg_daily_weekend_spend / avg_daily_weekday_spend */
  weekendSpendingRatio: number;
  /** Fraction of monthly spend in the last 7 calendar days (0–1) */
  monthEndConcentration: number;
  /** Rolling trajectory based on last month vs 3-month average */
  spendingTrajectory: "improving" | "stable" | "deteriorating";
  /** Month-over-month change of total spend (last month vs prior month) */
  totalSpendMoMChange: number;
  /** Categories whose monthly growth > 20% — warrant user attention */
  highGrowthCategories: string[];
}

// =============================================================================
// PORTFOLIO ANALYTICS OUTPUT
// =============================================================================

export interface AllocationSlice {
  type: string;
  label: string;
  value: number;
  cost: number;
  gainLoss: number;
  gainLossPercent: number;
  /** Fraction of total portfolio value (0–1) */
  fraction: number;
  count: number;
}

export type ConcentrationRisk = "low" | "moderate" | "high" | "critical";

export interface PortfolioAnalytics {
  // ── Totals ────────────────────────────────────────────────────────────────
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;

  // ── Allocation ────────────────────────────────────────────────────────────
  allocationByType: AllocationSlice[];

  // ── Diversification ───────────────────────────────────────────────────────
  /**
   * Herfindahl-Hirschman Index (0–1).
   * 1.0 = all assets in one type.
   * 0.2 = perfectly spread across 5 types.
   */
  hhi: number;
  /**
   * Normalised diversification score 0–100.
   * Derived from HHI: higher score = better diversified.
   */
  diversificationScore: number;
  concentrationRisk: ConcentrationRisk;

  // ── Risk signals ──────────────────────────────────────────────────────────
  /** Fraction of portfolio in crypto (0–1). > 0.3 is considered high. */
  cryptoExposure: number;
  /** The single largest position by current value */
  largestPosition: { name: string; value: number; percent: number } | null;
  /** Number of distinct investment types held */
  assetTypeCount: number;

  // ── Meta ──────────────────────────────────────────────────────────────────
  positionCount: number;
  isEmpty: boolean;
}

// =============================================================================
// RECOMMENDATION OUTPUT
// =============================================================================

export type RecommendationSeverity = "critical" | "warning" | "info" | "positive";
export type RecommendationCategory =
  | "savings"
  | "spending"
  | "investments"
  | "goals"
  | "income"
  | "budget"
  | "risk";

export interface FinancialImpact {
  type: "monthly_savings" | "annual_savings" | "risk_reduction" | "opportunity" | "cost_avoidance";
  /** Estimated monetary amount in the user's currency, null if not quantifiable */
  estimatedAmount: number | null;
  /** i18n key for the impact chip — rendered via t(impactKey, params) */
  impactKey: string;
}

/**
 * Dynamic values produced by the engine — raw numbers, names, percentages.
 * The UI layer formats these (currency, percent) before interpolation into t().
 */
export type RecommendationParams = Record<string, string | number>;

export interface Recommendation {
  /**
   * Deterministic ID derived from the rule name.
   * Stable across runs so the UI can dedup and the DB can upsert.
   * The UI looks up copy in the recommendation catalog by this id.
   */
  id: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  /** Raw dynamic values for i18n interpolation: { deficit: 500, rate: 8, ... } */
  params: RecommendationParams;
  financialImpact: FinancialImpact;
  /** How confident the engine is in this recommendation (0–1) */
  confidence: number;
  /** Ordering priority — lower number = more important */
  priority: number;
}

// =============================================================================
// COMBINED ENGINE OUTPUT
// =============================================================================

export interface FinancialEngineOutput {
  healthScore: HealthScore;
  budgetForecast: BudgetForecast;
  spendingIntelligence: SpendingIntelligence;
  portfolioAnalytics: PortfolioAnalytics;
  recommendations: Recommendation[];
  /** Sum of all savings account balances */
  totalSavings: number;
  /** Net worth: totalSavings + portfolio value (debts = 0) */
  netWorth: number;
  /** ISO timestamp of when this output was computed */
  computedAt: string;
}
