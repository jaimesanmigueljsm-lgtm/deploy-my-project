/**
 * Test data factories for the financial engine.
 *
 * All factories accept partial overrides so tests only specify what they care about.
 * Dates default to a deterministic reference point (2026-03-15) to keep tests stable.
 */

import type {
  FinancialEngineContext,
  EngineExpense,
  EngineIncome,
  EngineBill,
  EngineGoal,
  EngineInvestment,
  EngineProfile,
} from "@/core/finance/types";

// ─── Reference date ───────────────────────────────────────────────────────────

/** Deterministic "now" for all tests: mid-March 2026. */
export const REF_DATE = new Date("2026-03-15T12:00:00Z");

/** Returns a Date N days before REF_DATE. */
export function daysAgo(n: number): Date {
  return new Date(REF_DATE.getTime() - n * 86_400_000);
}

/** Returns a Date for a specific YYYY-MM-DD. */
export function d(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

// ─── Individual record factories ──────────────────────────────────────────────

let _id = 0;
function nextId(): string {
  return String(++_id);
}

export function makeExpense(overrides: Partial<EngineExpense> = {}): EngineExpense {
  return {
    id: nextId(),
    amount: 100,
    categoryId: "cat-1",
    categoryName: "Groceries",
    kind: "variable",
    recurring: false,
    spentAt: REF_DATE,
    ...overrides,
  };
}

export function makeIncome(overrides: Partial<EngineIncome> = {}): EngineIncome {
  return {
    id: nextId(),
    amount: 3000,
    source: "Salary",
    recurring: true,
    receivedAt: REF_DATE,
    ...overrides,
  };
}

export function makeBill(overrides: Partial<EngineBill> = {}): EngineBill {
  return {
    id: nextId(),
    name: "Rent",
    amount: 800,
    dueDay: 1,
    paidThisMonth: false,
    active: true,
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<EngineGoal> = {}): EngineGoal {
  return {
    id: nextId(),
    name: "Emergency fund",
    targetAmount: 10_000,
    currentAmount: 2_000,
    monthlyContribution: 200,
    deadline: null,
    priority: "high",
    category: "savings",
    ...overrides,
  };
}

export function makeInvestment(overrides: Partial<EngineInvestment> = {}): EngineInvestment {
  return {
    id: nextId(),
    type: "etf",
    name: "MSCI World",
    ticker: "VWCE",
    quantity: 10,
    avgCost: 100,
    currentPrice: 110,
    currency: "EUR",
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<EngineProfile> = {}): EngineProfile {
  return {
    currency: "EUR",
    monthlySavingsTarget: 500,
    priorities: ["savings"],
    ...overrides,
  };
}

// ─── Monthly expense helpers ───────────────────────────────────────────────────

/**
 * Generate N months of variable expenses.
 * `amounts` — one amount per month, starting from the oldest.
 * Month offsets are relative to REF_DATE going backwards.
 */
export function makeMonthlyExpenses(amounts: number[]): EngineExpense[] {
  return amounts.flatMap((amount, i) => {
    const monthOffset = amounts.length - 1 - i;
    const date = new Date(REF_DATE);
    date.setMonth(date.getMonth() - monthOffset);
    date.setDate(15);
    return [makeExpense({ amount, spentAt: date, kind: "variable" })];
  });
}

/**
 * Generate N months of fixed expenses (kind="fixed").
 */
export function makeMonthlyFixedExpenses(amounts: number[]): EngineExpense[] {
  return amounts.flatMap((amount, i) => {
    const monthOffset = amounts.length - 1 - i;
    const date = new Date(REF_DATE);
    date.setMonth(date.getMonth() - monthOffset);
    date.setDate(5);
    return [makeExpense({ amount, spentAt: date, kind: "fixed" })];
  });
}

/**
 * Generate N months of income.
 */
export function makeMonthlyIncomes(amounts: number[]): EngineIncome[] {
  return amounts.map((amount, i) => {
    const monthOffset = amounts.length - 1 - i;
    const date = new Date(REF_DATE);
    date.setMonth(date.getMonth() - monthOffset);
    date.setDate(1);
    return makeIncome({ amount, receivedAt: date });
  });
}

// ─── Context factory ──────────────────────────────────────────────────────────

/**
 * Build a minimal FinancialEngineContext.
 * Sane defaults produce a financially healthy user so individual tests
 * can override specific fields to stress a single dimension.
 */
export function makeCtx(overrides: Partial<FinancialEngineContext> = {}): FinancialEngineContext {
  return {
    profile: makeProfile(),
    expenses: makeMonthlyExpenses([1500, 1600, 1400, 1550, 1450, 1500]),
    incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
    bills: [],
    goals: [],
    investments: [],
    categories: [{ id: "cat-1", name: "Groceries", kind: "variable" }],
    savingsAccounts: [],
    asOf: REF_DATE,
    ...overrides,
  };
}

/**
 * Context preset: user with zero financial data (brand new account).
 */
export function makeEmptyCtx(): FinancialEngineContext {
  return makeCtx({
    expenses: [],
    incomes: [],
    bills: [],
    goals: [],
    investments: [],
  });
}

/**
 * Context preset: user who is consistently overspending.
 */
export function makeOverspendingCtx(): FinancialEngineContext {
  return makeCtx({
    expenses: makeMonthlyExpenses([3200, 3500, 3100, 3400, 3300, 3600]),
    incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
  });
}

/**
 * Context preset: user with good savings rate (~30%).
 */
export function makeGoodSaverCtx(): FinancialEngineContext {
  return makeCtx({
    expenses: makeMonthlyExpenses([2100, 2000, 2050, 1950, 2100, 2000]),
    incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
  });
}

/**
 * Context preset: user with a well-funded emergency fund (10k+ in goals).
 */
export function makeEmergencyFundCtx(currentAmount: number): FinancialEngineContext {
  return makeCtx({
    goals: [makeGoal({ name: "Emergency Fund", currentAmount, targetAmount: 15_000 })],
    expenses: makeMonthlyExpenses([1500, 1500, 1500, 1500, 1500, 1500]),
    incomes: makeMonthlyIncomes([3000, 3000, 3000, 3000, 3000, 3000]),
  });
}
