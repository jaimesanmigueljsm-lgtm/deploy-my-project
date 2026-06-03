import { createFileRoute } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useEffect, useMemo, useState } from "react";
import { money, shortMoney } from "@/lib/format";
import {
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Calendar,
  Sparkles,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SectionHeader, EmptyState, StatCard, ProgressRing } from "@/components/nest";
import { cn } from "@/lib/utils";
import type { Goal, GoalContribution } from "@/types/finance";
import { GOAL_ICONS, GOAL_COLORS } from "@/features/goals/goals.constants";
import {
  getDeadlineStatus,
  getProjectedCompletion,
  getNextMilestone,
} from "@/features/goals/goals.utils";
import type { AddGoalPayload } from "@/features/goals/goals.service";
import {
  useGoals,
  useGoalContributions,
  useMonthIncomeTotal,
  useProfile,
  useAddGoal,
  useUpdateGoal,
  useDeleteGoal,
  useAddContribution,
  useDeleteContribution,
  useUpdateContribution,
  useSeedDemoGoals,
} from "@/features/goals/use-goals";
import { useT } from "@/i18n";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";
import {
  useUserFamilies,
  useFamilyGoals,
  useCreateSharedGoal,
  useAddSharedContribution,
  useCreateFamily,
  useSearchUser,
  useSendInvite,
  useLeaveGroup,
  type SharedGoal,
  type UserFamily,
  type UserSearchResult,
} from "@/features/goals/use-shared-goals";
import { Users, Globe, UserPlus, Settings2, ChevronRight, Check, X, LogOut, Search, ChevronDown, ChevronUp, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/goals")({
  component: Goals,
  errorComponent: SectionError,
});

// Safe string-indexed lookups for const objects
const goalIconsMap = GOAL_ICONS as Record<
  string,
  { icon: typeof Target; label: string } | undefined
>;
const goalColorsMap = GOAL_COLORS as Record<
  string,
  { bg: string; text: string; ring: string } | undefined
>;

function Goals() {
  const { t } = useT();
  const goalsQ = useGoals();
  const contribsQ = useGoalContributions();
  const incomeQ = useMonthIncomeTotal();
  const profileQ = useProfile();
  const deleteGoal = useDeleteGoal();
  const seedGoals = useSeedDemoGoals();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contribOpen, setContribOpen] = useState<Goal | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "shared">("personal");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [sharedAddOpen, setSharedAddOpen] = useState(false);

  const goals = goalsQ.data ?? [];
  const contribs = contribsQ.data ?? [];
  const income = incomeQ.data ?? 0;
  const currency = profileQ.data?.currency ?? "EUR";
  const convert = useCurrencyConvert();
  const isLoading = goalsQ.isLoading || contribsQ.isLoading;

  const familiesQ = useUserFamilies();
  const families = familiesQ.data ?? [];
  const effectiveGroupId = activeGroupId ?? families[0]?.family_id ?? null;
  const sharedGoalsQ = useFamilyGoals(effectiveGroupId);
  const sharedGoals = sharedGoalsQ.data ?? [];

  const stats = useMemo(() => {
    const total = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const saved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    const monthly = goals.reduce((s, g) => s + Number(g.monthly_contribution ?? 0), 0);
    return { total, saved, monthly, progress: total > 0 ? (saved / total) * 100 : 0 };
  }, [goals]);

  if (isLoading) return <GoalsSkeleton />;

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise pb-24">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {t("goals.section.title")}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">
            {activeTab === "personal" ? t("goals.title") : t("goals.shared.section")}
          </h1>
        </div>
        <button
          onClick={() => {
            if (activeTab === "shared") {
              setSharedAddOpen(true);
            } else {
              setEditing(null);
              setOpen(true);
            }
          }}
          className="size-10 rounded-full bg-foreground text-background grid place-items-center hover:opacity-90 transition active:scale-95"
        >
          <Plus className="size-4" />
        </button>
      </header>

      {/* TAB SWITCHER */}
      <div className="flex gap-1 p-1 bg-muted rounded-2xl">
        <button
          onClick={() => setActiveTab("personal")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200",
            activeTab === "personal"
              ? "bg-positive text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Target className="size-3.5" />
          {t("goals.tab.personal")}
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200",
            activeTab === "shared"
              ? "bg-positive text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-3.5" />
          {t("goals.tab.shared")}
          {sharedGoals.length > 0 && (
            <span className="size-4 rounded-full bg-white text-positive text-[10px] font-bold grid place-items-center">
              {sharedGoals.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "personal" && (
        <>
          {/* Premium Goals List */}
          {goals.length === 0 ? (
            <PremiumEmptyState
              onCreateGoal={() => {
                setEditing(null);
                setOpen(true);
              }}
              onSeedGoals={() => seedGoals.mutate()}
              t={t}
            />
          ) : (
            <div className="space-y-4">
              {goals.map((g) => (
                <PremiumGoalCard
                  key={g.id}
                  goal={g}
                  currency={currency}
                  contribs={contribs.filter((c) => c.goal_id === g.id)}
                  onAddMoney={() => setContribOpen(g)}
                  onEdit={() => {
                    setEditing(g);
                    setOpen(true);
                  }}
                  onDelete={() => {
                    if (!confirm(t("goals.confirm.delete").replace("{name}", g.name))) return;
                    deleteGoal.mutate(g.id);
                  }}
                  t={t}
                />
              ))}
            </div>
          )}

          <GoalDialog open={open} onOpenChange={setOpen} editing={editing} currency={currency} t={t} />

          <ContributionDialog
            goal={contribOpen}
            currency={currency}
            onClose={() => setContribOpen(null)}
            t={t}
          />
        </>
      )}

      {activeTab === "shared" && (
        <SharedGoalsSection
          families={families}
          activeGroupId={effectiveGroupId}
          onGroupChange={setActiveGroupId}
          goals={sharedGoals}
          isLoading={sharedGoalsQ.isLoading || familiesQ.isLoading}
          familyId={effectiveGroupId}
          t={t}
          externalAddOpen={sharedAddOpen}
          onExternalAddOpenChange={setSharedAddOpen}
        />
      )}
    </div>
  );
}

// ─── Premium Empty State ──────────────────────────────────────────────────────

function PremiumEmptyState({
  onCreateGoal,
  onSeedGoals,
  t,
}: {
  onCreateGoal: () => void;
  onSeedGoals: () => void;
  t: (k: string) => string;
}) {
  const suggestions = [
    { emoji: "✈️", label: "Japón" },
    { emoji: "🚗", label: "Coche nuevo" },
    { emoji: "🏠", label: "Entrada casa" },
    { emoji: "🏍️", label: "Moto" },
  ];

  return (
    <div className="pt-12 pb-8 px-4 text-center space-y-6">
      {/* Gradient background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-emerald-200 to-teal-200 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gradient-to-br from-cyan-200 to-blue-200 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-full blur-3xl" />
      </div>

      {/* Aspirational copy */}
      <div className="space-y-3 relative">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight">
          No necesitas más dinero.<br />Solo un plan.
        </h2>
        <p className="text-muted-foreground text-base max-w-sm mx-auto">
          Crea una meta y empieza a construirla paso a paso.
        </p>
      </div>

      {/* Primary CTA */}
      <Button
        size="lg"
        onClick={onCreateGoal}
        className="px-8 py-6 text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
      >
        <Plus className="size-5 mr-2" />
        Crear primera meta
      </Button>

      {/* Suggestion chips */}
      <div className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Ideas para empezar
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={onCreateGoal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
            >
              <span className="text-base">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Demo option (subtle) */}
      <button
        onClick={onSeedGoals}
        className="text-xs text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
      >
        <Sparkles className="size-3" />
        {t("goals.demo")}
      </button>
    </div>
  );
}

// ─── Premium Shared Empty State ───────────────────────────────────────────────

function PremiumSharedEmptyState({
  onCreateGoal,
  t,
}: {
  onCreateGoal: () => void;
  t: (k: string) => string;
}) {
  const suggestions = [
    { emoji: "✈️", label: "Viaje Argentina" },
    { emoji: "🏠", label: "Entrada casa" },
    { emoji: "💍", label: "Boda" },
    { emoji: "🐶", label: "Nuevo compañero" },
  ];

  return (
    <div className="pt-12 pb-8 px-4 text-center space-y-6">
      {/* Warm gradient background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-orange-200 to-rose-200 dark:from-orange-900/20 dark:to-rose-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gradient-to-br from-amber-200 to-yellow-200 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-full blur-3xl" />
      </div>

      {/* Aspirational copy */}
      <div className="space-y-3 relative">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight">
          Los grandes planes<br />se construyen juntos.
        </h2>
        <p className="text-muted-foreground text-base max-w-sm mx-auto">
          Invita a alguien y empezad a ahorrar para vuestro próximo objetivo.
        </p>
      </div>

      {/* Primary CTA */}
      <Button
        size="lg"
        onClick={onCreateGoal}
        className="px-8 py-6 text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
      >
        <Plus className="size-5 mr-2" />
        Crear meta compartida
      </Button>

      {/* Suggestion chips */}
      <div className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Ideas para empezar
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={onCreateGoal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
            >
              <span className="text-base">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Premium Goal Card ────────────────────────────────────────────────────────

function PremiumGoalCard({
  goal,
  currency,
  contribs,
  onAddMoney,
  onEdit,
  onDelete,
  t,
}: {
  goal: Goal;
  currency: string;
  contribs?: GoalContribution[];
  onAddMoney: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  const convert = useCurrencyConvert();
  const iconMeta = goalIconsMap[goal.icon];
  const colorMeta = goalColorsMap[goal.color] ?? GOAL_COLORS.mint;
  const Icon = iconMeta?.icon ?? GOAL_ICONS.target.icon;
  const [historyOpen, setHistoryOpen] = useState(false);
  const deleteContrib = useDeleteContribution();
  const [editingContrib, setEditingContrib] = useState<GoalContribution | null>(null);
  const goalContribs = contribs ?? [];

  const pct =
    Number(goal.target_amount) > 0
      ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100)
      : 0;

  const deadlineStatus = getDeadlineStatus(goal, currency, convert);
  const projected = getProjectedCompletion(goal);
  const nextMs = getNextMilestone(pct);
  const remaining = Number(goal.target_amount) - Number(goal.current_amount);

  return (
    <div className="card-soft p-4 gradient-hero-green space-y-2.5 rounded-2xl hover:shadow-soft transition-shadow relative overflow-hidden">
      {/* Top Section: Icon, Name, Amount | Progress Ring */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Icon */}
          <div
            className={cn(
              "size-11 rounded-xl grid place-items-center shrink-0",
              colorMeta.bg,
              colorMeta.text,
            )}
          >
            <Icon className="size-5" />
          </div>

          {/* Name + Amount */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
            <p className="text-[10px] text-muted-foreground">Objetivo total</p>
            <div className="num-display text-[28px] font-bold leading-none mt-0.5">
              {shortMoney(convert(Number(goal.target_amount)), currency)}
            </div>
          </div>
        </div>

        {/* Circular Progress Ring */}
        <div className="shrink-0">
          <ProgressRing
            value={pct}
            size={64}
            stroke={5}
            label={`${Math.round(pct)}%`}
            sublabel="TOTAL"
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: colorMeta.ring }}
          />
        </div>
      </div>

      {/* Secondary Info */}
      <div className="space-y-1 text-xs">
        {/* Pace / Deadline */}
        {deadlineStatus ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span
              className={cn(
                "font-medium",
                deadlineStatus.tone === "good" && "text-positive",
                deadlineStatus.tone === "warn" && "text-warn",
                deadlineStatus.tone === "bad" && "text-negative",
              )}
            >
              {deadlineStatus.label}
            </span>
          </div>
        ) : projected ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              A este ritmo:{" "}
              <span className="font-medium text-foreground">
                {projected.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </span>
          </div>
        ) : null}

        {/* Next Milestone */}
        {nextMs !== null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Siguiente: {nextMs}%</span>
            <span className="font-medium num">
              (faltan {shortMoney(convert((Number(goal.target_amount) * nextMs) / 100 - Number(goal.current_amount)), currency)})
            </span>
          </div>
        )}
      </div>

      {/* Contribution History Toggle */}
      {goalContribs.length > 0 && (
        <button
          onClick={() => setHistoryOpen(h => !h)}
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition pt-1 border-t border-border-subtle"
        >
          <span>
            {goalContribs.length} aportaciones · Última: {money(convert(goalContribs[0].amount), currency)}
          </span>
          {historyOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      )}

      {/* Expanded History */}
      {historyOpen && goalContribs.length > 0 && (
        <div className="space-y-1.5">
          {goalContribs.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/50">
              <div className="min-w-0">
                <p className="text-sm font-semibold num">
                  +{money(convert(c.amount), currency)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(c.contributed_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {c.note && ` · ${c.note}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditingContrib(c)}
                  className="size-7 rounded-lg bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (!confirm(t("goals.contrib.history.confirm_delete"))) return;
                    deleteContrib.mutate(c.id);
                  }}
                  className="size-7 rounded-lg bg-muted grid place-items-center text-muted-foreground hover:text-negative transition"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onAddMoney}
          className="flex-1 rounded-xl font-medium"
          size="sm"
        >
          <Plus className="size-3.5 mr-1.5" />
          Añadir aportación
        </Button>
        <Button
          onClick={onEdit}
          variant="outline"
          size="sm"
          className="rounded-xl"
        >
          Editar
        </Button>
        <Button
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="text-negative hover:text-negative hover:bg-negative/10 rounded-xl px-2"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Edit Contribution Dialog */}
      <EditContributionDialog
        contrib={editingContrib}
        currency={currency}
        onClose={() => setEditingContrib(null)}
        t={t}
      />
    </div>
  );
}

// ─── Original Goal card (keep for reference/shared goals) ────────────────────

function GoalCard({
  goal,
  currency,
  contribs,
  onAddMoney,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  contribs?: GoalContribution[];
  onAddMoney: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const convert = useCurrencyConvert();
  const iconMeta = goalIconsMap[goal.icon];
  const colorMeta = goalColorsMap[goal.color] ?? GOAL_COLORS.mint;
  const Icon = iconMeta?.icon ?? GOAL_ICONS.target.icon;
  const [historyOpen, setHistoryOpen] = useState(false);
  const deleteContrib = useDeleteContribution();
  const [editingContrib, setEditingContrib] = useState<GoalContribution | null>(null);
  const goalContribs = contribs ?? [];

  const pct =
    Number(goal.target_amount) > 0
      ? Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100)
      : 0;

  const deadlineStatus = getDeadlineStatus(goal, currency, convert);
  const projected = getProjectedCompletion(goal);
  const nextMs = getNextMilestone(pct);

  return (
    <div className="card-flat p-4 space-y-3 hover:shadow-soft transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "size-11 rounded-2xl grid place-items-center shrink-0",
              colorMeta.bg,
              colorMeta.text,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
              {goal.priority === "high" && (
                <span className="text-[9px] uppercase tracking-wider font-bold text-warn bg-warn-soft px-1.5 py-0.5 rounded">
                  {t("goals.card.priority")}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground num truncate">
              {money(convert(Number(goal.current_amount)), currency)} {t("common.of")}{" "}
              {money(convert(Number(goal.target_amount)), currency)}
              {Number(goal.monthly_contribution) > 0 &&
                ` · ${money(convert(Number(goal.monthly_contribution)), currency)}/${t("goals.per_month")}`}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-semibold num">{Math.round(pct)}%</div>
          {pct >= 100 && <Trophy className="size-3.5 text-warn ml-auto mt-0.5" />}
        </div>
      </div>

      {/* Progress bar w/ milestones */}
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: colorMeta.ring }}
          />
        </div>
        {[25, 50, 75].map((m) => (
          <div key={m} className="absolute top-0 size-2 -translate-x-1/2" style={{ left: `${m}%` }}>
            <div
              className={cn(
                "size-1 rounded-full mx-auto mt-0.5",
                pct >= m ? "bg-background" : "bg-border",
              )}
            />
          </div>
        ))}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between text-[11px]">
        {deadlineStatus ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              deadlineStatus.tone === "good" && "text-positive",
              deadlineStatus.tone === "warn" && "text-warn",
              deadlineStatus.tone === "bad" && "text-negative",
            )}
          >
            {deadlineStatus.tone === "good" ? (
              <Trophy className="size-3" />
            ) : (
              <AlertTriangle className="size-3" />
            )}
            {deadlineStatus.label}
          </span>
        ) : projected ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Calendar className="size-3" />
            {t("goals.card.pace").replace(
              "{date}",
              projected.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("goals.card.set_monthly")}</span>
        )}
        {nextMs !== null && (
          <span className="text-muted-foreground num">
            {t("goals.card.next")
              .replace("{pct}", String(nextMs))
              .replace(
                "{amount}",
                money(
                  convert(
                    (Number(goal.target_amount) * nextMs) / 100 - Number(goal.current_amount),
                  ),
                  currency,
                ),
              )}
          </span>
        )}
      </div>

      {/* Contribution history toggle */}
      {goalContribs.length > 0 && (
        <button
          onClick={() => setHistoryOpen(h => !h)}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition pt-1 border-t border-border-subtle"
        >
          <span>
            {goalContribs.length} {t("goals.contrib.history.count")}
            {" · "}{t("goals.contrib.history.last")}: {money(convert(goalContribs[0].amount), currency)}
          </span>
          {historyOpen
            ? <ChevronUp className="size-3.5" />
            : <ChevronDown className="size-3.5" />
          }
        </button>
      )}

      {/* Expanded history */}
      {historyOpen && goalContribs.length > 0 && (
        <div className="space-y-2 pt-1">
          {goalContribs.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/50">
              <div className="min-w-0">
                <p className="text-[12px] font-medium num">
                  +{money(convert(c.amount), currency)}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {new Date(c.contributed_at).toLocaleDateString(undefined, {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                  {c.note && ` · ${c.note}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditingContrib(c)}
                  className="size-6 rounded-lg bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  onClick={() => {
                    if (!confirm(t("goals.contrib.history.confirm_delete"))) return;
                    deleteContrib.mutate(c.id);
                  }}
                  className="size-6 rounded-lg bg-muted grid place-items-center text-muted-foreground hover:text-negative transition"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditContributionDialog
        contrib={editingContrib}
        currency={currency}
        onClose={() => setEditingContrib(null)}
        t={t}
      />

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="default" className="flex-1" onClick={onAddMoney}>
          <Plus className="size-3.5 mr-1" /> {t("goals.contrib.cta")}
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          {t("common.edit")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-muted-foreground hover:text-negative"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Goal dialog ──────────────────────────────────────────────────────────────

function GoalDialog({
  open,
  onOpenChange,
  editing,
  currency,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Goal | null;
  currency: string;
  t: (k: string) => string;
}) {
  const addGoal = useAddGoal();
  const updateGoal = useUpdateGoal();

  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    monthly_contribution: "",
    deadline: "",
    icon: "target",
    color: "mint",
    priority: "medium",
    notes: "",
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        target_amount: String(editing.target_amount),
        current_amount: String(editing.current_amount),
        monthly_contribution: String(editing.monthly_contribution ?? 0),
        deadline: editing.deadline ?? "",
        icon: editing.icon,
        color: editing.color,
        priority: editing.priority ?? "medium",
        notes: editing.notes ?? "",
      });
    } else {
      setForm({
        name: "",
        target_amount: "",
        current_amount: "0",
        monthly_contribution: "",
        deadline: "",
        icon: "target",
        color: "mint",
        priority: "medium",
        notes: "",
      });
    }
  }, [editing, open]);

  function save() {
    if (!form.name || !form.target_amount) return toast.error(t("goals.contrib.error"));

    const payload: AddGoalPayload = {
      name: form.name,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      deadline: form.deadline || null,
      icon: form.icon,
      color: form.color,
      priority: form.priority,
      notes: form.notes || null,
    };

    if (editing) {
      updateGoal.mutate({ id: editing.id, payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      addGoal.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  }

  const isPending = addGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("goals.dialog.title.edit") : t("goals.dialog.title.new")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("goals.dialog.name")}</Label>
            <Input
              placeholder={t("goals.dialog.name.placeholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>
                {t("goals.dialog.target")} ({currency})
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="20000"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("goals.dialog.already_saved")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={form.current_amount}
                onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("goals.dialog.monthly")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="500"
                value={form.monthly_contribution}
                onChange={(e) => setForm({ ...form, monthly_contribution: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("goals.deadline")}</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("goals.dialog.icon")}</Label>
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(GOAL_ICONS).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`goals.icon.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("goals.dialog.color")}</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["mint", "sky", "warn", "violet"] as const).map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`goals.color.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("goals.dialog.priority")}</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["high", "medium", "low"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`goals.priority.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("goals.dialog.notes")}</Label>
            <Textarea
              placeholder={t("goals.dialog.notes.placeholder")}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? t("common.loading") : editing ? t("common.save") : t("goals.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contribution dialog ───────────────────────────────────────────────────────

function ContributionDialog({
  goal,
  currency,
  onClose,
  t,
}: {
  goal: Goal | null;
  currency: string;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const addContribution = useAddContribution();
  const convert = useCurrencyConvert();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setAmount("");
    setNote("");
  }, [goal]);

  function save() {
    if (!goal) return;
    const n = Number(amount);
    if (!n || n <= 0) return toast.error(t("goals.contrib.error"));
    addContribution.mutate(
      { goal_id: goal.id, amount: n, note: note || null },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.contrib.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>
              {t("goals.contrib.amount")} ({currency})
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              autoFocus
              placeholder={goal?.monthly_contribution ? String(goal.monthly_contribution) : "100"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {Number(goal?.monthly_contribution) > 0 ? (
              <button
                type="button"
                onClick={() => setAmount(String(goal!.monthly_contribution))}
                className="text-[11px] text-muted-foreground hover:text-foreground mt-1"
              >
                {t("goals.contrib.use_planned").replace(
                  "{amount}",
                  money(convert(Number(goal!.monthly_contribution)), currency),
                )}
              </button>
            ) : null}
          </div>
          <div>
            <Label>{t("goals.contrib.note")}</Label>
            <Input
              placeholder={t("goals.contrib.note.placeholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={addContribution.isPending}>
            {addContribution.isPending ? t("common.loading") : t("goals.contrib.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Contribution Dialog ─────────────────────────────────────────────────

function EditContributionDialog({
  contrib,
  currency,
  onClose,
  t,
}: {
  contrib: GoalContribution | null;
  currency: string;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const updateContrib = useUpdateContribution();
  const convert = useCurrencyConvert();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (contrib) {
      setAmount(String(contrib.amount));
      setNote(contrib.note ?? "");
    }
  }, [contrib]);

  function save() {
    if (!contrib) return;
    const n = Number(amount);
    if (!n || n <= 0) return toast.error(t("goals.contrib.error"));
    updateContrib.mutate(
      { contributionId: contrib.id, newAmount: n, newNote: note || null },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Dialog open={!!contrib} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.contrib.history.edit_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("goals.contrib.amount")} ({currency})</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("goals.contrib.note")}</Label>
            <Input
              placeholder={t("goals.contrib.note.placeholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={updateContrib.isPending}>
            {updateContrib.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared Goals Section ─────────────────────────────────────────────────────

function SharedGoalsSection({
  families,
  activeGroupId,
  onGroupChange,
  goals,
  isLoading,
  familyId,
  t,
  externalAddOpen,
  onExternalAddOpenChange,
}: {
  families: UserFamily[];
  activeGroupId: string | null;
  onGroupChange: (id: string) => void;
  goals: SharedGoal[];
  isLoading: boolean;
  familyId: string | null;
  t: (k: string) => string;
  externalAddOpen: boolean;
  onExternalAddOpenChange: (o: boolean) => void;
}) {
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [inviteGoalFamilyId, setInviteGoalFamilyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contribGoal, setContribGoal] = useState<SharedGoal | null>(null);

  const createGoal = useCreateSharedGoal(familyId);
  const createFamily = useCreateFamily();
  const addContrib = useAddSharedContribution(familyId);
  const profileQ = useProfile();
  const currency = profileQ.data?.currency ?? "EUR";
  const convert = useCurrencyConvert();

  const activeFamily = families.find((f) => f.family_id === activeGroupId) ?? families[0];

  // Handle creating first goal with auto group creation
  async function handleCreateFirstGoal(goalData: { name: string; targetAmount: number; deadline: string | null }) {
    try {
      // 1. Create invisible group with goal name
      const newFamilyId = await new Promise<string>((resolve, reject) => {
        createFamily.mutate(goalData.name, {
          onSuccess: resolve,
          onError: reject,
        });
      });

      // 2. Switch to new group
      onGroupChange(newFamilyId);

      // 3. Create goal in that group
      await new Promise<void>((resolve, reject) => {
        createGoal.mutate(goalData, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });

      setAddGoalOpen(false);
    } catch (err) {
      // Errors already handled by hooks
    }
  }

  // Sync external add open (from header + button)
  useEffect(() => {
    if (externalAddOpen) {
      setAddGoalOpen(true);
      onExternalAddOpenChange(false);
    }
  }, [externalAddOpen, onExternalAddOpenChange]);

  // Stats for active group
  const groupStats = useMemo(() => {
    const total = goals.reduce((s, g) => s + g.target_amount, 0);
    const saved = goals.reduce((s, g) => s + g.current_amount, 0);
    return { total, saved, progress: total > 0 ? (saved / total) * 100 : 0 };
  }, [goals]);

  if (families.length === 0) {
    return (
      <>
        <PremiumSharedEmptyState
          onCreateGoal={() => setAddGoalOpen(true)}
          t={t}
        />
        <AddSharedGoalDialog
          open={addGoalOpen}
          onOpenChange={setAddGoalOpen}
          onCreate={handleCreateFirstGoal}
          isPending={createGoal.isPending || createFamily.isPending}
          currency={currency}
          t={t}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">

      {/* Goals list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <PremiumSharedEmptyState
          onCreateGoal={() => setAddGoalOpen(true)}
          t={t}
        />
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <SharedGoalCard
              key={g.id}
              goal={g}
              currency={currency}
              convert={convert}
              onContribute={() => setContribGoal(g)}
              onInvite={() => setInviteGoalFamilyId(familyId)}
              t={t}
            />
          ))}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setAddGoalOpen(true)}
          >
            <Plus className="size-3.5 mr-1" /> {t("goals.shared.add")}
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <AddSharedGoalDialog
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        onCreate={({ name, targetAmount, deadline }) =>
          createGoal.mutate({ name, targetAmount, deadline }, { onSuccess: () => setAddGoalOpen(false) })
        }
        isPending={createGoal.isPending}
        currency={currency}
        t={t}
      />

      <SharedContribDialog
        goal={contribGoal}
        currency={currency}
        convert={convert}
        onClose={() => setContribGoal(null)}
        onSubmit={(delta) =>
          contribGoal &&
          addContrib.mutate(
            { goalId: contribGoal.id, currentAmount: contribGoal.current_amount, delta },
            { onSuccess: () => setContribGoal(null) },
          )
        }
        isPending={addContrib.isPending}
        t={t}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={(newFamilyId) => onGroupChange(newFamilyId)}
        t={t}
      />

      <InviteUserDialog
        open={!!inviteGoalFamilyId}
        onOpenChange={(open) => !open && setInviteGoalFamilyId(null)}
        familyId={inviteGoalFamilyId}
        t={t}
      />

      <GroupSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        family={activeFamily ?? null}
        t={t}
      />
    </div>
  );
}

function SharedGoalCard({
  goal,
  currency,
  convert,
  onContribute,
  onInvite,
  t,
}: {
  goal: SharedGoal;
  currency: string;
  convert: (n: number) => number;
  onContribute: () => void;
  onInvite: () => void;
  t: (k: string) => string;
}) {
  const pct = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
    : 0;

  const remaining = goal.target_amount - goal.current_amount;
  const isComplete = pct >= 100;

  // Mini bar chart data — simulate 5 segments of progress
  const segments = [20, 40, 60, 80, 100];

  return (
    <div className="card-flat p-4 space-y-4 hover:shadow-soft transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "size-11 rounded-2xl grid place-items-center shrink-0",
            isComplete
              ? "bg-positive-soft text-positive"
              : "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400"
          )}>
            {isComplete ? <Trophy className="size-5" /> : <Users className="size-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
              {isComplete && (
                <span className="text-[9px] uppercase tracking-wider font-bold text-positive bg-positive-soft px-1.5 py-0.5 rounded">
                  {t("goals.card.complete")}
                </span>
              )}
              {goal.status === "archived" && (
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {t("goals.shared.archived")}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground num">
              {money(convert(goal.current_amount), currency)} {t("common.of")} {money(convert(goal.target_amount), currency)}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold num">{Math.round(pct)}%</div>
        </div>
      </div>

      {/* Progress bar with milestones */}
      <div className="relative">
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              isComplete ? "bg-positive" : "bg-orange-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className="absolute top-0 size-2.5 -translate-x-1/2 flex items-center justify-center"
            style={{ left: `${m}%` }}
          >
            <div className={cn(
              "size-1 rounded-full",
              pct >= m ? "bg-background/60" : "bg-border"
            )} />
          </div>
        ))}
      </div>

      {/* Mini bar chart — visual representation of goal segments */}
      <div className="flex items-end gap-1 h-8">
        {segments.map((s, i) => {
          const filled = pct >= s;
          const partial = pct > (s - 20) && pct < s;
          const partialPct = partial ? ((pct - (s - 20)) / 20) * 100 : 0;
          return (
            <div key={i} className="flex-1 rounded-sm bg-muted overflow-hidden" style={{ height: `${60 + i * 10}%` }}>
              <div
                className={cn(
                  "w-full rounded-sm transition-all duration-500",
                  filled
                    ? isComplete ? "bg-positive" : "bg-orange-400 dark:bg-orange-500"
                    : "bg-transparent"
                )}
                style={{
                  height: filled ? "100%" : partial ? `${partialPct}%` : "0%",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          {goal.deadline ? (
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(goal.deadline).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {!isComplete && `${money(convert(remaining), currency)} ${t("goals.shared.remaining")}`}
            </span>
          )}
          <button
            onClick={onInvite}
            className="size-8 rounded-full border border-dashed border-border grid place-items-center hover:bg-muted transition"
            title={t("goals.shared.invite")}
          >
            <UserPlus className="size-3.5 text-muted-foreground" />
          </button>
        </div>
        {!isComplete && (
          <Button size="sm" variant="default" onClick={onContribute} className="h-7 text-xs px-3">
            <Plus className="size-3 mr-1" /> {t("goals.contrib.cta")}
          </Button>
        )}
      </div>
    </div>
  );
}

function AddSharedGoalDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
  currency,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (data: { name: string; targetAmount: number; deadline: string | null }) => void;
  isPending: boolean;
  currency: string;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!open) { setName(""); setTarget(""); setDeadline(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.shared.dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("goals.dialog.name")}</Label>
            <Input
              placeholder={t("goals.shared.dialog.name.placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("goals.dialog.target")} ({currency})</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="5000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("goals.deadline")}</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={() => onCreate({ name, targetAmount: Number(target), deadline: deadline || null })}
            disabled={!name || !target || isPending}
          >
            {isPending ? t("common.loading") : t("goals.shared.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SharedContribDialog({
  goal,
  currency,
  convert,
  onClose,
  onSubmit,
  isPending,
  t,
}: {
  goal: SharedGoal | null;
  currency: string;
  convert: (n: number) => number;
  onClose: () => void;
  onSubmit: (delta: number) => void;
  isPending: boolean;
  t: (k: string) => string;
}) {
  const [amount, setAmount] = useState("");
  useEffect(() => { setAmount(""); }, [goal]);

  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.contrib.title")} — {goal?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("goals.contrib.amount")} ({currency})</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              autoFocus
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={() => onSubmit(Number(amount))}
            disabled={!amount || Number(amount) <= 0 || isPending}
          >
            {isPending ? t("common.loading") : t("goals.contrib.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Group Dialog ──────────────────────────────────────────────────────

function CreateGroupDialog({
  open,
  onOpenChange,
  onSuccess,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess?: (familyId: string) => void;
  t: (k: string) => string;
}) {
  const createGroup = useCreateFamily();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  function handleCreate() {
    createGroup.mutate(name, {
      onSuccess: (familyId) => {
        onSuccess?.(familyId);
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.shared.group.create")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("goals.shared.group.name")}</Label>
            <Input
              placeholder={t("goals.shared.group.name.placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("goals.shared.group.create.hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createGroup.isPending}
          >
            {createGroup.isPending ? t("common.loading") : t("goals.shared.group.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invite User Dialog ───────────────────────────────────────────────────────

function InviteUserDialog({
  open,
  onOpenChange,
  familyId,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familyId: string | null;
  t: (k: string) => string;
}) {
  const searchUser = useSearchUser();
  const sendInvite = useSendInvite(familyId);
  const [username, setUsername] = useState("");
  const [foundUser, setFoundUser] = useState<UserSearchResult | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) { setUsername(""); setFoundUser(null); setSearched(false); }
  }, [open]);

  async function handleSearch() {
    if (!username.trim()) return;
    setSearched(true);
    const result = await searchUser.mutateAsync(username.replace(/^@/, ""));
    setFoundUser(result);
  }

  function handleInvite() {
    if (!foundUser) return;
    sendInvite.mutate(foundUser.financial_username, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("goals.shared.invite.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("goals.shared.invite.username")}</Label>
            <div className="flex gap-2">
              <Input
                placeholder="@username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFoundUser(null); setSearched(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSearch}
                disabled={!username.trim() || searchUser.isPending}
                className="shrink-0"
              >
                {searchUser.isPending
                  ? <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Search className="size-4" />
                }
              </Button>
            </div>
          </div>

          {searched && !foundUser && !searchUser.isPending && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted text-sm text-muted-foreground">
              <X className="size-4 shrink-0" />
              {t("goals.shared.invite.not_found")}
            </div>
          )}

          {foundUser && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-positive-soft">
              <div>
                <p className="text-sm font-medium">{foundUser.first_name} {foundUser.last_name_1}</p>
                <p className="text-xs text-muted-foreground">@{foundUser.financial_username}</p>
              </div>
              <Check className="size-4 text-positive" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            onClick={handleInvite}
            disabled={!foundUser || sendInvite.isPending}
          >
            <UserPlus className="size-3.5 mr-1" />
            {sendInvite.isPending ? t("common.loading") : t("goals.shared.invite.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Group Settings Dialog ────────────────────────────────────────────────────

function GroupSettingsDialog({
  open,
  onOpenChange,
  family,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  family: UserFamily | null;
  t: (k: string) => string;
}) {
  const leaveGroup = useLeaveGroup();

  if (!family) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{family.family_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-sm">{family.member_count} {t("goals.shared.members")}</span>
            </div>
            <span className="text-xs text-muted-foreground capitalize">{family.member_role}</span>
          </div>
          <div className="text-xs text-muted-foreground px-1">{t("goals.shared.group.owned_by")} {family.owner_name}</div>
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            {t("common.close")}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-negative hover:text-negative hover:bg-negative/10"
            onClick={() => {
              if (!confirm(t("goals.shared.group.leave.confirm").replace("{name}", family.family_name))) return;
              leaveGroup.mutate(family.family_id, { onSuccess: () => onOpenChange(false) });
            }}
            disabled={leaveGroup.isPending}
          >
            <LogOut className="size-3.5 mr-1" />
            {leaveGroup.isPending ? t("common.loading") : t("goals.shared.group.leave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalsSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="h-10 w-48 rounded-xl bg-muted animate-pulse" />
      <div className="h-32 rounded-3xl bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
      </div>
      <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      <div className="h-40 rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
