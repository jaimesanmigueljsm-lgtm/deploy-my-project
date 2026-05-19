import { z } from "zod";
import {
  positiveAmountSchema,
  nonNegativeAmountSchema,
  optionalFutureDateSchema,
  uuidSchema,
  requiredStringSchema,
  optionalNoteSchema,
} from "./common.schema";
import { GOAL_ICONS, GOAL_COLORS, type GoalIconKey, type GoalColorKey } from "@/features/goals/goals.constants";

// ── Enums derived from constants ──────────────────────────────────────────────
// Deriving from constants ensures the schema stays in sync automatically —
// adding a new icon/color to the constant automatically extends validation.

const goalIconKeys = Object.keys(GOAL_ICONS) as [GoalIconKey, ...GoalIconKey[]];
export const GoalIconSchema = z.enum(goalIconKeys, {
  errorMap: () => ({ message: `Goal icon must be one of: ${goalIconKeys.join(", ")}` }),
});

const goalColorKeys = Object.keys(GOAL_COLORS) as [GoalColorKey, ...GoalColorKey[]];
export const GoalColorSchema = z.enum(goalColorKeys, {
  errorMap: () => ({ message: `Goal color must be one of: ${goalColorKeys.join(", ")}` }),
});

export const GoalPrioritySchema = z.enum(["high", "medium", "low"], {
  errorMap: () => ({ message: "Priority must be 'high', 'medium', or 'low'" }),
});
export type GoalPriority = z.infer<typeof GoalPrioritySchema>;

// ── Goal schemas ──────────────────────────────────────────────────────────────

// Internal base object — exported schemas add cross-field rules on top.
const _goalFields = z.object({
  name: requiredStringSchema,
  target_amount: positiveAmountSchema,
  current_amount: nonNegativeAmountSchema.default(0),
  monthly_contribution: nonNegativeAmountSchema.default(0),
  deadline: optionalFutureDateSchema,
  category: z.string().trim().max(50).default("other"),
  icon: GoalIconSchema.default("target"),
  priority: GoalPrioritySchema.default("medium"),
  color: GoalColorSchema.default("mint"),
  notes: optionalNoteSchema,
});

/**
 * Form + service validation for creating a new goal.
 * Cross-field rule: current_amount cannot exceed target_amount.
 */
export const AddGoalSchema = _goalFields.superRefine((data, ctx) => {
  if (data.current_amount > data.target_amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Current saved amount cannot exceed the target amount",
      path: ["current_amount"],
    });
  }
});
export type AddGoalInput = z.infer<typeof AddGoalSchema>;

/**
 * Partial updates — no cross-field check since we only see the changed fields.
 */
export const UpdateGoalSchema = _goalFields.partial();
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

// ── Contribution schemas ──────────────────────────────────────────────────────

/**
 * Contributions must be strictly positive — zero or negative contributions are
 * meaningless and would corrupt the goal's current_amount.
 */
export const AddContributionSchema = z.object({
  goal_id: uuidSchema,
  amount: positiveAmountSchema,
  note: optionalNoteSchema,
});
export type AddContributionInput = z.infer<typeof AddContributionSchema>;

// ── Row schemas ───────────────────────────────────────────────────────────────

export const GoalRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  target_amount: nonNegativeAmountSchema,
  current_amount: nonNegativeAmountSchema,
  monthly_contribution: nonNegativeAmountSchema,
  deadline: z.string().nullable().optional(),
  category: z.string().default("other"),
  icon: z.string().default("target"),
  priority: z.string().default("medium"),
  color: z.string().default("mint"),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
});
export type GoalRow = z.infer<typeof GoalRowSchema>;

export const GoalContributionRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  goal_id: uuidSchema,
  amount: nonNegativeAmountSchema,
  note: z.string().nullable().optional(),
  contributed_at: z.string(),
  created_at: z.string(),
});
export type GoalContributionRow = z.infer<typeof GoalContributionRowSchema>;
