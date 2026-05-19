import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { parseOrThrow } from "@/schemas";
import { AddExpenseSchema } from "@/schemas/expense.schema";

export type Expense = Tables<"expenses">;

export type AddExpensePayload = Omit<
  TablesInsert<"expenses">,
  "id" | "created_at" | "user_id" | "spent_at"
> & { spent_at?: string };

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchExpenses(
  userId: string,
  start: string,
  end: string,
): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, description, spent_at, kind, category_id, recurring")
    .eq("user_id", userId)
    .gte("spent_at", start)
    .lte("spent_at", end)
    .order("spent_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Expense[];
}

export async function fetchPrevMonthTotal(
  userId: string,
  start: string,
  end: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .gte("spent_at", start)
    .lte("spent_at", end);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function addExpense(
  userId: string,
  payload: AddExpensePayload,
): Promise<Expense> {
  const validated = parseOrThrow(AddExpenseSchema, payload, "addExpense");

  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...validated, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) };
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
