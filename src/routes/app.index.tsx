import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { money, monthLabel, monthRange, shortMoney } from "@/lib/format";
import {
  Sparkles,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  PiggyBank,
  ShieldCheck,
  Target,
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
import { useSavingsAccounts } from "@/features/savings/use-savings";
import { useT } from "@/i18n";
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
type Goal = Tables<"savings_goals">;

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const { t } = useT();
  const {
    profile,
    expenses,
    prevMonthTotal,
    incomeTotal,
    categories,
    goals,
    recommendations,
    isLoading,
    range,
  } = useDashboard();

  const { data: savingsAccounts = [], isLoading: savingsLoading } = useSavingsAccounts();
  const { mutate: refreshInsights, isPending: refreshing } = useGenerateInsights();

  // ── Derived values (before any early return — Rules of Hooks) ────────────
  const totalSpent = useMemo(() => expenses.reduce((s, x) => s + x.amount, 0), [expenses]);
  const series = useMemo(() => buildSeries(expenses, range), [expenses, range]);
  const dist = useMemo(() => buildDistribution(expenses, categories), [expenses, categories]);

  const totalSaved = useMemo(
    () => savingsAccounts.reduce((s, a) => s + a.balance, 0),
    [savingsAccounts],
  );
  const emergencyBalance = useMemo(
    () => savingsAccounts.filter((a) => a.is_emergency_fund).reduce((s, a) => s + a.balance, 0),
    [savingsAccounts],
  );
  const hasEmergencyAccount = useMemo(
    () => savingsAccounts.some((a) => a.is_emergency_fund),
    [savingsAccounts],
  );

  const featuredGoal = useMemo(() => {
    const active = (goals as Goal[]).filter(
      (g) => Number(g.current_amount) < Number(g.target_amount) && Number(g.target_amount) > 0,
    );
    if (active.length === 0) return null;
    return active.sort(
      (a, b) =>
        Number(b.current_amount) / Number(b.target_amount) -
        Number(a.current_amount) / Number(a.target_amount),
    )[0];
  }, [goals]);

  if (isLoading) return <DashboardSkeleton />;

  const currency = profile?.currency ?? "EUR";
  const remaining = incomeTotal - totalSpent;
  const savingsRate = incomeTotal > 0 ? Math.max(0, remaining) / incomeTotal : 0;
  const monthChange =
    prevMonthTotal > 0 ? ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  const monthlySub: string = (() => {
    if (remaining <= 0) return t("dashboard.monthly.over");
    if (totalSpent < prevMonthTotal && prevMonthTotal > 0) return t("dashboard.monthly.better");
    if (savingsRate >= 0.2) return t("dashboard.monthly.great");
    if (savingsRate >= 0.1) return t("dashboard.monthly.good");
    return t("dashboard.monthly.ok");
  })();

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
          <div className="mt-1 balance-display text-[44px] font-semibold leading-tight">
            {shortMoney(remaining, currency)}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-positive font-medium">
              <ArrowUpRight className="size-3" /> {money(incomeTotal, currency)}
            </span>
            <span className="text-border">|</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ArrowDownRight className="size-3" /> {money(totalSpent, currency)}
            </span>
            {prevMonthTotal > 0 && <TrendBadge value={monthChange} className="ml-1" />}
          </div>
        </div>

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
                formatter={((v: unknown) => money(Number(v), currency)) as never}
                labelFormatter={(l) => `Day ${l}`}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#g)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Your Savings ── */}
      {!savingsLoading && savingsAccounts.length > 0 && (
        <section className="animate-rise-delay-1">
          <SectionHeader title={t("dashboard.yoursavings.title")} />
          <div className={`grid gap-2.5 ${hasEmergencyAccount ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="card-flat p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="label-overline">{t("dashboard.yoursavings.total")}</span>
                <span className="size-5 rounded-lg grid place-items-center bg-positive-soft text-positive">
                  <PiggyBank className="size-3" />
                </span>
              </div>
              <div className="num text-2xl font-semibold tracking-tight leading-none text-positive">
                {shortMoney(totalSaved, currency)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {savingsAccounts.length}{" "}
                {savingsAccounts.length === 1
                  ? t("dashboard.yoursavings.account")
                  : t("dashboard.yoursavings.accounts")}
              </div>
            </div>

            {hasEmergencyAccount && (
              <div className="card-flat p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="label-overline">{t("dashboard.yoursavings.emergency")}</span>
                  <span className="size-5 rounded-lg grid place-items-center bg-sky-soft text-sky">
                    <ShieldCheck className="size-3" />
                  </span>
                </div>
                <div className="num text-2xl font-semibold tracking-tight leading-none text-sky">
                  {shortMoney(emergencyBalance, currency)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t("dashboard.yoursavings.emergency.sub")}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── This Month ── */}
      <section className="animate-rise-delay-1">
        <SectionHeader title={t("dashboard.monthly.title")} />
        <div className="card-flat p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("dashboard.monthly.saved")}</p>
              <p
                className={`num text-2xl font-semibold leading-none ${
                  remaining >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {shortMoney(remaining, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">{monthlySub}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("dashboard.monthly.rate")}</p>
              <p
                className={`num text-2xl font-semibold leading-none mt-1 ${
                  savingsRate >= 0.1
                    ? "text-positive"
                    : remaining < 0
                      ? "text-negative"
                      : "text-muted-foreground"
                }`}
              >
                {incomeTotal > 0 ? `${Math.round(savingsRate * 100)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Where money goes ── */}
      {dist.length > 0 && (
        <section>
          <SectionHeader
            title={t("dashboard.section.spending")}
            subtitle={t("dashboard.section.spending.sub")}
          />
          <div className="card-flat p-5 flex items-center gap-5">
            <div className="relative shrink-0">
              <ResponsiveContainer width={104} height={104}>
                <PieChart>
                  <Pie
                    data={dist}
                    dataKey="value"
                    innerRadius={36}
                    outerRadius={50}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {dist.map((_d, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {t("dashboard.section.spending.total")}
                </div>
                <div className="text-sm font-semibold num">{shortMoney(totalSpent, currency)}</div>
              </div>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {dist.slice(0, 4).map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="num font-medium">{money(d.value, currency)}</span>
                    <span className="text-muted-foreground tabular-nums w-9 text-right">
                      {Math.round((d.value / totalSpent) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Goal in progress ── */}
      {featuredGoal && (
        <section className="animate-rise-delay-1">
          <SectionHeader
            title={t("dashboard.goalcard.title")}
            action={
              <Link
                to="/app/goals"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
              >
                {t("dashboard.goalcard.viewall")} <ChevronRight className="size-3" />
              </Link>
            }
          />
          <GoalCard goal={featuredGoal} currency={currency} t={t} />
        </section>
      )}

      {/* ── For you (AI recommendations only) ── */}
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

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  currency,
  t,
}: {
  goal: Goal;
  currency: string;
  t: (key: string) => string;
}) {
  const current = Number(goal.current_amount);
  const target = Number(goal.target_amount);
  const progress = target > 0 ? Math.min(1, current / target) : 0;
  const remaining = Math.max(0, target - current);

  return (
    <div className="card-flat p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-xl bg-muted grid place-items-center text-foreground shrink-0">
            <Target className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none truncate">{goal.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {money(remaining, currency)} {t("dashboard.goalcard.remaining")}
            </p>
          </div>
        </div>
        <span className="text-base font-semibold num text-foreground shrink-0 ml-2">
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-foreground rounded-full transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{money(current, currency)} {t("dashboard.monthly.saved").toLowerCase()}</span>
        <span>{money(target, currency)} {t("common.of").toLowerCase()} target</span>
      </div>
    </div>
  );
}

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
      <div className="grid grid-cols-2 gap-2.5">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonBlock className="h-24" />
      <SkeletonBlock className="h-40" />
      <div className="space-y-2">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
      </div>
    </div>
  );
}
