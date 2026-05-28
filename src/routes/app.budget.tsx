import { createFileRoute } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { money, monthLabel, monthRange, relativeDate } from "@/lib/format";
import {
  Plus,
  Receipt,
  X,
  Trash2,
  Filter,
  TrendingUp,
  Briefcase,
  Pencil,
  Info,
  RepeatIcon,
  PiggyBank,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionHeader, EmptyState, CategoryDot } from "@/components/nest";
import {
  useBudgetData,
  useAddBill,
  useDeleteBill,
  useAddIncome,
  useUpdateIncome,
  useDeleteIncome,
} from "@/features/budget/use-budget";
import {
  useSavingsAccounts,
  useAddSavingsAccount,
  useUpdateSavingsAccount,
  useDeleteSavingsAccount,
} from "@/features/savings/use-savings";
import type { SavingsAccount, SavingsAccountType } from "@/features/savings/savings.service";
import {
  useAddExpense,
  useDeleteExpense,
  useUpdateExpense,
} from "@/features/expenses/use-expenses";
import { useT } from "@/i18n";
import { CATEGORY_NAME_TO_KEY } from "@/i18n/translations";
import { useCurrencyConvert } from "@/features/currency/use-exchange-rates";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/budget")({
  component: Budget,
  errorComponent: SectionError,
  validateSearch: (search: Record<string, unknown>) => ({
    add:
      search.add === "expense" || search.add === "income"
        ? (search.add as "expense" | "income")
        : undefined,
  }),
});

type Category = Pick<Tables<"categories">, "id" | "name" | "color" | "kind">;
type Income = Pick<Tables<"incomes">, "id" | "source" | "amount" | "recurring" | "received_at">;
type Bill = Pick<Tables<"bills">, "id" | "name" | "amount" | "due_day" | "paid_this_month">;
type EditableExpense = Pick<
  Tables<"expenses">,
  "id" | "amount" | "description" | "spent_at" | "kind" | "category_id" | "recurring"
>;

type Tab = "all" | "fixed" | "variable" | "income" | "savings";

function Budget() {
  const { t } = useT();
  const range = useMemo(() => monthRange(), []);

  const { expenses, categories, bills, incomes, currency, isLoading } = useBudgetData(
    range.start,
    range.end,
  );
  const convert = useCurrencyConvert();

  const deleteExpense = useDeleteExpense();
  const deleteBill = useDeleteBill();
  const deleteIncome = useDeleteIncome();

  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<EditableExpense | null>(null);
  const [openSavings, setOpenSavings] = useState(false);
  const [editingSavings, setEditingSavings] = useState<SavingsAccount | null>(null);

  const { data: savingsAccounts = [] } = useSavingsAccounts();
  const deleteSavingsAccount = useDeleteSavingsAccount();

  // Open dialog when navigated with ?add=expense | ?add=income
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (search.add === "expense") {
      setOpen(true);
      navigate({ to: "/app/budget", search: { add: undefined }, replace: true });
    }
    if (search.add === "income") {
      setEditingIncome(null);
      setOpenIncome(true);
      navigate({ to: "/app/budget", search: { add: undefined }, replace: true });
    }
  }, [search.add, navigate]);

  // Dedupe categories by (name + kind) to avoid duplicated chips/aggregations
  // when the user has accidentally seeded the same category multiple times.
  const dedupedCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      const key = `${c.kind}|${c.name.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  const billIds = useMemo(() => new Set(bills.map((b) => b.id)), [bills]);

  const billsAsExpenses = useMemo((): EditableExpense[] => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    return bills.map((b) => {
      const maxDay = new Date(y, m + 1, 0).getDate();
      const d = Math.min(b.due_day, maxDay);
      return {
        id: b.id,
        amount: Number(b.amount),
        description: b.name,
        spent_at: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        kind: "fixed",
        category_id: null,
        recurring: true,
      };
    });
  }, [bills]);

  const filtered = useMemo(() => {
    if (tab === "fixed") return [...billsAsExpenses, ...expenses.filter((e) => e.kind === "fixed")];
    if (tab === "variable") return expenses.filter((e) => e.kind !== "fixed");
    if (tab === "all") return [...billsAsExpenses, ...expenses];
    return expenses;
  }, [tab, expenses, billsAsExpenses]);

  const { totalSpent, totalFixed, totalVariable } = useMemo(() => {
    const billsTotal = bills.reduce((s, b) => s + Number(b.amount), 0);
    return {
      totalSpent: expenses.reduce((s, e) => s + e.amount, 0) + billsTotal,
      totalFixed:
        expenses.filter((e) => e.kind === "fixed").reduce((s, e) => s + e.amount, 0) + billsTotal,
      totalVariable: expenses.filter((e) => e.kind !== "fixed").reduce((s, e) => s + e.amount, 0),
    };
  }, [expenses, bills]);

  const { totalIncome, recurringIncome } = useMemo(
    () => ({
      totalIncome: incomes.reduce((s, i) => s + i.amount, 0),
      recurringIncome: incomes.filter((i) => i.recurring).reduce((s, i) => s + i.amount, 0),
    }),
    [incomes],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number; count: number }>();
    for (const e of filtered) {
      const cat = dedupedCategories.find((c) => c.id === e.category_id);
      const key = cat?.name.trim().toLowerCase() ?? "_uncat";
      const cur = map.get(key) ?? {
        name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? "neutral",
        total: 0,
        count: 0,
      };
      cur.total += e.amount;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, dedupedCategories]);

  const handleEditExpense = useCallback(
    (expense: EditableExpense) => {
      if (billIds.has(expense.id)) return;
      setEditingExpense(expense);
      setOpen(true);
    },
    [billIds],
  );

  const handleDeleteExpense = useCallback(
    (id: string) => {
      if (billIds.has(id)) {
        deleteBill.mutate(id);
      } else {
        deleteExpense.mutate(id);
      }
    },
    [billIds, deleteBill.mutate, deleteExpense.mutate],
  );

  if (isLoading) return <BudgetSkeleton />;

  const totalSavingsBalance = savingsAccounts.reduce((s, a) => s + a.balance, 0);
  const emergencyBalance = savingsAccounts
    .filter((a) => a.is_emergency_fund)
    .reduce((s, a) => s + a.balance, 0);

  const tabs: [Tab, string][] = [
    ["all", t("budget.tab.all")],
    ["fixed", t("budget.tab.fixed")],
    ["variable", t("budget.tab.variable")],
    ["income", t("budget.tab.income")],
    ["savings", t("budget.tab.savings")],
  ];

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {monthLabel()}
          </p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("budget.title")}</h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="size-10 rounded-full bg-foreground text-background grid place-items-center"
        >
          <Plus className="size-4" />
        </button>
      </header>

      {/* Summary card */}
      <div className="card-soft p-5 gradient-hero">
        <p className="text-xs text-muted-foreground">{t("budget.summary.spent")}</p>
        <div className="num-display text-[40px] font-semibold mt-0.5">
          {money(convert(totalSpent), currency)}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
          <Stat label={t("budget.summary.fixed")} value={money(convert(totalFixed), currency)} />
          <Stat
            label={t("budget.summary.variable")}
            value={money(convert(totalVariable), currency)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 card-flat p-1 rounded-xl">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
              tab === k
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Savings tab ───────────────────────────────────────────────────────── */}
      {tab === "savings" ? (
        <>
          <div className="card-soft p-5 gradient-mint">
            <p className="text-xs text-muted-foreground">{t("savings.summary.total")}</p>
            <div className="num-display text-[40px] font-semibold mt-0.5">
              {money(convert(totalSavingsBalance), currency)}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
              <Stat
                label={t("savings.summary.emergency")}
                value={money(convert(emergencyBalance), currency)}
              />
              <Stat label={t("savings.summary.accounts")} value={`${savingsAccounts.length}`} />
            </div>
          </div>
          <section>
            <SectionHeader
              title={t("savings.section.title")}
              action={
                <button
                  onClick={() => {
                    setEditingSavings(null);
                    setOpenSavings(true);
                  }}
                  className="text-xs font-medium text-positive"
                >
                  + {t("common.add")}
                </button>
              }
            />
            {savingsAccounts.length === 0 ? (
              <EmptyState
                icon={<PiggyBank className="size-5" />}
                title={t("savings.empty.title")}
                description={t("savings.empty.desc")}
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSavings(null);
                      setOpenSavings(true);
                    }}
                  >
                    {t("savings.add.button")}
                  </Button>
                }
              />
            ) : (
              <div className="card-flat divide-y divide-border-subtle">
                {savingsAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setEditingSavings(acc);
                      setOpenSavings(true);
                    }}
                    className="group w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-xl bg-sky-soft text-sky grid place-items-center shrink-0">
                        {acc.is_emergency_fund ? (
                          <ShieldCheck className="size-4" />
                        ) : (
                          <Landmark className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{acc.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t(`savings.type.${acc.type}`)}
                          {acc.institution_name ? ` · ${acc.institution_name}` : ""}
                          {acc.is_emergency_fund ? ` · ${t("savings.badge.emergency")}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold num text-positive">
                        {money(convert(acc.balance), currency)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSavingsAccount.mutate(acc.id);
                        }}
                        disabled={deleteSavingsAccount.isPending}
                        aria-label={t("common.delete")}
                        className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-negative hover:bg-negative-soft/40 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      ) : /* ── Income tab ───────────────────────────────────────────────────────── */
      tab === "income" ? (
        <>
          <div className="card-soft p-5 gradient-mint">
            <p className="text-xs text-muted-foreground">{t("budget.income.total")}</p>
            <div className="num-display text-[40px] font-semibold mt-0.5">
              {money(convert(totalIncome), currency)}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
              <Stat
                label={t("budget.income.recurring")}
                value={money(convert(recurringIncome), currency)}
              />
              <Stat label={t("budget.income.sources")} value={`${incomes.length}`} />
            </div>
          </div>
          <section>
            <SectionHeader
              title={t("budget.section.income")}
              action={
                <button
                  onClick={() => {
                    setEditingIncome(null);
                    setOpenIncome(true);
                  }}
                  className="text-xs font-medium text-positive"
                >
                  + {t("common.add")}
                </button>
              }
            />
            {incomes.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title={t("budget.empty.income.title")}
                description={t("budget.empty.income.desc")}
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingIncome(null);
                      setOpenIncome(true);
                    }}
                  >
                    {t("budget.add.income")}
                  </Button>
                }
              />
            ) : (
              <div className="card-flat divide-y divide-border-subtle">
                {incomes.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => {
                      setEditingIncome(i);
                      setOpenIncome(true);
                    }}
                    className="group w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-xl bg-positive-soft text-positive grid place-items-center shrink-0">
                        <TrendingUp className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{i.source}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.recurring && i.received_at
                            ? `${t("budget.income.recurringDay")} ${new Date(i.received_at + "T12:00:00").getDate()}`
                            : i.recurring
                              ? t("budget.income.recurringLabel")
                              : relativeDate(i.received_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold num text-positive">
                        +{money(convert(i.amount), currency)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteIncome.mutate(i.id);
                        }}
                        disabled={deleteIncome.isPending}
                        aria-label="Delete income"
                        className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-negative hover:bg-negative-soft/40 transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* ── Expense tabs (all / fixed / variable) ──────────────────────────────── */
        <>
          {byCategory.length > 0 && (
            <section>
              <SectionHeader title={t("budget.section.byCategory")} />
              <div className="space-y-2">
                {byCategory.slice(0, 6).map((c) => (
                  <div key={c.name} className="card-flat p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CategoryDot color={c.color} />
                        <span className="text-sm font-medium">
                          {CATEGORY_NAME_TO_KEY[c.name] ? t(CATEGORY_NAME_TO_KEY[c.name]) : c.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">· {c.count}</span>
                      </div>
                      <div className="text-sm font-semibold num">
                        {money(convert(c.total), currency)}
                      </div>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${(c.total / Math.max(1, totalSpent)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeader
              title={t("budget.section.transactions")}
              action={
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Filter className="size-3" /> {filtered.length}
                </span>
              }
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Receipt className="size-5" />}
                title={t("budget.empty.expenses.title")}
                description={t("budget.empty.expenses.desc")}
                action={
                  <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="size-3.5 mr-1" /> {t("budget.add.expense")}
                  </Button>
                }
              />
            ) : (
              <div className="card-flat divide-y divide-border-subtle">
                {filtered.map((e) => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    cat={dedupedCategories.find((c) => c.id === e.category_id)}
                    currency={currency}
                    convert={convert}
                    onEdit={handleEditExpense}
                    onDelete={handleDeleteExpense}
                    isPendingDelete={deleteExpense.isPending}
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ExpenseDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingExpense(null);
        }}
        categories={dedupedCategories}
        editing={editingExpense}
        t={t}
      />
      <IncomeDialog
        open={openIncome}
        onClose={() => {
          setOpenIncome(false);
          setEditingIncome(null);
        }}
        editing={editingIncome}
        t={t}
      />
      <SavingsDialog
        open={openSavings}
        onClose={() => {
          setOpenSavings(false);
          setEditingSavings(null);
        }}
        editing={editingSavings}
        currency={currency}
        t={t}
      />
    </div>
  );
}

// ─── Stat ──────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold num mt-0.5">{value}</div>
    </div>
  );
}

// ─── ExpenseDialog ─────────────────────────────────────────────────────────────

function ExpenseDialog({
  open,
  onClose,
  categories,
  editing,
  t,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  editing: EditableExpense | null;
  t: (k: string) => string;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [kind, setKind] = useState<"variable" | "fixed">("variable");
  const [date, setDate] = useState("");
  const [fixedDay, setFixedDay] = useState(String(new Date().getDate()));

  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const isPending = addExpense.isPending || updateExpense.isPending;
  const submittingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setAmount(String(editing.amount));
      setDescription(editing.description);
      setCategoryId(editing.category_id ?? "");
      setKind((editing.kind as "variable" | "fixed") ?? "variable");
      setDate(editing.spent_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
      if (editing.kind === "fixed" && editing.spent_at) {
        setFixedDay(String(new Date(editing.spent_at + "T12:00:00").getDate()));
      }
    } else {
      setAmount("");
      setDescription("");
      setCategoryId("");
      setKind("variable");
      setDate("");
      setFixedDay(String(new Date().getDate()));
    }
    submittingRef.current = false;
  }, [editing, open]);

  function buildSpentAt(day: string): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const maxDay = new Date(y, m + 1, 0).getDate();
    const d = Math.min(Math.max(1, Number(day) || 1), maxDay);
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function save() {
    if (submittingRef.current) return;
    if (!amount || Number(amount) <= 0) return;
    submittingRef.current = true;

    const resolvedName =
      description || (categories.find((c) => c.id === categoryId)?.name ?? "Expense");

    if (editing) {
      // Editing an existing expense — always updates the expense record
      updateExpense.mutate(
        {
          id: editing.id,
          payload: {
            amount: Number(amount),
            description: resolvedName,
            kind,
            category_id: categoryId || null,
            spent_at: date || undefined,
          },
        },
        {
          onSuccess: onClose,
          onSettled: () => {
            submittingRef.current = false;
          },
        },
      );
    } else {
      // New expense (fixed or variable)
      addExpense.mutate(
        {
          amount: Number(amount),
          description: resolvedName,
          kind,
          category_id: categoryId || null,
          recurring: kind === "fixed",
          spent_at: kind === "fixed" ? buildSpentAt(fixedDay) : new Date().toISOString().slice(0, 10),
        },
        {
          onSuccess: () => {
            setAmount("");
            setDescription("");
            setCategoryId("");
            setKind("variable");
            onClose();
          },
          onSettled: () => {
            submittingRef.current = false;
          },
        },
      );
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
            {editing ? t("budget.dialog.expense.edit.title") : t("budget.dialog.expense.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="card-sunken p-5 flex items-baseline gap-2">
            <span className="text-xl text-muted-foreground">€</span>
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
          <div className="space-y-1.5">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("budget.dialog.expense.description.placeholder")}
            />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id === categoryId ? "" : c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    categoryId === c.id
                      ? "bg-foreground text-background border-foreground"
                      : "border-border bg-surface hover:border-foreground/20"
                  }`}
                >
                  {CATEGORY_NAME_TO_KEY[c.name] ? t(CATEGORY_NAME_TO_KEY[c.name]) : c.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5 card-flat p-1 rounded-xl">
            {(
              [
                ["variable", t("budget.tab.variable")],
                ["fixed", t("budget.tab.fixed")],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                  kind === k ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Fixed expense — recurring badge + day of month (new entries only) */}
          {kind === "fixed" && !editing && (
            <>
              <div className="rounded-xl bg-positive-soft/30 border border-positive/20 px-4 py-3 flex gap-3 items-start animate-rise">
                <RepeatIcon className="size-4 text-positive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-positive">
                    {t("budget.dialog.expense.fixed.info.title")}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {t("budget.dialog.expense.fixed.info.body")}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 animate-rise">
                <Label className="text-xs text-muted-foreground">
                  {t("budget.dialog.expense.dayofmonth")}
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={fixedDay}
                  onChange={(e) => setFixedDay(e.target.value)}
                  placeholder="1"
                />
              </div>
            </>
          )}

          {/* Date field — editing mode only */}
          {editing && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("budget.dialog.expense.date")}
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="size-4 mr-1" /> {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={isPending} className="flex-1">
              {isPending
                ? t("common.loading")
                : editing
                  ? t("common.save")
                  : kind === "fixed"
                    ? t("budget.dialog.expense.fixed.cta")
                    : t("common.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── IncomeDialog ──────────────────────────────────────────────────────────────

function IncomeDialog({
  open,
  onClose,
  editing,
  t,
}: {
  open: boolean;
  onClose: () => void;
  editing: Income | null;
  t: (k: string) => string;
}) {
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [receivedDay, setReceivedDay] = useState("1");

  const addIncome = useAddIncome();
  const updateIncome = useUpdateIncome();
  const isPending = addIncome.isPending || updateIncome.isPending;
  const submittingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setSource(editing.source);
      setAmount(String(editing.amount));
      setRecurring(editing.recurring);
      if (editing.received_at) {
        setReceivedDay(String(new Date(editing.received_at + "T12:00:00").getDate()));
      } else {
        setReceivedDay("1");
      }
    } else {
      setSource("");
      setAmount("");
      setRecurring(true);
      setReceivedDay("1");
    }
    submittingRef.current = false;
  }, [editing, open]);

  function buildReceivedAt(day: string): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const maxDay = new Date(y, m + 1, 0).getDate();
    const d = Math.min(Math.max(1, Number(day) || 1), maxDay);
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function save() {
    if (submittingRef.current) return;
    if (!source || !amount || Number(amount) <= 0) return;
    submittingRef.current = true;
    const payload = {
      source,
      amount: Number(amount),
      recurring,
      received_at: recurring ? buildReceivedAt(receivedDay) : buildReceivedAt(String(new Date().getDate())),
    };
    const opts = {
      onSuccess: onClose,
      onSettled: () => {
        submittingRef.current = false;
      },
    };

    if (editing) {
      updateIncome.mutate({ id: editing.id, payload }, opts);
    } else {
      addIncome.mutate(payload, opts);
    }
  }

  const presets = ["Salary", "Freelance", "Dividends", "Rental", "Side hustle", "Bonus"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("budget.dialog.income.edit.title") : t("budget.dialog.income.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="card-sunken p-5 flex items-baseline gap-2">
            <span className="text-xl text-muted-foreground">€</span>
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
          <div className="space-y-1.5">
            <Label>{t("budget.dialog.income.source")}</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t("budget.dialog.income.source.placeholder")}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSource(p)}
                  className="px-3 py-1 rounded-full text-[11px] border border-border bg-surface hover:border-foreground/20 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 card-flat p-1 rounded-xl">
            {(
              [
                [true, t("budget.dialog.income.recurring")],
                [false, t("budget.dialog.income.oneoff")],
              ] as const
            ).map(([k, l]) => (
              <button
                key={String(k)}
                onClick={() => setRecurring(k)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                  recurring === k ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {recurring && (
            <div className="space-y-1.5 animate-rise">
              <Label className="text-xs text-muted-foreground">
                {t("budget.dialog.income.dayofmonth")}
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={receivedDay}
                onChange={(e) => setReceivedDay(e.target.value)}
                placeholder="1"
              />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={isPending} className="flex-1">
              {isPending ? t("common.loading") : editing ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SavingsDialog ─────────────────────────────────────────────────────────────

const SAVINGS_TYPES: SavingsAccountType[] = ["checking", "savings", "cash", "emergency", "other"];

function SavingsDialog({
  open,
  onClose,
  editing,
  currency,
  t,
}: {
  open: boolean;
  onClose: () => void;
  editing: SavingsAccount | null;
  currency: string;
  t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SavingsAccountType>("savings");
  const [balance, setBalance] = useState("");
  const [institution, setInstitution] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  const addSavings = useAddSavingsAccount();
  const updateSavings = useUpdateSavingsAccount();
  const isPending = addSavings.isPending || updateSavings.isPending;
  const submittingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setBalance(String(editing.balance));
      setInstitution(editing.institution_name ?? "");
      setIsEmergency(editing.is_emergency_fund);
    } else {
      setName("");
      setType("savings");
      setBalance("");
      setInstitution("");
      setIsEmergency(false);
    }
    submittingRef.current = false;
  }, [editing, open]);

  function save() {
    if (submittingRef.current) return;
    if (!name || !balance || Number(balance) < 0) return;
    submittingRef.current = true;
    const payload = {
      name,
      type,
      balance: Number(balance),
      currency,
      institution_name: institution || null,
      is_emergency_fund: isEmergency,
    };
    const opts = {
      onSuccess: onClose,
      onSettled: () => {
        submittingRef.current = false;
      },
    };
    if (editing) {
      updateSavings.mutate({ id: editing.id, updates: payload }, opts);
    } else {
      addSavings.mutate(payload, opts);
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
            {editing ? t("savings.dialog.edit.title") : t("savings.dialog.add.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="card-sunken p-5 flex items-baseline gap-2">
            <span className="text-xl text-muted-foreground">€</span>
            <Input
              type="number"
              inputMode="decimal"
              autoFocus
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              className="border-0 shadow-none p-0 h-auto text-3xl font-semibold num focus-visible:ring-0 bg-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("savings.field.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("savings.field.name.placeholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("savings.field.type")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {SAVINGS_TYPES.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setType(tp)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    type === tp
                      ? "bg-foreground text-background border-foreground"
                      : "border-border bg-surface hover:border-foreground/20"
                  }`}
                >
                  {t(`savings.type.${tp}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("savings.field.institution")}
            </Label>
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder={t("savings.field.institution.placeholder")}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsEmergency((v) => !v)}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition text-left ${
              isEmergency
                ? "bg-positive-soft border-positive text-positive"
                : "bg-surface border-border text-muted-foreground hover:border-foreground/20"
            }`}
          >
            <ShieldCheck className="size-4 shrink-0" />
            <div>
              <div className="text-xs font-semibold">{t("savings.field.emergency.label")}</div>
              <div className="text-[11px] opacity-70 leading-snug">
                {t("savings.field.emergency.desc")}
              </div>
            </div>
          </button>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="size-4 mr-1" /> {t("common.cancel")}
            </Button>
            <Button
              onClick={save}
              disabled={isPending || !name || Number(balance) < 0}
              className="flex-1"
            >
              {isPending ? t("common.loading") : editing ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Memoized expense row ──────────────────────────────────────────────────────

type ConvertFn = (n: number) => number;

const ExpenseRow = memo(function ExpenseRow({
  expense,
  cat,
  currency,
  convert,
  onEdit,
  onDelete,
  isPendingDelete,
  t,
}: {
  expense: EditableExpense;
  cat: Category | undefined;
  currency: string;
  convert: ConvertFn;
  onEdit: (e: EditableExpense) => void;
  onDelete: (id: string) => void;
  isPendingDelete: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="group flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-9 rounded-xl bg-muted grid place-items-center">
          <CategoryDot color={cat?.color ?? "neutral"} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{expense.description}</div>
          <div className="text-xs text-muted-foreground">
            {cat
              ? CATEGORY_NAME_TO_KEY[cat.name]
                ? t(CATEGORY_NAME_TO_KEY[cat.name])
                : cat.name
              : expense.kind}{" "}
            · {relativeDate(expense.spent_at)}
            {expense.recurring && ` · ${t("budget.expense.recurring")}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold num">−{money(convert(expense.amount), currency)}</div>
        <button
          onClick={() => onEdit(expense)}
          aria-label={t("common.edit")}
          className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={() => onDelete(expense.id)}
          disabled={isPendingDelete}
          aria-label={t("common.delete")}
          className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-negative hover:bg-negative-soft/40 transition"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
});

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function BudgetSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="h-10 w-32 rounded-xl bg-muted animate-pulse" />
      <div className="h-32 rounded-3xl bg-muted animate-pulse" />
      <div className="h-10 rounded-2xl bg-muted animate-pulse" />
      <div className="h-48 rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
