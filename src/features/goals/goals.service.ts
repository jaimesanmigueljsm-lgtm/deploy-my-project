import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { Goal, GoalContribution } from "@/types/finance";
import { parseOrThrow } from "@/schemas";
import { AddGoalSchema, AddContributionSchema } from "@/schemas/goal.schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AddGoalPayload = Omit<TablesInsert<"savings_goals">, "id" | "created_at" | "user_id">;
export type UpdateGoalPayload = TablesUpdate<"savings_goals">;
export type AddContributionPayload = { goal_id: string; amount: number; note: string | null };

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function fetchGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    target_amount:       Number(r.target_amount),
    current_amount:      Number(r.current_amount),
    monthly_contribution: Number(r.monthly_contribution ?? 0),
  })) as Goal[];
}

export async function addGoal(userId: string, payload: AddGoalPayload): Promise<Goal> {
  const validated = parseOrThrow(AddGoalSchema, payload, "addGoal");

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({ ...validated, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Goal;
}

export async function updateGoal(id: string, payload: UpdateGoalPayload): Promise<Goal> {
  const { data, error } = await supabase
    .from("savings_goals")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Contributions ────────────────────────────────────────────────────────────

export async function fetchGoalContributions(userId: string): Promise<GoalContribution[]> {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("*")
    .eq("user_id", userId)
    .order("contributed_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as GoalContribution[];
}

export async function addContribution(
  userId: string,
  payload: AddContributionPayload,
): Promise<void> {
  const validated = parseOrThrow(AddContributionSchema, payload, "addContribution");

  // Single atomic RPC replaces the previous 3-call pattern:
  //   SELECT goal → INSERT contribution → UPDATE goal.current_amount
  // All three happen inside one Postgres transaction. If the UPDATE fails,
  // the INSERT is rolled back — no orphaned contribution records.
  // Ownership is verified server-side inside the function before any mutation.
  const { error } = await supabase.rpc("add_goal_contribution", {
    p_user_id: userId,
    p_goal_id: validated.goal_id,
    p_amount:  validated.amount,
    p_note:    validated.note ?? null,
  });

  if (error) throw new Error(error.message);
}

// ─── Demo data ────────────────────────────────────────────────────────────────

export async function seedDemoGoals(userId: string): Promise<void> {
  const examples: TablesInsert<"savings_goals">[] = [
    { user_id: userId, name: "Emergency fund (3 months)", target_amount: 6000,  current_amount: 1200, monthly_contribution: 300, icon: "piggy", color: "warn",   priority: "high",   notes: "Cover 3 months of essential expenses." },
    { user_id: userId, name: "Down payment for a home",  target_amount: 40000, current_amount: 8500, monthly_contribution: 600, icon: "home",  color: "mint",   priority: "high",   notes: "20% down on a €200k flat."            },
    { user_id: userId, name: "Family trip to Japan",     target_amount: 5000,  current_amount: 800,  monthly_contribution: 250, icon: "plane", color: "sky",    priority: "medium", notes: "Spring next year."                    },
    { user_id: userId, name: "New car (replacement)",    target_amount: 18000, current_amount: 3200, monthly_contribution: 400, icon: "car",   color: "violet", priority: "low"                                                  },
  ];
  const { error } = await supabase.from("savings_goals").insert(examples);
  if (error) throw new Error(error.message);
}
