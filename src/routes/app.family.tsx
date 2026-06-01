import { createFileRoute } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Users,
  Crown,
  Baby,
  Heart,
  Target,
  Clock,
  Search,
  Send,
  Pencil,
  TrendingUp,
  Calendar,
  Trash2,
  UserPlus,
  UserMinus,
  Sparkles,
  Zap,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionHeader, EmptyState } from "@/components/nest";
import { useT } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/features/profile/use-profile";
import { money, shortMoney, getCurrencySymbol } from "@/lib/format";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFamilyData,
  getMyInvitations,
  getFamilySentInvitations,
  searchUserByUsername,
  sendFamilyInvite,
  acceptFamilyInvite,
  rejectFamilyInvite,
  createFamily,
  createSharedGoal,
  updateSharedGoal,
  addGoalContribution,
  updateFamilyName,
  removeFamilyMember,
  leaveFamily,
  notifyFamilyMembers,
  getFamilyActivity,
  logFamilyActivity,
  updateMemberRelationship,
  type UserSearchResult,
  type ReceivedInvitation,
  type SentInvitation,
  type SharedGoal,
  type FamilyMemberProfile,
  type FamilyActivity,
} from "@/features/family/family.service";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

function monthlyNeeded(goal: SharedGoal): number | null {
  if (!goal.deadline) return null;
  const msLeft = new Date(goal.deadline).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const monthsLeft = msLeft / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsLeft < 0.5) return null;
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  if (remaining <= 0) return null;
  return remaining / monthsLeft;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatActivity(
  item: FamilyActivity,
  t: (k: string) => string,
  currency: string,
  convert: (n: number) => number = (n) => n,
): string {
  const meta = item.meta as Record<string, string | number>;
  const name = item.actor_name ?? t("family.role.member");
  switch (item.type) {
    case "member_joined":
      return t("family.activity.member_joined").replace("{name}", name);
    case "member_removed":
      return t("family.activity.member_removed").replace("{name}", name);
    case "goal_created":
      return t("family.activity.goal_created")
        .replace("{name}", name)
        .replace("{goal}", String(meta.goalName ?? ""));
    case "goal_updated":
      return t("family.activity.goal_updated")
        .replace("{name}", name)
        .replace("{goal}", String(meta.goalName ?? ""));
    case "goal_contribution": {
      const text = t("family.activity.goal_contribution")
        .replace("{name}", name)
        .replace("{amount}", money(convert(Number(meta.amount ?? 0)), currency))
        .replace("{goal}", String(meta.goalName ?? ""));
      return meta.note ? `${text} — "${meta.note}"` : text;
    }
    case "family_renamed":
      return t("family.activity.family_renamed")
        .replace("{name}", name)
        .replace("{newName}", String(meta.newName ?? ""));
    default:
      return name;
  }
}

const FK = {
  data: (familyId: string) => ["family", "data", familyId] as const,
  received: (userId: string) => ["family", "received", userId] as const,
  sent: (familyId: string) => ["family", "sent", familyId] as const,
  activity: (familyId: string) => ["family", "activity", familyId] as const,
};

export const Route = createFileRoute("/app/family")({
  component: FamilyPage,
  errorComponent: SectionError,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function FamilyPage() {
  const { t } = useT();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const qc = useQueryClient();

  const userId = user?.id ?? "";
  const familyId = profile?.family_id ?? null;
  const currency = profile?.currency ?? "EUR";
  const convert = useCurrencyConvert();
  const myDisplayName = profile?.full_name ?? profile?.first_name ?? t("family.role.member");

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

  const { data: sentInvitations = [] } = useQuery({
    queryKey: FK.sent(familyId ?? ""),
    queryFn: () => getFamilySentInvitations(familyId!),
    enabled: !!familyId,
    staleTime: 20_000,
  });

  const { data: activityLog = [] } = useQuery({
    queryKey: FK.activity(familyId ?? ""),
    queryFn: () => getFamilyActivity(familyId!),
    enabled: !!familyId,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  // ── Realtime: invitation channel (always active when logged in) ───────────
  useEffect(() => {
    if (!userId) return;
    let subscribedOnce = false;
    const ch = supabase
      .channel(`nest-inv-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "family_invitations",
          filter: `invited_user_id=eq.${userId}`,
        },
        () => void qc.invalidateQueries({ queryKey: FK.received(userId) }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // On reconnect (not initial), refresh to catch any missed events
          if (subscribedOnce) void qc.invalidateQueries({ queryKey: FK.received(userId) });
          subscribedOnce = true;
        }
      });
    return () => {
      supabase.removeChannel(ch).then((status) => {
        if (status !== "ok") console.warn("[Nest] inv channel cleanup:", status);
      });
    };
  }, [userId, qc]);

  // ── Realtime: family channel (active when in a family) ────────────────────
  useEffect(() => {
    if (!familyId) return;
    let subscribedOnce = false;
    const ch = supabase
      .channel(`nest-fam-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_members",
          filter: `family_id=eq.${familyId}`,
        },
        () => void qc.invalidateQueries({ queryKey: FK.data(familyId) }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shared_goals",
          filter: `family_id=eq.${familyId}`,
        },
        () => void qc.invalidateQueries({ queryKey: FK.data(familyId) }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "family_activity",
          filter: `family_id=eq.${familyId}`,
        },
        () => void qc.invalidateQueries({ queryKey: FK.activity(familyId) }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // On reconnect (not initial), refresh all family data to catch missed events
          if (subscribedOnce) {
            void qc.invalidateQueries({ queryKey: FK.data(familyId) });
            void qc.invalidateQueries({ queryKey: FK.activity(familyId) });
          }
          subscribedOnce = true;
        }
      });
    return () => {
      supabase.removeChannel(ch).then((status) => {
        if (status !== "ok") console.warn("[Nest] fam channel cleanup:", status);
      });
    };
  }, [familyId, qc]);

  // ── Auto-repair: if removed from family, clear own profile ───────────────
  useEffect(() => {
    if (!familyData || !userId || !familyId || familyData.isOwner) return;
    const inMembers = familyData.members.some((m) => m.user_id === userId);
    if (inMembers) return;
    void leaveFamily(userId).then(
      () => void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
    );
  }, [familyData, userId, familyId, qc]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: ({ id }: { id: string; invFamilyId: string }) => acceptFamilyInvite(id),
    onSuccess: async (_, { invFamilyId }) => {
      toast.success(t("family.invite.accepted.toast"));
      // Pre-seed family data cache so the transition feels instant
      void qc.invalidateQueries({ queryKey: FK.data(invFamilyId) });
      // Update profile (sets familyId, triggers component transition)
      await qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      // Clear invitation inbox after profile is fresh
      void qc.invalidateQueries({ queryKey: FK.received(userId) });
      try {
        await notifyFamilyMembers(
          invFamilyId,
          "invite_accepted",
          t("family.notif.joined.title"),
          t("family.notif.joined.body").replace("{name}", myDisplayName),
        );
      } catch {
        /* non-critical */
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectFamilyInvite,
    onSuccess: () => {
      toast.success(t("family.invite.rejected.toast"));
      void qc.invalidateQueries({ queryKey: FK.received(userId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string; memberUserId: string }) =>
      removeFamilyMember(memberId),
    onSuccess: (_, { memberUserId }) => {
      toast.success(t("family.toast.member.removed"));
      void qc.invalidateQueries({ queryKey: FK.data(familyId ?? "") });
      void qc.invalidateQueries({ queryKey: queryKeys.profile(memberUserId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRelationshipMutation = useMutation({
    mutationFn: ({ memberId, relationship }: { memberId: string; relationship: string | null }) =>
      updateMemberRelationship(memberId, relationship),
    onSuccess: () => void qc.invalidateQueries({ queryKey: FK.data(familyId ?? "") }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openGoal, setOpenGoal] = useState(false);
  const [openWhoAreWe, setOpenWhoAreWe] = useState(false);
  const [openGoalPicker, setOpenGoalPicker] = useState(false);
  const [viewingMember, setViewingMember] = useState<FamilyMemberProfile | null>(null);
  const [editingGoal, setEditingGoal] = useState<SharedGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SharedGoal | null>(null);

  function quickContribute() {
    if (goals.length === 0) return;
    if (goals.length === 1) {
      setContributingGoal(goals[0]);
      return;
    }
    setOpenGoalPicker(true);
  }

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (profileLoading || (!!familyId && familyLoading && !familyData)) return <FamilySkeleton />;

  const isOwner = familyData?.isOwner ?? false;
  const { family, members, memberProfiles, goals } = familyData ?? {
    family: null,
    members: [],
    memberProfiles: [],
    goals: [],
  };

  // ── Stats (derived, no extra query) ───────────────────────────────────────
  const activeGoals = goals.filter((g) => g.current_amount < g.target_amount).length;
  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);

  // ── No family ──────────────────────────────────────────────────────────────
  if (!familyId || (!familyLoading && !family)) {
    return (
      <div className="px-4 pt-5 space-y-5 animate-rise">
        <header className="pt-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {t("family.subtitle")}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("family.title")}</h1>
        </header>

        {receivedInvitations.length > 0 && (
          <section>
            <SectionHeader title={t("family.invite.received.title")} />
            <div className="space-y-2">
              {receivedInvitations.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  invitation={inv}
                  onAccept={() => acceptMutation.mutate({ id: inv.id, invFamilyId: inv.family_id })}
                  onReject={() => rejectMutation.mutate(inv.id)}
                  busy={acceptMutation.isPending || rejectMutation.isPending}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        <EmptyState
          icon={<Users className="size-5" />}
          title={t("family.empty.title")}
          description={t("family.empty.desc")}
          action={
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="size-3.5 mr-1" />
              {t("family.create.button")}
            </Button>
          }
        />

        <CreateFamilyDialog
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          userId={userId}
          onCreated={() => void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) })}
          t={t}
        />
      </div>
    );
  }

  if (!family) return <FamilySkeleton />;

  // ── Has family ──────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 space-y-5 animate-rise pb-6">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {t("family.subtitle")}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight flex items-center gap-2">
            {family.name}
            {isOwner && (
              <button
                onClick={() => setOpenWhoAreWe(true)}
                className="size-6 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                aria-label={t("common.edit")}
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setOpenInvite(true)}
              className="size-10 rounded-full bg-foreground text-background grid place-items-center hover:opacity-90 transition active:scale-95"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </header>

      {/* Stats strip */}
      <FamilyStatsStrip
        memberCount={members.length}
        activeGoals={activeGoals}
        totalSaved={totalSaved}
        currency={currency}
        t={t}
      />

      {/* Received invitations */}
      {receivedInvitations.length > 0 && (
        <section>
          <SectionHeader title={t("family.invite.received.title")} />
          <div className="space-y-2">
            {receivedInvitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onAccept={() => acceptMutation.mutate({ id: inv.id, invFamilyId: inv.family_id })}
                onReject={() => rejectMutation.mutate(inv.id)}
                busy={acceptMutation.isPending || rejectMutation.isPending}
                t={t}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pending sent invitations (owner) */}
      {isOwner && sentInvitations.length > 0 && (
        <section>
          <SectionHeader title={t("family.invite.pending.title")} />
          <div className="card-flat divide-y divide-border-subtle">
            {sentInvitations.map((inv) => (
              <SentInvitationRow key={inv.id} inv={inv} />
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section>
        <SectionHeader
          title={t("family.section.members")}
          action={
            isOwner ? (
              <button
                onClick={() => setOpenWhoAreWe(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("common.manage")}
              </button>
            ) : undefined
          }
        />
        <div className="card-flat divide-y divide-border-subtle">
          {(memberProfiles.length > 0
            ? memberProfiles
            : members.map(
                (m) =>
                  ({
                    member_id: m.id,
                    user_id: m.user_id,
                    role: m.role,
                    relationship_type: m.relationship_type ?? null,
                    joined_at: m.created_at ?? null,
                    first_name: m.first_name ?? "",
                    last_name_1: m.last_name_1 ?? "",
                    financial_username: m.financial_username ?? "",
                    full_name: m.full_name ?? null,
                    avatar_url: m.avatar_url ?? null,
                  }) as FamilyMemberProfile,
              )
          ).map((m) => {
            const Icon = m.role === "owner" ? Crown : m.role === "child" ? Baby : Heart;
            const isMe = m.user_id === userId;
            const displayName =
              m.full_name ??
              (m.first_name ? `${m.first_name} ${m.last_name_1}`.trim() : null) ??
              t("family.role.member");
            return (
              <button
                key={m.member_id}
                onClick={() => setViewingMember(m)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/40 transition"
              >
                <div className="flex items-center gap-3">
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={displayName}
                      className="size-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-muted grid place-items-center text-foreground shrink-0">
                      <Icon className="size-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      {displayName}
                      {isMe && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {t("family.you.label")}
                        </span>
                      )}
                    </div>
                    {m.financial_username && (
                      <div className="text-xs text-muted-foreground font-mono">
                        @{m.financial_username}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="capitalize">{t(`family.role.${m.role}`) ?? m.role}</span>
                      {m.relationship_type && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>
                            {t(`family.member.relationship.${m.relationship_type}`) ??
                              m.relationship_type}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <svg
                  className="size-3.5 text-muted-foreground shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </section>

      {/* Shared goals */}
      <section>
        <SectionHeader
          title={t("family.section.goals")}
          action={
            <button
              onClick={() => {
                setEditingGoal(null);
                setOpenGoal(true);
              }}
              className="text-xs font-medium text-positive"
            >
              {t("family.add.goal")}
            </button>
          }
        />
        {goals.length === 0 ? (
          <EmptyState
            icon={<Target className="size-5" />}
            title={t("family.goal.empty.title")}
            description={t("family.goal.empty.desc")}
          />
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const pct =
                g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
              const remaining = Math.max(0, g.target_amount - g.current_amount);
              const monthly = monthlyNeeded(g);
              return (
                <div key={g.id} className="card-flat p-4">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="size-9 rounded-xl bg-positive-soft text-positive grid place-items-center shrink-0">
                        <Target className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{g.name}</div>
                        <div className="text-[11px] text-muted-foreground num">
                          {money(convert(g.current_amount), currency)}{" "}
                          <span className="opacity-60">{t("common.of")}</span>{" "}
                          {money(convert(g.target_amount), currency)}
                        </div>
                        {g.deadline && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="size-3" />
                            {new Date(g.deadline).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-semibold num text-positive">
                        {Math.round(pct)}%
                      </span>
                      <button
                        onClick={() => setContributingGoal(g)}
                        aria-label={t("family.goal.contribute")}
                        className="size-10 grid place-items-center rounded-xl text-positive bg-positive-soft/40 hover:bg-positive-soft/70 transition active:scale-95"
                      >
                        <CircleDollarSign className="size-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingGoal(g);
                          setOpenGoal(true);
                        }}
                        aria-label={t("common.edit")}
                        className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-positive transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {(remaining > 0 || monthly !== null) && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                      {remaining > 0 && (
                        <span>
                          {money(convert(remaining), currency)} {t("family.goal.remaining")}
                        </span>
                      )}
                      {monthly !== null && (
                        <span className="text-positive font-medium">
                          {t("family.goal.monthly").replace(
                            "{amount}",
                            money(convert(Math.ceil(monthly)), currency),
                          )}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Activity feed */}
      <section>
        <SectionHeader title={t("family.section.activity")} />
        <ActivityFeed items={activityLog} currency={currency} t={t} />
      </section>

      {/* Dialogs */}
      <MemberProfileSheet
        member={viewingMember}
        onClose={() => setViewingMember(null)}
        isOwnProfile={viewingMember?.user_id === userId}
        isOwner={isOwner}
        onUpdateRelationship={(memberId, relationship) =>
          updateRelationshipMutation.mutate({ memberId, relationship })
        }
        t={t}
      />

      <GoalPickerDialog
        open={openGoalPicker}
        onClose={() => setOpenGoalPicker(false)}
        goals={goals}
        onPick={(g) => {
          setOpenGoalPicker(false);
          setContributingGoal(g);
        }}
        t={t}
      />

      <WhoAreWeDialog
        open={openWhoAreWe}
        onClose={() => setOpenWhoAreWe(false)}
        family={family}
        members={memberProfiles}
        isOwner={isOwner}
        currentUserId={userId}
        onRenamed={(newName) => {
          void qc.invalidateQueries({ queryKey: FK.data(family.id) });
          void logFamilyActivity(family.id, "family_renamed", myDisplayName, { newName }).catch(
            () => {},
          );
          void qc.invalidateQueries({ queryKey: FK.activity(family.id) });
        }}
        onRemoveMember={(memberId, memberUserId) =>
          removeMemberMutation.mutate({ memberId, memberUserId })
        }
        t={t}
      />

      {isOwner && (
        <InviteDialog
          open={openInvite}
          onClose={() => setOpenInvite(false)}
          familyId={family.id}
          onSent={() => void qc.invalidateQueries({ queryKey: FK.sent(family.id) })}
          t={t}
        />
      )}

      <GoalDialog
        open={openGoal}
        onClose={() => {
          setOpenGoal(false);
          setEditingGoal(null);
        }}
        familyId={family.id}
        editing={editingGoal}
        myName={myDisplayName}
        currency={currency}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: FK.data(family.id) });
          void qc.invalidateQueries({ queryKey: FK.activity(family.id) });
        }}
        t={t}
      />

      {contributingGoal && (
        <ContributionDialog
          open={!!contributingGoal}
          onClose={() => setContributingGoal(null)}
          goal={contributingGoal}
          familyId={family.id}
          myName={myDisplayName}
          currency={currency}
          onSaved={() => {
            setContributingGoal(null);
            void qc.invalidateQueries({ queryKey: FK.data(family.id) });
            void qc.invalidateQueries({ queryKey: FK.activity(family.id) });
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ─── FamilyStatsStrip ─────────────────────────────────────────────────────────

function FamilyStatsStrip({
  memberCount,
  activeGoals,
  totalSaved,
  currency,
  t,
}: {
  memberCount: number;
  activeGoals: number;
  totalSaved: number;
  currency: string;
  t: (k: string) => string;
}) {
  const convert = useCurrencyConvert();
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="card-flat p-3.5 space-y-0.5 text-center">
        <p className="text-xl font-semibold num">{memberCount}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {t("family.stats.members")}
        </p>
      </div>
      <div className="card-flat p-3.5 space-y-0.5 text-center">
        <p className="text-xl font-semibold num">{activeGoals}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {t("family.stats.goals")}
        </p>
      </div>
      <div className="card-flat p-3.5 space-y-0.5 text-center">
        <p className="text-base font-semibold num text-positive">
          {shortMoney(convert(totalSaved), currency)}
        </p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {t("family.stats.saved")}
        </p>
      </div>
    </div>
  );
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────

function ActivityFeed({
  items,
  currency,
  t,
}: {
  items: FamilyActivity[];
  currency: string;
  t: (k: string) => string;
}) {
  const convert = useCurrencyConvert();
  if (items.length === 0) {
    return (
      <div className="card-flat px-4 py-6 flex flex-col items-center gap-2 text-muted-foreground">
        <Sparkles className="size-5 opacity-40" />
        <p className="text-sm">{t("family.activity.empty")}</p>
      </div>
    );
  }

  function getIcon(type: string) {
    switch (type) {
      case "member_joined":
        return <UserPlus className="size-3.5" />;
      case "member_removed":
        return <UserMinus className="size-3.5" />;
      case "goal_contribution":
        return <TrendingUp className="size-3.5" />;
      case "goal_created":
        return <Target className="size-3.5" />;
      case "goal_updated":
        return <Pencil className="size-3.5" />;
      case "family_renamed":
        return <Pencil className="size-3.5" />;
      default:
        return <Zap className="size-3.5" />;
    }
  }

  function getIconColor(type: string): string {
    if (type === "member_joined" || type === "goal_contribution")
      return "bg-positive-soft text-positive";
    if (type === "member_removed") return "bg-muted text-muted-foreground";
    return "bg-accent/10 text-accent";
  }

  return (
    <div className="card-flat divide-y divide-border-subtle">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
          <div
            className={cn(
              "size-7 rounded-full grid place-items-center shrink-0 mt-0.5",
              getIconColor(item.type),
            )}
          >
            {getIcon(item.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">{formatActivity(item, t, currency, convert)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {relativeTime(item.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InvitationCard({
  invitation,
  onAccept,
  onReject,
  busy,
  t,
}: {
  invitation: ReceivedInvitation;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
  t: (k: string, p?: Record<string, string>) => string;
}) {
  return (
    <div className="card-flat p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-accent/10 text-accent grid place-items-center shrink-0 mt-0.5">
          <Users className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{invitation.family_name}</div>
          <div className="text-xs text-muted-foreground">
            {t("family.invite.received.from", {
              name: `${invitation.invited_by_first_name} ${invitation.invited_by_last_name_1}`,
            })}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            @{invitation.invited_by_username}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs"
          disabled={busy}
          onClick={onReject}
        >
          {t("family.invite.reject")}
        </Button>
        <Button size="sm" className="flex-1 h-8 text-xs" disabled={busy} onClick={onAccept}>
          {t("family.invite.accept")}
        </Button>
      </div>
    </div>
  );
}

function SentInvitationRow({ inv }: { inv: SentInvitation }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-sm font-medium">
          {inv.invited_first_name} {inv.invited_last_name_1}
        </div>
        <div className="text-xs text-muted-foreground font-mono">@{inv.invited_username}</div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        <span>{inv.role}</span>
      </div>
    </div>
  );
}

// ─── MemberProfileSheet ───────────────────────────────────────────────────────

const RELATIONSHIP_OPTIONS = [
  "partner",
  "spouse",
  "child",
  "parent",
  "sibling",
  "roommate",
  "other",
] as const;

function MemberProfileSheet({
  member,
  onClose,
  isOwnProfile,
  isOwner,
  onUpdateRelationship,
  t,
}: {
  member: FamilyMemberProfile | null;
  onClose: () => void;
  isOwnProfile: boolean;
  isOwner: boolean;
  onUpdateRelationship: (memberId: string, relationship: string | null) => void;
  t: (k: string) => string;
}) {
  const [relationship, setRelationship] = useState<string>("");

  useEffect(() => {
    if (member) setRelationship(member.relationship_type ?? "");
  }, [member]);

  if (!member) return null;

  const displayName =
    member.full_name ??
    (member.first_name ? `${member.first_name} ${member.last_name_1}`.trim() : null) ??
    t("family.role.member");
  const RoleIcon = member.role === "owner" ? Crown : member.role === "child" ? Baby : Heart;

  function handleRelationshipChange(val: string) {
    setRelationship(val);
    onUpdateRelationship(member!.member_id, val || null);
  }

  return (
    <Dialog
      open={!!member}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="rounded-2xl max-w-xs">
        <div className="flex flex-col items-center gap-3 pt-2">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={displayName}
              className="size-24 rounded-full object-cover"
            />
          ) : (
            <div className="size-24 rounded-full bg-muted grid place-items-center text-foreground">
              <RoleIcon className="size-8" />
            </div>
          )}
          <div className="text-center">
            <div className="text-base font-semibold">{displayName}</div>
            {member.financial_username && (
              <div className="text-sm text-muted-foreground font-mono mt-0.5">
                @{member.financial_username}
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="text-xs capitalize px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {t(`family.role.${member.role}`) ?? member.role}
              </span>
              {member.relationship_type && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent">
                  {t(`family.member.relationship.${member.relationship_type}`) ??
                    member.relationship_type}
                </span>
              )}
            </div>
          </div>
        </div>

        {member.joined_at && (
          <p className="text-center text-[11px] text-muted-foreground -mt-1">
            {t("family.member.joined")}{" "}
            {new Date(member.joined_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
            })}
          </p>
        )}

        {(isOwnProfile || isOwner) && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("family.member.relationship.label")}
            </Label>
            <select
              value={relationship}
              onChange={(e) => handleRelationshipChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">—</option>
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`family.member.relationship.${r}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="w-full">
          {t("common.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── CreateFamilyDialog ───────────────────────────────────────────────────────

function CreateFamilyDialog({
  open,
  onClose,
  userId,
  onCreated,
  t,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onCreated: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createFamily(userId, name.trim());
      toast.success(t("family.toast.created"));
      setName("");
      onCreated();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("family.dialog.create.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("family.dialog.create.name.label")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("family.dialog.create.name.placeholder")}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void create()}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void create()}
              disabled={saving || !name.trim()}
              className="flex-1"
            >
              {saving ? t("family.dialog.create.creating") : t("family.dialog.create.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── InviteDialog ─────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onClose,
  familyId,
  onSent,
  t,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  onSent: () => void;
  t: (k: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<UserSearchResult | null | "not-found">(null);

  function reset() {
    setQuery("");
    setResult(null);
    setSearching(false);
    setSending(false);
  }

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const found = await searchUserByUsername(query.trim());
      setResult(found ?? "not-found");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function doSend() {
    if (!result || result === "not-found") return;
    setSending(true);
    try {
      await sendFamilyInvite(familyId, result.financial_username);
      toast.success(t("family.toast.invite.sent"));
      onSent();
      reset();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("family.dialog.invite.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("family.invite.search.label")}</Label>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setResult(null);
                }}
                placeholder={t("family.invite.search.placeholder")}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void doSearch()}
              />
              <Button
                variant="outline"
                size="icon"
                disabled={searching || !query.trim()}
                onClick={() => void doSearch()}
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>
          {result === "not-found" && (
            <p className="text-sm text-muted-foreground text-center py-2">
              {t("family.invite.search.notfound")}
            </p>
          )}
          {result && result !== "not-found" && (
            <div className="card-flat p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted grid place-items-center text-foreground shrink-0">
                <Heart className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">
                  {result.first_name} {result.last_name_1}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  @{result.financial_username}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void doSend()}
              disabled={!result || result === "not-found" || sending}
              className="flex-1"
            >
              <Send className="size-3.5 mr-1.5" />
              {t("family.invite.send.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── GoalDialog ───────────────────────────────────────────────────────────────

function GoalDialog({
  open,
  onClose,
  familyId,
  editing,
  myName,
  currency,
  onSaved,
  t,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  editing: SharedGoal | null;
  myName: string;
  currency: string;
  onSaved: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setTarget(String(editing.target_amount));
        setCurrent(String(editing.current_amount));
        setDeadline(editing.deadline?.slice(0, 10) ?? "");
      } else {
        setName("");
        setTarget("");
        setCurrent("");
        setDeadline("");
      }
    }
  }, [open, editing]);

  async function save() {
    if (!name.trim() || !target) return;
    setSaving(true);
    try {
      if (editing) {
        await updateSharedGoal(editing.id, {
          name: name.trim(),
          target_amount: Number(target),
          deadline: deadline || null,
        });
        toast.success(t("family.toast.goal.updated"));
        try {
          await notifyFamilyMembers(
            familyId,
            "goal_updated",
            t("family.notif.goal.updated.title"),
            t("family.notif.goal.updated.body")
              .replace("{name}", myName)
              .replace("{goal}", name.trim()),
          );
          await logFamilyActivity(familyId, "goal_updated", myName, { goalName: name.trim() });
        } catch {
          /* non-critical */
        }
      } else {
        await createSharedGoal(
          familyId,
          name.trim(),
          Number(target),
          Number(current || 0),
          deadline || null,
        );
        toast.success(t("family.toast.goal.added"));
        try {
          await notifyFamilyMembers(
            familyId,
            "goal_updated",
            t("family.notif.goal.created.title"),
            t("family.notif.goal.created.body")
              .replace("{name}", myName)
              .replace("{goal}", name.trim()),
          );
          await logFamilyActivity(familyId, "goal_created", myName, { goalName: name.trim() });
        } catch {
          /* non-critical */
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("family.dialog.goal.edit.title") : t("family.dialog.goal.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("family.dialog.goal.name.label")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("family.dialog.goal.name.placeholder")}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("family.dialog.goal.target")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="3000"
              />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label>{t("family.dialog.goal.saved")}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {editing && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("family.dialog.goal.deadline")}</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            )}
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("family.dialog.goal.deadline")}
              </Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !name.trim() || !target}
              className="flex-1"
            >
              {saving
                ? t("common.loading")
                : editing
                  ? t("common.save")
                  : t("family.dialog.goal.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ContributionDialog ───────────────────────────────────────────────────────

function ContributionDialog({
  open,
  onClose,
  goal,
  familyId,
  myName,
  currency,
  onSaved,
  t,
}: {
  open: boolean;
  onClose: () => void;
  goal: SharedGoal;
  familyId: string;
  myName: string;
  currency: string;
  onSaved: () => void;
  t: (k: string) => string;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const convert = useCurrencyConvert();

  async function save() {
    const n = Number(amount);
    if (!n || n <= 0) return;
    setSaving(true);
    try {
      await addGoalContribution(goal.id, goal.current_amount, n);
      try {
        const bodyTpl = t("family.notif.contribution.body")
          .replace("{name}", myName)
          .replace("{amount}", money(convert(n), currency))
          .replace("{goal}", goal.name);
        await notifyFamilyMembers(
          familyId,
          "contribution_added",
          t("family.notif.contribution.title").replace("{goal}", goal.name),
          note ? `${bodyTpl} — ${note}` : bodyTpl,
        );
        await logFamilyActivity(familyId, "goal_contribution", myName, {
          goalName: goal.name,
          amount: n,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      } catch {
        /* non-critical */
      }
      toast.success(t("family.toast.contribution.added"));
      setAmount("");
      setNote("");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const monthly = monthlyNeeded(goal);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setAmount("");
          setNote("");
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("family.dialog.contribute.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="card-sunken p-3 flex items-center gap-3">
            <div className="size-8 rounded-xl bg-positive-soft text-positive grid place-items-center shrink-0">
              <Target className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{goal.name}</div>
              <div className="text-xs text-muted-foreground num">
                {money(convert(goal.current_amount), currency)} /{" "}
                {money(convert(goal.target_amount), currency)}
                {remaining > 0 && (
                  <span className="ml-1 opacity-70">
                    · {money(convert(remaining), currency)} {t("family.goal.remaining")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="card-sunken p-5 flex items-baseline gap-2">
            <span className="text-xl text-muted-foreground">{getCurrencySymbol(currency)}</span>
            <Input
              type="number"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="border-0 shadow-none p-0 h-auto text-3xl font-semibold num focus-visible:ring-0 bg-transparent"
            />
          </div>
          {monthly !== null && (
            <p className="text-xs text-positive font-medium text-center -mt-1">
              {t("family.dialog.contribute.monthly").replace(
                "{amount}",
                money(convert(Math.ceil(monthly)), currency),
              )}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("family.dialog.contribute.note")}
            </Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("family.dialog.contribute.note.placeholder")}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !amount || Number(amount) <= 0}
              className="flex-1"
            >
              {saving ? t("common.loading") : t("family.dialog.contribute.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── GoalPickerDialog ─────────────────────────────────────────────────────────

function GoalPickerDialog({
  open,
  onClose,
  goals,
  onPick,
  t,
}: {
  open: boolean;
  onClose: () => void;
  goals: SharedGoal[];
  onPick: (g: SharedGoal) => void;
  t: (k: string) => string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("family.dialog.pick.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {goals.map((g) => (
            <button
              key={g.id}
              onClick={() => onPick(g)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition text-left"
            >
              <div className="size-9 rounded-xl bg-positive-soft text-positive grid place-items-center shrink-0">
                <Target className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{g.name}</div>
                <div className="text-xs text-muted-foreground num">
                  {Math.round(g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0)}
                  %
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── WhoAreWeDialog ───────────────────────────────────────────────────────────

function WhoAreWeDialog({
  open,
  onClose,
  family,
  members,
  isOwner,
  currentUserId,
  onRenamed,
  onRemoveMember,
  t,
}: {
  open: boolean;
  onClose: () => void;
  family: { id: string; name: string; owner_id: string };
  members: FamilyMemberProfile[];
  isOwner: boolean;
  currentUserId: string;
  onRenamed: (newName: string) => void;
  onRemoveMember: (memberId: string, memberUserId: string) => void;
  t: (k: string) => string;
}) {
  const [editName, setEditName] = useState(family.name);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEditName(family.name);
      setPendingRemove(null);
    }
  }, [open, family.name]);

  async function rename() {
    if (!editName.trim() || editName.trim() === family.name) return;
    setSaving(true);
    try {
      await updateFamilyName(family.id, editName.trim());
      toast.success(t("family.toast.renamed"));
      onRenamed(editName.trim());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("family.whoarewe.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Family name */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("family.whoarewe.name.label")}
            </Label>
            {isOwner ? (
              <div className="flex gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void rename()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || !editName.trim() || editName.trim() === family.name}
                  onClick={() => void rename()}
                >
                  {saving ? "..." : t("family.whoarewe.name.save")}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-semibold">{family.name}</p>
            )}
          </div>

          {/* Members */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("family.whoarewe.members.title")}
            </Label>
            <div className="card-flat divide-y divide-border-subtle">
              {members.map((m) => {
                const RoleIcon = m.role === "owner" ? Crown : m.role === "child" ? Baby : Heart;
                const displayName =
                  m.full_name ??
                  `${m.first_name} ${m.last_name_1}`.trim() ??
                  t("family.role.member");
                const canRemove = isOwner && m.role !== "owner" && m.user_id !== currentUserId;
                return (
                  <div key={m.member_id} className="flex items-center gap-3 px-4 py-3.5">
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt={displayName}
                        className="size-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-10 rounded-full bg-muted grid place-items-center text-foreground shrink-0">
                        <RoleIcon className="size-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{displayName}</div>
                      {m.financial_username && (
                        <div className="text-xs text-muted-foreground font-mono">
                          @{m.financial_username}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {t(`family.role.${m.role}`) ?? m.role}
                      </div>
                    </div>
                    {canRemove &&
                      (pendingRemove === m.member_id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              onRemoveMember(m.member_id, m.user_id);
                              setPendingRemove(null);
                            }}
                            className="text-[11px] text-negative font-medium px-2 py-1 rounded-lg bg-negative/10 hover:bg-negative/20 transition"
                          >
                            {t("family.member.remove.cta")}
                          </button>
                          <button
                            onClick={() => setPendingRemove(null)}
                            className="text-[11px] text-muted-foreground px-2 py-1"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingRemove(m.member_id)}
                          className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-negative hover:bg-negative/10 transition shrink-0"
                          aria-label={t("family.member.remove")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          <Button variant="outline" onClick={onClose} className="w-full">
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FamilySkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="h-10 w-32 rounded-xl bg-muted animate-pulse" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
      </div>
      <div className="h-40 rounded-3xl bg-muted animate-pulse" />
      <div className="h-32 rounded-3xl bg-muted animate-pulse" />
    </div>
  );
}
