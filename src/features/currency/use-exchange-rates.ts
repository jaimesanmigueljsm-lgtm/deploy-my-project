import { useCallback } from "react";

/**
 * Single-base-currency architecture: every user operates in one currency.
 * Amounts are stored and displayed in that currency as-is — no conversion.
 * This hook exists solely for call-site compatibility; it is an identity function.
 */
export function useCurrencyConvert(): (amount: number) => number {
  return useCallback((n: number) => n, []);
}
