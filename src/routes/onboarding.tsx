import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Loader2, Check,
  Home, Building2, Zap, Droplets, Flame, Wifi, Smartphone, Dumbbell, Repeat, Shield, Car, Bus, Baby,
  ShoppingCart, Utensils, Music, ShoppingBag, Heart, BookOpen, Plane, PawPrint, Sparkles,
  PiggyBank, CreditCard, TrendingDown, Star, Brain, Target, TrendingUp,
} from "lucide-react";
import { useT } from "@/i18n";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type CatDef = { id: string; icon: React.ElementType; color: string; dbIcon: string };

const FIXED_CATS: CatDef[] = [
  { id: "rent",          icon: Home,       color: "sky",    dbIcon: "home" },
  { id: "mortgage",      icon: Building2,  color: "sky",    dbIcon: "building-2" },
  { id: "electricity",   icon: Zap,        color: "warn",   dbIcon: "zap" },
  { id: "water",         icon: Droplets,   color: "sky",    dbIcon: "droplets" },
  { id: "gas",           icon: Flame,      color: "warn",   dbIcon: "flame" },
  { id: "internet",      icon: Wifi,       color: "mint",   dbIcon: "wifi" },
  { id: "phone",         icon: Smartphone, color: "mint",   dbIcon: "smartphone" },
  { id: "gym",           icon: Dumbbell,   color: "mint",   dbIcon: "dumbbell" },
  { id: "subscriptions", icon: Repeat,     color: "violet", dbIcon: "repeat" },
  { id: "insurance",     icon: Shield,     color: "sky",    dbIcon: "shield" },
  { id: "car",           icon: Car,        color: "warn",   dbIcon: "car" },
  { id: "transport",     icon: Bus,        color: "sky",    dbIcon: "bus" },
  { id: "childcare",     icon: Baby,       color: "mint",   dbIcon: "baby" },
];

const VARIABLE_CATS: CatDef[] = [
  { id: "groceries",   icon: ShoppingCart, color: "mint",   dbIcon: "shopping-cart" },
  { id: "restaurants", icon: Utensils,     color: "warn",   dbIcon: "utensils" },
  { id: "transport",   icon: Car,          color: "sky",    dbIcon: "car" },
  { id: "leisure",     icon: Music,        color: "violet", dbIcon: "music" },
  { id: "shopping",    icon: ShoppingBag,  color: "warn",   dbIcon: "shopping-bag" },
  { id: "health",      icon: Heart,        color: "mint",   dbIcon: "heart" },
  { id: "education",   icon: BookOpen,     color: "sky",    dbIcon: "book-open" },
  { id: "travel",      icon: Plane,        color: "sky",    dbIcon: "plane" },
  { id: "pets",        icon: PawPrint,     color: "mint",   dbIcon: "paw-print" },
  { id: "beauty",      icon: Sparkles,     color: "violet", dbIcon: "sparkles" },
];

const PRIORITY_DEFS = [
  { id: "savings",   icon: PiggyBank   },
  { id: "debt",      icon: CreditCard  },
  { id: "family",    icon: Heart       },
  { id: "lifestyle", icon: Star        },
  { id: "spending",  icon: TrendingDown},
  { id: "travel",    icon: Plane       },
  { id: "home",      icon: Home        },
  { id: "stress",    icon: Brain       },
  { id: "children",  icon: Baby        },
  { id: "control",   icon: Target      },
  { id: "invest",    icon: TrendingUp  },
] as const;

const COLOR_CLS: Record<string, string> = {
  mint:   "bg-positive-soft text-positive",
  sky:    "bg-sky-soft text-sky",
  warn:   "bg-warn-soft text-warn",
  violet: "bg-violet-soft text-violet",
};

const TOTAL_STEPS = 5;

function Onboarding() {
  const navigate = useNavigate();
  const { t } = useT();
  const [step, setStep]     = useState(0);
  const [loading, setLoading] = useState(false);

  const [savingsTarget,    setSavingsTarget]    = useState("");
  const [income,           setIncome]           = useState("");
  const [selectedFixed,    setSelectedFixed]    = useState<string[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<string[]>([]);
  const [priorities,       setPriorities]       = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
    });
  }, [navigate]);

  const canNext =
    (step === 0 && Number(savingsTarget) > 0) ||
    (step === 1 && Number(income) > 0)         ||
    step === 2                                  ||
    step === 3                                  ||
    (step === 4 && priorities.length > 0);

  const last = step === TOTAL_STEPS - 1;

  function toggleFixed(id: string) {
    setSelectedFixed((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function toggleVariable(id: string) {
    setSelectedVariable((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function togglePriority(id: string) {
    setPriorities((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  async function finish() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      await supabase.from("profiles").update({
        monthly_savings_target: Number(savingsTarget),
        priorities,
        onboarded: true,
      }).eq("id", user.id);

      if (Number(income) > 0) {
        await supabase.from("incomes").insert({
          user_id: user.id,
          source: "Monthly income",
          amount: Number(income),
          recurring: true,
        });
      }

      const fixedRows = selectedFixed.map((id) => {
        const cat = FIXED_CATS.find((c) => c.id === id)!;
        return { user_id: user.id, name: t(`fixed.${id}`), icon: cat.dbIcon, color: cat.color, kind: "fixed" };
      });
      const varRows = selectedVariable.map((id) => {
        const cat = VARIABLE_CATS.find((c) => c.id === id)!;
        return { user_id: user.id, name: t(`variable.${id}`), icon: cat.dbIcon, color: cat.color, kind: "variable" };
      });

      const allRows = [...fixedRows, ...varRows];
      if (allRows.length === 0) {
        allRows.push(
          { user_id: user.id, name: t("fixed.rent"),          icon: "home",          color: "sky",  kind: "fixed" },
          { user_id: user.id, name: t("variable.groceries"),  icon: "shopping-cart", color: "mint", kind: "variable" },
        );
      }
      await supabase.from("categories").insert(allRows);

      toast.success(t("onboarding.toast.success"), { description: t("onboarding.toast.success.desc") });
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Top bar: back + progress */}
      <div className="px-6 pt-6 flex items-center justify-between">
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
                i === step  ? "w-6 bg-primary" :
                i < step    ? "w-2 bg-primary/50" :
                              "w-2 bg-border"
              }`}
            />
          ))}
        </div>
        <div className="size-10" />
      </div>

      {/* Step content */}
      <div key={step} className="flex-1 flex flex-col px-6 pt-10 pb-8 max-w-md w-full mx-auto animate-rise">
        {step === 0 && (
          <StepSavings t={t} value={savingsTarget} onChange={setSavingsTarget} />
        )}
        {step === 1 && (
          <StepIncome t={t} value={income} onChange={setIncome} />
        )}
        {step === 2 && (
          <StepFixed t={t} selected={selectedFixed} onToggle={toggleFixed} />
        )}
        {step === 3 && (
          <StepVariable t={t} selected={selectedVariable} onToggle={toggleVariable} />
        )}
        {step === 4 && (
          <StepPriorities t={t} selected={priorities} onToggle={togglePriority} />
        )}

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

function StepSavings({ t, value, onChange }: { t: (k: string) => string; value: string; onChange: (v: string) => void }) {
  const chips = [
    { label: t("onboarding.step1.chip.100"), amount: "100" },
    { label: t("onboarding.step1.chip.200"), amount: "200" },
    { label: t("onboarding.step1.chip.400"), amount: "400" },
    { label: t("onboarding.step1.chip.whatever"), amount: "50" },
  ];

  return (
    <>
      <StepHeading title={t("onboarding.step1.title")} subtitle={t("onboarding.step1.subtitle")} />
      <div className="mt-8 flex-1 space-y-4">
        <div className="card-soft p-6 flex items-baseline gap-2">
          <span className="text-2xl text-muted-foreground">€</span>
          <Input
            type="number" inputMode="decimal" min="0" autoFocus
            value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
            className="border-0 shadow-none p-0 h-auto text-5xl font-bold tracking-tight num focus-visible:ring-0 bg-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.amount} type="button"
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

function StepIncome({ t, value, onChange }: { t: (k: string) => string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <StepHeading title={t("onboarding.step2.title")} subtitle={t("onboarding.step2.subtitle")} />
      <div className="mt-8 flex-1">
        <div className="card-soft p-6 flex items-baseline gap-2">
          <span className="text-2xl text-muted-foreground">€</span>
          <Input
            type="number" inputMode="decimal" min="0" autoFocus
            value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
            className="border-0 shadow-none p-0 h-auto text-5xl font-bold tracking-tight num focus-visible:ring-0 bg-transparent"
          />
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Step 3: Fixed expenses ─────────────────────── */

function StepFixed({ t, selected, onToggle }: { t: (k: string) => string; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <>
      <StepHeading title={t("onboarding.step3.title")} subtitle={t("onboarding.step3.subtitle")} />
      <div className="mt-6 flex-1">
        <CategoryGrid cats={FIXED_CATS} prefix="fixed" selected={selected} onToggle={onToggle} t={t} />
        <p className="text-xs text-muted-foreground mt-4">{t("onboarding.step3.notice")}</p>
      </div>
    </>
  );
}

/* ───────────────────────── Step 4: Variable lifestyle ─────────────────── */

function StepVariable({ t, selected, onToggle }: { t: (k: string) => string; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <>
      <StepHeading title={t("onboarding.step4.title")} subtitle={t("onboarding.step4.subtitle")} />
      <div className="mt-6 flex-1">
        <CategoryGrid cats={VARIABLE_CATS} prefix="variable" selected={selected} onToggle={onToggle} t={t} />
      </div>
    </>
  );
}

/* ───────────────────────── Step 5: Priorities ─────────────────────────── */

function StepPriorities({ t, selected, onToggle }: { t: (k: string) => string; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <>
      <StepHeading title={t("onboarding.step5.title")} subtitle={t("onboarding.step5.subtitle")} />
      <div className="mt-6 flex-1 grid grid-cols-2 gap-2.5 content-start">
        {PRIORITY_DEFS.map(({ id, icon: Icon }) => {
          const active = selected.includes(id);
          return (
            <button
              key={id} type="button" onClick={() => onToggle(id)}
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
  cats, prefix, selected, onToggle, t,
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
            key={id} type="button" onClick={() => onToggle(id)}
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
            <span className={`size-9 rounded-xl grid place-items-center ${COLOR_CLS[color] ?? "bg-muted text-muted-foreground"}`}>
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
