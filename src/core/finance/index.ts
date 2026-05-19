/**
 * index.ts — Public API of the Financial Intelligence Engine.
 *
 * Consumers import from "@/core/finance":
 *   - buildEngineContext   — assemble FinancialEngineContext from Supabase rows
 *   - runFinancialEngine   — run all engines and return FinancialEngineOutput
 *   - Individual engines   — for use in isolated hooks / server functions
 *   - Types                — all engine input/output types
 *   - Constants            — scoring thresholds (useful in UI for legend labels)
 */

export { buildEngineContext } from "./adapters";
export { computeHealthScore } from "./scoring/health-score";
export { computeBudgetForecast } from "./budgeting/forecast";
export { computeSpendingIntelligence } from "./analytics/spending-intel";
export { computePortfolioAnalytics } from "./investments/portfolio";
export { computeRecommendations } from "./recommendations/engine";

export type {
  FinancialEngineContext,
  FinancialEngineOutput,
  EngineProfile,
  EngineExpense,
  EngineIncome,
  EngineBill,
  EngineGoal,
  EngineInvestment,
  EngineCategory,
  HealthScore,
  HealthStatus,
  SubScore,
  RiskIndicator,
  BudgetForecast,
  SpendingIntelligence,
  CategoryTrend,
  SpendingAnomaly,
  TrendDirection,
  AnomalySeverity,
  PortfolioAnalytics,
  AllocationSlice,
  ConcentrationRisk,
  Recommendation,
  RecommendationParams,
  FinancialImpact,
  RecommendationSeverity,
  RecommendationCategory,
  MonthlyBucket,
  CategoryBucket,
} from "./types";

export {
  HEALTH_SCORE_WEIGHTS,
  SAVINGS_RATE_THRESHOLDS,
  EMERGENCY_FUND_THRESHOLDS,
  RECURRING_PRESSURE_THRESHOLDS,
  EXPENSE_STABILITY_THRESHOLDS,
  INCOME_CONSISTENCY_THRESHOLDS,
  HEALTH_STATUS_BANDS,
  INVESTMENT_TYPE_COUNT,
  HHI_CONCENTRATION_THRESHOLDS,
  CRYPTO_EXPOSURE_WARNING,
  POSITION_CONCENTRATION_WARNING,
  ANOMALY_Z_THRESHOLDS,
  BUDGET_RATIOS,
  RECOMMENDATION_THRESHOLDS,
} from "./constants";

import type { FinancialEngineContext, FinancialEngineOutput } from "./types";
import { computeHealthScore } from "./scoring/health-score";
import { computeBudgetForecast } from "./budgeting/forecast";
import { computeSpendingIntelligence } from "./analytics/spending-intel";
import { computePortfolioAnalytics } from "./investments/portfolio";
import { computeRecommendations } from "./recommendations/engine";

/**
 * Run all five engines in a single call.
 *
 * This is the primary entry point for hooks and server functions.
 * All engines share the same context — no redundant data fetching.
 */
export function runFinancialEngine(ctx: FinancialEngineContext): FinancialEngineOutput {
  const healthScore = computeHealthScore(ctx);
  const budgetForecast = computeBudgetForecast(ctx);
  const spendingIntelligence = computeSpendingIntelligence(ctx);
  const portfolioAnalytics = computePortfolioAnalytics(ctx);
  const recommendations = computeRecommendations(ctx, healthScore, portfolioAnalytics, budgetForecast);

  return {
    healthScore,
    budgetForecast,
    spendingIntelligence,
    portfolioAnalytics,
    recommendations,
    computedAt: ctx.asOf.toISOString(),
  };
}
