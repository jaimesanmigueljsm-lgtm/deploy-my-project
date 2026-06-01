export function money(n: number, currency = "EUR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2,
  }).format(n || 0);
}

export function moneyExact(n: number, currency = "EUR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function shortMoney(n: number, currency = "EUR") {
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return money(n, currency);
}

export function getCurrencySymbol(currency = "EUR"): string {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

export function pct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export const monthLabel = (d = new Date()) =>
  d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

export const shortMonth = (d = new Date()) => d.toLocaleDateString(undefined, { month: "short" });

export const monthRange = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    daysInMonth: end.getDate(),
    today: d.getDate(),
  };
};

export const previousMonthRange = (d = new Date()) => {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return monthRange(prev);
};

export function relativeDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
