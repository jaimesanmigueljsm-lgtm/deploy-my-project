import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { money, monthLabel, monthRange, relativeDate } from "@/lib/format";
import { Plus, Receipt, X, Trash2, Filter, TrendingUp, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionHeader, EmptyState, CategoryDot } from "@/components/nest";
import { useBudgetData, useAddIncome, useUpdateIncome, useDeleteIncome } from "@/features/budget/use-budget";
import { useAddExpense, useDeleteExpense } from "@/features/expenses/use-expenses";
import { useT } from "@/i18n";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/budget")({
  component: Budget,
  validateSearch: (search: Record<string, unknown>) => ({
    add: search.add === "expense" || search.add === "income" ? (search.add as "expense" | "income") : undefined,
  }),
});

type Category = Pick<Tables<"categories">, "id" | "name" | "color" | "kind">;
type Income    = Pick<Tables<"incomes">, "id" | "source" | "amount" | "recurring" | "received_at">;

type Tab = "all" | "fixed" | "variable" | "income";

function Budget() {
  const { t } = useT();
  const range = useMemo(() => monthRange(), []);

  const { expenses, categories, incomes, currency, isLoading } = useBudgetData(
    range.start,
    range.end,
  );

  const deleteExpense = useDeleteExpense();
  const deleteIncome  = useDeleteIncome();

  const [tab, setTab]               = useState<Tab>("all");
  const [open, setOpen]             = useState(false);
  const [openIncome, setOpenIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  // Open dialog when navigated with ?add=expense | ?add=income
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (search.add === "expense") { setOpen(true); navigate({ to: "/app/budget", search: {}, replace: true }); }
    if (search.add === "income")  { setEditingIncome(null); setOpenIncome(true); navigate({ to: "/app/budget", search: {}, replace: true }); }
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

  const filtered = useMemo(() => {
    if (tab === "fixed")    return expenses.filter((e) => e.kind === "fixed");
    if (tab === "variable") return expenses.filter((e) => e.kind === "variable");
    return expenses;
  }, [tab, expenses]);

  const { totalSpent, totalFixed, totalVariable } = useMemo(() => ({
    totalSpent:    expenses.reduce((s, e) => s + e.amount, 0),
    totalFixed:    expenses.filter((e) => e.kind === "fixed").reduce((s, e) => s + e.amount, 0),
    totalVariable: expenses.filter((e) => e.kind === "variable").reduce((s, e) => s + e.amount, 0),
  }), [expenses]);

  const { totalIncome, recurringIncome } = useMemo(() => ({
    totalIncome:     incomes.reduce((s, i) => s + i.amount, 0),
    recurringIncome: incomes.filter((i) => i.recurring).reduce((s, i) => s + i.amount, 0),
  }), [incomes]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number; count: number }>();
    for (const e of expenses.filter((x) => tab === "all" || x.kind === tab)) {
      const cat = dedupedCategories.find((c) => c.id === e.category_id);
      // Group by name to merge duplicate categories into one row
      const key = cat?.name.trim().toLowerCase() ?? "_uncat";
      const cur = map.get(key) ?? { name: cat?.name ?? "Uncategorized", color: cat?.color ?? "neutral", total: 0, count: 0 };
      cur.total += e.amount;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses, dedupedCategories, tab]);

  if (isLoading) return <BudgetSkeleton />;

  const tabs: [Tab, string][] = [
    ["all",      t("budget.tab.all")],
    ["fixed",    t("budget.tab.fixed")],
    ["variable", t("budget.tab.variable")],
    ["income",   t("budget.tab.income")],
  ];

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{monthLabel()}</p>
          <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("budget.title")}</h1>
        </div>
        <button onClick={() => setOpen(true)} className="size-10 rounded-full bg-foreground text-background grid place-items-center">
          <Plus className="size-4" />
        </button>
      </header>

      {/* Summary card */}
      <div className="card-soft p-5 gradient-hero">
        <p className="text-xs text-muted-foreground">{t("budget.summary.spent")}</p>
        <div className="num-display text-[40px] font-semibold mt-0.5">{money(totalSpent, currency)}</div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
          <Stat label={t("budget.summary.fixed")}    value={money(totalFixed, currency)} />
          <Stat label={t("budget.summary.variable")} value={money(totalVariable, currency)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 card-flat p-1 rounded-xl">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
              tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Income tab ────────────────────────────────────────────────────────── */}
      {tab === "income" ? (
        <>
          <div className="card-soft p-5 gradient-mint">
            <p className="text-xs text-muted-foreground">{t("budget.income.total")}</p>
            <div className="num-display text-[40px] font-semibold mt-0.5">{money(totalIncome, currency)}</div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
              <Stat label={t("budget.income.recurring")} value={money(recurringIncome, currency)} />
              <Stat label={t("budget.income.sources")}   value={`${incomes.length}`} />
            </div>
          </div>
          <section>
            <SectionHeader
              title={t("budget.section.income")}
              action={
                <button
                  onClick={() => { setEditingIncome(null); setOpenIncome(true); }}
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
                  <Button size="sm" onClick={() => { setEditingIncome(null); setOpenIncome(true); }}>
                    {t("budget.add.income")}
                  </Button>
                }
              />
            ) : (
              <div className="card-flat divide-y divide-border-subtle">
                {incomes.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => { setEditingIncome(i); setOpenIncome(true); }}
                    className="group w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-xl bg-positive-soft text-positive grid place-items-center shrink-0">
                        <TrendingUp className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{i.source}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.recurring ? t("budget.income.recurringLabel") : relativeDate(i.received_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold num text-positive">+{money(i.amount, currency)}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteIncome.mutate(i.id); }}
                        disabled={deleteIncome.isPending}
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>

      /* ── Expense tabs (all / fixed / variable) ──────────────────────────────── */
      ) : (
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
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground">· {c.count}</span>
                      </div>
                      <div className="text-sm font-semibold num">{money(c.total, currency)}</div>
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
                {filtered.map((e) => {
                  const cat = categories.find((c) => c.id === e.category_id);
                  return (
                    <div key={e.id} className="group flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-xl bg-muted grid place-items-center">
                          <CategoryDot color={cat?.color ?? "neutral"} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{e.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {cat?.name ?? e.kind} · {relativeDate(e.spent_at)}
                            {e.recurring && ` · ${t("budget.expense.recurring")}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold num">−{money(e.amount, currency)}</div>
                        <button
                          onClick={() => deleteExpense.mutate(e.id)}
                          disabled={deleteExpense.isPending}
                          className="text-muted-foreground opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <ExpenseDialog open={open} onClose={() => setOpen(false)} categories={categories} t={t} />
      <IncomeDialog
        open={openIncome}
        onClose={() => { setOpenIncome(false); setEditingIncome(null); }}
        editing={editingIncome}
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
  open, onClose, categories, t,
}: {
  open: boolean; onClose: () => void; categories: Category[]; t: (k: string) => string;
}) {
  const [amount, setAmount]           = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId]   = useState<string>("");
  const [kind, setKind]               = useState<"variable" | "fixed">("variable");

  const addExpense = useAddExpense();
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setAmount(""); setDescription(""); setCategoryId(""); setKind("variable");
      submittingRef.current = false;
    }
  }, [open]);

  function save() {
    if (submittingRef.current) return;
    if (!amount || Number(amount) <= 0) return;
    submittingRef.current = true;
    addExpense.mutate(
      {
        amount: Number(amount),
        description: description || (categories.find((c) => c.id === categoryId)?.name ?? "Expense"),
        kind,
        category_id: categoryId || null,
        recurring: kind === "fixed",
      },
      {
        onSuccess: () => {
          setAmount(""); setDescription(""); setCategoryId(""); setKind("variable");
          onClose();
        },
        onSettled: () => {
          submittingRef.current = false;
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>{t("budget.dialog.expense.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="card-sunken p-5 flex items-baseline gap-2">
            <span className="text-xl text-muted-foreground">€</span>
            <Input
              type="number" inputMode="decimal" autoFocus value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0"
              className="border-0 shadow-none p-0 h-auto text-3xl font-semibold num focus-visible:ring-0 bg-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Coffee, taxi…" />
          </div>
          {categories.length > 0 && (
            <div className="space-y-1.5">
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
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-1.5 card-flat p-1 rounded-xl">
            {([["variable", t("budget.tab.variable")], ["fixed", t("budget.tab.fixed")]] as const).map(([k, l]) => (
              <button
                key={k} onClick={() => setKind(k)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                  kind === k ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="size-4 mr-1" /> {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={addExpense.isPending} className="flex-1">
              {addExpense.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── IncomeDialog ──────────────────────────────────────────────────────────────

function IncomeDialog({
  open, onClose, editing, t,
}: {
  open: boolean; onClose: () => void; editing: Income | null; t: (k: string) => string;
}) {
  const [source, setSource]       = useState("");
  const [amount, setAmount]       = useState("");
  const [recurring, setRecurring] = useState(true);

  const addIncome    = useAddIncome();
  const updateIncome = useUpdateIncome();
  const isPending    = addIncome.isPending || updateIncome.isPending;
  const submittingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setSource(editing.source);
      setAmount(String(editing.amount));
      setRecurring(editing.recurring);
    } else {
      setSource(""); setAmount(""); setRecurring(true);
    }
    submittingRef.current = false;
  }, [editing, open]);

  function save() {
    if (submittingRef.current) return;
    if (!source || !amount || Number(amount) <= 0) return;
    submittingRef.current = true;
    const payload = { source, amount: Number(amount), recurring };
    const opts = {
      onSuccess: onClose,
      onSettled: () => { submittingRef.current = false; },
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
              type="number" inputMode="decimal" autoFocus value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0"
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
                  key={p} type="button" onClick={() => setSource(p)}
                  className="px-3 py-1 rounded-full text-[11px] border border-border bg-surface hover:border-foreground/20 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 card-flat p-1 rounded-xl">
            {([[true, t("budget.dialog.income.recurring")], [false, "One-off"]] as const).map(([k, l]) => (
              <button
                key={String(k)} onClick={() => setRecurring(k)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
                  recurring === k ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">{t("common.cancel")}</Button>
            <Button onClick={save} disabled={isPending} className="flex-1">
              {isPending ? t("common.loading") : editing ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
