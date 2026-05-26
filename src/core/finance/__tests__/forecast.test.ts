import { describe, it, expect } from "vitest";
import { computeBudgetForecast } from "@/core/finance/budgeting/forecast";
import { makeCtx, makeExpense, makeIncome, makeBill, REF_DATE, d } from "@/test/factories";

// REF_DATE = 2026-03-15 — March has 31 days, so day 15 is used.
// daysElapsed = 15, daysRemaining = 16

const MARCH_15 = REF_DATE; // 2026-03-15
const MAR_KEY = "2026-03";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function marchExpense(amount: number, day: number, kind: "fixed" | "variable" = "variable") {
  return makeExpense({ amount, spentAt: d(`2026-03-${String(day).padStart(2, "0")}`), kind });
}

function marchIncome(amount: number) {
  return makeIncome({ amount, receivedAt: d("2026-03-01") });
}

// ─── Time context ─────────────────────────────────────────────────────────────

describe("computeBudgetForecast — time context", () => {
  it("reports 31 days in March", () => {
    const { daysInMonth } = computeBudgetForecast(makeCtx({ asOf: MARCH_15 }));
    expect(daysInMonth).toBe(31);
  });

  it("currentDay = 15 on March 15", () => {
    const { currentDay } = computeBudgetForecast(makeCtx({ asOf: MARCH_15 }));
    expect(currentDay).toBe(15);
  });

  it("daysElapsed = 15 on March 15", () => {
    const { daysElapsed } = computeBudgetForecast(makeCtx({ asOf: MARCH_15 }));
    expect(daysElapsed).toBe(15);
  });

  it("daysRemaining = 16 on March 15 (31 - 15)", () => {
    const { daysRemaining } = computeBudgetForecast(makeCtx({ asOf: MARCH_15 }));
    expect(daysRemaining).toBe(16);
  });
});

// ─── Current spend accounting ──────────────────────────────────────────────────

describe("computeBudgetForecast — current spend", () => {
  it("sums only current-month expenses", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [
        marchExpense(200, 5), // March — included
        marchExpense(300, 10), // March — included
        makeExpense({ amount: 999, spentAt: d("2026-02-20") }), // Feb — excluded
      ],
      incomes: [marchIncome(3000)],
    });
    const { currentSpend } = computeBudgetForecast(ctx);
    expect(currentSpend).toBe(500);
  });

  it("separates fixed and variable spend correctly", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(600, 1, "fixed"), marchExpense(400, 10, "variable")],
      incomes: [marchIncome(3000)],
    });
    const result = computeBudgetForecast(ctx);
    expect(result.currentFixedSpend).toBe(600);
    expect(result.currentVariableSpend).toBe(400);
    expect(result.currentSpend).toBe(1000);
  });
});

// ─── Pending fixed costs ───────────────────────────────────────────────────────

describe("computeBudgetForecast — pending fixed costs", () => {
  it("includes only active unpaid bills", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      bills: [
        makeBill({ amount: 800, paidThisMonth: false, active: true }), // pending
        makeBill({ amount: 500, paidThisMonth: true, active: true }), // paid — excluded
        makeBill({ amount: 300, paidThisMonth: false, active: false }), // inactive — excluded
      ],
      incomes: [marchIncome(3000)],
    });
    const { pendingFixedCosts } = computeBudgetForecast(ctx);
    expect(pendingFixedCosts).toBe(800);
  });

  it("is 0 when all bills are paid", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      bills: [makeBill({ paidThisMonth: true })],
      incomes: [marchIncome(3000)],
    });
    const { pendingFixedCosts } = computeBudgetForecast(ctx);
    expect(pendingFixedCosts).toBe(0);
  });
});

// ─── Projection logic ──────────────────────────────────────────────────────────

describe("computeBudgetForecast — projections", () => {
  it("projects variable spend by pace, NOT total spend", () => {
    // Day 15 of 31, 600 variable spent = 40/day pace → 31 * 40 = 1240 variable projected
    // Fixed already paid = 200 → projectedMonthEnd = 1240 + 200 = 1440
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [
        marchExpense(200, 5, "fixed"), // fixed — not extrapolated
        marchExpense(600, 10, "variable"), // variable — pace extrapolated
      ],
      incomes: [marchIncome(3000)],
      bills: [],
    });
    const { projectedMonthEnd, dailyPace } = computeBudgetForecast(ctx);
    expect(dailyPace).toBeCloseTo(600 / 15, 2); // 40/day
    // projectedMonthEnd = (600/15) * 31 + 200 = 40 * 31 + 200 = 1440
    expect(projectedMonthEnd).toBeCloseTo(1440, 0);
  });

  it("adds pending bills on top of pace projection (not double-counted)", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(300, 5, "variable")],
      incomes: [marchIncome(3000)],
      bills: [makeBill({ amount: 500, paidThisMonth: false })],
    });
    const { projectedMonthEnd, projectedTotalWithFixed, pendingFixedCosts } =
      computeBudgetForecast(ctx);
    // Pending bills should be added exactly once
    expect(projectedTotalWithFixed).toBeCloseTo(projectedMonthEnd + pendingFixedCosts, 1);
  });

  it("projectedSavings = expectedIncome - projectedTotalWithFixed", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(600, 10, "variable")],
      incomes: [marchIncome(3000)],
      bills: [],
    });
    const { projectedSavings, expectedMonthlyIncome, projectedTotalWithFixed } =
      computeBudgetForecast(ctx);
    expect(projectedSavings).toBeCloseTo(expectedMonthlyIncome - projectedTotalWithFixed, 1);
  });

  it("projectedOverrun is true when projected total exceeds income", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(3000, 10, "variable")], // pace = 200/day → 6200 projected
      incomes: [marchIncome(3000)],
      bills: [],
    });
    const { projectedOverrun } = computeBudgetForecast(ctx);
    expect(projectedOverrun).toBe(true);
  });

  it("projectedOverrun is false for well-managed spending", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(500, 10, "variable")], // pace ≈ 33/day → ~1033 projected
      incomes: [marchIncome(3000)],
      bills: [],
    });
    const { projectedOverrun } = computeBudgetForecast(ctx);
    expect(projectedOverrun).toBe(false);
  });
});

// ─── Day 1 edge case ───────────────────────────────────────────────────────────

describe("computeBudgetForecast — day 1 edge case", () => {
  const DAY_1 = d("2026-03-01");

  it("daily pace is 0 with no spending on day 1", () => {
    const ctx = makeCtx({
      asOf: DAY_1,
      expenses: [],
      incomes: [makeIncome({ amount: 3000, receivedAt: DAY_1 })],
    });
    const { dailyPace } = computeBudgetForecast(ctx);
    expect(dailyPace).toBe(0);
  });

  it("confidence is low on day 1", () => {
    const ctx = makeCtx({
      asOf: DAY_1,
      expenses: [],
      incomes: [makeIncome({ amount: 3000, receivedAt: DAY_1 })],
    });
    const { confidence } = computeBudgetForecast(ctx);
    // Day 1 of 5 minimum = 0.2 * 0.5 = 0.1
    expect(confidence).toBeLessThan(0.5);
  });
});

// ─── Income fallback ───────────────────────────────────────────────────────────

describe("computeBudgetForecast — income fallback", () => {
  it("uses current month income when available", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      incomes: [
        makeIncome({ amount: 4000, receivedAt: d("2026-03-01") }), // current month
        makeIncome({ amount: 3000, receivedAt: d("2026-02-01") }), // previous month
      ],
      expenses: [],
    });
    const { expectedMonthlyIncome } = computeBudgetForecast(ctx);
    expect(expectedMonthlyIncome).toBe(4000);
  });

  it("falls back to historic average when no current-month income", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      incomes: [
        makeIncome({ amount: 2000, receivedAt: d("2026-02-01") }),
        makeIncome({ amount: 4000, receivedAt: d("2026-01-01") }),
      ],
      expenses: [],
    });
    const { expectedMonthlyIncome } = computeBudgetForecast(ctx);
    // average of [2000, 4000] = 3000
    expect(expectedMonthlyIncome).toBe(3000);
  });
});

// ─── Safe-to-spend ─────────────────────────────────────────────────────────────

describe("computeBudgetForecast — safe to spend", () => {
  it("safeToSpendPerDay decreases when more variable spend happens", () => {
    const lowSpend = computeBudgetForecast(
      makeCtx({
        asOf: MARCH_15,
        expenses: [marchExpense(100, 10, "variable")],
        incomes: [marchIncome(3000)],
      }),
    );
    const highSpend = computeBudgetForecast(
      makeCtx({
        asOf: MARCH_15,
        expenses: [marchExpense(700, 10, "variable")],
        incomes: [marchIncome(3000)],
      }),
    );
    expect(lowSpend.safeToSpendPerDay).toBeGreaterThan(highSpend.safeToSpendPerDay);
  });

  it("safeToSpendPerDay is 0 when variable budget is exhausted", () => {
    // 30% of 3000 = 900 variable budget; spend > 900 → 0
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(1500, 10, "variable")],
      incomes: [marchIncome(3000)],
    });
    const { safeToSpendPerDay } = computeBudgetForecast(ctx);
    expect(safeToSpendPerDay).toBe(0);
  });

  it("variableBudgetRemaining is non-negative", () => {
    const ctx = makeCtx({
      asOf: MARCH_15,
      expenses: [marchExpense(2000, 10, "variable")],
      incomes: [marchIncome(3000)],
    });
    const { variableBudgetRemaining } = computeBudgetForecast(ctx);
    expect(variableBudgetRemaining).toBeGreaterThanOrEqual(0);
  });
});

// ─── Confidence ───────────────────────────────────────────────────────────────

describe("computeBudgetForecast — confidence", () => {
  it("confidence increases through the month", () => {
    const early = computeBudgetForecast(makeCtx({ asOf: d("2026-03-03") }));
    const mid = computeBudgetForecast(makeCtx({ asOf: MARCH_15 }));
    const late = computeBudgetForecast(makeCtx({ asOf: d("2026-03-28") }));
    expect(mid.confidence).toBeGreaterThan(early.confidence);
    expect(late.confidence).toBeGreaterThan(mid.confidence);
  });

  it("confidence is in [0, 1]", () => {
    const { confidence } = computeBudgetForecast(makeCtx());
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});
