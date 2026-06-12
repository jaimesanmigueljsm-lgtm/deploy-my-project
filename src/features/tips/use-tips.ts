/**
 * use-tips.ts — Hook that selects N tips per visit for the Home "Consejos" feed.
 *
 * Selection algorithm:
 *   1. Compute `isRelevant(engine)` for every tip. Engine-relevant tips come
 *      first, in catalog order (the catalog order doubles as priority for
 *      ties — e.g. emergency fund before "invest surplus").
 *   2. Fill the remaining slots from the non-relevant tips, walking the array
 *      starting at an index seeded by the day-of-year. This gives every user
 *      a stable selection for the whole day, that refreshes at midnight, and
 *      cycles through the full catalog over time.
 *
 * No randomness — the same user on the same day always sees the same tips,
 * which makes hydration deterministic (no SSR/CSR flicker) and makes the
 * feature trivially testable.
 */

import { useMemo } from "react";
import { useFinancialEngine } from "@/features/dashboard/use-financial-engine";
import { TIPS_CATALOG, type Tip } from "./tips.catalog";

export function useTips(count = 3): Tip[] {
  const { output: engine } = useFinancialEngine();

  return useMemo(() => {
    const relevant: Tip[] = [];
    const rest: Tip[] = [];

    for (const tip of TIPS_CATALOG) {
      if (tip.isRelevant?.(engine)) relevant.push(tip);
      else rest.push(tip);
    }

    const selected: Tip[] = relevant.slice(0, count);

    if (selected.length < count && rest.length > 0) {
      const need = count - selected.length;
      // Day-of-year seed → stable selection per calendar day.
      // (Math.floor + UTC-anchored difference avoids DST drift.)
      const now = new Date();
      const startOfYear = Date.UTC(now.getFullYear(), 0, 0);
      const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfYear = Math.floor((todayUTC - startOfYear) / 86_400_000);

      for (let i = 0; i < need; i++) {
        const idx = (dayOfYear + i) % rest.length;
        selected.push(rest[idx]);
      }
    }

    return selected;
  }, [engine, count]);
}
