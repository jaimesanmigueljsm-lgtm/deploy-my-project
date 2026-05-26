import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchExchangeRates, applyRate, readUserBaseCurrencyOrNull } from "@/lib/exchange-rates";
import { useProfile } from "@/features/profile/use-profile";
import { useAuth } from "@/hooks/use-auth";

function useBaseCurrency(): string {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  return (
    readUserBaseCurrencyOrNull(user?.id) ?? profile?.base_currency ?? profile?.currency ?? "EUR"
  );
}

export function useExchangeRates() {
  const base = useBaseCurrency();

  return useQuery({
    queryKey: ["exchange-rates", base],
    queryFn: () => fetchExchangeRates(base),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    enabled: !!base,
    retry: 2,
  });
}

export function useCurrencyConvert(): (amount: number) => number {
  const { data: profile } = useProfile();
  const { data: rates } = useExchangeRates();
  const base = useBaseCurrency();
  const display = profile?.currency ?? "EUR";

  return useCallback(
    (amount: number) => {
      if (base === display || !rates) return amount;
      return applyRate(amount, display, rates);
    },
    [base, display, rates],
  );
}
