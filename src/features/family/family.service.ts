/**
 * family.service.ts — Family & Invitation service layer.
 *
 * All cross-user lookups go through SECURITY DEFINER RPCs defined in the
 * identity_and_family migration. Direct table reads are limited to the
 * calling user's own data (enforced by RLS).
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Domain types (mirrors RPC return shapes) ─────────────────────────────────

export interface UserSearchResult {
  id: string;
  first_name: string;
  last_name_1: string;
  financial_username: string;
}

export interface ReceivedInvitation {
  id: string;
  family_id: string;
  family_name: string;
  invited_by_first_name: string;
  invited_by_last_name_1: string;
  invited_by_username: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export interface SentInvitation {
  id: string;
  invited_user_id: string;
  invited_first_name: string;
  invited_last_name_1: string;
  invited_username: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  display_name: string | null;
  role: string;
  relationship_type?: string | null;
  created_at?: string;
  first_name?: string;
  last_name_1?: string;
  financial_username?: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface FamilyMemberProfile {
  member_id: string;
  user_id: string;
  role: string;
  relationship_type?: string | null;
  joined_at?: string | null;
  first_name: string;
  last_name_1: string;
  financial_username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface FamilyActivity {
  id: string;
  family_id: string;
  user_id: string | null;
  type: string;
  actor_name: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface SharedGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  notes?: string | null;
  status?: "active" | "completed" | "archived";
}

export interface UserFamily {
  family_id: string;
  family_name: string;
  member_role: string;
  member_count: number;
  owner_name: string;
  family_type?: string; // 'expense' | 'goals'
}

export interface SharedExpense {
  id: string;
  family_id: string;
  paid_by: string;
  description: string;
  amount: number;
  category: string | null;
  notes: string | null;
  spent_at: string; // Fecha real del gasto
  created_at: string;
  shared_expense_participants: Array<{ user_id: string }>;
}

export interface FamilySettlement {
  id: string;
  family_id: string;
  from_user_id: string; // Quien paga
  to_user_id: string;   // Quien recibe
  amount: number;
  description: string | null;
  settled_at: string;   // Fecha real del pago
  created_by: string;   // Quien lo registró
  created_at: string;
}

export interface MemberBalance {
  user_id: string;
  balance: number; // positive = owed money, negative = owes money
}

export interface FamilyData {
  family: { id: string; name: string; owner_id: string };
  members: FamilyMember[];
  memberProfiles: FamilyMemberProfile[];
  goals: SharedGoal[];
  isOwner: boolean;
}

// ─── Username utilities (client-side normalisation for search input) ─────────

/** Strips accents and non-alphanumeric chars — mirrors the DB's unaccent logic. */
export function normaliseUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
}

/** Preview the financial username that will be generated from name parts.
 *  The DB function is authoritative; this is for real-time UI preview only. */
export function previewUsername(firstName: string, lastName1: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const f = clean(firstName.trim());
  const l = clean(lastName1.trim());
  if (!f && !l) return "";
  return `@${f}.${l}`;
}

// ─── Username search ─────────────────────────────────────────────────────────

/**
 * Search for a NOOLY user by their exact financial username.
 * Calls the find_user_by_username SECURITY DEFINER RPC.
 * Returns null if not found.
 */
export async function searchUserByUsername(username: string): Promise<UserSearchResult | null> {
  const normalised = normaliseUsername(username.replace(/^@/, ""));
  if (normalised.length < 3) return null;

  const { data, error } = await supabase.rpc("find_user_by_username", {
    p_username: normalised,
  });

  if (error) throw new Error(error.message);
  return data && data.length > 0 ? (data[0] as UserSearchResult) : null;
}

// ─── Invitations — sending ────────────────────────────────────────────────────

export async function sendFamilyInvite(familyId: string, username: string): Promise<string> {
  const normalised = normaliseUsername(username.replace(/^@/, ""));
  const { data, error } = await supabase.rpc("send_family_invite", {
    p_family_id: familyId,
    p_username: normalised,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ─── Invitations — receiving ──────────────────────────────────────────────────

export async function getMyInvitations(): Promise<ReceivedInvitation[]> {
  const { data, error } = await supabase.rpc("get_my_invitations");
  if (error) throw new Error(error.message);
  return (data ?? []) as ReceivedInvitation[];
}

export async function acceptFamilyInvite(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_family_invite", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
}

export async function rejectFamilyInvite(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("reject_family_invite", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
}

// ─── Invitations — owner view ─────────────────────────────────────────────────

export async function getFamilySentInvitations(familyId: string): Promise<SentInvitation[]> {
  const { data, error } = await supabase.rpc("get_family_sent_invitations", {
    p_family_id: familyId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SentInvitation[];
}

// ─── Family data ─────────────────────────────────────────────────────────────

export async function loadFamilyData(familyId: string, currentUserId: string): Promise<FamilyData> {
  const [familyRes, membersRes, goalsRes, profilesRes] = await Promise.all([
    supabase.from("families").select("*").eq("id", familyId).single(),
    supabase.from("family_members").select("*").eq("family_id", familyId).order("created_at"),
    supabase
      .from("shared_goals")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("get_family_members_profiles", { p_family_id: familyId }),
  ]);

  if (familyRes.error) throw new Error(familyRes.error.message);

  const family = familyRes.data as { id: string; name: string; owner_id: string };
  const members = (membersRes.data ?? []) as FamilyMember[];
  const goals = ((goalsRes.data ?? []) as SharedGoal[]).map((g) => ({
    ...g,
    target_amount: Number(g.target_amount),
    current_amount: Number(g.current_amount),
  }));

  // Try RPC result first; fall back to direct profiles query if it failed/returned empty
  let memberProfiles = (profilesRes.data ?? []) as FamilyMemberProfile[];

  if (memberProfiles.length === 0 && members.length > 0) {
    const userIds = members.map((m) => m.user_id);
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name_1, financial_username, full_name, avatar_url")
      .in("id", userIds);

    if (profileRows && profileRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileMap = new Map((profileRows as any[]).map((p) => [p.id, p]));
      memberProfiles = members.map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = profileMap.get(m.user_id) ?? {};
        return {
          member_id: m.id,
          user_id: m.user_id,
          role: m.role,
          relationship_type: m.relationship_type ?? null,
          joined_at: m.created_at ?? null,
          first_name: p.first_name ?? "",
          last_name_1: p.last_name_1 ?? "",
          financial_username: p.financial_username ?? "",
          full_name: p.full_name ?? null,
          avatar_url: p.avatar_url ?? null,
        } as FamilyMemberProfile;
      });
    }
  }

  return {
    family,
    members,
    memberProfiles,
    goals,
    isOwner: family.owner_id === currentUserId,
  };
}

// ─── Family profile (¿Quiénes somos?) ────────────────────────────────────────

export async function getFamilyMembersProfiles(familyId: string): Promise<FamilyMemberProfile[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_family_members_profiles", {
    p_family_id: familyId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FamilyMemberProfile[];
}

export async function updateFamilyName(familyId: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("update_family_name", {
    p_family_id: familyId,
    p_name: name,
  });
  if (error) throw new Error(error.message);
}

export async function removeFamilyMember(memberId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("remove_family_member", {
    p_member_id: memberId,
  });
  if (error) throw new Error(error.message);
}

export async function leaveFamily(_userId: string): Promise<void> {
  // SECURITY DEFINER RPC: atomically removes family_members row + clears
  // profiles.family_id in one transaction. If the leaving user was the owner
  // and other members remain, ownership transfers to the longest-standing member.
  // If no members are left, the family is dissolved entirely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("leave_family");
  if (error) throw new Error(error.message);
}

// ─── Family creation ──────────────────────────────────────────────────────────

export async function createFamily(
  _userId: string,
  name: string,
  type: "expense" | "goals" = "expense",
): Promise<string> {
  // SECURITY DEFINER RPC: atomically inserts into families + family_members +
  // updates profiles.family_id in one transaction. The previous 3-call pattern
  // could leave an orphaned family row if step 2 or 3 failed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("create_family", {
    p_name: name,
    p_type: type,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteFamily(familyId: string, userId: string): Promise<void> {
  // SECURITY DEFINER RPC: atomically deletes family and all related data.
  // Only the owner can delete. Cascades to members, invitations, goals, expenses, activity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("delete_family", {
    p_family_id: familyId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

// ─── Shared goal mutations ────────────────────────────────────────────────────

export async function createSharedGoal(
  familyId: string,
  name: string,
  targetAmount: number,
  currentAmount: number = 0,
  deadline: string | null = null,
): Promise<void> {
  const { error } = await supabase.from("shared_goals").insert({
    family_id: familyId,
    name,
    target_amount: targetAmount,
    current_amount: currentAmount,
    deadline,
  });
  if (error) throw new Error(error.message);
}

export async function updateSharedGoal(
  goalId: string,
  updates: { name?: string; target_amount?: number; deadline?: string | null; status?: string },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("shared_goals").update(updates).eq("id", goalId);
  if (error) throw new Error(error.message);
}

export async function addGoalContribution(
  goalId: string,
  _currentAmount: number,
  delta: number,
): Promise<void> {
  // SECURITY DEFINER RPC: uses UPDATE current_amount = current_amount + delta
  // evaluated inside the transaction — race-condition-safe. The previous client-
  // side pattern computed (currentAmount + delta) from a stale render value.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("add_shared_goal_contribution", {
    p_goal_id: goalId,
    p_delta: delta,
  });
  if (error) throw new Error(error.message);
}

// ─── Family notifications ─────────────────────────────────────────────────────

/**
 * Calls the SECURITY DEFINER notify_family_members RPC which inserts a
 * notification row for every family member EXCEPT the calling user.
 * Requires the migration 20260521300000_family_rls_and_notifications.sql.
 */
export async function notifyFamilyMembers(
  familyId: string,
  type: "invite_accepted" | "contribution_added" | "goal_updated",
  title: string,
  body: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("notify_family_members", {
    p_family_id: familyId,
    p_type: type,
    p_title: title,
    p_body: body,
  });
  if (error) throw new Error(error.message);
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export async function getFamilyActivity(familyId: string): Promise<FamilyActivity[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("family_activity")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return []; // graceful — table may not exist yet
  return (data ?? []) as FamilyActivity[];
}

export async function logFamilyActivity(
  familyId: string,
  type: string,
  actorName: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("log_family_activity", {
    p_family_id: familyId,
    p_type: type,
    p_actor_name: actorName,
    p_meta: meta,
  });
  if (error) throw new Error(error.message);
}

// ─── Member relationship ──────────────────────────────────────────────────────

export async function updateMemberRelationship(
  memberId: string,
  relationship: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("update_member_relationship", {
    p_member_id: memberId,
    p_relationship: relationship ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Multi-group ──────────────────────────────────────────────────────────────

export async function getUserFamilies(): Promise<UserFamily[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_user_families");
  if (error) throw new Error(error.message);
  return (data ?? []) as UserFamily[];
}

export async function getUserGoalGroups(): Promise<UserFamily[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_user_families");
  if (error) throw new Error(error.message);
  return ((data ?? []) as UserFamily[]).filter(
    (f) => f.family_type === "goals",
  );
}

export async function getUserExpenseGroups(): Promise<UserFamily[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_user_families");
  if (error) throw new Error(error.message);
  return ((data ?? []) as UserFamily[]).filter(
    (f) => f.family_type === "expense" || !f.family_type,
  );
}

export async function leaveFamilyGroup(familyId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("leave_family_group", {
    p_family_id: familyId,
  });
  if (error) throw new Error(error.message);
}

// ─── Shared expenses ──────────────────────────────────────────────────────────

export async function fetchSharedExpenses(familyId: string): Promise<SharedExpense[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("shared_expenses")
    .select(`*, shared_expense_participants ( user_id )`)
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return []; // graceful if table doesn't exist yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((e) => ({ ...e, amount: Number(e.amount) })) as SharedExpense[];
}

export async function addSharedExpense(
  familyId: string,
  paidBy: string,
  description: string,
  amount: number,
  participantIds: string[],
  spentAt: string, // Nueva fecha del gasto
  category?: string | null,
  notes?: string | null,
): Promise<void> {
  const { data: expense, error: expErr } = await supabase
    .from("shared_expenses")
    .insert({
      family_id: familyId,
      paid_by: paidBy,
      description: description.trim(),
      amount,
      spent_at: spentAt,
      category: category?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();
  if (expErr) throw new Error(expErr.message);

  if (participantIds.length > 0) {
    const { error: partErr } = await supabase
      .from("shared_expense_participants")
      .insert(participantIds.map((uid: string) => ({ expense_id: expense.id, user_id: uid })));
    if (partErr) throw new Error(partErr.message);
  }
}

export async function deleteSharedExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from("shared_expenses").delete().eq("id", expenseId);
  if (error) throw new Error(error.message);
}

export async function updateSharedExpense(
  expenseId: string,
  familyId: string,
  paidBy: string,
  description: string,
  amount: number,
  participantIds: string[],
  spentAt: string,
  category?: string | null,
  notes?: string | null,
): Promise<void> {
  // Update the expense
  const { error: expErr } = await supabase
    .from("shared_expenses")
    .update({
      paid_by: paidBy,
      description: description.trim(),
      amount,
      spent_at: spentAt,
      category: category?.trim() || null,
      notes: notes?.trim() || null,
    })
    .eq("id", expenseId)
    .eq("family_id", familyId);

  if (expErr) throw new Error(expErr.message);

  // Delete existing participants
  const { error: delErr } = await supabase
    .from("shared_expense_participants")
    .delete()
    .eq("expense_id", expenseId);

  if (delErr) throw new Error(delErr.message);

  // Insert new participants
  if (participantIds.length > 0) {
    const { error: partErr } = await supabase
      .from("shared_expense_participants")
      .insert(participantIds.map((uid: string) => ({ expense_id: expenseId, user_id: uid })));
    if (partErr) throw new Error(partErr.message);
  }
}

// ─── Settlements (Ingresos/Pagos) ────────────────────────────────────────────

export async function fetchFamilySettlements(familyId: string): Promise<FamilySettlement[]> {
  const { data, error } = await supabase
    .from("family_settlements")
    .select("*")
    .eq("family_id", familyId)
    .order("settled_at", { ascending: false })
    .limit(50);
  if (error) return []; // graceful if table doesn't exist yet
  return (data ?? []).map((s) => ({ ...s, amount: Number(s.amount) })) as FamilySettlement[];
}

export async function addFamilySettlement(
  familyId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
  settledAt: string,
  description?: string | null,
): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("family_settlements")
    .insert({
      family_id: familyId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      settled_at: settledAt,
      description: description?.trim() || null,
      created_by: user.id,
    });
  if (error) throw new Error(error.message);
}

export async function deleteFamilySettlement(settlementId: string): Promise<void> {
  const { error } = await supabase.from("family_settlements").delete().eq("id", settlementId);
  if (error) throw new Error(error.message);
}

export interface Settlement {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

// ─── Balance calculation (pure TypeScript — no DB triggers) ───────────────────

export function calculateMemberBalances(
  members: FamilyMemberProfile[],
  expenses: SharedExpense[],
  settlements: FamilySettlement[] = [],
): MemberBalance[] {
  const balances: Record<string, number> = {};
  for (const m of members) balances[m.user_id] = 0;

  // 1. Calcular balances de gastos compartidos
  for (const e of expenses) {
    const participants = e.shared_expense_participants ?? [];
    const n = participants.length;
    if (n === 0) continue;
    const share = e.amount / n;

    if (balances[e.paid_by] !== undefined) balances[e.paid_by] += e.amount;
    for (const p of participants) {
      if (balances[p.user_id] !== undefined) balances[p.user_id] -= share;
    }
  }

  // 2. Aplicar settlements (pagos de deudas)
  for (const s of settlements) {
    // Quien paga (from) sube su balance (reduce su deuda)
    if (balances[s.from_user_id] !== undefined) balances[s.from_user_id] += s.amount;
    // Quien recibe (to) baja su balance (reduce lo que le deben)
    if (balances[s.to_user_id] !== undefined) balances[s.to_user_id] -= s.amount;
  }

  return members.map((m) => ({ user_id: m.user_id, balance: balances[m.user_id] ?? 0 }));
}

/**
 * Simple greedy settlement suggestions.
 * Pairs the largest debtor with the largest creditor repeatedly.
 * Pure TypeScript — no DB calls.
 */
export function calculateSettlements(balances: MemberBalance[]): Settlement[] {
  const debtors: Array<{ user_id: string; amount: number }> = [];
  const creditors: Array<{ user_id: string; amount: number }> = [];

  for (const b of balances) {
    if (b.balance < -0.01) debtors.push({ user_id: b.user_id, amount: -b.balance });
    else if (b.balance > 0.01) creditors.push({ user_id: b.user_id, amount: b.balance });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0.01) {
      settlements.push({
        from_user_id: debtors[i].user_id,
        to_user_id: creditors[j].user_id,
        amount: Math.round(amount * 100) / 100,
      });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return settlements;
}

/**
 * Calculate total amount user owes/spent in shared expenses.
 * Returns the sum of user's proportional shares (for dashboard calculation).
 *
 * @param userId - The user ID to calculate shares for
 * @param expenses - Array of shared expenses with participants
 * @returns Total amount the user owes (their proportional share across all expenses)
 */
export function calculateUserShareOfExpenses(
  userId: string,
  expenses: SharedExpense[]
): number {
  let total = 0;

  for (const expense of expenses) {
    const participants = expense.shared_expense_participants ?? [];
    const isParticipant = participants.some(p => p.user_id === userId);

    if (isParticipant && participants.length > 0) {
      const share = expense.amount / participants.length;
      total += share;
    }
  }

  return total;
}
