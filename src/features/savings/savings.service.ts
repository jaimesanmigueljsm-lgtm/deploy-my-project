import { supabase } from "@/integrations/supabase/client";

export type SavingsAccountType = "checking" | "savings" | "cash" | "emergency" | "other";

export interface SavingsAccount {
  id: string;
  user_id: string;
  name: string;
  type: SavingsAccountType;
  balance: number;
  currency: string;
  institution_name: string | null;
  is_emergency_fund: boolean;
  created_at: string;
  updated_at: string;
}

export type SavingsAccountPayload = {
  name: string;
  type: SavingsAccountType;
  balance: number;
  currency?: string;
  institution_name?: string | null;
  is_emergency_fund?: boolean;
};

export async function fetchSavingsAccounts(userId: string): Promise<SavingsAccount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("savings_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SavingsAccount[]).map((r) => ({ ...r, balance: Number(r.balance) }));
}

export async function addSavingsAccount(
  userId: string,
  payload: SavingsAccountPayload,
): Promise<SavingsAccount> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("savings_accounts")
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, balance: Number(data.balance) } as SavingsAccount;
}

export async function updateSavingsAccount(
  id: string,
  updates: Partial<SavingsAccountPayload>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("savings_accounts")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSavingsAccount(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("savings_accounts")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
