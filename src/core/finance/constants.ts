/**
 * constants.ts — Financial benchmarks, scoring thresholds, and engine weights.
 *
 * Philosophy: The health score measures financial stability and peace of mind,
 * NOT financial sophistication. Investing is optional and never penalised.
 *
 * Sources:
 *   - 50/30/20 Rule (Elizabeth Warren)
 *   - Emergency Fund: 3–6 months expenses (CFPB)
 *   - Fixed cost ceiling: 40–55% of income (personal finance consensus)
 */

// =============================================================================
// HEALTH SCORE WEIGHTS
// 6 factors focused on stability and resilience. Must sum to exactly 1.0.
// Investment participation is NOT scored — it should never penalise users.
// =============================================================================

export const HEALTH_SCORE_WEIGHTS = {
  savingsConsistency:    0.25,  // Are you building a surplus each month?
  emergencyReadiness:    0.25,  // Do you have a safety net?
  fixedExpensePressure:  0.20,  // Are fixed costs squeezing your income?
  spendingStability:     0.15,  // Is your spending predictable?
  goalConsistency:       0.10,  // Are you working toward your goals?
  incomeReliability:     0.05,  // Is your income stable?
} as const;

const _weightSum = Object.values(HEALTH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(_weightSum - 1.0) > 1e-9) {
  throw new Error(`HEALTH_SCORE_WEIGHTS must sum to 1.0, got ${_weightSum}`);
}

// =============================================================================
// SAVINGS CONSISTENCY THRESHOLDS
// Based on the 50/30/20 rule: 20% is the target savings rate.
// =============================================================================

export const SAVINGS_RATE_THRESHOLDS = [
  { maxRate: -0.001,   score: 0,   label: "Overspending" },    // spending > income
  { maxRate:  0.05,    score: 15,  label: "Very low" },        // 0–5%
  { maxRate:  0.10,    score: 35,  label: "Below target" },    // 5–10%
  { maxRate:  0.15,    score: 55,  label: "Developing" },      // 10–15%
  { maxRate:  0.20,    score: 75,  label: "On target" },       // 15–20%
  { maxRate:  0.30,    score: 88,  label: "Strong" },          // 20–30%
  { maxRate: Infinity, score: 100, label: "Excellent" },       // 30%+
] as const;

// =============================================================================
// EMERGENCY READINESS THRESHOLDS
// Measured in months of ESSENTIAL expenses covered (bills + basic living costs).
// Source: CFPB recommends 3–6 months. Under 1 month is a critical risk.
// =============================================================================

export const EMERGENCY_FUND_THRESHOLDS = [
  { maxMonths: 0,        score: 0,   label: "No fund" },
  { maxMonths: 1,        score: 15,  label: "Critical" },
  { maxMonths: 2,        score: 35,  label: "Insufficient" },
  { maxMonths: 3,        score: 55,  label: "Building" },
  { maxMonths: 6,        score: 80,  label: "Adequate" },
  { maxMonths: Infinity, score: 100, label: "Excellent" },
] as const;

// =============================================================================
// FIXED EXPENSE PRESSURE THRESHOLDS
// fixed_expenses / net_income. Based on the spec:
//   < 40% → excellent
//   40–55% → healthy
//   55–70% → risky
//   > 70% → dangerous
// =============================================================================

export const FIXED_EXPENSE_PRESSURE_THRESHOLDS = [
  { maxRatio: 0.40,     score: 100, label: "Excellent" },
  { maxRatio: 0.55,     score: 75,  label: "Healthy" },
  { maxRatio: 0.70,     score: 40,  label: "Risky" },
  { maxRatio: Infinity, score: 10,  label: "Dangerous" },
] as const;

// Keep alias for backward compat with recommendation engine
export const RECURRING_PRESSURE_THRESHOLDS = FIXED_EXPENSE_PRESSURE_THRESHOLDS;

// =============================================================================
// SPENDING STABILITY (Coefficient of Variation)
// Lower CV = more predictable spending = better planning capacity.
// =============================================================================

export const EXPENSE_STABILITY_THRESHOLDS = [
  { maxCV: 0.05,     score: 100, label: "Very stable" },
  { maxCV: 0.10,     score: 85,  label: "Stable" },
  { maxCV: 0.20,     score: 70,  label: "Moderate" },
  { maxCV: 0.35,     score: 50,  label: "Variable" },
  { maxCV: 0.50,     score: 30,  label: "Volatile" },
  { maxCV: Infinity, score: 10,  label: "Erratic" },
] as const;

// =============================================================================
// INCOME RELIABILITY (Coefficient of Variation)
// Salary earners near 0; freelancers/gig workers often 20–50%.
// =============================================================================

export const INCOME_CONSISTENCY_THRESHOLDS = [
  { maxCV: 0.05,     score: 100, label: "Very consistent" },
  { maxCV: 0.10,     score: 85,  label: "Consistent" },
  { maxCV: 0.20,     score: 70,  label: "Moderate" },
  { maxCV: 0.35,     score: 50,  label: "Variable" },
  { maxCV: Infinity, score: 25,  label: "Irregular" },
] as const;

// =============================================================================
// HEALTH SCORE STATUS BANDS — 0–1000 scale
//
//   0–300   → unstable   (finances are stressed)
//   300–500 → improving  (building momentum)
//   500–700 → healthy    (solid foundations)
//   700–850 → strong     (well managed)
//   850–1000→ excellent  (thriving)
// =============================================================================

export const HEALTH_STATUS_BANDS = [
  { minScore: 850, status: "excellent" as const, label: "Excellent" },
  { minScore: 700, status: "strong"    as const, label: "Strong" },
  { minScore: 500, status: "healthy"   as const, label: "Healthy" },
  { minScore: 300, status: "improving" as const, label: "Improving" },
  { minScore: 0,   status: "unstable"  as const, label: "Unstable" },
] as const;

// =============================================================================
// ESSENTIAL EXPENSE CATEGORIES
// Used to compute "essential monthly expenses" for the emergency fund.
// Keywords matched case-insensitively against category names.
// Bills (active recurring) are always treated as essential regardless of name.
// =============================================================================

export const ESSENTIAL_CATEGORY_KEYWORDS = [
  "rent", "alquiler", "loyer", "miete", "aluguel", "affitto",
  "mortgage", "hipoteca", "hypothèque", "hypothek", "hipoteca",
  "electricity", "electricidad", "électricité", "strom", "eletricidade", "elettricità",
  "gas", "water", "agua", "eau", "wasser", "água",
  "utilities", "suministros", "services",
  "phone", "móvil", "mobile", "téléphone", "telefon", "telefone", "telefono",
  "internet", "groceries", "alimentación", "alimentation", "lebensmittel",
  "alimentação", "alimentari",
  "food", "comida", "nourriture", "essen", "comida",
  "supermarket", "supermercado", "supermarché", "supermarkt", "supermercato",
  "transport", "transporte", "transportation", "verkehr",
  "insurance", "seguro", "assurance", "versicherung", "seguro", "assicurazione",
] as const;

// =============================================================================
// PORTFOLIO DIVERSIFICATION (used by portfolio analytics only — not in core score)
// =============================================================================

export const INVESTMENT_TYPE_COUNT = 5;

export const HHI_CONCENTRATION_THRESHOLDS = {
  low:      0.15,
  moderate: 0.25,
  high:     0.50,
} as const;

export const CRYPTO_EXPOSURE_WARNING = 0.30;
export const POSITION_CONCENTRATION_WARNING = 0.40;

// =============================================================================
// SPENDING ANOMALY DETECTION
// =============================================================================

export const ANOMALY_Z_THRESHOLDS = {
  low:    1.5,
  medium: 2.0,
  high:   3.0,
} as const;

// =============================================================================
// BUDGET FORECASTING
// =============================================================================

export const MIN_DAYS_FOR_CONFIDENT_FORECAST = 5;

export const BUDGET_RATIOS = {
  needs:   0.50,
  wants:   0.30,
  savings: 0.20,
} as const;

// =============================================================================
// RECOMMENDATION ENGINE THRESHOLDS
// =============================================================================

export const RECOMMENDATION_THRESHOLDS = {
  savingsRateCritical:      0.0,
  savingsRateWarning:       0.10,
  savingsRatePositive:      0.20,
  emergencyFundCritical:    1,
  emergencyFundWarning:     3,
  fixedPressureCritical:    0.70,   // per spec: > 70% dangerous
  fixedPressureWarning:     0.55,   // per spec: 55–70% risky
  // Kept for backward compat with engine.ts
  recurringPressureCritical: 0.70,
  recurringPressureWarning:  0.55,
  diversificationWarning:    40,
  spendingGrowthInfo:        0.10,
  spendingGrowthWarning:     0.20,
  goalContributionLow:       0.05,
} as const;
