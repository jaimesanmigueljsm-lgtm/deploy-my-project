import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useMemo, useState, memo } from "react";
import { money, shortMoney, pct } from "@/lib/format";
import { Plus, TrendingUp, Coins, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  XAxis,
} from "recharts";
import { SectionHeader, EmptyState, TrendBadge, StatCard } from "@/components/nest";
import { CHART_COLORS, getChartTooltipStyle, chartCursor } from "@/lib/chart";
import { useT } from "@/i18n";
import {
  useFinancesData,
  useAddInvestment,
  useDeleteInvestment,
  useSeedDemoInvestments,
} from "@/features/finances/use-finances";
import { INVESTMENT_TYPE_META } from "@/features/finances/finances.constants";
import { computePortfolioStats, buildSyntheticHistory } from "@/features/finances/finances.utils";
import type { AddInvestmentPayload } from "@/features/finances/finances.service";
import type { InvestmentType } from "@/types/finance";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";

export const Route = createFileRoute("/app/finances")({
  component: Finances,
  errorComponent: SectionError,
});

function Finances() {
  const { t } = useT();
  const { investments, currency, isLoading } = useFinancesData();
  const convert = useCurrencyConvert();
  const deleteInvestment = useDeleteInvestment();
  const seedDemo = useSeedDemoInvestments();
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => computePortfolioStats(investments), [investments]);

  const allocation = useMemo(
    () =>
      Array.from(stats.byType.entries())
        .map(([k, v]) => ({
          name: INVESTMENT_TYPE_META[k as InvestmentType]?.label ?? k,
          value: v,
          type: k,
        }))
        .filter((x) => x.value > 0),
    [stats.byType],
  );

  const historySeries = useMemo(() => buildSyntheticHistory(stats.value), [stats.value]);

  if (isLoading) return <FinancesSkeleton />;

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Portfolio
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">Net worth</h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="size-10 rounded-full bg-foreground text-background grid place-items-center"
        >
          <Plus className="size-4" />
        </button>
      </header>

      {/* HERO net worth */}
      <div className="card-soft p-5 gradient-net text-background relative overflow-hidden">
        <p className="text-xs opacity-60">Total value</p>
        <div className="num-display text-[44px] font-semibold mt-0.5 leading-tight">
          {shortMoney(convert(stats.value), currency)}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className={`num font-medium ${stats.pl >= 0 ? "text-positive" : "text-negative"}`}>
            {stats.pl >= 0 ? "+" : ""}
            {money(convert(stats.pl), currency)}
          </span>
          <TrendBadge value={stats.plPct} className="!bg-white/10 !text-white" />
          <span className="opacity-50">all-time</span>
        </div>

        <PortfolioAreaChart historySeries={historySeries} currency={currency} convert={convert} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Invested"
          value={shortMoney(convert(stats.invested), currency)}
          suffix="cost basis"
          tone="neutral"
          icon={<Coins className="size-3.5" />}
        />
        <StatCard
          label="Today"
          value={`${stats.plPct >= 0 ? "+" : ""}${stats.plPct.toFixed(2)}%`}
          suffix={`${money(convert(stats.pl), currency)}`}
          tone={stats.pl >= 0 ? "mint" : "warn"}
          icon={<TrendingUp className="size-3.5" />}
        />
      </div>

      {/* Allocation */}
      {allocation.length > 0 && (
        <section>
          <SectionHeader title={t("finance.allocation")} />
          <AllocationPieChart
            allocation={allocation}
            totalValue={stats.value}
            assetCount={investments.length}
            currency={currency}
            convert={convert}
          />
        </section>
      )}

      {/* Holdings */}
      <section>
        <SectionHeader
          title="Holdings"
          action={
            <span className="text-[11px] text-muted-foreground">
              {investments.length} positions
            </span>
          }
        />
        {investments.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="size-5" />}
            title="Start tracking your portfolio"
            description="Add stocks, ETFs, crypto or savings to see net worth and performance in one place."
            action={
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="size-3.5 mr-1" /> Add holding
                </Button>
                <Button size="sm" variant="outline" onClick={() => seedDemo.mutate()}>
                  <Sparkles className="size-3.5 mr-1" /> Try demo data
                </Button>
              </div>
            }
          />
        ) : (
          <div className="card-flat divide-y divide-border-subtle">
            {investments.map((inv) => {
              const invType = inv.type as InvestmentType;
              const meta = INVESTMENT_TYPE_META[invType] ?? INVESTMENT_TYPE_META.other;
              const Icon = meta.icon;
              const value = Number(inv.current_price) * Number(inv.quantity);
              const cost = Number(inv.avg_cost) * Number(inv.quantity);
              const pl = value - cost;
              const plPct = cost > 0 ? (pl / cost) * 100 : 0;
              return (
                <Link
                  key={inv.id}
                  to="/app/finances/$id"
                  params={{ id: inv.id }}
                  className="group flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-10 rounded-xl grid place-items-center shrink-0"
                      style={{ background: `${meta.color}22`, color: meta.color }}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                        {inv.ticker && (
                          <span className="font-mono text-[11px] uppercase opacity-60">
                            {inv.ticker}
                          </span>
                        )}
                        {inv.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground num">
                        {Number(inv.quantity)} ×{" "}
                        {money(convert(Number(inv.current_price)), currency)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                    <div>
                      <div className="text-sm font-semibold num">
                        {money(convert(value), currency)}
                      </div>
                      <div
                        className={`text-[11px] num ${pl >= 0 ? "text-positive" : "text-negative"}`}
                      >
                        {pl >= 0 ? "+" : ""}
                        {pct(plPct, 2)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        deleteInvestment.mutate(inv.id);
                      }}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* AI insight */}
      {investments.length > 0 && (
        <div className="card-soft p-4 bg-foreground text-background relative overflow-hidden">
          <div className="absolute top-0 right-0 size-32 gradient-mint opacity-30 rounded-full blur-3xl -translate-y-12 translate-x-8" />
          <div className="relative flex gap-3">
            <div className="size-9 rounded-xl bg-background/10 grid place-items-center backdrop-blur shrink-0">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60 font-medium">
                Portfolio insight
              </p>
              <p className="text-sm font-medium mt-0.5 leading-snug">
                {stats.pl >= 0
                  ? `Your portfolio is up ${pct(stats.plPct)} overall. Largest position: ${investments[0]?.name}.`
                  : `Down ${pct(stats.plPct)} overall. Consider reviewing exposure to ${INVESTMENT_TYPE_META[investments[0]?.type as InvestmentType]?.label ?? "your largest holding"}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      <InvestmentDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function InvestmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const addInvestment = useAddInvestment();
  const [type, setType] = useState<AddInvestmentPayload["type"]>("stock");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");

  function save() {
    if (!name || !quantity || !avgCost) return toast.error("Fill required fields");
    addInvestment.mutate(
      {
        type,
        ticker: ticker || null,
        name,
        quantity: Number(quantity),
        avg_cost: Number(avgCost),
        current_price: Number(currentPrice || avgCost),
      },
      {
        onSuccess: () => {
          setTicker("");
          setName("");
          setQuantity("");
          setAvgCost("");
          setCurrentPrice("");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-1.5">
            {(["stock", "etf", "crypto", "savings", "other"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`py-2 text-[11px] font-medium rounded-lg border transition capitalize ${
                  type === t
                    ? "bg-foreground text-background border-foreground"
                    : "border-border bg-surface text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label>Ticker</Label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="VWCE"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vanguard FTSE All-World"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("finance.avg_cost")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Price now</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="110"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={save} disabled={addInvestment.isPending} className="flex-1">
              {addInvestment.isPending ? "Saving…" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Memoized chart components ────────────────────────────────────────────────

type ConvertFn = (n: number) => number;

const PortfolioAreaChart = memo(function PortfolioAreaChart({
  historySeries,
  currency,
  convert,
}: {
  historySeries: { d: number; v: number }[];
  currency: string;
  convert: ConvertFn;
}) {
  return (
    <div className="mt-4 h-24 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={historySeries} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="np" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="d" hide />
          <Tooltip
            cursor={chartCursor}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              background: "oklch(0.18 0.02 255)",
              color: "white",
              fontSize: 11,
              padding: "6px 10px",
            }}
            formatter={((v: unknown) => money(convert(Number(v)), currency)) as never}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            fill="url(#np)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

type AllocSlice = { type: string; name: string; value: number };

const AllocationPieChart = memo(function AllocationPieChart({
  allocation,
  totalValue,
  assetCount,
  currency,
  convert,
}: {
  allocation: AllocSlice[];
  totalValue: number;
  assetCount: number;
  currency: string;
  convert: ConvertFn;
}) {
  return (
    <div className="card-flat p-5 flex items-center gap-5">
      <div className="relative shrink-0">
        <ResponsiveContainer width={108} height={108}>
          <PieChart>
            <Pie
              data={allocation}
              dataKey="value"
              innerRadius={38}
              outerRadius={52}
              paddingAngle={2}
              stroke="none"
            >
              {allocation.map((d, i) => (
                <Cell
                  key={i}
                  fill={INVESTMENT_TYPE_META[d.type as InvestmentType]?.color ?? "#888"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Assets</div>
          <div className="text-sm font-semibold">{assetCount}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {allocation.map((a) => (
          <div key={a.type} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: INVESTMENT_TYPE_META[a.type as InvestmentType]?.color }}
              />
              <span>{a.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="num font-medium">{shortMoney(convert(a.value), currency)}</span>
              <span className="text-muted-foreground tabular-nums w-9 text-right">
                {Math.round((a.value / totalValue) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function FinancesSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="h-10 w-32 rounded-xl bg-muted animate-pulse" />
      <div className="h-44 rounded-3xl bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
