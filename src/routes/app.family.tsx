import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionHeader, EmptyState } from "@/components/nest";
import { useT } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/features/profile/use-profile";
import { money } from "@/lib/format";
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
  type UserSearchResult,
  type ReceivedInvitation,
  type SentInvitation,
} from "@/features/family/family.service";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/app/family")({
  component: FamilyPage,
});

const FK = {
  data: (familyId: string) => ["family", "data", familyId] as const,
  received: (userId: string) => ["family", "received", userId] as const,
  sent: (familyId: string) => ["family", "sent", familyId] as const,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function FamilyPage() {
  const { t } = useT();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const qc = useQueryClient();

  const userId = user?.id ?? "";
  const familyId = profile?.family_id ?? null;
  const currency = profile?.currency ?? "EUR";

  const { data: receivedInvitations = [] } = useQuery({
    queryKey: FK.received(userId),
    queryFn: getMyInvitations,
    enabled: !!userId,
    staleTime: 30_000,
  });

  const { data: familyData } = useQuery({
    queryKey: FK.data(familyId ?? ""),
    queryFn: () => loadFamilyData(familyId!, userId),
    enabled: !!familyId && !!userId,
    staleTime: 30_000,
  });

  const { data: sentInvitations = [] } = useQuery({
    queryKey: FK.sent(familyId ?? ""),
    queryFn: () => getFamilySentInvitations(familyId!),
    enabled: !!familyId && familyData?.isOwner === true,
    staleTime: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptFamilyInvite,
    onSuccess: () => {
      toast.success(t("family.invite.accepted.toast"));
      void qc.invalidateQueries({ queryKey: ["family"] });
      void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
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

  const [openCreate, setOpenCreate] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openGoal, setOpenGoal] = useState(false);

  if (profileLoading) return <FamilySkeleton />;

  const isOwner = familyData?.isOwner ?? false;
  const { family, members, goals } = familyData ?? {
    family: null,
    members: [],
    goals: [],
    isOwner: false,
  };

  // ── No family ──────────────────────────────────────────────────────────────

  if (!familyId || !family) {
    return (
      <div className="px-4 pt-5 space-y-5 animate-rise">
        <header className="pt-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {t("family.subtitle")}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">
            {t("family.title")}
          </h1>
        </header>

        {receivedInvitations.length > 0 && (
          <section>
            <SectionHeader title={t("family.invite.received.title")} />
            <div className="space-y-2">
              {receivedInvitations.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  invitation={inv}
                  onAccept={() => acceptMutation.mutate(inv.id)}
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
          onCreated={() =>
            void qc.invalidateQueries({ queryKey: queryKeys.profile(userId) })
          }
          t={t}
        />
      </div>
    );
  }

  // ── Has family ─────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-5 space-y-5 animate-rise">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {t("family.subtitle")}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">
            {family.name}
          </h1>
        </div>
        {isOwner && (
          <button
            onClick={() => setOpenInvite(true)}
            className="size-10 rounded-full bg-foreground text-background grid place-items-center"
          >
            <Plus className="size-4" />
          </button>
        )}
      </header>

      {/* Hero */}
      <div className="card-soft p-5 gradient-hero">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {members.length}{" "}
          {members.length === 1
            ? t("family.hero.member")
            : t("family.hero.members")}
        </div>
        <div className="mt-1 text-[22px] font-semibold tracking-tight">
          {t("family.hero.title")}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {goals.length > 0
            ? `${goals.length} ${goals.length === 1 ? t("family.hero.goals.some") : t("family.hero.goals.many")}`
            : t("family.hero.goals.none")}
        </p>
      </div>

      {/* Received invitations */}
      {receivedInvitations.length > 0 && (
        <section>
          <SectionHeader title={t("family.invite.received.title")} />
          <div className="space-y-2">
            {receivedInvitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onAccept={() => acceptMutation.mutate(inv.id)}
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
        <SectionHeader title={t("family.section.members")} />
        <div className="card-flat divide-y divide-border-subtle">
          {members.map((m) => {
            const Icon =
              m.role === "owner" ? Crown : m.role === "child" ? Baby : Heart;
            const isMe = m.user_id === userId;
            const displayName =
              m.first_name && m.last_name_1
                ? `${m.first_name} ${m.last_name_1}`
                : (m.display_name ?? t("family.role.member"));
            return (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-muted grid place-items-center text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {displayName}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                          {t("family.you.label")}
                        </span>
                      )}
                    </div>
                    {m.financial_username && (
                      <div className="text-xs text-muted-foreground font-mono">
                        @{m.financial_username}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground capitalize">
                      {t(`family.role.${m.role}`) ?? m.role}
                    </div>
                  </div>
                </div>
              </div>
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
              onClick={() => setOpenGoal(true)}
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
                g.target_amount > 0
                  ? Math.min(100, (g.current_amount / g.target_amount) * 100)
                  : 0;
              return (
                <div key={g.id} className="card-flat p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-9 rounded-xl bg-positive-soft text-positive grid place-items-center shrink-0">
                        <Target className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {g.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground num">
                          {money(g.current_amount, currency)}{" "}
                          {t("common.of")}{" "}
                          {money(g.target_amount, currency)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold num">
                      {Math.round(pct)}%
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-positive transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isOwner && (
        <InviteDialog
          open={openInvite}
          onClose={() => setOpenInvite(false)}
          familyId={family.id}
          onSent={() =>
            void qc.invalidateQueries({ queryKey: FK.sent(family.id) })
          }
          t={t}
        />
      )}
      <GoalDialog
        open={openGoal}
        onClose={() => setOpenGoal(false)}
        familyId={family.id}
        onSaved={() =>
          void qc.invalidateQueries({ queryKey: FK.data(family.id) })
        }
        t={t}
      />
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
          <div className="text-sm font-semibold truncate">
            {invitation.family_name}
          </div>
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
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={busy}
          onClick={onAccept}
        >
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
        <div className="text-xs text-muted-foreground font-mono">
          @{inv.invited_username}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="size-3" />
        <span>{inv.role}</span>
      </div>
    </div>
  );
}

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
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void create()}
              disabled={saving || !name.trim()}
              className="flex-1"
            >
              {saving
                ? t("family.dialog.create.creating")
                : t("family.dialog.create.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [result, setResult] = useState<UserSearchResult | null | "not-found">(
    null,
  );

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
        if (!v) { reset(); onClose(); }
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("family.dialog.invite.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search field */}
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

          {/* Result card */}
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => { reset(); onClose(); }}
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

function GoalDialog({
  open,
  onClose,
  familyId,
  onSaved,
  t,
}: {
  open: boolean;
  onClose: () => void;
  familyId: string;
  onSaved: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !target) return;
    setSaving(true);
    try {
      await createSharedGoal(
        familyId,
        name.trim(),
        Number(target),
        Number(current || 0),
      );
      toast.success(t("family.toast.goal.added"));
      setName("");
      setTarget("");
      setCurrent("");
      onSaved();
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
          <DialogTitle>{t("family.dialog.goal.title")}</DialogTitle>
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
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="3000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("family.dialog.goal.saved")}</Label>
              <Input
                type="number"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !name.trim() || !target}
              className="flex-1"
            >
              {saving ? t("common.loading") : t("family.dialog.goal.cta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FamilySkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="h-10 w-32 rounded-xl bg-muted animate-pulse" />
      <div className="h-32 rounded-3xl bg-muted animate-pulse" />
      <div className="h-40 rounded-3xl bg-muted animate-pulse" />
    </div>
  );
}
