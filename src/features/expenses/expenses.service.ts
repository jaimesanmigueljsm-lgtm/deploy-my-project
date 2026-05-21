import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { parseOrThrow } from "@/schemas";
import { AddExpenseSchema, UpdateExpenseSchema } from "@/schemas/expense.schema";

export type Expense = Tables<"expenses">;

export type AddExpensePayload = Omit<
  TablesInsert<"expenses">,
  "id" | "created_at" | "user_id" | "spent_at"
> & { spent_at?: string };

export type UpdateExpensePayload = {
  description?: string;
  amount?: number;
  category_id?: string | null;
  kind?: "fixed" | "variable";
  spent_at?: string;
};

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

export async function addExpense(userId: string, payload: AddExpensePayload): Promise<Expense> {
  const validated = parseOrThrow(AddExpenseSchema, payload, "addExpense");

  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...validated, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) };
}

export async function updateExpense(id: string, payload: UpdateExpensePayload): Promise<Expense> {
  const validated = parseOrThrow(UpdateExpenseSchema, payload, "updateExpense");

  // Build a typed update payload — omit null/undefined to avoid overwriting columns.
  const updateData: TablesUpdate<"expenses"> = {};
  if (validated.description !== undefined && validated.description !== null)
    updateData.description = validated.description;
  if (validated.amount !== undefined && validated.amount !== null)
    updateData.amount = validated.amount;
  if ("category_id" in validated) updateData.category_id = validated.category_id ?? null;
  if (validated.kind !== undefined && validated.kind !== null) updateData.kind = validated.kind;
  if (validated.spent_at !== undefined && validated.spent_at !== null)
    updateData.spent_at = validated.spent_at;
  if (validated.recurring !== undefined && validated.recurring !== null)
    updateData.recurring = validated.recurring;

  const { data, error } = await supabase
    .from("expenses")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) };
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
