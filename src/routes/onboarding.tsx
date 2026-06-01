import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Home,
  Building2,
  Car,
  Banknote,
  Wrench,
  Smartphone,
  Dumbbell,
  Repeat,
  Shield,
  Bus,
  Baby,
  ShoppingCart,
  Utensils,
  Music,
  Heart,
  Plane,
  PawPrint,
  Sparkles,
  PiggyBank,
  CreditCard,
  TrendingDown,
  Star,
  Brain,
  Target,
  TrendingUp,
  Sofa,
  Landmark,
  Shirt,
  MoreHorizontal,
} from "lucide-react";
import { useT } from "@/i18n";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type CatDef = { id: string; icon: React.ElementType; color: string; dbIcon: string };

// electricity / water / gas removed; car / loans / household added
const FIXED_CATS: CatDef[] = [
  { id: "rent", icon: Home, color: "sky", dbIcon: "home" },
  { id: "mortgage", icon: Building2, color: "sky", dbIcon: "building-2" },
  { id: "car", icon: Car, color: "sky", dbIcon: "car" },
  { id: "loans", icon: Banknote, color: "warn", dbIcon: "banknote" },
  { id: "household", icon: Wrench, color: "sky", dbIcon: "wrench" },
  { id: "phone", icon: Smartphone, color: "mint", dbIcon: "smartphone" },
  { id: "gym", icon: Dumbbell, color: "mint", dbIcon: "dumbbell" },
  { id: "subscriptions", icon: Repeat, color: "violet", dbIcon: "repeat" },
  { id: "insurance", icon: Shield, color: "sky", dbIcon: "shield" },
  { id: "transport", icon: Bus, color: "sky", dbIcon: "bus" },
  { id: "childcare", icon: Baby, color: "mint", dbIcon: "baby" },
];

const VARIABLE_CATS: CatDef[] = [
  { id: "others", icon: MoreHorizontal, color: "mint", dbIcon: "more-horizontal" },
  { id: "leisure", icon: Music, color: "violet", dbIcon: "music" },
  { id: "beauty", icon: Sparkles, color: "violet", dbIcon: "sparkles" },
  { id: "home", icon: Sofa, color: "sky", dbIcon: "sofa" },
  { id: "health", icon: Heart, color: "mint", dbIcon: "heart" },
  { id: "travel", icon: Plane, color: "sky", dbIcon: "plane" },
  { id: "finance", icon: Landmark, color: "violet", dbIcon: "landmark" },
  { id: "transport", icon: Bus, color: "sky", dbIcon: "bus" },
  { id: "clothing", icon: Shirt, color: "warn", dbIcon: "shirt" },
  { id: "pets", icon: PawPrint, color: "mint", dbIcon: "paw-print" },
  { id: "loan", icon: CreditCard, color: "violet", dbIcon: "credit-card" },
];

const PRIORITY_DEFS = [
  { id: "savings", icon: PiggyBank },
  { id: "debt", icon: CreditCard },
  { id: "family", icon: Heart },
  { id: "lifestyle", icon: Star },
  { id: "spending", icon: TrendingDown },
  { id: "travel", icon: Plane },
  { id: "home", icon: Home },
  { id: "stress", icon: Brain },
  { id: "children", icon: Baby },
  { id: "control", icon: Target },
  { id: "invest", icon: TrendingUp },
] as const;

const COLOR_CLS: Record<string, string> = {
  mint: "bg-positive-soft text-positive",
  sky: "bg-sky-soft text-sky",
  warn: "bg-warn-soft text-warn",
  violet: "bg-violet-soft text-violet",
};

const ONBOARDING_CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "ARS", symbol: "$", name: "Argentine Peso" },
  { code: "COP", symbol: "$", name: "Colombian Peso" },
  { code: "CLP", symbol: "$", name: "Chilean Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
] as const;

// Step order: currency → savings → income → día-a-día → fixed cats → fixed amounts → priorities
const TOTAL_STEPS = 7;

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const finishingRef = useRef(false);

  const [currency, setCurrency] = useState("EUR");
  const [savingsTarget, setSavingsTarget] = useState("");
  const [income, setIncome] = useState("");
  const [selectedFixed, setSelectedFixed] = useState<string[]>([]);
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, string>>({});
  const [selectedVariable, setSelectedVariable] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled && prof?.onboarded) navigate({ to: "/app" });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const currencySymbol =
    ONBOARDING_CURRENCIES.find((c) => c.code === currency)?.symbol ?? "€";

  const canNext =
    step === 0 || // currency — always has a default
    (step === 1 && Number(savingsTarget) > 0) ||
    (step === 2 && Number(income) > 0) ||
    step === 3 || // variable — optional selection
    step === 4 || // fixed cats — optional
    step === 5 || // fixed amounts — always skippable
    (step === 6 && priorities.length > 0);

  const last = step === TOTAL_STEPS - 1;

  function toggleFixed(id: string) {
    setSelectedFixed((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function toggleVariable(id: string) {
    setSelectedVariable((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function togglePriority(id: string) {
    setPriorities((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function setFixedAmount(id: string, val: string) {
    setFixedAmounts((p) => ({ ...p, [id]: val }));
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: existing } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();
      if (existing?.onboarded) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
        queryClient.removeQueries({ queryKey: queryKeys.profile(user.id) });
        navigate({ to: "/app" });
        return;
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          monthly_savings_target: Number(savingsTarget),
          priorities,
          currency,
          onboarded: true,
        })
        .eq("id", user.id)
        .select()
        .single();
      if (updateError) throw updateError;

      if (Number(income) > 0) {
        const { data: existingIncome } = await supabase
          .from("incomes")
          .select("id")
          .eq("user_id", user.id)
          .eq("source", "Monthly income")
          .eq("recurring", true)
          .limit(1);
        if (!existingIncome || existingIncome.length === 0) {
          await supabase.from("incomes").insert({
            user_id: user.id,
            source: "Monthly income",
            amount: Number(income),
            recurring: true,
          });
        }
      }

      const { data: existingCats } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!existingCats || existingCats.length === 0) {
        const fixedRows = selectedFixed.map((id) => {
          const cat = FIXED_CATS.find((c) => c.id === id)!;
          return {
            user_id: user.id,
            name: t(`fixed.${id}`),
            icon: cat.dbIcon,
            color: cat.color,
            kind: "fixed",
          };
        });
        const varRows = selectedVariable.map((id) => {
          const cat = VARIABLE_CATS.find((c) => c.id === id)!;
          return {
            user_id: user.id,
            name: t(`variable.${id}`),
            icon: cat.dbIcon,
            color: cat.color,
            kind: "variable",
          };
        });

        const allRows = [...fixedRows, ...varRows];
        if (allRows.length === 0) {
          allRows.push(
            { user_id: user.id, name: t("fixed.rent"), icon: "home", color: "sky", kind: "fixed" },
            {
              user_id: user.id,
              name: t("variable.groceries"),
              icon: "shopping-cart",
              color: "mint",
              kind: "variable",
            },
          );
        }

        const { data: insertedCats } = await supabase.from("categories").insert(allRows).select();

        // Seed recurring expenses for fixed cats that have an estimated amount
        if (insertedCats && insertedCats.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const expenseRows = selectedFixed
            .filter((id) => Number(fixedAmounts[id]) > 0)
            .map((id) => {
              const catName = t(`fixed.${id}`);
              const cat = insertedCats.find((c) => c.name === catName);
              if (!cat) return null;
              return {
                user_id: user.id,
                category_id: cat.id,
                amount: Number(fixedAmounts[id]),
                description: catName,
                kind: "fixed",
                recurring: true,
                spent_at: today,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

          if (expenseRows.length > 0) {
            await supabase.from("expenses").insert(expenseRows);
          }
        }
      }

      toast.success(t("onboarding.toast.success"), {
        description: t("onboarding.toast.success.desc"),
      });
      // Seed the cache with the freshly-updated profile before navigating.
      // beforeLoad reads queryKeys.profile(uid) with staleTime:5min — setting it
      // here guarantees the guard sees onboarded:true immediately, no refetch race.
      queryClient.setQueryData(queryKeys.profile(user.id), updatedProfile);
      navigate({ to: "/app" });
    } catch (e) {
      finishingRef.current = false;
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Top bar: back + progress — safe-area-inset so it clears the notch on PWA */}
      <div
        className="px-6 flex items-center justify-between"
        style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
      >
        {step > 0 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="size-10 rounded-full bg-surface border border-border grid place-items-center press-scale"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : (
          <div className="size-10" />
        )}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : i < step ? "w-2 bg-primary/50" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
        <div className="size-10" />
      </div>

      {/* Step content */}
      <div
        key={step}
        className="flex-1 flex flex-col px-6 pt-10 pb-8 max-w-md w-full mx-auto animate-rise"
      >
        {step === 0 && (
          <StepCurrency t={t} selected={currency} onSelect={setCurrency} />
        )}
        {step === 1 && (
          <StepSavings t={t} value={savingsTarget} onChange={setSavingsTarget} currencySymbol={currencySymbol} />
        )}
        {step === 2 && (
          <StepIncome t={t} value={income} onChange={setIncome} currencySymbol={currencySymbol} />
        )}
        {/* Step 3: día a día (variable) */}
        {step === 3 && <StepVariable t={t} selected={selectedVariable} onToggle={toggleVariable} />}
        {/* Step 4: fixed categories selection */}
        {step === 4 && <StepFixed t={t} selected={selectedFixed} onToggle={toggleFixed} />}
        {/* Step 5: estimated amounts for selected fixed categories */}
        {step === 5 && (
          <StepFixedAmounts
            t={t}
            selectedFixed={selectedFixed}
            amounts={fixedAmounts}
            onAmountChange={setFixedAmount}
            currencySymbol={currencySymbol}
          />
        )}
        {step === 6 && <StepPriorities t={t} selected={priorities} onToggle={togglePriority} />}

        <Button
          disabled={!canNext || loading}
          onClick={() => (last ? finish() : setStep(step + 1))}
          className="w-full rounded-2xl text-base mt-6 py-6"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {last ? t("onboarding.cta.enter") : t("common.continue")}
              <ArrowRight className="size-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 1: Savings target ─────────────────────── */

/* ───────────────────────── Step 0: Currency ───────────────────────────── */

function StepCurrency({
  t,
  selected,
  onSelect,
}: {
  t: (k: string) => string;
  selected: string;
  onSelect: (code: string) => void;
}) {
  return (
    <>
      <StepHeading
        title={t("onboarding.currency.title")}
        subtitle={t("onboarding.currency.subtitle")}
      />
      <div className="mt-6 flex-1 space-y-2 overflow-y-auto pb-2">
        {ONBOARDING_CURRENCIES.map((c) => {
          const active = selected === c.code;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onSelect(c.code)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all press-scale ${
                active
                  ? "bg-primary/8 border-primary shadow-sm"
                  : "bg-surface border-border hover:border-primary/30"
              }`}
            >
              <span className="size-10 rounded-xl bg-muted grid place-items-center text-lg font-bold num shrink-0 text-foreground">
                {c.symbol}
              </span>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold leading-tight">{c.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{c.code}</div>
              </div>
              {active && (
                <span className="size-5 rounded-full bg-primary grid place-items-center shrink-0">
                  <Check className="size-3 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ───────────────────────── Step 1: Savings target ─────────────────────── */

function StepSavings({
  t,
  value,
  onChange,
  currencySymbol,
}: {
  t: (k: string) => string;
  value: string;
  onChange: (v: string) => void;
  currencySymbol: string;
}) {
  const chips = [
    { label: "100", amount: "100" },
    { label: "200", amount: "200" },
    { label: "400", amount: "400" },
    { label: t("onboarding.step1.chip.whatever"), amount: "50" },
  ];

  return (
    <>
      <StepHeading title={t("onboarding.step1.title")} subtitle={t("onboarding.step1.subtitle")} />
      <div className="mt-8 flex-1 space-y-4">
        <div className="card-soft p-6 flex items-baseline gap-2">
          <span className="text-2xl text-muted-foreground">{currencySymbol}</span>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            className="border-0 shadow-none p-0 h-auto text-5xl font-bold tracking-tight num focus-visible:ring-0 bg-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.amount}
              type="button"
              onClick={() => onChange(c.amount)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all press-scale ${
                value === c.amount
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border hover:border-primary/40 text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t("onboarding.step1.notice")}</p>
      </div>
    </>
  );
}

/* ───────────────────────── Step 2: Income ─────────────────────────────── */

function StepIncome({
  t,
  value,
  onChange,
  currencySymbol,
}: {
  t: (k: string) => string;
  value: string;
  onChange: (v: string) => void;
  currencySymbol: string;
}) {
  return (
    <>
      <StepHeading title={t("onboarding.step2.title")} subtitle={t("onboarding.step2.subtitle")} />
      <div className="mt-8 flex-1">
        <div className="card-soft p-6 flex items-baseline gap-2">
          <span className="text-2xl text-muted-foreground">{currencySymbol}</span>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            className="border-0 shadow-none p-0 h-auto text-5xl font-bold tracking-tight num focus-visible:ring-0 bg-transparent"
          />
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Step 3: Variable lifestyle (día a día) ─────── */

function StepVariable({
  t,
  selected,
  onToggle,
}: {
  t: (k: string) => string;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <StepHeading title={t("onboarding.step4.title")} subtitle={t("onboarding.step4.subtitle")} />
      <div className="mt-6 flex-1">
        <CategoryGrid
          cats={VARIABLE_CATS}
          prefix="variable"
          selected={selected}
          onToggle={onToggle}
          t={t}
        />
      </div>
    </>
  );
}

/* ───────────────────────── Step 4: Fixed categories ───────────────────── */

function StepFixed({
  t,
  selected,
  onToggle,
}: {
  t: (k: string) => string;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <StepHeading title={t("onboarding.step3.title")} subtitle={t("onboarding.step3.subtitle")} />
      <div className="mt-6 flex-1">
        <CategoryGrid
          cats={FIXED_CATS}
          prefix="fixed"
          selected={selected}
          onToggle={onToggle}
          t={t}
        />
        <p className="text-xs text-muted-foreground mt-4">{t("onboarding.step3.notice")}</p>
      </div>
    </>
  );
}

/* ───────────────────────── Step 5: Fixed amounts ──────────────────────── */

function StepFixedAmounts({
  t,
  selectedFixed,
  amounts,
  onAmountChange,
  currencySymbol,
}: {
  t: (k: string) => string;
  selectedFixed: string[];
  amounts: Record<string, string>;
  onAmountChange: (id: string, val: string) => void;
  currencySymbol: string;
}) {
  return (
    <>
      <StepHeading
        title={t("onboarding.step3b.title")}
        subtitle={t("onboarding.step3b.subtitle")}
      />
      <div className="mt-6 flex-1 space-y-2.5 overflow-y-auto">
        {selectedFixed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center pt-8">
            {t("onboarding.step3b.empty")}
          </p>
        ) : (
          selectedFixed.map((id) => {
            const cat = FIXED_CATS.find((c) => c.id === id)!;
            const Icon = cat.icon;
            return (
              <div key={id} className="card-soft flex items-center gap-3 px-4 py-3">
                <span
                  className={`size-9 rounded-xl grid place-items-center shrink-0 ${COLOR_CLS[cat.color] ?? "bg-muted text-muted-foreground"}`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 text-sm font-medium">{t(`fixed.${id}`)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground text-sm">{currencySymbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={amounts[id] ?? ""}
                    onChange={(e) => onAmountChange(id, e.target.value)}
                    placeholder="0"
                    className="w-20 text-right text-sm font-semibold bg-transparent border-0 outline-none focus:ring-0 num placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ───────────────────────── Step 6: Priorities ─────────────────────────── */

function StepPriorities({
  t,
  selected,
  onToggle,
}: {
  t: (k: string) => string;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <StepHeading title={t("onboarding.step5.title")} subtitle={t("onboarding.step5.subtitle")} />
      <div className="mt-6 flex-1 grid grid-cols-2 gap-2.5 content-start">
        {PRIORITY_DEFS.map(({ id, icon: Icon }) => {
          const active = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              className={`relative p-4 rounded-2xl border text-left transition-all press-scale ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-card"
                  : "bg-surface border-border hover:border-primary/30"
              }`}
            >
              {active && (
                <span className="absolute top-2.5 right-2.5 size-4 rounded-full bg-white/20 grid place-items-center">
                  <Check className="size-2.5" />
                </span>
              )}
              <Icon className="size-5 mb-2 opacity-80" />
              <div className="text-sm font-medium leading-snug">{t(`priority.${id}`)}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ───────────────────────── Shared primitives ───────────────────────────── */

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-[15px] leading-snug">{subtitle}</p>
    </div>
  );
}

function CategoryGrid({
  cats,
  prefix,
  selected,
  onToggle,
  t,
}: {
  cats: CatDef[];
  prefix: string;
  selected: string[];
  onToggle: (id: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cats.map(({ id, icon: Icon, color }) => {
        const active = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={`relative flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border transition-all press-scale ${
              active
                ? "bg-primary/8 border-primary shadow-sm"
                : "bg-surface border-border hover:border-primary/30"
            }`}
          >
            {active && (
              <span className="absolute top-2 right-2 size-4 rounded-full bg-primary grid place-items-center">
                <Check className="size-2.5 text-primary-foreground" />
              </span>
            )}
            <span
              className={`size-9 rounded-xl grid place-items-center ${COLOR_CLS[color] ?? "bg-muted text-muted-foreground"}`}
            >
              <Icon className="size-4" />
            </span>
            <span className="text-[11px] font-medium text-center leading-tight line-clamp-2">
              {t(`${prefix}.${id}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
