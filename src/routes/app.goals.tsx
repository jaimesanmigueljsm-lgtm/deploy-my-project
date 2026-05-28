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
  useSeedDemoGoals,
} from "@/features/goals/use-goals";
import { useT } from "@/i18n";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";

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

  const goals = goalsQ.data ?? [];
  const contribs = contribsQ.data ?? [];
  const income = incomeQ.data ?? 0;
  const currency = profileQ.data?.currency ?? "EUR";
  const convert = useCurrencyConvert();
  const isLoading = goalsQ.isLoading || contribsQ.isLoading;

  const stats = useMemo(() => {
    const total = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const saved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    const monthly = goals.reduce((s, g) => s + Number(g.monthly_contribution ?? 0), 0);
    return { total, saved, monthly, progress: total > 0 ? (saved / total) * 100 : 0 };
  }, [goals]);

  if (isLoading) return <GoalsSkeleton />;

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {t("goals.section.title")}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("goals.title")}</h1>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="size-10 rounded-full bg-foreground text-background grid place-items-center hover:opacity-90 transition"
        >
          <Plus className="size-4" />
        </button>
      </header>

      {/* HERO */}
      <div className="card-soft p-5 gradient-hero relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("goals.stat.saved")}</p>
            <div className="num-display text-[36px] font-semibold mt-0.5 leading-tight">
              {shortMoney(convert(stats.saved), currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("common.of")} {shortMoney(convert(stats.total), currency)} — {goals.length}{" "}
              {t("goals.title").toLowerCase()}
            </p>
          </div>
          <ProgressRing
            value={stats.progress}
            size={72}
            stroke={6}
            label={`${Math.round(stats.progress)}%`}
            sublabel={t("goals.kpi.overall")}
          />
        </div>
        <div className="mt-4 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-positive transition-all duration-700"
            style={{ width: `${Math.min(100, stats.progress)}%` }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={t("goals.stat.monthly")}
          value={shortMoney(convert(stats.monthly), currency)}
          suffix={
            income > 0
              ? t("goals.kpi.pct_income").replace(
                  "{pct}",
                  String(Math.round((stats.monthly / income) * 100)),
                )
              : t("goals.kpi.set_plan")
          }
          tone="mint"
          icon={<Calendar className="size-3.5" />}
        />
        <StatCard
          label={t("goals.stat.total")}
          value={shortMoney(convert(Math.max(0, stats.total - stats.saved)), currency)}
          suffix={
            stats.monthly > 0
              ? t("goals.kpi.months_left").replace(
                  "{n}",
                  String(Math.ceil((stats.total - stats.saved) / stats.monthly)),
                )
              : t("goals.kpi.no_plan")
          }
          tone="sky"
          icon={<TrendingUp className="size-3.5" />}
        />
      </div>

      {/* Goals list */}
      <section>
        <SectionHeader title={t("goals.title")} />
        {goals.length === 0 ? (
          <EmptyState
            icon={<Target className="size-5" />}
            title={t("goals.empty.title")}
            description={t("goals.empty.desc")}
            action={
              <div className="flex gap-2 flex-wrap justify-center">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus className="size-3.5 mr-1" /> {t("goals.add")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => seedGoals.mutate()}>
                  <Sparkles className="size-3.5 mr-1" /> {t("goals.demo")}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-3">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                currency={currency}
                lastContrib={contribs.filter((c) => c.goal_id === g.id)[0]}
                onAddMoney={() => setContribOpen(g)}
                onEdit={() => {
                  setEditing(g);
                  setOpen(true);
                }}
                onDelete={() => {
                  if (!confirm(t("goals.confirm.delete").replace("{name}", g.name))) return;
                  deleteGoal.mutate(g.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <GoalDialog open={open} onOpenChange={setOpen} editing={editing} currency={currency} t={t} />

      <ContributionDialog
        goal={contribOpen}
        currency={currency}
        onClose={() => setContribOpen(null)}
        t={t}
      />
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  currency,
  lastContrib,
  onAddMoney,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  lastContrib?: GoalContribution;
  onAddMoney: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const convert = useCurrencyConvert();
  const iconMeta = goalIconsMap[goal.icon];
  const colorMeta = goalColorsMap[goal.color] ?? GOAL_COLORS.mint;
  const Icon = iconMeta?.icon ?? GOAL_ICONS.target.icon;

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

      {lastContrib && (
        <p className="text-[10px] text-muted-foreground border-t border-border-subtle pt-2">
          {t("goals.card.last_deposit")
            .replace("{amount}", money(convert(lastContrib.amount), currency))
            .replace("{date}", new Date(lastContrib.contributed_at).toLocaleDateString())}
          {lastContrib.note && ` · ${lastContrib.note}`}
        </p>
      )}

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
