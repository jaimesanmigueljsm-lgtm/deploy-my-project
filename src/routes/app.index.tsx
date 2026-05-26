import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, memo } from "react";
import { money, monthLabel, monthRange, shortMoney } from "@/lib/format";
import {
  Sparkles,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  SectionHeader,
  InsightCard,
  TrendBadge,
  SkeletonBlock,
} from "@/components/nest";
import { CHART_COLORS, getChartTooltipStyle, chartCursor } from "@/lib/chart";
import { useDashboard, useGenerateInsights } from "@/features/dashboard/use-dashboard";
import { useFinancialEngine } from "@/features/dashboard/use-financial-engine";
import { ForecastWidget, ForecastSkeleton } from "@/features/dashboard/components/forecast-widget";
import { useT } from "@/i18n";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";
import { NotificationBell } from "@/features/notifications/notification-bell";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

// ─── Derived types ────────────────────────────────────────────────────────────

type Expense = Pick<
  Tables<"expenses">,
  "id" | "amount" | "description" | "spent_at" | "kind" | "category_id"
>;
type Category = Pick<Tables<"categories">, "id" | "name" | "color" | "kind">;

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const { t } = useT();
  const {
    profile,
    expenses,
    prevMonthTotal,
    incomeTotal,
    categories,
    recommendations,
    isLoading,
    range,
  } = useDashboard();

  const { output: engine, isLoading: engineLoading } = useFinancialEngine();
  const { mutate: refreshInsights, isPending: refreshing } = useGenerateInsights();

  // ── Derived values (before any early return — Rules of Hooks) ────────────
  const totalSpent = useMemo(() => expenses.reduce((s, x) => s + x.amount, 0), [expenses]);
  const series = useMemo(() => buildSeries(expenses, range), [expenses, range]);
  const dist = useMemo(() => buildDistribution(expenses, categories), [expenses, categories]);

  const convert = useCurrencyConvert();

  if (isLoading) return <DashboardSkeleton />;

  const currency = profile?.currency ?? "EUR";
  const remaining = incomeTotal - totalSpent;
  const monthChange =
    prevMonthTotal > 0 ? ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 space-y-5 animate-rise">
      {/* ── Header ── */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {monthLabel()}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">
            Hey, {profile?.full_name?.split(" ")[0] || "there"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Link
            to="/app/budget"
            search={{ add: "expense" }}
            className="size-10 rounded-full bg-foreground text-background grid place-items-center hover:opacity-90 transition active:scale-95"
            aria-label="Add expense"
          >
            <Plus className="size-4" />
          </Link>
        </div>
      </header>

      {/* ── Hero card ── */}
      <div className="card-soft p-5 gradient-hero relative overflow-hidden">
        <div>
          <p className="text-xs text-muted-foreground">{t("dashboard.available")}</p>
          <div className="mt-1 balance-display num-display text-[44px] font-semibold leading-tight">
            {shortMoney(convert(remaining), currency)}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="num inline-flex items-center gap-1 text-positive font-medium">
              <ArrowUpRight className="size-3" /> {money(convert(incomeTotal), currency)}
            </span>
            <span className="text-border">|</span>
            <span className="num inline-flex items-center gap-1 text-muted-foreground">
              <ArrowDownRight className="size-3" /> {money(convert(totalSpent), currency)}
            </span>
            {prevMonthTotal > 0 && <TrendBadge value={monthChange} className="ml-1" />}
          </div>
        </div>

        <SpendingAreaChart series={series} currency={currency} convert={convert} />
      </div>

      {/* ── Budget forecast ── */}
      {(engineLoading || engine) && (
        <section className="animate-rise-delay-1">
          <SectionHeader
            title={t("dashboard.section.forecast")}
            subtitle={t("dashboard.section.forecast.sub")}
          />
          {engineLoading || !engine
            ? <ForecastSkeleton />
            : <ForecastWidget forecast={engine.budgetForecast} currency={currency} savedSoFar={remaining} />
          }
        </section>
      )}

      {/* ── Where money goes ── */}
      {dist.length > 0 && (
        <section>
          <SectionHeader
            title={t("dashboard.section.spending")}
            subtitle={t("dashboard.section.spending.sub")}
          />
          <SpendingPieChart dist={dist} totalSpent={totalSpent} currency={currency} convert={convert} totalLabel={t("dashboard.section.spending.total")} />
        </section>
      )}

      {/* ── For you (AI recommendations) ── */}
      <section className="animate-rise-delay-2 pb-4">
        <SectionHeader
          title={t("dashboard.section.recommendations")}
          subtitle={
            recommendations.length > 0
              ? t("dashboard.section.recommendations.sub.ai")
              : t("dashboard.section.recommendations.sub.empty")
          }
          action={
            <button
              onClick={() => refreshInsights()}
              disabled={refreshing}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
              {recommendations.length > 0
                ? t("dashboard.insights.refresh")
                : t("dashboard.insights.generate.short")}
            </button>
          }
        />
        {recommendations.length > 0 ? (
          <div className="space-y-2">
            {recommendations.map((r) => {
              const tone =
                r.severity === "warning" ? "warn" : r.severity === "success" ? "mint" : "sky";
              const Icon =
                r.severity === "warning"
                  ? AlertTriangle
                  : r.severity === "success"
                    ? CheckCircle2
                    : Lightbulb;
              return (
                <InsightCard
                  key={r.id}
                  tone={tone}
                  icon={<Icon className="size-4" />}
                  title={r.title}
                  body={r.body}
                />
              );
            })}
          </div>
        ) : (
          <>
            <InsightCard
              tone="mint"
              icon={<Lightbulb className="size-4" />}
              title={t("dashboard.insight.roundup.title")}
              body={t("dashboard.insight.roundup.body")}
            />
            <InsightCard
              tone="sky"
              icon={<TrendingUp className="size-4" />}
              title={t("dashboard.insight.idlecash.title")}
              body={t("dashboard.insight.idlecash.body")}
            />
            <button
              onClick={() => refreshInsights()}
              disabled={refreshing}
              className="w-full card-flat p-3 text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              {refreshing ? t("dashboard.insights.analyzing") : t("dashboard.insights.generate")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Memoized chart components ────────────────────────────────────────────────

type ConvertFn = (n: number) => number;

const SpendingAreaChart = memo(function SpendingAreaChart({
  series, currency, convert,
}: { series: { day: number; cumulative: number }[]; currency: string; convert: ConvertFn }) {
  return (
    <div className="mt-4 h-20 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" hide />
          <Tooltip
            cursor={chartCursor}
            contentStyle={getChartTooltipStyle()}
            formatter={((v: unknown) => money(convert(Number(v)), currency)) as never}
            labelFormatter={(l) => `Day ${l}`}
          />
          <Area type="monotone" dataKey="cumulative" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#g)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

const SpendingPieChart = memo(function SpendingPieChart({
  dist, totalSpent, currency, convert, totalLabel,
}: { dist: { name: string; value: number }[]; totalSpent: number; currency: string; convert: ConvertFn; totalLabel: string }) {
  return (
    <div className="card-flat p-5 flex items-center gap-5">
      <div className="relative shrink-0">
        <ResponsiveContainer width={104} height={104}>
          <PieChart>
            <Pie data={dist} dataKey="value" innerRadius={36} outerRadius={50} paddingAngle={2} stroke="none">
              {dist.map((_d, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{totalLabel}</div>
          <div className="text-sm font-semibold num">{shortMoney(convert(totalSpent), currency)}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {dist.slice(0, 4).map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate">{d.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="num font-medium">{money(convert(d.value), currency)}</span>
              <span className="text-muted-foreground tabular-nums w-9 text-right">
                {Math.round((d.value / totalSpent) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function buildSeries(expenses: Expense[], range: ReturnType<typeof monthRange>) {
  const byDay = new Map<number, number>();
  for (const e of expenses) {
    const d = new Date(e.spent_at).getDate();
    byDay.set(d, (byDay.get(d) || 0) + e.amount);
  }
  let cum = 0;
  const out: { day: number; cumulative: number }[] = [];
  for (let d = 1; d <= range.today; d++) {
    cum += byDay.get(d) || 0;
    out.push({ day: d, cumulative: Math.round(cum) });
  }
  return out;
}

function buildDistribution(expenses: Expense[], cats: Category[]) {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const cat = cats.find((c) => c.id === e.category_id);
    const key = cat?.name ?? "Other";
    map.set(key, (map.get(key) || 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-5">
      <SkeletonBlock className="h-10 w-44" />
      <SkeletonBlock className="h-52" />
      <SkeletonBlock className="h-40" />
      <div className="space-y-2">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
      </div>
    </div>
  );
}
