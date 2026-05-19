import { describe, it, expect } from "vitest";
import {
  safeDivide,
  clamp,
  mean,
  stdDev,
  cv,
  hhi,
  weightedSum,
  lookupThreshold,
} from "@/core/finance/utils/math";

describe("safeDivide", () => {
  it("divides normally", () => expect(safeDivide(10, 4)).toBeCloseTo(2.5));
  it("returns fallback when divisor is zero", () => expect(safeDivide(5, 0)).toBe(0));
  it("returns custom fallback", () => expect(safeDivide(5, 0, 99)).toBe(99));
  it("returns fallback for NaN numerator", () => expect(safeDivide(NaN, 4)).toBe(0));
  it("returns fallback for NaN denominator", () => expect(safeDivide(4, NaN)).toBe(0));
  it("returns fallback for Infinity numerator", () => expect(safeDivide(Infinity, 4)).toBe(0));
  it("handles negative values", () => expect(safeDivide(-10, 2)).toBeCloseTo(-5));
});

describe("clamp", () => {
  it("clamps above max", () => expect(clamp(150, 0, 100)).toBe(100));
  it("clamps below min", () => expect(clamp(-5, 0, 100)).toBe(0));
  it("passes through value in range", () => expect(clamp(50, 0, 100)).toBe(50));
  it("handles boundary values", () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe("mean", () => {
  it("returns 0 for empty array", () => expect(mean([])).toBe(0));
  it("averages a single value", () => expect(mean([7])).toBe(7));
  it("averages multiple values", () => expect(mean([1, 2, 3, 4])).toBe(2.5));
  it("handles negative values", () => expect(mean([-2, 2])).toBe(0));
});

describe("stdDev", () => {
  it("returns 0 for empty array", () => expect(stdDev([])).toBe(0));
  it("returns 0 for a single value", () => expect(stdDev([5])).toBe(0));
  it("returns 0 for identical values", () => expect(stdDev([3, 3, 3])).toBe(0));
  it("computes population stdDev correctly", () => {
    // population stdDev of [2, 4, 4, 4, 5, 5, 7, 9] = 2
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });
});

describe("cv (coefficient of variation)", () => {
  it("returns 0 for constant values", () => expect(cv([3, 3, 3])).toBe(0));
  it("returns 0 when mean is 0", () => expect(cv([0, 0, 0])).toBe(0));
  it("returns 1 for negative mean (degenerate)", () => expect(cv([-1, -2, -3])).toBe(1));
  it("is lower for more stable series", () => {
    const stable = cv([100, 101, 99, 100]);
    const volatile = cv([50, 200, 30, 300]);
    expect(stable).toBeLessThan(volatile);
  });
});

describe("hhi", () => {
  it("returns 1 for empty array", () => expect(hhi([])).toBe(1));
  it("returns 1 for single category (fully concentrated)", () => expect(hhi([100])).toBe(1));
  it("returns 1 when sum is zero", () => expect(hhi([0, 0])).toBe(1));
  it("returns 0.5 for two equal categories", () => expect(hhi([50, 50])).toBeCloseTo(0.5, 5));
  it("returns 0.25 for four equal categories", () =>
    expect(hhi([25, 25, 25, 25])).toBeCloseTo(0.25, 5));
  it("is lower for more diversified portfolios", () => {
    expect(hhi([10, 10, 10, 10, 10])).toBeLessThan(hhi([80, 5, 5, 5, 5]));
  });
});

describe("weightedSum", () => {
  it("computes weighted composite score", () => {
    const result = weightedSum([
      { score: 100, weight: 0.5 },
      { score: 0, weight: 0.5 },
    ]);
    expect(result).toBe(50);
  });
  it("clamps to 0 when all scores are 0", () => {
    expect(weightedSum([{ score: 0, weight: 1 }])).toBe(0);
  });
  it("clamps to 100 when all scores are 100", () => {
    expect(weightedSum([{ score: 100, weight: 1 }])).toBe(100);
  });
  it("rounds to integer", () => {
    const result = weightedSum([{ score: 33.3, weight: 1 }]);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("lookupThreshold", () => {
  const bands = [
    { maxVal: 10, score: 10 },
    { maxVal: 50, score: 50 },
    { maxVal: Infinity, score: 100 },
  ] as const;

  it("returns the first matching band", () => {
    expect(lookupThreshold(bands, "maxVal", 5).score).toBe(10);
  });
  it("matches the boundary value exactly", () => {
    expect(lookupThreshold(bands, "maxVal", 10).score).toBe(10);
  });
  it("falls through to next band", () => {
    expect(lookupThreshold(bands, "maxVal", 11).score).toBe(50);
  });
  it("returns last entry for very large values", () => {
    expect(lookupThreshold(bands, "maxVal", 1_000_000).score).toBe(100);
  });
});
