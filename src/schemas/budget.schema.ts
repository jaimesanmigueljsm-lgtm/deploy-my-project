import { z } from "zod";
import {
  positiveAmountSchema,
  nonNegativeAmountSchema,
  isoDateSchema,
  uuidSchema,
  requiredStringSchema,
} from "./common.schema";

// ── Bill schemas ──────────────────────────────────────────────────────────────

/**
 * due_day: integer 1–31 (day of month the bill is due).
 * Note: months with fewer days (e.g. February) are handled at the UI layer —
 * the schema enforces the calendar maximum of 31.
 */
export const DueDaySchema = z.coerce
  .number({ invalid_type_error: "Due day must be a number" })
  .int("Due day must be a whole number")
  .min(1, "Due day must be between 1 and 31")
  .max(31, "Due day must be between 1 and 31");

export const AddBillSchema = z.object({
  name: requiredStringSchema,
  amount: positiveAmountSchema,
  due_day: DueDaySchema,
  category: z.string().trim().max(50).nullable().optional(),
});
export type AddBillInput = z.infer<typeof AddBillSchema>;

export const UpdateBillSchema = AddBillSchema.partial();
export type UpdateBillInput = z.infer<typeof UpdateBillSchema>;

export const BillRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  name: z.string(),
  amount: nonNegativeAmountSchema,
  due_day: z.coerce.number().int().min(1).max(31),
  category: z.string().nullable().optional(),
  paid_this_month: z.boolean().default(false),
  active: z.boolean().default(true),
  created_at: z.string(),
});
export type BillRow = z.infer<typeof BillRowSchema>;

// ── Income schemas ────────────────────────────────────────────────────────────

export const AddIncomeSchema = z.object({
  source: requiredStringSchema,
  amount: positiveAmountSchema,
  recurring: z.boolean().default(true),
  // received_at has a DB default (CURRENT_DATE) — pass a date string or omit it entirely.
  // Never null: that would bypass the DB default and set a NULL on a NOT NULL column.
  received_at: isoDateSchema.optional(),
});
export type AddIncomeInput = z.infer<typeof AddIncomeSchema>;

export const UpdateIncomeSchema = z.object({
  source: requiredStringSchema.optional(),
  amount: positiveAmountSchema.optional(),
  recurring: z.boolean().optional(),
  received_at: isoDateSchema.optional(),
});
export type UpdateIncomeInput = z.infer<typeof UpdateIncomeSchema>;

export const IncomeRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  source: z.string(),
  amount: nonNegativeAmountSchema,
  recurring: z.boolean().default(true),
  received_at: z.string(),
  created_at: z.string(),
});
export type IncomeRow = z.infer<typeof IncomeRowSchema>;
