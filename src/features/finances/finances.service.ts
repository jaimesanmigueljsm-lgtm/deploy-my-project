import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { Investment, InvestmentType } from "@/types/finance";
import { parseOrThrow } from "@/schemas";
import { AddInvestmentSchema } from "@/schemas/investment.schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AddInvestmentPayload = {
  type: InvestmentType;
  ticker: string | null;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchInvestments(userId: string): Promise<Investment[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    avg_cost: Number(r.avg_cost),
    current_price: Number(r.current_price),
  })) as Investment[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function addInvestment(
  userId: string,
  payload: AddInvestmentPayload,
): Promise<Investment> {
  const validated = parseOrThrow(AddInvestmentSchema, payload, "addInvestment");

  const { data, error } = await supabase
    .from("investments")
    .insert({ ...validated, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Investment;
}

export async function deleteInvestment(id: string): Promise<void> {
  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Demo data ────────────────────────────────────────────────────────────────

export async function seedDemoInvestments(userId: string): Promise<void> {
  const demo: TablesInsert<"investments">[] = [
    {
      user_id: userId,
      type: "stock",
      ticker: "AAPL",
      name: "Apple Inc.",
      quantity: 12,
      avg_cost: 145.3,
      current_price: 189.5,
      currency: "USD",
    },
    {
      user_id: userId,
      type: "stock",
      ticker: "MSFT",
      name: "Microsoft",
      quantity: 6,
      avg_cost: 280.1,
      current_price: 412.2,
      currency: "USD",
    },
    {
      user_id: userId,
      type: "etf",
      ticker: "VWCE",
      name: "Vanguard FTSE All-World",
      quantity: 45,
      avg_cost: 98.4,
      current_price: 116.8,
      currency: "EUR",
    },
    {
      user_id: userId,
      type: "etf",
      ticker: "SXR8",
      name: "iShares Core S&P 500",
      quantity: 18,
      avg_cost: 420.0,
      current_price: 538.5,
      currency: "EUR",
    },
    {
      user_id: userId,
      type: "crypto",
      ticker: "BTC",
      name: "Bitcoin",
      quantity: 0.085,
      avg_cost: 38500,
      current_price: 61200,
      currency: "EUR",
    },
    {
      user_id: userId,
      type: "crypto",
      ticker: "ETH",
      name: "Ethereum",
      quantity: 1.4,
      avg_cost: 2100,
      current_price: 2780,
      currency: "EUR",
    },
    {
      user_id: userId,
      type: "savings",
      ticker: null,
      name: "Emergency fund (3% APY)",
      quantity: 1,
      avg_cost: 8500,
      current_price: 8755,
      currency: "EUR",
    },
  ];

  const { error } = await supabase.from("investments").insert(demo);
  if (error) throw new Error(error.message);
}
