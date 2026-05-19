import { supabase } from "@/integrations/supabase/client";

export type ExportData = {
  expenses:    unknown[];
  incomes:     unknown[];
  investments: unknown[];
};

export async function fetchExportData(userId: string): Promise<ExportData> {
  const [exp, inc, inv] = await Promise.all([
    supabase.from("expenses").select("*").eq("user_id", userId),
    supabase.from("incomes").select("*").eq("user_id", userId),
    supabase.from("investments").select("*").eq("user_id", userId),
  ]);

  return {
    expenses:    exp.data ?? [],
    incomes:     inc.data ?? [],
    investments: inv.data ?? [],
  };
}
