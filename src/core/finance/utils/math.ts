/**
 * math.ts — Safe financial arithmetic utilities.
 *
 * All functions are pure, side-effect-free, and handle edge cases (empty arrays,
 * division by zero, NaN inputs) by returning a defined fallback value rather
 * than throwing or propagating NaN into the scoring pipeline.
 */

/** Divide a by b; returns fallback (default 0) if b is zero or either operand is NaN. */
export function safeDivide(a: number, b: number, fallback = 0): number {
  if (!isFinite(a) || !isFinite(b) || b === 0) return fallback;
  return a / b;
}

/** Clamp a value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arithmetic mean of a numeric array; 0 if empty. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Population standard deviation; 0 if fewer than 2 values. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Coefficient of Variation (stdDev / mean).
 * Returns 0 if mean is zero (no variability in a flat series).
 * Returns 1 if mean is negative (degenerate case — treat as maximum variability).
 */
export function cv(values: number[]): number {
  const m = mean(values);
  if (m <= 0) return m === 0 ? 0 : 1;
  return stdDev(values) / m;
}

/**
 * Herfindahl-Hirschman Index for a set of value shares.
 * HHI = Σ(share_i²) where share_i = value_i / Σvalue_j.
 *
 * Range: [1/n, 1.0] for n categories where all values are equal → 1/n (perfect spread),
 * one category = all → 1.0.
 *
 * Returns 1.0 if values array is empty or sum is zero (treat as maximally concentrated).
 */
export function hhi(values: number[]): number {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0 || values.length === 0) return 1;
  return values.reduce((s, v) => s + (v / total) ** 2, 0);
}

/**
 * Z-score of a value given a historical mean and standard deviation.
 * Returns 0 if stdDev is 0 (no spread → value is "average").
 */
export function zScore(value: number, historicalMean: number, historicalStd: number): number {
  if (historicalStd <= 0) return 0;
  return (value - historicalMean) / historicalStd;
}

/** Round to a given number of decimal places (default 2). */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Compute what percentage `part` is of `whole`; 0 if whole is 0. */
export function percentOf(part: number, whole: number): number {
  return safeDivide(part, whole, 0) * 100;
}

/**
 * Weighted sum of score/weight pairs, clamped to [0, 100].
 * Expects weights to already sum to 1.0.
 */
export function weightedSum(components: Array<{ score: number; weight: number }>): number {
  const raw = components.reduce((s, c) => s + c.score * c.weight, 0);
  return clamp(Math.round(raw), 0, 100);
}

/**
 * Piecewise threshold lookup.
 * Finds the first entry where `value <= maxField` and returns the corresponding score.
 * Returns the last entry's score if none match (should be an Infinity sentinel row).
 */
export function lookupThreshold<T extends Record<string, number | string>>(
  thresholds: readonly T[],
  maxField: keyof T,
  value: number,
): T {
  for (const entry of thresholds) {
    if (value <= (entry[maxField] as number)) return entry;
  }
  return thresholds[thresholds.length - 1];
}
