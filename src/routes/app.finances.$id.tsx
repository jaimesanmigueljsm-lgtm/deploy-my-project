import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { money, pct } from "@/lib/format";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from "recharts";
import { TrendBadge } from "@/components/nest";
import { CHART_COLORS, chartCursor } from "@/lib/chart";

export const Route = createFileRoute("/app/finances/$id")({
  component: HoldingDetail,
  errorComponent: SectionError,
});

type Investment = {
  id: string;
  type: string;
  ticker: string | null;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  currency: string;
  notes: string | null;
};

function HoldingDetail() {
  const { id } = Route.useParams();
  const [inv, setInv] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("investments").select("*").eq("id", id).maybeSingle();
      if (data) {
        setInv({
          ...(data as Investment),
          quantity: Number(data.quantity),
          avg_cost: Number(data.avg_cost),
          current_price: Number(data.current_price),
        });
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading)
    return (
      <div className="px-4 pt-6">
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  if (!inv) {
    return (
      <div className="px-4 pt-6">
        <p className="text-sm text-muted-foreground">Holding not found.</p>
        <Link to="/app/finances" className="text-sm font-medium underline mt-2 inline-block">
          Back
        </Link>
      </div>
    );
  }

  const value = inv.current_price * inv.quantity;
  const cost = inv.avg_cost * inv.quantity;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;
  const series = buildSeries(inv.avg_cost, inv.current_price);

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="flex items-center justify-between pt-2">
        <Link to="/app/finances" className="size-10 rounded-full card-flat grid place-items-center">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="text-center">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {inv.type}
          </div>
          <div className="text-sm font-semibold">{inv.ticker ?? inv.name}</div>
        </div>
        <div className="size-10" />
      </header>

      <div className="card-soft p-5 gradient-net text-background">
        <p className="text-xs opacity-60">{inv.name}</p>
        <div className="num-display text-[40px] font-semibold mt-0.5">
          {money(value, inv.currency)}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs">
          <span className={`num font-medium ${pl >= 0 ? "text-positive" : "text-negative"}`}>
            {pl >= 0 ? "+" : ""}
            {money(pl, inv.currency)}
          </span>
          <TrendBadge value={plPct} className="!bg-white/10 !text-white" />
        </div>

        <div className="mt-4 h-32 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="hd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.5} />
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
                formatter={((v: unknown) => money(Number(v), inv.currency)) as never}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                fill="url(#hd)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-flat divide-y divide-border-subtle">
        <Row label="Quantity" value={inv.quantity.toString()} />
        <Row label="Avg cost" value={money(inv.avg_cost, inv.currency)} />
        <Row label="Current price" value={money(inv.current_price, inv.currency)} />
        <Row label="Cost basis" value={money(cost, inv.currency)} />
        <Row label="Market value" value={money(value, inv.currency)} />
        <Row
          label="P/L"
          value={`${pl >= 0 ? "+" : ""}${money(pl, inv.currency)} · ${pct(plPct, 2)}`}
        />
      </div>

      <div className="card-soft p-4 bg-foreground text-background flex gap-3">
        <div className="size-9 rounded-xl bg-background/10 grid place-items-center shrink-0">
          <TrendingUp className="size-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-60 font-medium">
            Position insight
          </p>
          <p className="text-sm mt-0.5 leading-snug">
            {pl >= 0
              ? `If this rate continues, your position could reach ${money(value * 1.1, inv.currency)} in 12 months.`
              : `Down ${pct(plPct, 2)}. Consider DCA or wait for a clearer trend reversal.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium num">{value}</span>
    </div>
  );
}

function buildSeries(start: number, end: number) {
  const out: { d: number; v: number }[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const noise = Math.sin(i / 3) * (Math.abs(end - start) * 0.15);
    out.push({ d: i, v: Math.max(0, start + (end - start) * t + noise) });
  }
  return out;
}
