/**
 * engine.ts — Rules-based Recommendation Engine.
 *
 * Each rule produces a Recommendation with:
 *   - a stable `id` (used by the UI catalog to look up i18n copy)
 *   - raw numeric/string `params` (formatted by the UI layer before i18n interpolation)
 *   - `financialImpact` with an `impactKey` for the impact chip
 *
 * No English copy is produced here — all copy lives in the catalog + translations.
 */

import type {
  FinancialEngineContext,
  HealthScore,
  PortfolioAnalytics,
  BudgetForecast,
  Recommendation,
  RecommendationParams,
  FinancialImpact,
  RecommendationCategory,
  RecommendationSeverity,
} from "../types";
import { RECOMMENDATION_THRESHOLDS, CRYPTO_EXPOSURE_WARNING, POSITION_CONCENTRATION_WARNING } from "../constants";
import { safeDivide } from "../utils/math";

// ─── Internal rule shape ───────────────────────────────────────────────────────

interface RuleResult {
  id: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  params: RecommendationParams;
  financialImpact: FinancialImpact;
  confidence: number;
  priority: number;
}

// ─── Savings rules ────────────────────────────────────────────────────────────

function* savingsRules(ctx: FinancialEngineContext, hs: HealthScore): Generator<RuleResult> {
  const rate = safeDivide(hs.avgMonthlyIncome - hs.avgMonthlyExpenses, hs.avgMonthlyIncome, -1);

  if (rate < RECOMMENDATION_THRESHOLDS.savingsRateCritical) {
    const deficit = Math.abs(hs.avgMonthlyExpenses - hs.avgMonthlyIncome);
    yield {
      id: "savings-negative",
      severity: "critical",
      category: "savings",
      params: { deficit: Math.round(deficit) },
      financialImpact: {
        type: "monthly_savings",
        estimatedAmount: deficit,
        impactKey: "rec.impact.monthlySavings",
      },
      confidence: 0.95,
      priority: 1,
    };
  } else if (rate < RECOMMENDATION_THRESHOLDS.savingsRateWarning) {
    const gap = (RECOMMENDATION_THRESHOLDS.savingsRateWarning - rate) * hs.avgMonthlyIncome;
    yield {
      id: "savings-low",
      severity: "warning",
      category: "savings",
      params: { rate: Math.round(rate * 100), gap: Math.round(gap) },
      financialImpact: {
        type: "annual_savings",
        estimatedAmount: gap * 12,
        impactKey: "rec.impact.annualSavings",
      },
      confidence: 0.90,
      priority: 2,
    };
  } else if (rate >= RECOMMENDATION_THRESHOLDS.savingsRatePositive) {
    yield {
      id: "savings-excellent",
      severity: "positive",
      category: "savings",
      params: { rate: Math.round(rate * 100) },
      financialImpact: {
        type: "opportunity",
        estimatedAmount: null,
        impactKey: "rec.impact.opportunity",
      },
      confidence: 0.80,
      priority: 20,
    };
  }
}

// ─── Emergency fund rules ─────────────────────────────────────────────────────

function* emergencyFundRules(ctx: FinancialEngineContext, hs: HealthScore): Generator<RuleResult> {
  const months = hs.subScores.emergencyReadiness.rawValue;

  if (months < RECOMMENDATION_THRESHOLDS.emergencyFundCritical) {
    const base = hs.essentialMonthlyExpenses ?? hs.avgMonthlyExpenses;
    const target = base * 3;
    yield {
      id: "emergency-fund-critical",
      severity: "critical",
      category: "risk",
      params: { target: Math.round(target), monthly: Math.round(target / 12) },
      financialImpact: {
        type: "risk_reduction",
        estimatedAmount: target,
        impactKey: "rec.impact.riskReduction",
      },
      confidence: 0.95,
      priority: 1,
    };
  } else if (months < RECOMMENDATION_THRESHOLDS.emergencyFundWarning) {
    const base = hs.essentialMonthlyExpenses ?? hs.avgMonthlyExpenses;
    const gap = base * 3 - months * base;
    yield {
      id: "emergency-fund-low",
      severity: "warning",
      category: "risk",
      params: { months: +months.toFixed(1), gap: Math.round(gap) },
      financialImpact: {
        type: "risk_reduction",
        estimatedAmount: gap,
        impactKey: "rec.impact.riskReduction",
      },
      confidence: 0.90,
      priority: 3,
    };
  }
}

// ─── Recurring pressure rules ─────────────────────────────────────────────────

function* recurringPressureRules(ctx: FinancialEngineContext, hs: HealthScore): Generator<RuleResult> {
  const ratio = hs.subScores.fixedExpensePressure.rawValue;

  if (ratio > RECOMMENDATION_THRESHOLDS.recurringPressureCritical) {
    yield {
      id: "recurring-pressure-critical",
      severity: "critical",
      category: "spending",
      params: {
        ratio: Math.round(ratio * 100),
        potential: Math.round((ratio - 0.50) * hs.avgMonthlyIncome),
      },
      financialImpact: {
        type: "monthly_savings",
        estimatedAmount: (ratio - 0.50) * hs.avgMonthlyIncome,
        impactKey: "rec.impact.monthlySavings",
      },
      confidence: 0.85,
      priority: 2,
    };
  } else if (ratio > RECOMMENDATION_THRESHOLDS.recurringPressureWarning) {
    yield {
      id: "recurring-pressure-elevated",
      severity: "warning",
      category: "spending",
      params: { ratio: Math.round(ratio * 100) },
      financialImpact: {
        type: "monthly_savings",
        estimatedAmount: null,
        impactKey: "rec.impact.opportunityFlexibility",
      },
      confidence: 0.80,
      priority: 5,
    };
  }
}

// ─── Portfolio rules ──────────────────────────────────────────────────────────

function* portfolioRules(ctx: FinancialEngineContext, pa: PortfolioAnalytics): Generator<RuleResult> {
  if (pa.isEmpty) {
    yield {
      id: "portfolio-empty",
      severity: "info",
      category: "investments",
      params: {},
      financialImpact: {
        type: "opportunity",
        estimatedAmount: null,
        impactKey: "rec.impact.opportunityPortfolio",
      },
      confidence: 0.70,
      priority: 15,
    };
    return;
  }

  if (pa.cryptoExposure > CRYPTO_EXPOSURE_WARNING) {
    yield {
      id: "portfolio-crypto-overweight",
      severity: "warning",
      category: "investments",
      params: { cryptoPercent: Math.round(pa.cryptoExposure * 100) },
      financialImpact: {
        type: "risk_reduction",
        estimatedAmount: null,
        impactKey: "rec.impact.riskReductionGeneral",
      },
      confidence: 0.85,
      priority: 7,
    };
  }

  if (pa.largestPosition && pa.largestPosition.percent > POSITION_CONCENTRATION_WARNING * 100) {
    yield {
      id: "portfolio-position-concentrated",
      severity: "warning",
      category: "investments",
      params: {
        name: pa.largestPosition.name,
        percent: Math.round(pa.largestPosition.percent),
      },
      financialImpact: {
        type: "risk_reduction",
        estimatedAmount: null,
        impactKey: "rec.impact.riskReductionGeneral",
      },
      confidence: 0.80,
      priority: 8,
    };
  }

  if (pa.diversificationScore < RECOMMENDATION_THRESHOLDS.diversificationWarning) {
    yield {
      id: "portfolio-low-diversification",
      severity: "warning",
      category: "investments",
      params: { score: Math.round(pa.diversificationScore) },
      financialImpact: {
        type: "risk_reduction",
        estimatedAmount: null,
        impactKey: "rec.impact.riskReductionGeneral",
      },
      confidence: 0.75,
      priority: 9,
    };
  }
}

// ─── Goal rules ───────────────────────────────────────────────────────────────

function* goalRules(ctx: FinancialEngineContext, hs: HealthScore): Generator<RuleResult> {
  const totalContrib = ctx.goals.reduce((s, g) => s + g.monthlyContribution, 0);
  const contribRate = safeDivide(totalContrib, hs.avgMonthlyIncome, 0);

  if (ctx.goals.length > 0 && contribRate < RECOMMENDATION_THRESHOLDS.goalContributionLow) {
    yield {
      id: "goal-contribution-low",
      severity: "info",
      category: "goals",
      params: {},
      financialImpact: {
        type: "opportunity",
        estimatedAmount: null,
        impactKey: "rec.impact.opportunity",
      },
      confidence: 0.75,
      priority: 12,
    };
  }

  for (const g of ctx.goals) {
    if (g.priority !== "high" || !g.deadline) continue;
    const msRemaining = g.deadline.getTime() - ctx.asOf.getTime();
    const monthsRemaining = msRemaining / (1000 * 60 * 60 * 24 * 30.44);
    const completion = safeDivide(g.currentAmount, g.targetAmount, 0);
    if (monthsRemaining > 0 && monthsRemaining <= 6 && completion < 0.50) {
      const shortfall = g.targetAmount - g.currentAmount;
      const requiredMonthly = safeDivide(shortfall, monthsRemaining, shortfall);
      yield {
        id: `goal-deadline-pressure-${g.id}`,
        severity: "warning",
        category: "goals",
        params: {
          goalName: g.name,
          months: Math.round(monthsRemaining),
          completion: Math.round(completion * 100),
          required: Math.round(requiredMonthly),
        },
        financialImpact: {
          type: "opportunity",
          estimatedAmount: shortfall,
          impactKey: "rec.impact.opportunity",
        },
        confidence: 0.85,
        priority: 4,
      };
    }
  }
}

// ─── Budget rules ─────────────────────────────────────────────────────────────

function* budgetRules(ctx: FinancialEngineContext, forecast: BudgetForecast): Generator<RuleResult> {
  if (forecast.projectedOverrun && forecast.confidence > 0.5) {
    const overrun = forecast.projectedTotalWithFixed - forecast.expectedMonthlyIncome;
    yield {
      id: "budget-overrun-projected",
      severity: "warning",
      category: "budget",
      params: {
        overrun: Math.round(overrun),
        safePerDay: Math.round(forecast.safeToSpendPerDay),
      },
      financialImpact: {
        type: "cost_avoidance",
        estimatedAmount: overrun,
        impactKey: "rec.impact.costAvoidance",
      },
      confidence: forecast.confidence,
      priority: 3,
    };
  }
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeRecommendations(
  ctx: FinancialEngineContext,
  hs: HealthScore,
  pa: PortfolioAnalytics,
  forecast: BudgetForecast,
): Recommendation[] {
  const rules: RuleResult[] = [
    ...savingsRules(ctx, hs),
    ...emergencyFundRules(ctx, hs),
    ...recurringPressureRules(ctx, hs),
    ...portfolioRules(ctx, pa),
    ...goalRules(ctx, hs),
    ...budgetRules(ctx, forecast),
  ];

  return rules
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.priority - b.priority,
    )
    .map((r) => ({ ...r }));
}
