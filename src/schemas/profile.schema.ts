import { z } from "zod";
import { nonNegativeAmountSchema, currencyCodeSchema, uuidSchema } from "./common.schema";

// ── Sub-schemas ───────────────────────────────────────────────────────────────

export const ThemeSchema = z.enum(["light", "dark"], {
  errorMap: () => ({ message: "Theme must be 'light' or 'dark'" }),
});
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * notification_prefs is stored as a JSON column. We parse it explicitly so the
 * rest of the app never has to deal with `Json` or unchecked booleans.
 */
export const NotificationPrefsSchema = z.object({
  alerts: z.boolean().default(true),
  weekly: z.boolean().default(true),
  monthly: z.boolean().default(true),
  insights: z.boolean().default(true),
  investment_mode: z.boolean().default(false),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

// ── Profile schemas ───────────────────────────────────────────────────────────

/**
 * All fields are optional — profiles are updated partially via useUpdateProfile.
 * Individual field schemas are strict so a bad update still throws.
 */
// Username validation: lowercase letters, digits, dots. 3–30 chars.
// Dots cannot be at the start, end, or consecutive.
export const financialUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-z0-9][a-z0-9.]*[a-z0-9]$/, "Only letters, digits, and dots allowed")
  .refine((v) => !v.includes(".."), "Consecutive dots are not allowed");

export type FinancialUsername = z.infer<typeof financialUsernameSchema>;

export const UpdateProfileSchema = z.object({
  first_name: z.string().trim().min(1).max(60).optional(),
  last_name_1: z.string().trim().min(1).max(60).optional(),
  last_name_2: z.string().trim().max(60).optional().nullable(),
  financial_username: financialUsernameSchema.optional(),
  avatar_url: z.string().max(500).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),

  full_name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name is too long (max 100 characters)")
    .optional(),

  currency: currencyCodeSchema.optional(),
  base_currency: currencyCodeSchema.optional(),

  theme: ThemeSchema.optional(),

  monthly_savings_target: nonNegativeAmountSchema.optional(),

  // health_score is managed server-side. Clients should not update it directly.
  // Score is 0–1000 (the engine multiplies the internal 0–100 composite by 10).
  health_score: z.coerce
    .number()
    .int()
    .min(0, "Health score cannot be negative")
    .max(1000, "Health score cannot exceed 1000")
    .optional(),

  notification_prefs: NotificationPrefsSchema.partial().optional(),

  // priorities is a free-form array of user-defined strings (e.g. ["savings","family"])
  priorities: z
    .array(z.string().trim().max(50))
    .max(10, "Too many priorities (max 10)")
    .optional()
    .nullable(),

  onboarded: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

/**
 * Row schema for parsing the full profile from Supabase.
 * Normalises monetary fields to proper JS numbers.
 */
export const ProfileRowSchema = z.object({
  id: uuidSchema,
  first_name: z.string().default(""),
  last_name_1: z.string().default(""),
  last_name_2: z.string().nullable().optional(),
  financial_username: z.string().default(""),
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  currency: z.string().default("EUR"),
  base_currency: z.string().nullable().optional(),
  onboarded: z.boolean().default(false),
  monthly_savings_target: nonNegativeAmountSchema,
  health_score: z.coerce.number().int().min(0).max(1000).default(700),
  family_id: z.string().nullable().optional(),
  notification_prefs: z.unknown().nullable(),
  theme: z.string().default("light"),
  priorities: z.array(z.string()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProfileRow = z.infer<typeof ProfileRowSchema>;
