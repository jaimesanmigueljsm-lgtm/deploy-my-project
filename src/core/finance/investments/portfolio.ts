/**
 * portfolio.ts — Investment Portfolio Analytics Engine.
 *
 * Computes allocation by asset type, HHI-based diversification score,
 * concentration risk classification, and risk signals.
 */

import type { FinancialEngineContext, PortfolioAnalytics, AllocationSlice, ConcentrationRisk } from "../types";
import {
  INVESTMENT_TYPE_COUNT,
  HHI_CONCENTRATION_THRESHOLDS,
  CRYPTO_EXPOSURE_WARNING,
  POSITION_CONCENTRATION_WARNING,
} from "../constants";
import { safeDivide, clamp, hhi } from "../utils/math";

const TYPE_LABELS: Record<string, string> = {
  stock:   "Stocks",
  etf:     "ETFs",
  crypto:  "Crypto",
  savings: "Savings",
  other:   "Other",
};

export function computePortfolioAnalytics(ctx: FinancialEngineContext): PortfolioAnalytics {
  if (ctx.investments.length === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalGainLossPercent: 0,
      allocationByType: [],
      hhi: 1,
      diversificationScore: 0,
      concentrationRisk: "critical",
      cryptoExposure: 0,
      largestPosition: null,
      assetTypeCount: 0,
      positionCount: 0,
      isEmpty: true,
    };
  }

  // ── Per-investment metrics ────────────────────────────────────────────────
  const positions = ctx.investments.map((inv) => ({
    inv,
    value: inv.quantity * inv.currentPrice,
    cost: inv.quantity * inv.avgCost,
  }));

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.cost, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = safeDivide(totalGainLoss, totalCost, 0) * 100;

  // ── Allocation by type ────────────────────────────────────────────────────
  const typeMap = new Map<string, { value: number; cost: number; count: number }>();
  for (const { inv, value, cost } of positions) {
    const existing = typeMap.get(inv.type) ?? { value: 0, cost: 0, count: 0 };
    typeMap.set(inv.type, {
      value: existing.value + value,
      cost: existing.cost + cost,
      count: existing.count + 1,
    });
  }

  const allocationByType: AllocationSlice[] = Array.from(typeMap.entries()).map(
    ([type, agg]) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      value: agg.value,
      cost: agg.cost,
      gainLoss: agg.value - agg.cost,
      gainLossPercent: safeDivide(agg.value - agg.cost, agg.cost, 0) * 100,
      fraction: safeDivide(agg.value, totalValue, 0),
      count: agg.count,
    }),
  );
  allocationByType.sort((a, b) => b.value - a.value);

  // ── HHI & diversification ────────────────────────────────────────────────
  const typeValues = allocationByType.map((s) => s.value);
  const hhiValue = hhi(typeValues);

  // Normalise score: 0 at HHI=1.0 (monopoly), 100 at HHI=1/N (perfect spread)
  const minHHI = 1 / INVESTMENT_TYPE_COUNT;
  const diversificationScore =
    hhiValue <= minHHI
      ? 100
      : clamp(((1 - hhiValue) / (1 - minHHI)) * 100, 0, 100);

  const concentrationRisk: ConcentrationRisk =
    hhiValue < HHI_CONCENTRATION_THRESHOLDS.low
      ? "low"
      : hhiValue < HHI_CONCENTRATION_THRESHOLDS.moderate
        ? "moderate"
        : hhiValue < HHI_CONCENTRATION_THRESHOLDS.high
          ? "high"
          : "critical";

  // ── Risk signals ─────────────────────────────────────────────────────────
  const cryptoSlice = allocationByType.find((s) => s.type === "crypto");
  const cryptoExposure = cryptoSlice ? cryptoSlice.fraction : 0;

  const largestPositionRaw = positions.reduce(
    (best, p) => (p.value > (best?.value ?? -1) ? p : best),
    null as (typeof positions)[0] | null,
  );
  const largestPosition = largestPositionRaw
    ? {
        name: largestPositionRaw.inv.name,
        value: largestPositionRaw.value,
        percent: safeDivide(largestPositionRaw.value, totalValue, 0) * 100,
      }
    : null;

  const assetTypeCount = typeMap.size;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    allocationByType,
    hhi: hhiValue,
    diversificationScore,
    concentrationRisk,
    cryptoExposure,
    largestPosition,
    assetTypeCount,
    positionCount: ctx.investments.length,
    isEmpty: false,
  };
}
