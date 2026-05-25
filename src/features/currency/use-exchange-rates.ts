import { useQuery } from "@tanstack/react-query";
import { fetchExchangeRates, applyRate } from "@/lib/exchange-rates";
import { useProfile } from "@/features/profile/use-profile";

export function useExchangeRates() {
  const { data: profile } = useProfile();
  const base = profile?.base_currency ?? profile?.currency ?? "EUR";

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
  const base = profile?.base_currency ?? profile?.currency ?? "EUR";
  const display = profile?.currency ?? "EUR";

  return (amount: number) => {
    if (base === display || !rates) return amount;
    return applyRate(amount, display, rates);
  };
}
