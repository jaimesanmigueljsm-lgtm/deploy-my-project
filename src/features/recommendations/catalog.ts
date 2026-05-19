/**
 * catalog.ts — Recommendation UI catalog.
 *
 * Maps stable engine rule IDs → translation keys + param formatting hints.
 * The engine emits raw numbers; this catalog tells the UI layer which params
 * to format as money (shortMoney) or percent before passing to t().
 *
 * Lookup:  getCatalogEntry(rec.id) — handles prefix-matched IDs like
 *          "goal-deadline-pressure-abc123" → "goal-deadline-pressure" entry.
 */

export interface CatalogEntry {
  titleKey: string;
  explanationKey: string;
  actionKey: string;
  /** Param names that should be formatted as shortMoney(value, currency) */
  moneyParams?: string[];
  /** Param names that should be formatted as "N%" */
  percentParams?: string[];
}

const CATALOG: Record<string, CatalogEntry> = {
  "savings-negative": {
    titleKey:       "rec.savingsNegative.title",
    explanationKey: "rec.savingsNegative.explanation",
    actionKey:      "rec.savingsNegative.action",
    moneyParams:    ["deficit"],
  },
  "savings-low": {
    titleKey:       "rec.savingsLow.title",
    explanationKey: "rec.savingsLow.explanation",
    actionKey:      "rec.savingsLow.action",
    percentParams:  ["rate"],
    moneyParams:    ["gap"],
  },
  "savings-excellent": {
    titleKey:       "rec.savingsExcellent.title",
    explanationKey: "rec.savingsExcellent.explanation",
    actionKey:      "rec.savingsExcellent.action",
    percentParams:  ["rate"],
  },
  "emergency-fund-critical": {
    titleKey:       "rec.emergencyFundCritical.title",
    explanationKey: "rec.emergencyFundCritical.explanation",
    actionKey:      "rec.emergencyFundCritical.action",
    moneyParams:    ["target", "monthly"],
  },
  "emergency-fund-low": {
    titleKey:       "rec.emergencyFundLow.title",
    explanationKey: "rec.emergencyFundLow.explanation",
    actionKey:      "rec.emergencyFundLow.action",
    moneyParams:    ["gap"],
  },
  "recurring-pressure-critical": {
    titleKey:       "rec.recurringPressureCritical.title",
    explanationKey: "rec.recurringPressureCritical.explanation",
    actionKey:      "rec.recurringPressureCritical.action",
    percentParams:  ["ratio"],
    moneyParams:    ["potential"],
  },
  "recurring-pressure-elevated": {
    titleKey:       "rec.recurringPressureElevated.title",
    explanationKey: "rec.recurringPressureElevated.explanation",
    actionKey:      "rec.recurringPressureElevated.action",
    percentParams:  ["ratio"],
  },
  "portfolio-empty": {
    titleKey:       "rec.portfolioEmpty.title",
    explanationKey: "rec.portfolioEmpty.explanation",
    actionKey:      "rec.portfolioEmpty.action",
  },
  "portfolio-crypto-overweight": {
    titleKey:       "rec.portfolioCryptoOverweight.title",
    explanationKey: "rec.portfolioCryptoOverweight.explanation",
    actionKey:      "rec.portfolioCryptoOverweight.action",
    percentParams:  ["cryptoPercent"],
  },
  "portfolio-position-concentrated": {
    titleKey:       "rec.portfolioPositionConcentrated.title",
    explanationKey: "rec.portfolioPositionConcentrated.explanation",
    actionKey:      "rec.portfolioPositionConcentrated.action",
    percentParams:  ["percent"],
  },
  "portfolio-low-diversification": {
    titleKey:       "rec.portfolioLowDiversification.title",
    explanationKey: "rec.portfolioLowDiversification.explanation",
    actionKey:      "rec.portfolioLowDiversification.action",
  },
  "goal-contribution-low": {
    titleKey:       "rec.goalContributionLow.title",
    explanationKey: "rec.goalContributionLow.explanation",
    actionKey:      "rec.goalContributionLow.action",
  },
  "goal-deadline-pressure": {
    titleKey:       "rec.goalDeadlinePressure.title",
    explanationKey: "rec.goalDeadlinePressure.explanation",
    actionKey:      "rec.goalDeadlinePressure.action",
    percentParams:  ["completion"],
    moneyParams:    ["required"],
  },
  "budget-overrun-projected": {
    titleKey:       "rec.budgetOverrunProjected.title",
    explanationKey: "rec.budgetOverrunProjected.explanation",
    actionKey:      "rec.budgetOverrunProjected.action",
    moneyParams:    ["overrun", "safePerDay"],
  },
};

/**
 * Looks up a catalog entry by exact ID or by prefix (for dynamic IDs like
 * "goal-deadline-pressure-abc123").
 */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
  if (CATALOG[id]) return CATALOG[id];
  const prefix = Object.keys(CATALOG).find((k) => id.startsWith(k + "-"));
  return prefix ? CATALOG[prefix] : undefined;
}
