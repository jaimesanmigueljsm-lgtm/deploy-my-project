import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { parseOrThrow } from "@/schemas";
import { AddBillSchema, AddIncomeSchema, UpdateIncomeSchema } from "@/schemas/budget.schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Category = Pick<Tables<"categories">, "id" | "name" | "color" | "kind">;
export type Bill = Pick<Tables<"bills">, "id" | "name" | "amount" | "due_day" | "paid_this_month">;
export type Income = Pick<
  Tables<"incomes">,
  "id" | "source" | "amount" | "recurring" | "received_at"
>;

export type AddBillPayload = Pick<TablesInsert<"bills">, "name" | "amount" | "due_day">;
export type AddIncomePayload = Pick<TablesInsert<"incomes">, "source" | "amount" | "recurring">;
export type UpdateIncomePayload = Pick<TablesUpdate<"incomes">, "source" | "amount" | "recurring">;

// ─── Categories ───────────────────────────────────────────────────────────────

export async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, kind")
    .eq("user_id", userId)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

// ─── Bills ────────────────────────────────────────────────────────────────────

export async function fetchBills(userId: string): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select("id, name, amount, due_day, paid_this_month")
    .eq("user_id", userId)
    .eq("active", true)
    .order("due_day");

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Bill[];
}

export async function addBill(userId: string, payload: AddBillPayload): Promise<Bill> {
  const validated = parseOrThrow(AddBillSchema, payload, "addBill");

  const { data, error } = await supabase
    .from("bills")
    .insert({ ...validated, user_id: userId })
    .select("id, name, amount, due_day, paid_this_month")
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) } as Bill;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleBill(id: string, paidThisMonth: boolean): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .update({ paid_this_month: paidThisMonth })
    .eq("id", id)
    .select("id, name, amount, due_day, paid_this_month")
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) } as Bill;
}

// ─── Incomes ──────────────────────────────────────────────────────────────────

export async function fetchIncomes(userId: string): Promise<Income[]> {
  const { data, error } = await supabase
    .from("incomes")
    .select("id, source, amount, recurring, received_at")
    .eq("user_id", userId)
    .order("received_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Income[];
}

export async function addIncome(userId: string, payload: AddIncomePayload): Promise<Income> {
  const validated = parseOrThrow(AddIncomeSchema, payload, "addIncome");

  const { data, error } = await supabase
    .from("incomes")
    .insert({ ...validated, user_id: userId })
    .select("id, source, amount, recurring, received_at")
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) } as Income;
}

export async function updateIncome(id: string, payload: UpdateIncomePayload): Promise<Income> {
  const validated = parseOrThrow(UpdateIncomeSchema, payload, "updateIncome");

  const { data, error } = await supabase
    .from("incomes")
    .update(validated)
    .eq("id", id)
    .select("id, source, amount, recurring, received_at")
    .single();

  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) } as Income;
}

export async function deleteIncome(id: string): Promise<void> {
  const { error } = await supabase.from("incomes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
