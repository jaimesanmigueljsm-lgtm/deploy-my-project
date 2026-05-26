import { describe, it, expect } from "vitest";
import {
  HEALTH_SCORE_WEIGHTS,
  SAVINGS_RATE_THRESHOLDS,
  EMERGENCY_FUND_THRESHOLDS,
  FIXED_EXPENSE_PRESSURE_THRESHOLDS,
  EXPENSE_STABILITY_THRESHOLDS,
  INCOME_CONSISTENCY_THRESHOLDS,
  HEALTH_STATUS_BANDS,
} from "@/core/finance/constants";

describe("HEALTH_SCORE_WEIGHTS", () => {
  it("has exactly 6 factors", () => {
    expect(Object.keys(HEALTH_SCORE_WEIGHTS)).toHaveLength(6);
  });

  it("sum equals 1.0 within floating-point tolerance", () => {
    const sum = Object.values(HEALTH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
  });

  it("every weight is positive", () => {
    for (const w of Object.values(HEALTH_SCORE_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
    }
  });

  it("no single factor dominates (each weight <= 0.35)", () => {
    for (const w of Object.values(HEALTH_SCORE_WEIGHTS)) {
      expect(w).toBeLessThanOrEqual(0.35);
    }
  });
});

describe("Threshold arrays — structural invariants", () => {
  const thresholdSets = [
    { name: "SAVINGS_RATE_THRESHOLDS", data: SAVINGS_RATE_THRESHOLDS, maxField: "maxRate" },
    { name: "EMERGENCY_FUND_THRESHOLDS", data: EMERGENCY_FUND_THRESHOLDS, maxField: "maxMonths" },
    {
      name: "FIXED_EXPENSE_PRESSURE_THRESHOLDS",
      data: FIXED_EXPENSE_PRESSURE_THRESHOLDS,
      maxField: "maxRatio",
    },
    {
      name: "EXPENSE_STABILITY_THRESHOLDS",
      data: EXPENSE_STABILITY_THRESHOLDS,
      maxField: "maxCV",
    },
    {
      name: "INCOME_CONSISTENCY_THRESHOLDS",
      data: INCOME_CONSISTENCY_THRESHOLDS,
      maxField: "maxCV",
    },
  ] as const;

  for (const { name, data, maxField } of thresholdSets) {
    it(`${name}: last entry has Infinity sentinel`, () => {
      const last = data[data.length - 1];
      expect((last as unknown as Record<string, number>)[maxField]).toBe(Infinity);
    });

    it(`${name}: scores are in range [0, 100]`, () => {
      for (const entry of data) {
        expect(entry.score).toBeGreaterThanOrEqual(0);
        expect(entry.score).toBeLessThanOrEqual(100);
      }
    });

    it(`${name}: has at least 2 bands`, () => {
      expect(data.length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe("HEALTH_STATUS_BANDS", () => {
  it("covers the full 0–1000 score range with no gaps", () => {
    // Sort bands by minScore descending and verify contiguous coverage
    const sorted = [...HEALTH_STATUS_BANDS].sort((a, b) => b.minScore - a.minScore);
    expect(sorted[0].minScore).toBe(850); // excellent starts at 850
    expect(sorted[sorted.length - 1].minScore).toBe(0); // unstable starts at 0
  });

  it("has exactly 5 named status levels", () => {
    const statuses = HEALTH_STATUS_BANDS.map((b) => b.status);
    expect(statuses).toContain("excellent");
    expect(statuses).toContain("strong");
    expect(statuses).toContain("healthy");
    expect(statuses).toContain("improving");
    expect(statuses).toContain("unstable");
    expect(statuses).toHaveLength(5);
  });

  it("bands are in descending order of minScore", () => {
    for (let i = 0; i < HEALTH_STATUS_BANDS.length - 1; i++) {
      expect(HEALTH_STATUS_BANDS[i].minScore).toBeGreaterThan(HEALTH_STATUS_BANDS[i + 1].minScore);
    }
  });
});
