import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { money, monthRange, shortMoney } from "@/lib/format";
import { Sparkles, TrendingUp as TUp, PiggyBank, ShieldCheck, Wallet2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, Legend,
} from "recharts";
import { SectionHeader, EmptyState, SkeletonBlock } from "@/components/nest";
import { CHART_COLORS, getChartTooltipStyle } from "@/lib/chart";
import type { AnalyticsExpense } from "@/types/finance";
import { useAnalyticsData } from "@/features/analytics/use-analytics";
import { buildTopCategories, buildIncomeExpenseSeries, buildFixedVariableSeries } from "@/features/analytics/analytics.utils";
import { HealthCard, HealthCardSkeleton } from "@/features/dashboard/components/health-card";
import { SmartInsightsFeed, SmartInsightsSkeleton } from "@/features/dashboard/components/smart-insights";
import { useFinancialEngine } from "@/features/dashboard/use-financial-engine";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/analytics")({
  component: Analytics,
});

// ─── Period helpers ───────────────────────────────────────────────────────────

type Period = "month" | "quarter" | "semester";

function periodMonths(period: Period): number {
  return period === "month" ? 1 : period === "quarter" ? 3 : 6;
}

function periodStart(period: Period): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (periodMonths(period) - 1));
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

function Analytics() {
  const { t } = useT();
  const { expenses, incomes, categories, currency, isLoading } = useAnalyticsData();
  const { output: engine, isLoading: engineLoading } = useFinancialEngine();
  const range = useMemo(() => monthRange(), []);

  const [period, setPeriod] = useState<Period>("month");

  const months = periodMonths(period);
  const start  = useMemo(() => periodStart(period), [period]);
  const end    = range.end;

  const filteredExpenses = useMemo(
    () => expenses.filter((e: AnalyticsExpense) => e.spent_at >= start && e.spent_at <= end),
    [expenses, start, end],
  );
  const filteredIncomes = useMemo(
    () => incomes.filter((i) => i.received_at >= start && i.received_at <= end),
    [incomes, start, end],
  );

  const expenseTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const incomeTotal  = useMemo(() => filteredIncomes.reduce((s, i) => s + i.amount, 0), [filteredIncomes]);
  const net          = incomeTotal - expenseTotal;

  const topCats = useMemo(
    () => buildTopCategories(expenses, categories, start, end),
    [expenses, categories, start, end],
  );

  const chartSeries = useMemo(
    () => buildIncomeExpenseSeries(expenses, incomes, months),
    [expenses, incomes, months],
  );

  const fixedVariableSeries = useMemo(
    () => buildFixedVariableSeries(expenses, months),
    [expenses, months],
  );

  if (isLoading) return <AnalyticsSkeleton />;

  if (expenses.length === 0) {
    return (
      <div className="px-4 pt-8">
        <EmptyState
          icon={<TUp className="size-5" />}
          title={t("analytics.empty.title")}
          description={t("analytics.empty.desc")}
        />
      </div>
    );
  }

  const periods: { key: Period; label: string }[] = [
    { key: "month",    label: t("analytics.period.month") },
    { key: "quarter",  label: t("analytics.period.quarter") },
    { key: "semester", label: t("analytics.period.semester") },
  ];

  return (
    <div className="px-4 pt-5 space-y-5 animate-rise pb-6">

      {/* Header */}
      <header className="pt-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t("analytics.subtitle")}</p>
        <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("analytics.title")}</h1>
      </header>

      {/* Period filter */}
      <div className="flex gap-1.5 p-1 bg-muted rounded-xl">
        {periods.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
              period === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card-flat p-3.5 space-y-1">
          <p className="label-overline">{t("analytics.income.label")}</p>
          <p className="text-base font-semibold num text-positive">{shortMoney(incomeTotal, currency)}</p>
        </div>
        <div className="card-flat p-3.5 space-y-1">
          <p className="label-overline">{t("analytics.expenses.label")}</p>
          <p className="text-base font-semibold num">{shortMoney(expenseTotal, currency)}</p>
        </div>
        <div className="card-flat p-3.5 space-y-1">
          <p className="label-overline">{t("analytics.net.label")}</p>
          <p className={cn("text-base font-semibold num", net >= 0 ? "text-positive" : "text-negative")}>
            {shortMoney(net, currency)}
          </p>
        </div>
      </div>

      {/* Income vs Expenses chart */}
      <section>
        <SectionHeader title={t("analytics.section.incomeVsExpenses")} />
        <div className="card-flat p-4">
          <div className="h-48 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barSize={14} barGap={3}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.93 0.005 250)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.52 0.012 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.012 255)" }} axisLine={false} tickLine={false} tickFormatter={(v) => shortMoney(v, currency)} width={44} />
                <Tooltip
                  cursor={{ fill: "oklch(0.96 0.006 250)" }}
                  contentStyle={getChartTooltipStyle()}
                  formatter={((v: unknown, name: unknown) => [money(Number(v), currency), name]) as never}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                />
                <ReferenceLine y={0} stroke="oklch(0.85 0.005 250)" />
                <Bar dataKey="income"   name={t("analytics.chart.income")}   fill={CHART_COLORS[2]} radius={[4, 4, 2, 2]} />
                <Bar dataKey="expenses" name={t("analytics.chart.expenses")} fill={CHART_COLORS[0]} radius={[4, 4, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top categories */}
      {topCats.length > 0 && (
        <section>
          <SectionHeader title={t("analytics.section.categories")} />
          <div className="card-flat divide-y divide-border-subtle">
            {topCats.map(({ name, total }: { name: string; total: number }, i: number) => (
              <div key={name} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="size-7 rounded-lg bg-muted grid place-items-center text-[11px] font-semibold text-muted-foreground tabular-nums">{i + 1}</div>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {expenseTotal > 0 ? `${Math.round((total / expenseTotal) * 100)}%` : "—"}
                  </span>
                  <span className="text-sm font-semibold num">{money(total, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fixed vs Variable expenses chart */}
      <section>
        <SectionHeader title={t("analytics.section.fixedVsVariable")} subtitle={t("analytics.section.fixedVsVariable.sub")} />
        <div className="card-flat p-4">
          <div className="h-48 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fixedVariableSeries} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barSize={14} barGap={3}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.93 0.005 250)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.52 0.012 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.012 255)" }} axisLine={false} tickLine={false} tickFormatter={(v) => shortMoney(v, currency)} width={44} />
                <Tooltip
                  cursor={{ fill: "oklch(0.96 0.006 250)" }}
                  contentStyle={getChartTooltipStyle()}
                  formatter={((v: unknown, name: unknown) => [money(Number(v), currency), name]) as never}
                />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Bar dataKey="fixed"    name={t("analytics.chart.fixed")}    fill={CHART_COLORS[3]} radius={[4, 4, 2, 2]} />
                <Bar dataKey="variable" name={t("analytics.chart.variable")} fill={CHART_COLORS[0]} radius={[4, 4, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Financial health */}
      <section>
        <SectionHeader title={t("analytics.section.healthDetail")} />
        {engineLoading || !engine
          ? <HealthCardSkeleton />
          : <HealthCard healthScore={engine.healthScore} currency={currency} />
        }
      </section>

      {/* Savings & Net Worth position */}
      {!engineLoading && engine && (engine.totalSavings > 0 || engine.netWorth > 0) && (
        <section>
          <SectionHeader title={t("analytics.section.savings")} subtitle={t("analytics.section.savings.sub")} />
          <div className="grid grid-cols-3 gap-2.5">
            <div className="card-flat p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <p className="label-overline">{t("analytics.savings.total")}</p>
                <PiggyBank className="size-3.5 text-positive" />
              </div>
              <p className="text-base font-semibold num text-positive">{shortMoney(engine.totalSavings, currency)}</p>
            </div>
            <div className="card-flat p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <p className="label-overline">{t("analytics.savings.emergency")}</p>
                <ShieldCheck className="size-3.5 text-sky" />
              </div>
              <p className={cn("text-base font-semibold num", engine.healthScore.subScores.emergencyReadiness.rawValue >= 3 ? "text-positive" : "text-warn")}>
                {engine.healthScore.subScores.emergencyReadiness.rawValue.toFixed(1)} {t("dashboard.savings.months")}
              </p>
            </div>
            <div className="card-flat p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <p className="label-overline">{t("analytics.savings.networth")}</p>
                <Wallet2 className="size-3.5 text-muted-foreground" />
              </div>
              <p className={cn("text-base font-semibold num", engine.netWorth >= 0 ? "text-positive" : "text-negative")}>
                {shortMoney(engine.netWorth, currency)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Spending signals */}
      {(engineLoading || (engine && engine.spendingIntelligence)) && (
        <section>
          <SectionHeader title={t("analytics.section.signals")} />
          {engineLoading || !engine
            ? <SmartInsightsSkeleton />
            : <SmartInsightsFeed intelligence={engine.spendingIntelligence} />
          }
        </section>
      )}

    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-5">
      <SkeletonBlock className="h-10 w-32" />
      <SkeletonBlock className="h-10 rounded-xl" />
      <div className="grid grid-cols-3 gap-2.5">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
      </div>
      <SkeletonBlock className="h-52" />
      <SkeletonBlock className="h-40" />
    </div>
  );
}
