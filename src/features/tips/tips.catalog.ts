/**
 * tips.catalog.ts — Curated financial advice catalogue for the Home "Consejos"
 * section. Replaces the previous AI-generated "For you" recommendations on the
 * Home tab.
 *
 * Why a catalog (not AI):
 *   · Always useful from day 1, even with sparse user data.
 *   · No edge-function cost. No latency. Predictable copy.
 *   · Trivially translatable via the existing i18n system.
 *   · Per-day deterministic rotation so the user discovers new tips weekly
 *     without ever seeing the same three in a row.
 *
 * Engine-driven personal recommendations (the rule-based ones in
 * `core/finance/recommendations/engine.ts`) live in the Analytics tab via
 * `<RecommendationCards />`. The split keeps Home glance-able + universally
 * useful and Analytics the place to drill into your own numbers.
 *
 * Adding a new tip:
 *   1. Append an entry below with a stable `id` (kebab-case, never reused).
 *   2. Add `tip.<id>.title` and `tip.<id>.body` to every locale dict in
 *      `src/i18n/translations.ts`.
 *   3. Optionally implement `isRelevant(engine)` so the tip surfaces first
 *      when it matches the user's situation.
 */

import {
  Coins,
  Layers,
  Search,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  ShoppingCart,
  Landmark,
  Phone,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import type { ComponentType } from "react";
import type { FinancialEngineOutput } from "@/core/finance";

export type TipTone = "mint" | "sky" | "warn" | "violet";

export interface Tip {
  /** Stable ID for analytics, deep-links and i18n key derivation. */
  id: string;
  /** i18n key — `tip.<id>.title` by convention. */
  titleKey: string;
  /** i18n key — `tip.<id>.body` by convention. */
  bodyKey: string;
  /** Lucide icon component shown in the card chip. */
  icon: ComponentType<{ className?: string }>;
  /** Visual tone for the card chip — mint / sky / warn / violet. */
  tone: TipTone;
  /**
   * Topical category — currently for future filtering / analytics.
   * Not surfaced to the user as a label.
   */
  category: "savings" | "budget" | "spending" | "habit" | "fees" | "invest";
  /**
   * Optional relevance predicate. When the function returns `true` the tip is
   * surfaced ahead of the daily-rotating ones. Receives the engine output so
   * tips can light up based on the user's current situation (e.g. low
   * emergency fund, high recurring pressure, healthy savings rate, etc.).
   *
   * The engine may be `null` while data is still loading — return `false` in
   * that case to avoid flashing a tip that may not apply.
   */
  isRelevant?: (engine: FinancialEngineOutput | null) => boolean;
}

export const TIPS_CATALOG: Tip[] = [
  {
    id: "roundup-savings",
    titleKey: "tip.roundup-savings.title",
    bodyKey: "tip.roundup-savings.body",
    icon: Coins,
    tone: "mint",
    category: "savings",
  },
  {
    id: "rule-50-30-20",
    titleKey: "tip.rule-50-30-20.title",
    bodyKey: "tip.rule-50-30-20.body",
    icon: Layers,
    tone: "sky",
    category: "budget",
  },
  {
    id: "audit-subscriptions",
    titleKey: "tip.audit-subscriptions.title",
    bodyKey: "tip.audit-subscriptions.body",
    icon: Search,
    tone: "warn",
    category: "spending",
    // Surface this tip when the user's recurring/fixed expenses pressure is
    // above the engine's elevated threshold (~50% of income going to recurring).
    isRelevant: (engine) => {
      const ratio = engine?.healthScore.subScores.fixedExpensePressure.rawValue;
      return typeof ratio === "number" && ratio > 0.5;
    },
  },
  {
    id: "wait-24h",
    titleKey: "tip.wait-24h.title",
    bodyKey: "tip.wait-24h.body",
    icon: Clock,
    tone: "sky",
    category: "habit",
  },
  {
    id: "pay-yourself-first",
    titleKey: "tip.pay-yourself-first.title",
    bodyKey: "tip.pay-yourself-first.body",
    icon: ArrowUpRight,
    tone: "mint",
    category: "savings",
  },
  {
    id: "emergency-fund",
    titleKey: "tip.emergency-fund.title",
    bodyKey: "tip.emergency-fund.body",
    icon: ShieldCheck,
    tone: "mint",
    category: "savings",
    // Surface when emergency readiness < 3 months of essentials covered.
    isRelevant: (engine) => {
      const months = engine?.healthScore.subScores.emergencyReadiness.rawValue;
      return typeof months === "number" && months < 3;
    },
  },
  {
    id: "automate-savings",
    titleKey: "tip.automate-savings.title",
    bodyKey: "tip.automate-savings.body",
    icon: RefreshCw,
    tone: "mint",
    category: "savings",
  },
  {
    id: "shopping-list",
    titleKey: "tip.shopping-list.title",
    bodyKey: "tip.shopping-list.body",
    icon: ShoppingCart,
    tone: "sky",
    category: "habit",
  },
  {
    id: "compare-bank-fees",
    titleKey: "tip.compare-bank-fees.title",
    bodyKey: "tip.compare-bank-fees.body",
    icon: Landmark,
    tone: "warn",
    category: "fees",
  },
  {
    id: "renegotiate-bills",
    titleKey: "tip.renegotiate-bills.title",
    bodyKey: "tip.renegotiate-bills.body",
    icon: Phone,
    tone: "warn",
    category: "fees",
  },
  {
    id: "invest-surplus",
    titleKey: "tip.invest-surplus.title",
    bodyKey: "tip.invest-surplus.body",
    icon: TrendingUp,
    tone: "violet",
    category: "invest",
    // Suggest investing only when the user already has the basics covered:
    // emergency fund built + a decent savings rate. Never push someone into
    // markets while they're in deficit.
    isRelevant: (engine) => {
      if (!engine) return false;
      const months = engine.healthScore.subScores.emergencyReadiness.rawValue;
      const savingsRate = engine.healthScore.subScores.savingsConsistency.rawValue;
      return typeof months === "number" && months >= 3 && typeof savingsRate === "number" && savingsRate >= 0.2;
    },
  },
  {
    id: "separate-fun-card",
    titleKey: "tip.separate-fun-card.title",
    bodyKey: "tip.separate-fun-card.body",
    icon: CreditCard,
    tone: "sky",
    category: "habit",
  },
];
