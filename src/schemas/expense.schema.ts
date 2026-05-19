import { z } from "zod";
import {
  positiveAmountSchema,
  nonNegativeAmountSchema,
  optionalIsoDateSchema,
  isoDateSchema,
  uuidSchema,
  requiredStringSchema,
} from "./common.schema";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ExpenseKindSchema = z.enum(["fixed", "variable"], {
  errorMap: () => ({ message: "Expense kind must be 'fixed' or 'variable'" }),
});
export type ExpenseKind = z.infer<typeof ExpenseKindSchema>;

export const CategoryKindSchema = z.enum(["fixed", "variable", "income"], {
  errorMap: () => ({
    message: "Category kind must be 'fixed', 'variable', or 'income'",
  }),
});
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

// ── Expense schemas ───────────────────────────────────────────────────────────

/**
 * Used for form validation and as the service-boundary guard in addExpense().
 * All fields normalised: amount rounded to 2dp, strings trimmed.
 */
export const AddExpenseSchema = z.object({
  description: requiredStringSchema,
  amount: positiveAmountSchema,
  category_id: uuidSchema.nullable().optional(),
  kind: ExpenseKindSchema.default("variable"),
  recurring: z.boolean().default(false),
  spent_at: isoDateSchema.optional(),
});
export type AddExpenseInput = z.infer<typeof AddExpenseSchema>;

export const UpdateExpenseSchema = z.object({
  description: requiredStringSchema.optional(),
  amount: positiveAmountSchema.optional(),
  category_id: uuidSchema.nullable().optional(),
  kind: ExpenseKindSchema.optional(),
  recurring: z.boolean().optional(),
  spent_at: optionalIsoDateSchema,
});
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

/**
 * Row schema for parsing DB responses. More permissive than the input schema —
 * we trust the database but normalise numeric types so callers always receive
 * proper JS numbers (Supabase can return NUMERIC as string in some configs).
 */
export const ExpenseRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  description: z.string(),
  amount: nonNegativeAmountSchema,
  category_id: uuidSchema.nullable().optional(),
  kind: ExpenseKindSchema.default("variable"),
  recurring: z.boolean().default(false),
  spent_at: z.string(),
  created_at: z.string(),
});
export type ExpenseRow = z.infer<typeof ExpenseRowSchema>;

// ── Category schemas ──────────────────────────────────────────────────────────

export const AddCategorySchema = z.object({
  name: requiredStringSchema,
  icon: z.string().trim().min(1).max(50).default("wallet"),
  color: z.string().trim().min(1).max(50).default("mint"),
  kind: CategoryKindSchema.default("variable"),
});
export type AddCategoryInput = z.infer<typeof AddCategorySchema>;
