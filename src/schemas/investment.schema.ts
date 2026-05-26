import { z } from "zod";
import {
  nonNegativeAmountSchema,
  quantitySchema,
  currencyCodeSchema,
  uuidSchema,
  requiredStringSchema,
  optionalNoteSchema,
} from "./common.schema";
import { INVESTMENT_TYPE_META } from "@/features/finances/finances.constants";
import type { InvestmentType } from "@/types/finance";

// ── Enum derived from constants ───────────────────────────────────────────────

const investmentTypeKeys = Object.keys(INVESTMENT_TYPE_META) as [
  InvestmentType,
  ...InvestmentType[],
];

export const InvestmentTypeSchema = z.enum(investmentTypeKeys, {
  errorMap: () => ({
    message: `Investment type must be one of: ${investmentTypeKeys.join(", ")}`,
  }),
});
export type InvestmentTypeValue = z.infer<typeof InvestmentTypeSchema>;

// ── Investment schemas ────────────────────────────────────────────────────────

/**
 * Ticker: optional, 1–20 chars, auto-uppercased.
 * null is valid (savings accounts and "other" types rarely have a ticker).
 */
const tickerSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .trim()
    .min(1, "Ticker cannot be empty if provided")
    .max(20, "Ticker is too long (max 20 characters)")
    .transform((s) => s.toUpperCase())
    .nullable(),
);

export const AddInvestmentSchema = z
  .object({
    type: InvestmentTypeSchema.default("stock"),
    ticker: tickerSchema,
    name: requiredStringSchema,
    quantity: quantitySchema,
    avg_cost: nonNegativeAmountSchema,
    current_price: nonNegativeAmountSchema,
    currency: currencyCodeSchema.optional().default("EUR"),
    notes: optionalNoteSchema,
  })
  .superRefine((data, ctx) => {
    // Stocks and ETFs are expected to have a ticker — warn but don't block.
    // Crypto often has short tickers — allow null only for savings/other.
    if (data.ticker === null && (data.type === "stock" || data.type === "etf")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stocks and ETFs typically require a ticker symbol",
        path: ["ticker"],
      });
    }
  });

export type AddInvestmentInput = z.infer<typeof AddInvestmentSchema>;

export const UpdateInvestmentSchema = z.object({
  type: InvestmentTypeSchema.optional(),
  ticker: tickerSchema.optional(),
  name: requiredStringSchema.optional(),
  quantity: quantitySchema.optional(),
  avg_cost: nonNegativeAmountSchema.optional(),
  current_price: nonNegativeAmountSchema.optional(),
  currency: currencyCodeSchema.optional(),
  notes: optionalNoteSchema,
});
export type UpdateInvestmentInput = z.infer<typeof UpdateInvestmentSchema>;

export const InvestmentRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  type: InvestmentTypeSchema.default("other"),
  ticker: z.string().nullable().optional(),
  name: z.string(),
  quantity: quantitySchema,
  avg_cost: nonNegativeAmountSchema,
  current_price: nonNegativeAmountSchema,
  currency: z.string().default("EUR"),
  notes: z.string().nullable().optional(),
  last_updated: z.string().optional(),
  created_at: z.string(),
});
export type InvestmentRow = z.infer<typeof InvestmentRowSchema>;
