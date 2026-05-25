import type { Goal } from "@/types/finance";
import { money } from "@/lib/format";

// ─── Deadline status ──────────────────────────────────────────────────────────

export type DeadlineStatus = {
  tone: "good" | "warn" | "bad";
  label: string;
};

/**
 * Returns a human-readable deadline assessment for a goal.
 * Pure function — no React, fully unit-testable.
 */
export function getDeadlineStatus(
  goal: Goal,
  currency: string,
  convert: (n: number) => number = (n) => n,
): DeadlineStatus | null {
  if (!goal.deadline) return null;

  const dl = new Date(goal.deadline);
  const now = new Date();
  const monthsLeft = Math.max(
    0,
    (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth()),
  );
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const required = monthsLeft > 0 ? remaining / monthsLeft : remaining;

  if (remaining === 0)
    return { tone: "good", label: "Goal completed" };
  if (monthsLeft === 0)
    return { tone: "bad", label: "Deadline reached" };
  if (Number(goal.monthly_contribution) >= required)
    return { tone: "good", label: `On track · ${money(convert(required), currency)}/mo needed` };

  return {
    tone: "warn",
    label: `Behind · need ${money(convert(required), currency)}/mo (you have ${money(convert(Number(goal.monthly_contribution)), currency)})`,
  };
}

// ─── Projected completion date ────────────────────────────────────────────────

export function getProjectedCompletion(goal: Goal): Date | null {
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const monthly = Number(goal.monthly_contribution);
  if (!monthly || remaining === 0) return null;
  const months = Math.ceil(remaining / monthly);
  return new Date(new Date().setMonth(new Date().getMonth() + months));
}

// ─── Next milestone ───────────────────────────────────────────────────────────

const MILESTONES = [25, 50, 75, 100] as const;

export function getNextMilestone(progress: number): number | null {
  return MILESTONES.find((m) => progress < m) ?? null;
}

// ─── Savings coach message ────────────────────────────────────────────────────

export function getCoachMessage(
  goals: Goal[],
  income: number,
  currency: string,
  convert: (n: number) => number = (n) => n,
): string {
  const totalMonthly = goals.reduce((s, g) => s + Number(g.monthly_contribution), 0);
  const completed    = goals.filter((g) => Number(g.current_amount) >= Number(g.target_amount)).length;
  const behind       = goals.filter((g) => {
    if (!g.deadline) return false;
    const dl = new Date(g.deadline);
    const monthsLeft = Math.max(
      0,
      (dl.getFullYear() - new Date().getFullYear()) * 12 +
        (dl.getMonth() - new Date().getMonth()),
    );
    const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));
    return monthsLeft > 0 && Number(g.monthly_contribution) < remaining / monthsLeft;
  });

  if (completed > 0)
    return `${completed} goal${completed === 1 ? "" : "s"} completed! Consider raising the bar with a new milestone.`;
  if (behind.length > 0)
    return `"${behind[0].name}" is falling behind its deadline. Increase the monthly amount or extend the date.`;
  if (income > 0 && totalMonthly / income > 0.5)
    return `You're allocating ${Math.round((totalMonthly / income) * 100)}% of income to savings — ambitious! Make sure it's sustainable.`;
  if (income > 0 && totalMonthly / income < 0.1)
    return `You're saving only ${Math.round((totalMonthly / income) * 100)}% of income. The 50/30/20 rule suggests aiming for 20%.`;
  return `You're contributing ${money(convert(totalMonthly), currency)}/month across all goals. Steady progress beats sporadic effort.`;
}

// ─── Contribution toast message ───────────────────────────────────────────────

export function getContributionToast(
  newPct: number,
  amount: number,
  currency: string,
  convert: (n: number) => number = (n) => n,
): string {
  if (newPct >= 100) return "🎉 Goal completed! Congratulations!";
  if (newPct >= 75)  return "Great! 75%+ of your goal!";
  if (newPct >= 50)  return "Halfway there 💪";
  return `+${money(convert(amount), currency)} added`;
}
