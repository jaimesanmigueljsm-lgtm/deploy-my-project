const CACHE_KEY = "nest.fx_rates_v1";
const TTL_MS = 24 * 60 * 60 * 1000;

type RateCache = { base: string; rates: Record<string, number>; at: number };

function readCache(base: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c: RateCache = JSON.parse(raw);
    if (c.base !== base || Date.now() - c.at > TTL_MS) return null;
    return c.rates;
  } catch {
    return null;
  }
}

function writeCache(base: string, rates: Record<string, number>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ base, rates, at: Date.now() }));
    // eslint-disable-next-line no-empty
  } catch {}
}

export async function fetchExchangeRates(base: string): Promise<Record<string, number>> {
  const cached = readCache(base);
  if (cached) return cached;
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
  const json = (await res.json()) as { result: string; rates: Record<string, number> };
  if (json.result !== "success") throw new Error("Exchange rate API error");
  writeCache(base, json.rates);
  return json.rates;
}

export function applyRate(amount: number, to: string, rates: Record<string, number>): number {
  const rate = rates[to];
  return rate != null ? amount * rate : amount;
}

const BASE_KEY_PREFIX = "nest.user_base_currency.";

export function readUserBaseCurrencyOrNull(uid: string | undefined): string | null {
  if (!uid) return null;
  try {
    return localStorage.getItem(`${BASE_KEY_PREFIX}${uid}`);
  } catch {
    return null;
  }
}

export function writeUserBaseCurrency(uid: string, base: string): void {
  try {
    localStorage.setItem(`${BASE_KEY_PREFIX}${uid}`, base);
    // eslint-disable-next-line no-empty
  } catch {}
}
