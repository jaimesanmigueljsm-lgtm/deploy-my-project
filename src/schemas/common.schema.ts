/**
 * common.schema.ts — Foundational primitives for the fintech validation layer.
 *
 * Rule: every monetary field entering storage must pass through one of the
 * amount schemas so it is finite, non-NaN, and rounded to 2 decimal places
 * (matching DB NUMERIC 12,2). All other schemas build on these primitives.
 */

import { z } from "zod";

// ── Monetary amounts ──────────────────────────────────────────────────────────
// z.coerce.number() handles both string inputs (React Hook Form) and number
// inputs (service calls) without needing two separate schemas.

export const positiveAmountSchema = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a valid number")
  .positive("Amount must be greater than zero")
  .max(9_999_999_999.99, "Amount exceeds maximum allowed (9,999,999,999.99)")
  .transform((n) => Math.round(n * 100) / 100);

export const nonNegativeAmountSchema = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a valid number")
  .min(0, "Amount cannot be negative")
  .max(9_999_999_999.99, "Amount exceeds maximum allowed (9,999,999,999.99)")
  .transform((n) => Math.round(n * 100) / 100);

// Crypto / fractional quantities need 4-decimal precision (e.g. 0.0850 BTC).
export const quantitySchema = z.coerce
  .number({ invalid_type_error: "Quantity must be a number" })
  .finite("Quantity must be a valid number")
  .min(0, "Quantity cannot be negative")
  .transform((n) => Math.round(n * 10_000) / 10_000);

// ── Date fields ───────────────────────────────────────────────────────────────
// DB DATE columns are ISO strings "YYYY-MM-DD". The regex enforces format;
// the refine catches calendar impossibilities like 2024-02-31.

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isValidCalendarDate(s: string): boolean {
  return !isNaN(new Date(s + "T00:00:00").getTime());
}

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_RE, "Date must be in YYYY-MM-DD format")
  .refine(isValidCalendarDate, "Invalid calendar date");

export const optionalIsoDateSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (s) => !s || (ISO_DATE_RE.test(s) && isValidCalendarDate(s)),
    "Date must be in YYYY-MM-DD format",
  );

// For deadlines and future-dated records.
export const futureDateSchema = isoDateSchema.refine((s) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(s + "T00:00:00") >= today;
}, "Date must be today or in the future");

export const optionalFutureDateSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (s) => !s || (ISO_DATE_RE.test(s) && isValidCalendarDate(s)),
    "Date must be in YYYY-MM-DD format",
  )
  .refine((s) => {
    if (!s) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(s + "T00:00:00") >= today;
  }, "Deadline must be today or in the future");

// ── Currency ──────────────────────────────────────────────────────────────────
// Accepts "eur", "EUR", " eur " — normalises to uppercase 3-letter ISO 4217 code.
export const currencyCodeSchema = z
  .string({ required_error: "Currency is required" })
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z]{3}$/.test(s), "Currency must be a 3-letter ISO code (e.g. EUR, USD, GBP)");

// ── UUID ──────────────────────────────────────────────────────────────────────
export const uuidSchema = z
  .string({ required_error: "ID is required" })
  .uuid("Must be a valid UUID");

// ── Percentage ────────────────────────────────────────────────────────────────
// For derived values only (progress %, allocation %). Not stored in DB directly.
export const percentageSchema = z
  .number()
  .finite()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100%");

// ── Text fields ───────────────────────────────────────────────────────────────
export const requiredStringSchema = z
  .string({ required_error: "This field is required" })
  .trim()
  .min(1, "This field is required")
  .max(200, "Text is too long (max 200 characters)");

// Nullable note — empty string is normalised to null to keep the DB clean.
export const optionalNoteSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().trim().max(500, "Note is too long (max 500 characters)").nullable(),
);

// ── Safe-parse utilities ──────────────────────────────────────────────────────

export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e) => (e.path.length > 0 ? `${e.path.join(".")}: ${e.message}` : e.message))
    .join("; ");
}

/**
 * Parses `data` against `schema`. Returns a discriminated union:
 *   { success: true,  data: T }
 *   { success: false, errors: string }
 *
 * Use this when you want to handle the error yourself (e.g. form validation).
 */
export function safeParse<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): { success: true; data: z.infer<S> } | { success: false; errors: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: formatZodError(result.error) };
}

/**
 * Parses `data` against `schema` and returns the validated+normalised value.
 * Throws a descriptive Error on failure — React Query surfaces this via onError.
 *
 * Use this at service boundaries so invalid payloads never reach Supabase.
 */
export function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  context?: string,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const prefix = context ? `[${context}] ` : "";
  throw new Error(`${prefix}Validation failed: ${formatZodError(result.error)}`);
}

/**
 * Coerces any raw value to a safe monetary amount rounded to 2 decimal places.
 * Throws if the value cannot be represented as a finite number.
 * Use in utils / calculation helpers to guard against NaN / Infinity.
 */
export function coerceToAmount(raw: unknown): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new Error(`Cannot coerce "${String(raw)}" to a valid monetary amount`);
  }
  return Math.round(n * 100) / 100;
}
