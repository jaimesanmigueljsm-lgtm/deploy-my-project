import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Rate limit: 1 generation per 5 minutes per user
    const { data: latestRec } = await supabase
      .from("recommendations")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRec) {
      const ageMs = Date.now() - new Date(latestRec.created_at).getTime();
      if (ageMs < 5 * 60 * 1000) {
        return json({ ok: true, count: 0, cached: true });
      }
    }

    // Gather context
    const start = new Date(); start.setMonth(start.getMonth() - 2);
    const sinceStr = new Date(start.getFullYear(), start.getMonth(), 1).toISOString().slice(0, 10);

    const [{ data: profile }, { data: expenses }, { data: incomes }, { data: cats }] = await Promise.all([
      supabase.from("profiles").select("monthly_savings_target, currency, priorities, full_name").eq("id", user.id).maybeSingle(),
      supabase.from("expenses").select("amount, kind, spent_at, category_id, description").gte("spent_at", sinceStr),
      supabase.from("incomes").select("amount, received_at").gte("received_at", sinceStr),
      supabase.from("categories").select("id, name"),
    ]);

    const currency = profile?.currency || "EUR";
    const exps = (expenses || []).map((e: any) => ({
      ...e, amount: Number(e.amount),
      category: cats?.find((c: any) => c.id === e.category_id)?.name || "Uncategorized",
      month: e.spent_at.slice(0, 7),
    }));
    const incs = (incomes || []).map((i: any) => ({ ...i, amount: Number(i.amount) }));

    const summary = summarize(exps, incs, profile?.monthly_savings_target || 0);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI not configured" }, 500);

    const prompt = `You are a calm, expert family financial copilot.
User profile: ${JSON.stringify({ name: profile?.full_name, currency, target: profile?.monthly_savings_target, priorities: profile?.priorities })}
Spending summary: ${JSON.stringify(summary)}

Generate 4 short, specific recommendations. Each must be actionable and reference real numbers from the summary when possible.
Return JSON via the tool. Severity rules: "warning" for risks, "success" for wins, "info" for tips.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "save_insights",
            description: "Save the recommendations",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                      severity: { type: "string", enum: ["info", "warning", "success"] },
                    },
                    required: ["title", "body", "severity"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_insights" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Too many requests, try again soon" }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits depleted" }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return json({ error: "AI failed" }, 500);
    }

    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { insights: [] };
    const insights: { title: string; body: string; severity: string }[] = parsed.insights || [];

    if (insights.length) {
      // Replace previous recs
      await supabase.from("recommendations").delete().eq("user_id", user.id);
      await supabase.from("recommendations").insert(
        insights.map((r) => ({ user_id: user.id, title: r.title, body: r.body, severity: r.severity })),
      );
    }

    return json({ ok: true, count: insights.length });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function summarize(exps: any[], incs: any[], target: number) {
  const byMonth: Record<string, { total: number; fixed: number; variable: number }> = {};
  const byCatThis: Record<string, number> = {};
  const byCatPrev: Record<string, number> = {};
  const thisMonth = new Date().toISOString().slice(0, 7);
  const prev = new Date(); prev.setMonth(prev.getMonth() - 1);
  const prevMonth = prev.toISOString().slice(0, 7);
  const incomeThis = incs.filter((i) => i.received_at.slice(0, 7) === thisMonth).reduce((s, i) => s + i.amount, 0);

  for (const e of exps) {
    byMonth[e.month] ||= { total: 0, fixed: 0, variable: 0 };
    byMonth[e.month].total += e.amount;
    byMonth[e.month][e.kind === "fixed" ? "fixed" : "variable"] += e.amount;
    if (e.month === thisMonth) byCatThis[e.category] = (byCatThis[e.category] || 0) + e.amount;
    if (e.month === prevMonth) byCatPrev[e.category] = (byCatPrev[e.category] || 0) + e.amount;
  }

  const deltas: { category: string; pct: number }[] = [];
  for (const [c, v] of Object.entries(byCatThis)) {
    const p = byCatPrev[c] || 0;
    if (p > 0) deltas.push({ category: c, pct: Math.round(((v - p) / p) * 100) });
  }

  return { byMonth, byCatThis, deltas, incomeThis, target };
}
