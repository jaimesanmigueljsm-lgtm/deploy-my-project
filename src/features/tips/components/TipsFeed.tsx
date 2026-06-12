/**
 * TipsFeed — Renders the 3 daily tips for the Home "Consejos" section.
 *
 * Uses the existing <InsightCard /> primitive so the visual treatment matches
 * what users already see in other parts of the app (icon chip + title + body).
 * No new design — it only swaps the data source from AI recommendations to the
 * curated catalog.
 */

import { useTips } from "../use-tips";
import { useT } from "@/i18n";
import { InsightCard } from "@/components/nest";

export function TipsFeed({ count = 3 }: { count?: number }) {
  const tips = useTips(count);
  const { t } = useT();

  if (tips.length === 0) return null;

  return (
    <div className="space-y-2">
      {tips.map((tip) => {
        const Icon = tip.icon;
        return (
          <InsightCard
            key={tip.id}
            tone={tip.tone}
            icon={<Icon className="size-4" />}
            title={t(tip.titleKey as never)}
            body={t(tip.bodyKey as never)}
          />
        );
      })}
    </div>
  );
}
