import type { Investment } from "@/types/finance";

export type PortfolioStats = {
  invested: number;
  value:    number;
  pl:       number;
  plPct:    number;
  byType:   Map<string, number>;
};

/**
 * Computes aggregate portfolio statistics from a list of investment positions.
 * Pure function — no side effects, fully unit-testable.
 */
export function computePortfolioStats(investments: Investment[]): PortfolioStats {
  let invested = 0;
  let value    = 0;
  const byType = new Map<string, number>();

  for (const inv of investments) {
    const cost = Number(inv.avg_cost)      * Number(inv.quantity);
    const val  = Number(inv.current_price) * Number(inv.quantity);
    invested += cost;
    value    += val;
    byType.set(inv.type, (byType.get(inv.type) ?? 0) + val);
  }

  const pl    = value - invested;
  const plPct = invested > 0 ? (pl / invested) * 100 : 0;

  return { invested, value, pl, plPct, byType };
}

/**
 * Synthetic 60-point price history anchored to the current portfolio value.
 * Replaces this with real `investment_history` data in production.
 */
export function buildSyntheticHistory(currentValue: number): { d: number; v: number }[] {
  const out: { d: number; v: number }[] = [];
  let v = currentValue * 0.85;
  for (let i = 0; i < 60; i++) {
    v += Math.sin(i / 6) * currentValue * 0.012 + currentValue * 0.0025;
    out.push({ d: i, v: Math.max(0, Math.round(v)) });
  }
  out.push({ d: 60, v: Math.round(currentValue) });
  return out;
}
