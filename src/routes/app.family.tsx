import { createFileRoute } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Users, Crown, Search, Trash2, UserPlus,
  CircleDollarSign, Receipt, CheckCircle2, Trophy,
  ArrowRight, ChevronDown, ChevronUp, Check, X,
  Wallet, TrendingDown, PartyPopper, Settings2, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/nest";
import { useT } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/features/profile/use-profile";
import { money, shortMoney } from "@/lib/format";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFamilyData, getMyInvitations, getFamilySentInvitations,
  searchUserByUsername, sendFamilyInvite, acceptFamilyInvite,
  rejectFamilyInvite, createFamily, updateFamilyName, deleteFamily,
  removeFamilyMember, leaveFamily, notifyFamilyMembers,
  getUserExpenseGroups, fetchSharedExpenses, addSharedExpense,
  deleteSharedExpense, calculateMemberBalances, calculateSettlements,
  type UserSearchResult, type ReceivedInvitation,
  type FamilyMemberProfile, type UserFamily,
  type SharedExpense, type Settlement,
} from "@/features/family/family.service";
import { useActiveFamily } from "@/hooks/use-active-family";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const FK = {
  data: (familyId: string) => ["family", "data", familyId] as const,
  received: (userId: string) => ["family", "received", userId] as const,
  sent: (familyId: string) => ["family", "sent", familyId] as const,
  activity: (familyId: string) => ["family", "activity", familyId] as const,
  expenses: (familyId: string) => ["family", "expenses", familyId] as const,
  groups: (userId: string) => ["family", "groups", userId] as const,
};

export const Route = createFileRoute("/app/family")({
  component: GroupsPage,
  errorComponent: SectionError,
});

// ─── Page ──────────────────────────────────────────────────────────────────

function GroupsPage() {
  const { t } = useT();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const qc = useQueryClient();

  const userId = user?.id ?? "";
  const currency = profile?.currency ?? "EUR";
  const convert = useCurrencyConvert();
  const { activeFamilyId, switchGroup, clearOverride } = useActiveFamily(profile?.family_id ?? null);
  const familyId = activeFamilyId;
  const myDisplayName = profile?.full_name ?? profile?.first_name ?? t("family.role.member");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: receivedInvitations = [] } = useQuery({
    queryKey: FK.received(userId),
    queryFn: getMyInvitations,
    enabled: !!userId,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const { data: familyData, isLoading: familyLoading } = useQuery({
    queryKey: FK.data(familyId ?? ""),
    queryFn: () => loadFamilyData(familyId!, userId),
    enabled: !!familyId && !!userId,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: FK.groups(userId),
    queryFn: getUserExpenseGroups,
    enabled: !!userId,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    refetchOnMount: true,
  });

  const { data: sharedExpenses = [] } = useQuery({
    queryKey: FK.expenses(familyId ?? ""),
    queryFn: () => fetchSharedExpenses(familyId!),
    enabled: !!familyId,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`nest-inv-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "family_invitations", filter: `invited_user_id=eq.${userId}` },
        () => void qc.invalidateQueries({ queryKey: FK.received(userId) }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  useEffect(() => {
    if (!familyId) return;
    const ch = supabase
      .channel(`nest-fam-${familyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "family_members", filter: `family_id=eq.${familyId}` },
        () => void qc.invalidateQueries({ queryKey: FK.data(familyId) }))
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_expenses", filter: `family_id=eq.${familyId}` },
        () => void qc.invalidateQueries({ queryKey: FK.expenses(familyId) }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [familyId, qc]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: ({ id }: { id: string; invFamilyId: string }) => acceptFamilyInvite(id),
    onSuccess: async (_, { invFamilyId }) => {
      toast.success(t("groups.invite.accepted"));
      void qc.invalidateQueries({ queryKey: FK.data(invFamilyId) });
      await qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      void qc.invalidateQueries({ queryKey: FK.received(userId) });
      void qc.invalidateQueries({ queryKey: FK.groups(userId) });
      void qc.invalidateQueries({ queryKey: ["user-families", userId] });
      switchGroup(invFamilyId);
      try { await notifyFamilyMembers(invFamilyId, "invite_accepted", t("family.notif.joined.title"), t("family.notif.joined.body").replace("{name}", myDisplayName)); } catch { /* non-critical */ }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectFamilyInvite,
    onSuccess: () => { toast.success(t("groups.invite.rejected")); void qc.invalidateQueries({ queryKey: FK.received(userId) }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addExpenseMutation = useMutation({
    mutationFn: ({ description, amount, participantIds, category }: { description: string; amount: number; participantIds: string[]; category?: string }) =>
      addSharedExpense(familyId!, userId, description, amount, participantIds, category),
    onSuccess: () => void qc.invalidateQueries({ queryKey: FK.expenses(familyId ?? "") }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteSharedExpense(expenseId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: FK.expenses(familyId ?? "") }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openAddExpense, setOpenAddExpense] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const isOwner = familyData?.isOwner ?? false;
  const { family, members, memberProfiles } = familyData ?? { family: null, members: [], memberProfiles: [], goals: [] };

  const memberBalances = useMemo(() => calculateMemberBalances(memberProfiles, sharedExpenses), [memberProfiles, sharedExpenses]);
  const settlements = useMemo(() => calculateSettlements(memberBalances), [memberBalances]);

  const totalSpend = useMemo(() => sharedExpenses.reduce((s, e) => s + e.amount, 0), [sharedExpenses]);
  const myBalance = useMemo(() => memberBalances.find(b => b.user_id === userId)?.balance ?? 0, [memberBalances, userId]);
  const settledCount = useMemo(() => settlements.filter(s => s.amount <= 0.01).length, [settlements]);
  const isFullySettled = settlements.length > 0 && settlements.every(s => s.amount <= 0.01);

  if (profileLoading || (!!familyId && familyLoading && !familyData)) return <GroupsSkeleton />;

  // ── No group ──────────────────────────────────────────────────────────────
  if (!familyId || (!familyLoading && !family)) {
    return (
      <div className="px-4 pt-5 space-y-5 animate-rise pb-24">
        <header className="pt-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider text-muted-foreground px-2.5 py-1 rounded-full">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <circle cx="4" cy="4" r="4" />
              </svg>
              NOOLY SPLIT
            </span>
          </div>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("groups.title")}</h1>
        </header>

        {receivedInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("groups.invites.pending")}</p>
            {receivedInvitations.map(inv => (
              <PendingInviteCard key={inv.id} inv={inv}
                onAccept={() => acceptMutation.mutate({ id: inv.id, invFamilyId: inv.family_id })}
                onReject={() => rejectMutation.mutate(inv.id)}
                busy={acceptMutation.isPending || rejectMutation.isPending}
                t={t} />
            ))}
          </div>
        )}

        <div className="card-flat p-8 flex flex-col items-center text-center gap-5">
          <div className="size-20 rounded-3xl bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-950 dark:to-violet-900 grid place-items-center">
            <Receipt className="size-9 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="space-y-2 max-w-[260px]">
            <p className="text-lg font-semibold">{t("groups.empty.title")}</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{t("groups.empty.desc")}</p>
          </div>
          <Button onClick={() => setOpenCreate(true)} className="w-full max-w-[220px]">
            <Plus className="size-4 mr-2" /> {t("groups.create.cta")}
          </Button>
        </div>

        <CreatePlanDialog open={openCreate} onClose={() => setOpenCreate(false)} userId={userId}
          onCreated={(newId) => { switchGroup(newId); void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) }); void qc.invalidateQueries({ queryKey: FK.groups(userId) }); }} t={t} />
      </div>
    );
  }

  if (!family) return <GroupsSkeleton />;

  // ── Has group ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 space-y-5 animate-rise pb-24">

      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider text-muted-foreground px-2.5 py-1 rounded-full">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <circle cx="4" cy="4" r="4" />
              </svg>
              NOOLY SPLIT
            </span>
          </div>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight truncate max-w-[200px]">{family.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button onClick={() => setOpenInvite(true)}
              className="size-9 rounded-full bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition">
              <UserPlus className="size-4" />
            </button>
          )}
          <button onClick={() => setOpenAddExpense(true)}
            className="size-10 rounded-full bg-foreground text-background grid place-items-center hover:opacity-90 transition">
            <Plus className="size-4" />
          </button>
        </div>
      </header>

      {/* Group selector chips */}
      {userGroups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {userGroups.map((g, i) => {
            const chipColors = [
              "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
              "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
              "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
              "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
            ];
            return (
              <button key={g.family_id} onClick={() => switchGroup(g.family_id)}
                className={cn("shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                  g.family_id === familyId ? "bg-foreground text-background" : chipColors[i % chipColors.length])}>
                {g.family_name}
              </button>
            );
          })}
          <button onClick={() => setOpenCreate(true)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition border border-dashed border-border flex items-center gap-1">
            <Plus className="size-3" /> {t("groups.new")}
          </button>
        </div>
      )}

      {/* Pending invitations */}
      {receivedInvitations.length > 0 && (
        <div className="space-y-2">
          {receivedInvitations.map(inv => (
            <PendingInviteCard key={inv.id} inv={inv}
              onAccept={() => acceptMutation.mutate({ id: inv.id, invFamilyId: inv.family_id })}
              onReject={() => rejectMutation.mutate(inv.id)}
              busy={acceptMutation.isPending || rejectMutation.isPending}
              t={t} />
          ))}
        </div>
      )}

      {/* Hero card */}
      <div className="card-soft p-5 gradient-hero-green relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{memberProfiles.length} {t("groups.members")} · {sharedExpenses.length} {t("groups.expenses")}</p>
            </div>
            <div className="num-display text-[36px] font-semibold leading-tight">
              {shortMoney(convert(totalSpend), currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("groups.total_spend")}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold",
              myBalance > 0 ? "bg-positive-soft text-positive" :
              myBalance < 0 ? "bg-negative/10 text-negative" :
              "bg-muted text-muted-foreground")}>
              {myBalance > 0 ? `+${money(convert(myBalance), currency)}` :
               myBalance < 0 ? money(convert(myBalance), currency) :
               t("groups.settled")}
            </div>
            <p className="text-[10px] text-muted-foreground">{t("groups.your_balance")}</p>
            <button onClick={() => setOpenSettings(true)}
              className="size-7 rounded-full bg-foreground/10 grid place-items-center hover:bg-foreground/20 transition">
              <Settings2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Settlement progress bar */}
        {settlements.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>{t("groups.settlements")}</span>
              <span>{settledCount}/{settlements.length} {t("groups.settled_label")}</span>
            </div>
            <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-positive transition-all duration-700"
                style={{ width: `${settlements.length > 0 ? (settledCount / settlements.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Members avatars strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {memberProfiles.map(m => {
          const bal = memberBalances.find(b => b.user_id === m.user_id);
          const isMe = m.user_id === userId;
          return (
            <div key={m.user_id} className="flex flex-col items-center gap-1 shrink-0">
              <div className={cn("size-10 rounded-full grid place-items-center text-sm font-semibold",
                isMe ? "bg-foreground text-background" : "bg-muted text-foreground")}>
                {(m.first_name?.[0] ?? m.financial_username?.[0] ?? "?").toUpperCase()}
              </div>
              <p className="text-[10px] text-muted-foreground truncate max-w-[48px]">
                {isMe ? t("family.you.label") : (m.first_name ?? m.financial_username ?? "?")}
              </p>
              {bal && (
                <p className={cn("text-[10px] font-semibold num",
                  bal.balance > 0 ? "text-positive" : bal.balance < 0 ? "text-negative" : "text-muted-foreground")}>
                  {bal.balance > 0 ? `+${shortMoney(convert(bal.balance), currency)}` :
                   bal.balance < 0 ? shortMoney(convert(bal.balance), currency) : "✓"}
                </p>
              )}
            </div>
          );
        })}
        {isOwner && memberProfiles.length <= 2 && (
          <button
            onClick={() => setOpenInvite(true)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className="size-10 rounded-full border-2 border-dashed border-muted-foreground/30 grid place-items-center text-muted-foreground hover:border-violet-400 hover:text-violet-500 transition">
              <UserPlus className="size-4" />
            </div>
            <p className="text-[10px] text-muted-foreground">{t("groups.invite.cta")}</p>
          </button>
        )}
      </div>

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("groups.who_owes")}</p>
          <div className="space-y-2">
            {settlements.map((s, i) => {
              const from = memberProfiles.find(m => m.user_id === s.from_user_id);
              const to = memberProfiles.find(m => m.user_id === s.to_user_id);
              const fromName = s.from_user_id === userId ? t("family.you.label") : (from?.first_name ?? from?.financial_username ?? "?");
              const toName = s.to_user_id === userId ? t("family.you.label") : (to?.first_name ?? to?.financial_username ?? "?");
              return (
                <div key={i} className={cn("flex items-center justify-between p-3 rounded-2xl",
                  s.from_user_id === userId ? "bg-negative/8 border border-negative/20" :
                  s.to_user_id === userId ? "bg-positive-soft border border-positive/20" :
                  "bg-muted")}>
                  <div className="flex items-center gap-2">
                    <div className={cn("size-7 rounded-full grid place-items-center text-xs font-bold",
                      s.from_user_id === userId ? "bg-negative/20 text-negative" : "bg-muted-foreground/20 text-foreground")}>
                      {fromName[0]?.toUpperCase()}
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <div className={cn("size-7 rounded-full grid place-items-center text-xs font-bold",
                      s.to_user_id === userId ? "bg-positive/20 text-positive" : "bg-muted-foreground/20 text-foreground")}>
                      {toName[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-muted-foreground">{fromName} → {toName}</span>
                  </div>
                  <span className={cn("text-sm font-semibold num",
                    s.from_user_id === userId ? "text-negative" : s.to_user_id === userId ? "text-positive" : "text-foreground")}>
                    {money(convert(s.amount), currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("groups.expenses_label")}</p>
          <Button size="sm" variant="outline" onClick={() => setOpenAddExpense(true)}>
            <Plus className="size-3.5 mr-1" /> {t("groups.add_expense")}
          </Button>
        </div>

        {sharedExpenses.length === 0 ? (
          <div className="card-flat p-6 space-y-4">
            <div className="flex items-center gap-2">
              {[
                { icon: Receipt, label: t("groups.how.step1") },
                { icon: Users, label: t("groups.how.step2") },
                { icon: CheckCircle2, label: t("groups.how.step3") },
              ].map((step, i, arr) => (
                <>
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 text-center">
                    <div className="size-10 rounded-2xl bg-violet-50 dark:bg-violet-950/50 grid place-items-center">
                      <step.icon className="size-4 text-violet-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{step.label}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="size-3 text-muted-foreground shrink-0 mb-4" />
                  )}
                </>
              ))}
            </div>
            <Button className="w-full" onClick={() => setOpenAddExpense(true)}>
              <Plus className="size-4 mr-2" /> {t("groups.add_expense")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sharedExpenses.map(expense => (
              <ExpenseCard key={expense.id} expense={expense} memberProfiles={memberProfiles}
                userId={userId} currency={currency} convert={convert}
                onDelete={() => deleteExpenseMutation.mutate(expense.id)}
                isDeleting={deleteExpenseMutation.isPending}
                t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Complete plan button */}
      {isFullySettled && sharedExpenses.length > 0 && (
        <div className="card-flat p-4 flex flex-col items-center gap-3 text-center border-positive/30 border">
          <PartyPopper className="size-8 text-positive" />
          <div>
            <p className="font-semibold text-sm">{t("groups.all_settled")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("groups.all_settled.desc")}</p>
          </div>
          <Button
            size="sm"
            className="bg-positive hover:bg-positive/90 text-white w-full"
            disabled={completing}
            onClick={async () => {
              if (!confirm(t("groups.complete_plan.confirm"))) return;
              setCompleting(true);
              try {
                await updateFamilyName(family.id, `✓ ${family.name}`);
                toast.success(t("groups.complete_plan.success"));
                void qc.invalidateQueries({ queryKey: FK.data(family.id) });
                void qc.invalidateQueries({ queryKey: FK.groups(userId) });
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : String(e));
              } finally {
                setCompleting(false);
              }
            }}
          >
            <CheckCircle2 className="size-3.5 mr-1" />
            {completing ? t("common.loading") : t("groups.complete_plan")}
          </Button>
        </div>
      )}

      {/* Completed plans (collapsed) */}
      {showCompleted && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("groups.completed_plans")}</p>
        </div>
      )}

      {/* Dialogs */}
      <CreatePlanDialog open={openCreate} onClose={() => setOpenCreate(false)} userId={userId}
        onCreated={(newId) => { void qc.invalidateQueries({ queryKey: FK.groups(userId) }); void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) }); switchGroup(newId); }} t={t} />

      {isOwner && <InviteMemberDialog open={openInvite} onClose={() => setOpenInvite(false)} familyId={family.id}
        onSent={() => void qc.invalidateQueries({ queryKey: FK.sent(family.id) })} t={t} />}

      <AddExpenseDialog open={openAddExpense} onClose={() => setOpenAddExpense(false)}
        members={memberProfiles} currency={currency} currentUserId={userId} t={t}
        onSave={(description, amount, participantIds, category) => {
          addExpenseMutation.mutate({ description, amount, participantIds, category });
          setOpenAddExpense(false);
        }} />

      <PlanSettingsDialog open={openSettings} onClose={() => setOpenSettings(false)}
        family={family} isOwner={isOwner} memberProfiles={memberProfiles}
        userId={userId} t={t}
        onLeave={() => {
          void leaveFamily(userId).then(() => {
            // Find another group to switch to, or clear override if this was the last one
            const remainingGroups = userGroups.filter(g => g.family_id !== family.id);
            if (remainingGroups.length > 0) {
              switchGroup(remainingGroups[0].family_id);
            } else {
              clearOverride();
            }
            void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
            void qc.invalidateQueries({ queryKey: FK.groups(userId) });
          }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)));
        }}
        onRemoveMember={(memberId, memberUserId) => { void removeFamilyMember(memberId).then(() => { void qc.invalidateQueries({ queryKey: FK.data(family.id) }); void qc.invalidateQueries({ queryKey: queryKeys.profile(memberUserId) }); }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e))); }}
        onRename={(newName) => { void updateFamilyName(family.id, newName).then(() => void qc.invalidateQueries({ queryKey: FK.data(family.id) })).catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e))); }}
        onDelete={() => {
          void deleteFamily(family.id, userId).then(() => {
            // Find another group to switch to, or clear override if this was the last one
            const remainingGroups = userGroups.filter(g => g.family_id !== family.id);
            if (remainingGroups.length > 0) {
              switchGroup(remainingGroups[0].family_id);
            } else {
              clearOverride();
            }
            void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
            void qc.invalidateQueries({ queryKey: FK.groups(userId) });
          }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)));
        }} />
    </div>
  );
}

// ─── ExpenseCard ───────────────────────────────────────────────────────────

function ExpenseCard({ expense, memberProfiles, userId, currency, convert, onDelete, isDeleting, t }: {
  expense: SharedExpense; memberProfiles: FamilyMemberProfile[];
  userId: string; currency: string; convert: (n: number) => number;
  onDelete: () => void; isDeleting?: boolean; t: (k: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const payer = memberProfiles.find(m => m.user_id === expense.paid_by);
  const payerName = expense.paid_by === userId ? t("family.you.label") : (payer?.first_name ?? payer?.financial_username ?? "?");
  const isMyExpense = expense.paid_by === userId;
  const participants = expense.shared_expense_participants ?? [];
  const perPerson = participants.length > 0 ? expense.amount / participants.length : expense.amount;

  return (
    <div className="card-flat overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("size-10 rounded-2xl grid place-items-center shrink-0",
              isMyExpense ? "bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400" : "bg-muted text-muted-foreground")}>
              <Receipt className="size-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{expense.description}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("groups.paid_by")} {payerName}
                {expense.category && <span className="ml-1.5 px-1.5 py-0.5 bg-muted rounded text-[10px]">{expense.category}</span>}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold num">{money(convert(expense.amount), currency)}</p>
            <p className="text-[10px] text-muted-foreground num">{money(convert(perPerson), currency)}/ea</p>
          </div>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between mt-3 pt-2 border-t border-border-subtle text-[11px] text-muted-foreground hover:text-foreground transition">
          <span>{participants.length} {t("groups.participants")} · {new Date(expense.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border-subtle bg-muted/20">
          <p className="text-[11px] font-medium text-muted-foreground pt-3">{t("groups.split_between")}</p>
          <div className="space-y-1">
            {participants.map(part => {
              const p = memberProfiles.find(m => m.user_id === part.user_id);
              const name = part.user_id === userId ? t("family.you.label") : (p?.first_name ?? p?.financial_username ?? "?");
              return (
                <div key={part.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-muted grid place-items-center text-[10px] font-bold">
                      {name[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs">{name}</span>
                  </div>
                  <span className="text-xs font-medium num">{money(convert(perPerson), currency)}</span>
                </div>
              );
            })}
          </div>
          {isMyExpense && (
            <button
              onClick={() => { if (!confirm(t("groups.expense.delete.confirm"))) return; onDelete(); }}
              disabled={isDeleting}
              className={cn("w-full mt-2 flex items-center justify-center gap-1.5 text-[11px] transition py-1",
                isDeleting ? "text-muted-foreground" : "text-negative hover:text-negative/80"
              )}
            >
              {isDeleting
                ? <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Trash2 className="size-3" />
              }
              {isDeleting ? t("common.loading") : t("groups.expense.delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PendingInviteCard ────────────────────────────────────────────────────

function PendingInviteCard({ inv, onAccept, onReject, busy, t }: {
  inv: ReceivedInvitation; onAccept: () => void; onReject: () => void; busy: boolean; t: (k: string) => string;
}) {
  return (
    <div className="card-flat p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-10 rounded-2xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0">
          <UserPlus className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{inv.family_name}</p>
          <p className="text-[11px] text-muted-foreground">@{inv.invited_by_username} {t("groups.invite.from")}</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onReject} disabled={busy}
          className="size-8 rounded-full bg-muted grid place-items-center text-muted-foreground hover:text-negative transition">
          <X className="size-3.5" />
        </button>
        <button onClick={onAccept} disabled={busy}
          className="size-8 rounded-full bg-positive grid place-items-center text-white hover:opacity-90 transition">
          <Check className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── CreatePlanDialog ─────────────────────────────────────────────────────

function CreatePlanDialog({ open, onClose, userId, onCreated, t }: {
  open: boolean; onClose: () => void; userId: string;
  onCreated: (id: string) => void; t: (k: string) => string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setName(""); }, [open]);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createFamily(userId, name.trim(), "expense");
      toast.success(t("groups.created"));
      onCreated(id);
      onClose();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t("groups.create.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("groups.create.name")}</Label>
            <Input placeholder={t("groups.create.placeholder")} value={name}
              onChange={e => setName(e.target.value)} autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <p className="text-xs text-muted-foreground">{t("groups.create.hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || busy}>
            {busy ? t("common.loading") : t("groups.create.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── InviteMemberDialog ───────────────────────────────────────────────────

function InviteMemberDialog({ open, onClose, familyId, onSent, t }: {
  open: boolean; onClose: () => void; familyId: string; onSent: () => void; t: (k: string) => string;
}) {
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<UserSearchResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setUsername(""); setFound(null); setSearched(false); } }, [open]);

  async function handleSearch() {
    if (!username.trim()) return;
    setBusy(true);
    try {
      const r = await searchUserByUsername(username.replace(/^@/, ""));
      setFound(r); setSearched(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function handleInvite() {
    if (!found) return;
    setBusy(true);
    try {
      await sendFamilyInvite(familyId, found.financial_username);
      toast.success(t("groups.invite.sent"));
      onSent(); onClose();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t("groups.invite.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("groups.invite.search")}</Label>
            <div className="flex gap-2">
              <Input placeholder="@username" value={username}
                onChange={e => { setUsername(e.target.value); setFound(null); setSearched(false); }}
                onKeyDown={e => e.key === "Enter" && handleSearch()} />
              <Button variant="outline" size="icon" onClick={handleSearch} disabled={!username.trim() || busy} className="shrink-0">
                {busy ? <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
          </div>
          {searched && !found && <div className="flex items-center gap-2 p-3 rounded-xl bg-muted text-sm text-muted-foreground"><X className="size-4" />{t("groups.invite.not_found")}</div>}
          {found && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-positive-soft">
              <div><p className="text-sm font-medium">{found.first_name} {found.last_name_1}</p><p className="text-xs text-muted-foreground">@{found.financial_username}</p></div>
              <Check className="size-4 text-positive" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleInvite} disabled={!found || busy}>
            <UserPlus className="size-3.5 mr-1" />{busy ? t("common.loading") : t("groups.invite.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AddExpenseDialog ─────────────────────────────────────────────────────

function AddExpenseDialog({ open, onClose, members, currency, currentUserId, t, onSave }: {
  open: boolean; onClose: () => void; members: FamilyMemberProfile[];
  currency: string; currentUserId: string; t: (k: string) => string;
  onSave: (description: string, amount: number, participantIds: string[], category?: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    if (open) { setParticipants(members.map(m => m.user_id)); }
    else { setDescription(""); setAmount(""); setCategory(""); setParticipants([]); }
  }, [open, members]);

  function toggleParticipant(uid: string) {
    setParticipants(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);
  }

  const perPerson = participants.length > 0 && Number(amount) > 0 ? Number(amount) / participants.length : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("groups.expense.add.title")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("groups.expense.description")}</Label>
            <Input placeholder={t("groups.expense.description.placeholder")} value={description} onChange={e => setDescription(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>{t("groups.expense.amount")} ({currency})</Label>
            <Input type="number" inputMode="decimal" step="any" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>{t("groups.expense.category")} ({t("common.optional")})</Label>
            <Input placeholder={t("groups.expense.category.placeholder")} value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">{t("groups.expense.split_with")}</Label>
            {perPerson > 0 && (
              <p className="text-xs text-muted-foreground mb-2">{money(perPerson, currency)}/ea</p>
            )}
            <div className="space-y-2">
              {members.map(m => {
                const isMe = m.user_id === currentUserId;
                const name = isMe ? t("family.you.label") : (m.first_name ?? m.financial_username ?? "?");
                const checked = participants.includes(m.user_id);
                return (
                  <button key={m.user_id} onClick={() => toggleParticipant(m.user_id)}
                    className={cn("w-full flex items-center justify-between p-3 rounded-xl transition",
                      checked ? "bg-foreground/8 border border-foreground/20" : "bg-muted border border-transparent")}>
                    <div className="flex items-center gap-2">
                      <div className={cn("size-7 rounded-full grid place-items-center text-xs font-bold",
                        isMe ? "bg-foreground text-background" : "bg-muted-foreground/20 text-foreground")}>
                        {name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm">{name}</span>
                    </div>
                    <div className={cn("size-5 rounded-full grid place-items-center border-2 transition",
                      checked ? "bg-foreground border-foreground" : "border-muted-foreground/40")}>
                      {checked && <Check className="size-3 text-background" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(description, Number(amount), participants, category || undefined)}
            disabled={!description.trim() || Number(amount) <= 0 || isNaN(Number(amount)) || participants.length === 0}>
            {t("groups.expense.add.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PlanSettingsDialog ───────────────────────────────────────────────────

function PlanSettingsDialog({ open, onClose, family, isOwner, memberProfiles, userId, t, onLeave, onRemoveMember, onRename, onDelete }: {
  open: boolean; onClose: () => void;
  family: { id: string; name: string; owner_id: string } | null;
  isOwner: boolean; memberProfiles: FamilyMemberProfile[];
  userId: string; t: (k: string) => string;
  onLeave: () => void; onRemoveMember: (memberId: string, userId: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => { if (!open) { setEditingName(false); setNewName(""); } }, [open]);

  if (!family) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{family.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isOwner && (
            <div className="space-y-2">
              <Label>{t("groups.settings.rename")}</Label>
              <div className="flex gap-2">
                <Input placeholder={family.name} value={newName} onChange={e => setNewName(e.target.value)} />
                <Button variant="outline" onClick={() => { if (newName.trim()) { onRename(newName.trim()); onClose(); } }}
                  disabled={!newName.trim()}>{t("common.save")}</Button>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t("groups.settings.members")}</p>
            <div className="space-y-2">
              {memberProfiles.map(m => {
                const isMe = m.user_id === userId;
                const isGroupOwner = m.user_id === family.owner_id;
                return (
                  <div key={m.user_id} className="flex items-center justify-between p-2 rounded-xl bg-muted">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-foreground/10 grid place-items-center text-xs font-bold">
                        {(m.first_name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{isMe ? t("family.you.label") : (m.first_name ?? m.financial_username)}</p>
                        <p className="text-[10px] text-muted-foreground">@{m.financial_username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isGroupOwner && <Crown className="size-3.5 text-warn" />}
                      {isOwner && !isMe && !isGroupOwner && (
                        <button onClick={() => { if (!confirm(t("groups.settings.remove.confirm"))) return; onRemoveMember(m.member_id ?? "", m.user_id); }}
                          className="size-6 rounded grid place-items-center text-muted-foreground hover:text-negative transition">
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button variant="outline" onClick={onClose} className="w-full">{t("common.close")}</Button>
          {!isOwner ? (
            <Button variant="ghost" className="w-full text-negative hover:text-negative hover:bg-negative/10"
              onClick={() => { if (!confirm(t("groups.settings.leave.confirm").replace("{name}", family.name))) return; onLeave(); onClose(); }}>
              <LogOut className="size-3.5 mr-1" />{t("groups.settings.leave")}
            </Button>
          ) : (
            <Button variant="ghost" className="w-full text-negative hover:text-negative hover:bg-negative/10"
              onClick={() => { if (!confirm(t("groups.settings.delete.confirm").replace("{name}", family.name))) return; onDelete(); onClose(); }}>
              <Trash2 className="size-3.5 mr-1" />{t("groups.settings.delete")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function GroupsSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4 pb-24">
      <div className="h-10 w-48 rounded-xl bg-muted animate-pulse" />
      <div className="h-8 w-full rounded-full bg-muted animate-pulse" />
      <div className="h-40 rounded-3xl bg-muted animate-pulse" />
      <div className="h-16 rounded-2xl bg-muted animate-pulse" />
      <div className="space-y-2">
        <div className="h-20 rounded-2xl bg-muted animate-pulse" />
        <div className="h-20 rounded-2xl bg-muted animate-pulse" />
        <div className="h-20 rounded-2xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
