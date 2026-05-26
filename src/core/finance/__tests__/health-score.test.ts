import { describe, it, expect, beforeEach } from "vitest";
import { computeHealthScore } from "@/core/finance/scoring/health-score";
import {
  makeCtx,
  makeEmptyCtx,
  makeOverspendingCtx,
  makeGoodSaverCtx,
  makeEmergencyFundCtx,
  makeMonthlyExpenses,
  makeMonthlyFixedExpenses,
  makeMonthlyIncomes,
  makeBill,
  makeGoal,
  makeInvestment,
  REF_DATE,
} from "@/test/factories";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreIn(total: number, min: number, max: number) {
  expect(total).toBeGreaterThanOrEqual(min);
  expect(total).toBeLessThanOrEqual(max);
}

// ─── Output shape ─────────────────────────────────────────────────────────────

describe("computeHealthScore — output shape", () => {
  it("returns all required fields", () => {
    const result = computeHealthScore(makeCtx());
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("explanationKey");
    expect(result).toHaveProperty("subScores");
    expect(result).toHaveProperty("risks");
    expect(result).toHaveProperty("avgMonthlyIncome");
    expect(result).toHaveProperty("avgMonthlyExpenses");
    expect(result).toHaveProperty("essentialMonthlyExpenses");
    expect(result).toHaveProperty("asOf");
  });

  it("returns all 6 sub-scores", () => {
    const { subScores } = computeHealthScore(makeCtx());
    expect(subScores).toHaveProperty("savingsConsistency");
    expect(subScores).toHaveProperty("emergencyReadiness");
    expect(subScores).toHaveProperty("fixedExpensePressure");
    expect(subScores).toHaveProperty("spendingStability");
    expect(subScores).toHaveProperty("goalConsistency");
    expect(subScores).toHaveProperty("incomeReliability");
  });

  it("sub-score values are clamped to [0, 100]", () => {
    const { subScores } = computeHealthScore(makeCtx());
    for (const sub of Object.values(subScores)) {
      expect(sub.value).toBeGreaterThanOrEqual(0);
      expect(sub.value).toBeLessThanOrEqual(100);
    }
  });

  it("total is in [0, 1000]", () => {
    const { total } = computeHealthScore(makeCtx());
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(1000);
  });

  it("asOf matches context asOf", () => {
    const ctx = makeCtx();
    const result = computeHealthScore(ctx);
    expect(result.asOf).toEqual(ctx.asOf);
  });
});

// ─── Zero data ─────────────────────────────────────────────────────────────────

describe("computeHealthScore — zero data (empty account)", () => {
  it("does not throw with no data", () => {
    expect(() => computeHealthScore(makeEmptyCtx())).not.toThrow();
  });

  it("total is in valid range", () => {
    const { total } = computeHealthScore(makeEmptyCtx());
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(1000);
  });

  it("avgMonthlyIncome is 0 with no income data", () => {
    const { avgMonthlyIncome } = computeHealthScore(makeEmptyCtx());
    expect(avgMonthlyIncome).toBe(0);
  });

  it("avgMonthlyExpenses is 0 with no expense data", () => {
    const { avgMonthlyExpenses } = computeHealthScore(makeEmptyCtx());
    expect(avgMonthlyExpenses).toBe(0);
  });

  it("risks array is an array", () => {
    const { risks } = computeHealthScore(makeEmptyCtx());
    expect(Array.isArray(risks)).toBe(true);
  });
});

// ─── Savings consistency ───────────────────────────────────────────────────────

describe("savingsConsistency sub-score", () => {
  it("is lower when overspending", () => {
    const good = computeHealthScore(makeGoodSaverCtx());
    const bad = computeHealthScore(makeOverspendingCtx());
    expect(good.subScores.savingsConsistency.value).toBeGreaterThan(
      bad.subScores.savingsConsistency.value,
    );
  });

  it("is 0 when expenses consistently exceed income", () => {
    const ctx = makeCtx({
      expenses: makeMonthlyExpenses([4000, 4000, 4000, 4000, 4000, 4000]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.savingsConsistency.value).toBe(0);
  });

  it("is high (>=75) with a 30%+ savings rate", () => {
    const ctx = makeCtx({
      expenses: makeMonthlyExpenses([2000, 2000, 2000, 2000, 2000, 2000]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.savingsConsistency.value).toBeGreaterThanOrEqual(88);
  });

  it("flags SAVINGS_NEGATIVE risk when overspending", () => {
    const { risks } = computeHealthScore(makeOverspendingCtx());
    const codes = risks.map((r) => r.code);
    expect(codes).toContain("SAVINGS_NEGATIVE");
  });

  it("does NOT flag SAVINGS_NEGATIVE for a good saver", () => {
    const { risks } = computeHealthScore(makeGoodSaverCtx());
    const codes = risks.map((r) => r.code);
    expect(codes).not.toContain("SAVINGS_NEGATIVE");
  });
});

// ─── Emergency readiness ───────────────────────────────────────────────────────

describe("emergencyReadiness sub-score", () => {
  it("is 0 when no emergency fund exists", () => {
    const ctx = makeCtx({ goals: [] });
    const { subScores } = computeHealthScore(ctx);
    // No emergency fund → 0 months covered → score 0
    expect(subScores.emergencyReadiness.value).toBe(0);
  });

  it("is higher with a larger emergency fund", () => {
    const small = computeHealthScore(makeEmergencyFundCtx(1500));
    const large = computeHealthScore(makeEmergencyFundCtx(12000));
    expect(large.subScores.emergencyReadiness.value).toBeGreaterThan(
      small.subScores.emergencyReadiness.value,
    );
  });

  it("flags EMERGENCY_FUND_CRITICAL when no safety net", () => {
    const ctx = makeCtx({ goals: [], bills: [makeBill({ amount: 500 })] });
    const { risks } = computeHealthScore(ctx);
    const codes = risks.map((r) => r.code);
    expect(codes).toContain("EMERGENCY_FUND_CRITICAL");
  });

  it("counts savings-type investments as emergency reserves", () => {
    const expenses = makeMonthlyExpenses([1500, 1500, 1500, 1500, 1500, 1500]);
    const incomes = makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]);

    const withInvestment = computeHealthScore(
      makeCtx({
        goals: [],
        investments: [makeInvestment({ type: "savings", quantity: 1, currentPrice: 9000 })],
        expenses,
        incomes,
      }),
    );
    const withoutInvestment = computeHealthScore(
      makeCtx({
        goals: [],
        investments: [],
        expenses,
        incomes,
      }),
    );

    // Savings-type investments must count as reserves — score must be higher
    expect(withInvestment.subScores.emergencyReadiness.value).toBeGreaterThan(
      withoutInvestment.subScores.emergencyReadiness.value,
    );
  });
});

// ─── Fixed expense pressure ────────────────────────────────────────────────────

describe("fixedExpensePressure sub-score", () => {
  it("uses kind='fixed' expenses — NOT bills table", () => {
    // Bills are unpaid — if bills were used, score would be lower
    const ctx = makeCtx({
      expenses: [
        ...makeMonthlyFixedExpenses([800, 800, 800, 800, 800, 800]), // ~27% of 3000
        ...makeMonthlyExpenses([700, 700, 700, 700, 700, 700]),
      ],
      bills: [makeBill({ amount: 2000, paidThisMonth: false })], // should be ignored
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const { subScores } = computeHealthScore(ctx);
    // 800/3000 ≈ 26.7% → well under 40% → score 100 (Excellent)
    expect(subScores.fixedExpensePressure.value).toBe(100);
    expect(subScores.fixedExpensePressure.label).toBe("Excellent");
  });

  it("is lower when fixed costs are high relative to income", () => {
    const ctx = makeCtx({
      expenses: [
        ...makeMonthlyFixedExpenses([2500, 2500, 2500, 2500, 2500, 2500]), // ~83%
        ...makeMonthlyExpenses([200, 200, 200, 200, 200, 200]),
      ],
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const { subScores } = computeHealthScore(ctx);
    // 2500/3000 ≈ 83% → "Dangerous" → score 10
    expect(subScores.fixedExpensePressure.value).toBe(10);
    expect(subScores.fixedExpensePressure.label).toBe("Dangerous");
  });

  it("is 100 (Excellent) when there are no fixed expenses", () => {
    const ctx = makeCtx({
      expenses: makeMonthlyExpenses([1000, 1000, 1000, 1000, 1000, 1000]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
      bills: [],
    });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.fixedExpensePressure.value).toBe(100);
  });

  it("rawValue matches the fixed-to-income ratio", () => {
    const ctx = makeCtx({
      expenses: [
        ...makeMonthlyFixedExpenses([1200, 1200, 1200, 1200, 1200, 1200]), // 40% of 3000
      ],
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.fixedExpensePressure.rawValue).toBeCloseTo(0.4, 2);
  });

  it("flags FIXED_PRESSURE_CRITICAL when ratio > 70%", () => {
    const ctx = makeCtx({
      expenses: [...makeMonthlyFixedExpenses([2200, 2200, 2200, 2200, 2200, 2200])],
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const { risks } = computeHealthScore(ctx);
    expect(risks.map((r) => r.code)).toContain("FIXED_PRESSURE_CRITICAL");
  });
});

// ─── Spending stability ────────────────────────────────────────────────────────

describe("spendingStability sub-score", () => {
  it("is higher for very consistent spending", () => {
    const stable = makeCtx({
      expenses: makeMonthlyExpenses([1500, 1500, 1500, 1500, 1500, 1500]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const volatile = makeCtx({
      expenses: makeMonthlyExpenses([500, 3000, 800, 2800, 400, 3200]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const stableScore = computeHealthScore(stable).subScores.spendingStability.value;
    const volatileScore = computeHealthScore(volatile).subScores.spendingStability.value;
    expect(stableScore).toBeGreaterThan(volatileScore);
  });
});

// ─── Score bounds ──────────────────────────────────────────────────────────────

describe("computeHealthScore — score bounds and status mapping", () => {
  const scenarios = [
    { label: "overspending user", ctx: () => makeOverspendingCtx() },
    { label: "good saver", ctx: () => makeGoodSaverCtx() },
    { label: "empty account", ctx: () => makeEmptyCtx() },
    { label: "healthy user", ctx: () => makeCtx() },
  ];

  for (const { label, ctx } of scenarios) {
    it(`total is always in [0, 1000] for ${label}`, () => {
      const { total } = computeHealthScore(ctx());
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(1000);
    });
  }

  it("status is 'unstable' when total < 300", () => {
    // Overspending + no emergency fund should push below 300
    const ctx = makeCtx({
      expenses: makeMonthlyExpenses([4000, 4200, 3900, 4100, 4000, 4300]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
      goals: [],
    });
    const { total, status } = computeHealthScore(ctx);
    if (total < 300) {
      expect(status).toBe("unstable");
    }
  });

  it("status is 'excellent' when score >= 850", () => {
    // Very low fixed costs, good savings, large emergency fund
    const ctx = makeCtx({
      expenses: makeMonthlyExpenses([1500, 1500, 1500, 1500, 1500, 1500]),
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
      goals: [makeGoal({ currentAmount: 30_000, targetAmount: 30_000 })],
      bills: [],
    });
    const { total, status } = computeHealthScore(ctx);
    if (total >= 850) {
      expect(status).toBe("excellent");
    }
  });
});

// ─── Goal consistency ──────────────────────────────────────────────────────────

describe("goalConsistency sub-score", () => {
  it("is 50 when no goals exist (neutral default)", () => {
    const ctx = makeCtx({ goals: [] });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.goalConsistency.value).toBe(50);
  });

  it("is higher when goals are fully funded", () => {
    const ctx = makeCtx({
      goals: [makeGoal({ currentAmount: 10_000, targetAmount: 10_000 })],
    });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.goalConsistency.value).toBeGreaterThan(70);
  });

  it("is lower when goals have no progress", () => {
    const ctx = makeCtx({
      goals: [makeGoal({ currentAmount: 0, targetAmount: 10_000, monthlyContribution: 0 })],
    });
    const { subScores } = computeHealthScore(ctx);
    expect(subScores.goalConsistency.value).toBeLessThan(30);
  });
});

// ─── Income reliability ────────────────────────────────────────────────────────

describe("incomeReliability sub-score", () => {
  it("is higher for perfectly stable income", () => {
    const stable = makeCtx({
      incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    });
    const irregular = makeCtx({
      incomes: makeMonthlyIncomes([1000, 5000, 500, 4000, 800, 6000]),
    });
    const stableScore = computeHealthScore(stable).subScores.incomeReliability.value;
    const irregularScore = computeHealthScore(irregular).subScores.incomeReliability.value;
    expect(stableScore).toBeGreaterThan(irregularScore);
  });
});

// ─── Explanation key selection ─────────────────────────────────────────────────

describe("explanationKey", () => {
  it("returns 'health.explain.overspending' when savings rate is negative", () => {
    const { explanationKey } = computeHealthScore(makeOverspendingCtx());
    expect(explanationKey).toBe("health.explain.overspending");
  });

  it("returns a valid i18n key string", () => {
    const { explanationKey } = computeHealthScore(makeCtx());
    expect(explanationKey).toMatch(/^health\.explain\./);
  });
});
