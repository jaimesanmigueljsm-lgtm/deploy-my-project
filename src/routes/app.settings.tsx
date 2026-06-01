import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SectionError } from "@/components/section-error";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  Shield,
  CreditCard,
  Database,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  Sparkles,
  Globe,
  Languages,
  Check,
  TrendingUp,
  Camera,
  AtSign,
  Copy,
  MapPin,
  User,
  Loader2,
  XCircle,
  CheckCircle2,
  CalendarDays,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Timer,
  Fingerprint,
  Clock,
  Tags,
  Trash2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useAppLock } from "@/features/app-lock/use-app-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SectionHeader, CategoryIcon } from "@/components/nest";
import { ICON_PICKER_KEYS } from "@/lib/categories";
import { useT } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/features/profile/use-profile";
import { uploadAvatar, regenerateUsername, type Profile } from "@/features/profile/profile.service";
import { searchUserByUsername } from "@/features/family/family.service";
import { financialUsernameSchema } from "@/schemas/profile.schema";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { SecurityCenter } from "@/features/security/SecurityCenter";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchCategories,
  addCategory,
  deleteCategory,
  resetCategoriesToDefaults,
  type AddCategoryPayload,
  type Category,
} from "@/features/budget/budget.service";
import { CATEGORY_NAME_TO_KEY } from "@/i18n/translations";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
  errorComponent: SectionError,
});

const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "ARS", symbol: "$", name: "Argentine Peso" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
] as const;

const AUTO_LOCK_OPTIONS = [
  { value: -1, labelKey: "settings.appLock.autoLock.immediately" },
  { value: 60_000, labelKey: "settings.appLock.autoLock.1min" },
  { value: 120_000, labelKey: "settings.appLock.autoLock.2min" },
  { value: 300_000, labelKey: "settings.appLock.autoLock.5min" },
  { value: 0, labelKey: "settings.appLock.autoLock.never" },
] as const;

const DEFAULT_CAT_DEFS: { nameKey: string; color: string; kind: "variable" | "fixed"; icon: string }[] = [
  // Fixed
  { nameKey: "fixed.rent",          color: "sky",    kind: "fixed",    icon: "home" },
  { nameKey: "fixed.mortgage",      color: "sky",    kind: "fixed",    icon: "building-2" },
  { nameKey: "fixed.electricity",   color: "warn",   kind: "fixed",    icon: "zap" },
  { nameKey: "fixed.water",         color: "sky",    kind: "fixed",    icon: "droplets" },
  { nameKey: "fixed.gas",           color: "warn",   kind: "fixed",    icon: "flame" },
  { nameKey: "fixed.internet",      color: "sky",    kind: "fixed",    icon: "wifi" },
  { nameKey: "fixed.phone",         color: "mint",   kind: "fixed",    icon: "smartphone" },
  { nameKey: "fixed.gym",           color: "mint",   kind: "fixed",    icon: "dumbbell" },
  { nameKey: "fixed.subscriptions", color: "violet", kind: "fixed",    icon: "repeat" },
  { nameKey: "fixed.insurance",     color: "sky",    kind: "fixed",    icon: "shield" },
  { nameKey: "fixed.transport",     color: "sky",    kind: "fixed",    icon: "bus" },
  { nameKey: "fixed.childcare",     color: "mint",   kind: "fixed",    icon: "baby" },
  // Variable
  { nameKey: "variable.groceries",  color: "mint",   kind: "variable", icon: "shopping-cart" },
  { nameKey: "variable.restaurants",color: "warn",   kind: "variable", icon: "utensils" },
  { nameKey: "variable.transport",  color: "sky",    kind: "variable", icon: "bus" },
  { nameKey: "variable.shopping",   color: "warn",   kind: "variable", icon: "shopping-bag" },
  { nameKey: "variable.health",     color: "mint",   kind: "variable", icon: "heart" },
  { nameKey: "variable.education",  color: "sky",    kind: "variable", icon: "graduation-cap" },
  { nameKey: "variable.leisure",    color: "violet", kind: "variable", icon: "music" },
  { nameKey: "variable.travel",     color: "sky",    kind: "variable", icon: "plane" },
  { nameKey: "variable.beauty",     color: "violet", kind: "variable", icon: "sparkles" },
  { nameKey: "variable.clothing",   color: "warn",   kind: "variable", icon: "shirt" },
  { nameKey: "variable.home",       color: "sky",    kind: "variable", icon: "sofa" },
  { nameKey: "variable.pets",       color: "mint",   kind: "variable", icon: "paw-print" },
  { nameKey: "variable.finance",    color: "violet", kind: "variable", icon: "landmark" },
  { nameKey: "variable.loan",       color: "violet", kind: "variable", icon: "credit-card" },
  { nameKey: "variable.others",     color: "mint",   kind: "variable", icon: "more-horizontal" },
];

const CAT_COLORS = [
  { value: "mint", cls: "bg-positive" },
  { value: "sky", cls: "bg-sky" },
  { value: "warn", cls: "bg-warn" },
  { value: "violet", cls: "bg-violet" },
];

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Settings() {
  const nav = useNavigate();
  const { t, locale, setLocale, locales } = useT();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [openPrivacy, setOpenPrivacy] = useState(false);
  const [openSecurity, setOpenSecurity] = useState(false);
  const [openCategories, setOpenCategories] = useState(false);
  const [openSecurityCenter, setOpenSecurityCenter] = useState(false);
  const { isPinSet, meta, openSetup, updateMeta } = useAppLock();

  function toggleTheme() {
    const next = profile?.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("nest.theme", next);
    } catch {
      /* sandboxed */
    }
    updateProfile.mutate({ theme: next });
  }

  function togglePref(key: string) {
    const cur = (profile?.notification_prefs as Record<string, boolean> | null) ?? {};
    const effective = cur[key] !== false; // undefined defaults to true (on)
    updateProfile.mutate({ notification_prefs: { ...cur, [key]: !effective } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (isLoading || !profile) return <SettingsSkeleton />;

  const email = user?.email ?? "";
  const initials =
    (profile.full_name ?? email)
      .split(/[ @.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join("") || "U";

  const notifPrefs = (profile.notification_prefs as Record<string, boolean> | null) ?? {};
  const currentLocale = locales.find((l) => l.code === locale)!;

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="pt-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {t("settings.account")}
        </p>
        <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("settings.you")}</h1>
      </header>

      {/* Profile card — clickable, opens the Privacy/Profile dialog */}
      <button
        onClick={() => setOpenPrivacy(true)}
        className="card-soft p-5 flex items-center gap-4 w-full text-left hover:bg-muted/30 transition"
      >
        <div className="size-14 rounded-2xl overflow-hidden bg-foreground text-background grid place-items-center text-lg font-semibold shrink-0">
          {profile.avatar_url ? (
            <img
              src={`${profile.avatar_url}?v=${profile.updated_at}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">
            {profile.full_name ?? t("settings.addName")}
          </div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
          {profile.financial_username?.trim() && (
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              @{profile.financial_username}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </button>

      {/* Plan */}
      <div
        className="card-soft p-5 relative overflow-hidden"
        style={{ background: "oklch(0.18 0.02 250)", color: "white" }}
      >
        <div className="absolute top-0 right-0 size-32 gradient-mint opacity-30 rounded-full blur-3xl -translate-y-12 translate-x-8" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-60 font-medium">
              {t("settings.plan")}
            </p>
            <div className="text-lg font-semibold mt-0.5 text-white">NOOLY Premium</div>
            <p className="text-xs opacity-80 mt-1 text-white">
              Unlimited insights · Family · Investments
            </p>
          </div>
          <Sparkles className="size-6 opacity-90 text-white" />
        </div>
      </div>

      {/* Preferences */}
      <section>
        <SectionHeader title={t("settings.preferences")} />
        <div className="card-flat divide-y divide-border-subtle">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground">
                    <Languages className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{t("settings.language")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{currentLocale.flag}</span>
                  <span className="text-xs text-muted-foreground">{currentLocale.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {locales.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLocale(l.code)} className="gap-2">
                  <span className="text-base">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {l.code === locale && <Check className="size-4 opacity-70" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground">
                    <Globe className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{t("settings.currency")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-mono">
                    {CURRENCIES.find((c) => c.code === profile.currency)?.symbol ?? ""}{" "}
                    {profile.currency}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px] max-h-72 overflow-y-auto">
              {CURRENCIES.map((c) => (
                <DropdownMenuItem
                  key={c.code}
                  onClick={() => updateProfile.mutate({ currency: c.code })}
                  className="gap-3"
                >
                  <span className="w-6 text-right text-sm font-mono shrink-0">{c.symbol}</span>
                  <span className="flex-1 text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.code}</span>
                  {c.code === profile.currency && <Check className="size-4 opacity-70 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
            {t("settings.currency.warning")}
          </p>
          <RowToggle
            icon={
              profile.theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />
            }
            label={t("settings.darkMode")}
            value={profile.theme === "dark"}
            onChange={toggleTheme}
          />
          <RowToggle
            icon={<TrendingUp className="size-4" />}
            label={t("settings.investmentMode")}
            desc={t("settings.investmentMode.desc")}
            value={!!(notifPrefs as Record<string, boolean>).investment_mode}
            onChange={() => {}}
            badge="Coming soon"
          />
          <Row
            icon={<Tags className="size-4" />}
            label={t("settings.categories")}
            onClick={() => setOpenCategories(true)}
          />
        </div>
      </section>

      {/* Notifications */}
      <section>
        <SectionHeader title={t("settings.notifications")} />
        <div className="card-flat divide-y divide-border-subtle">
          <RowToggle
            icon={<Bell className="size-4" />}
            label={t("settings.alerts")}
            value={notifPrefs.alerts ?? true}
            onChange={() => togglePref("alerts")}
          />
          <RowToggle
            icon={<CalendarDays className="size-4" />}
            label={t("settings.monthly")}
            desc={t("settings.monthly.desc")}
            value={notifPrefs.monthly ?? true}
            onChange={() => togglePref("monthly")}
          />
          <RowToggle
            icon={<Sparkles className="size-4" />}
            label={t("settings.aiInsights")}
            value={notifPrefs.insights ?? true}
            onChange={() => togglePref("insights")}
          />
        </div>
      </section>

      {/* App protection */}
      <section>
        <SectionHeader title={t("settings.appProtection")} />
        <div className="card-flat divide-y divide-border-subtle">
          {/* PIN row */}
          <Row
            icon={<Lock className="size-4" />}
            label={t("settings.appLock.pin")}
            value={isPinSet ? t("settings.appLock.pin.change") : t("settings.appLock.pin.notSet")}
            onClick={() => openSetup(isPinSet ? "change" : "setup")}
          />

          {/* Auto-lock — only meaningful when PIN is set */}
          {isPinSet && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition text-left">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground">
                      <Timer className="size-4" />
                    </div>
                    <span className="text-sm font-medium">{t("settings.appLock.autoLock")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {t(
                        AUTO_LOCK_OPTIONS.find((o) => o.value === meta.autoLockMs)?.labelKey ??
                          "settings.appLock.autoLock.2min",
                      )}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {AUTO_LOCK_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => updateMeta({ autoLockMs: opt.value })}
                    className="gap-2"
                  >
                    <span className="flex-1">{t(opt.labelKey)}</span>
                    {meta.autoLockMs === opt.value && <Check className="size-4 opacity-70" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Hide balances */}
          <RowToggle
            icon={<EyeOff className="size-4" />}
            label={t("settings.appLock.hideBalances")}
            desc={t("settings.appLock.hideBalances.desc")}
            value={meta.hideBalances}
            onChange={() => updateMeta({ hideBalances: !meta.hideBalances })}
          />

          {/* Biometric — coming soon */}
          <RowToggle
            icon={<Fingerprint className="size-4" />}
            label={t("settings.appLock.biometric")}
            value={meta.biometricEnabled}
            onChange={() => {}}
            badge="Coming soon"
          />

          {/* Last session */}
          {isPinSet && meta.lastActiveAt > 0 && (
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="size-8 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0">
                <Clock className="size-4" />
              </div>
              <div>
                <span className="text-sm text-muted-foreground">
                  {t("settings.appLock.lastUnlock")}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {relativeTime(meta.lastActiveAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Security & data */}
      <section>
        <SectionHeader title={t("settings.security")} />
        <div className="card-flat divide-y divide-border-subtle">
          <Row
            icon={<Shield className="size-4" />}
            label="Security Center"
            value="Devices · Activity"
            onClick={() => setOpenSecurityCenter(true)}
          />
          <Row
            icon={<KeyRound className="size-4" />}
            label={t("settings.security.label")}
            value="Email & password"
            onClick={() => setOpenSecurity(true)}
          />
          <Row
            icon={<CreditCard className="size-4" />}
            label={t("settings.bankConnections")}
            value="Coming soon"
            onClick={() => toast("Bank connections coming soon")}
          />
          <Row
            icon={<Database className="size-4" />}
            label={t("settings.privacy")}
            value={t("settings.privacy.value")}
            onClick={() => setOpenPrivacy(true)}
          />
        </div>
      </section>

      <Button variant="outline" onClick={signOut} className="w-full h-12 rounded-2xl">
        <LogOut className="size-4 mr-2" /> {t("settings.signOut")}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        NOOLY · v0.1.0-beta · Closed beta
      </p>

      <ProfileEditDialog
        open={openPrivacy}
        onClose={() => setOpenPrivacy(false)}
        profile={profile}
        userId={user?.id ?? ""}
        t={t}
      />
      <SecurityDialog
        open={openSecurity}
        onClose={() => setOpenSecurity(false)}
        currentEmail={user?.email ?? ""}
      />
      <CategoriesDialog
        open={openCategories}
        onClose={() => setOpenCategories(false)}
        userId={user?.id ?? ""}
      />

      {/* Security Center dialog */}
      <Dialog
        open={openSecurityCenter}
        onOpenChange={(v) => {
          if (!v) setOpenSecurityCenter(false);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-4" /> Security Center
            </DialogTitle>
          </DialogHeader>
          <SecurityCenter uid={user?.id ?? ""} isPinSet={isPinSet} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CategoriesDialog ─────────────────────────────────────────────────────────

function CategoriesDialog({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  const { t } = useT();
  const qc = useQueryClient();

  const { data: cats = [], isLoading } = useQuery({
    queryKey: queryKeys.categories(userId),
    queryFn: () => fetchCategories(userId),
    enabled: open && !!userId,
  });

  const [addSection, setAddSection] = useState<"variable" | "fixed" | null>(null);
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState("mint");
  const [addIcon, setAddIcon] = useState("tag");
  const [confirmReset, setConfirmReset] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.categories(userId) });

  const addMut = useMutation({
    mutationFn: (payload: AddCategoryPayload) => addCategory(userId, payload),
    onSuccess: () => {
      invalidate();
      setAddSection(null);
      setAddName("");
    },
    onError: (err: Error) =>
      toast.error(
        err.message === "already_exists" ? t("settings.categories.error.duplicate") : err.message,
      ),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMut = useMutation({
    mutationFn: (rows: AddCategoryPayload[]) => resetCategoriesToDefaults(userId, rows),
    onSuccess: () => {
      invalidate();
      setConfirmReset(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openAdd(section: "variable" | "fixed") {
    setAddSection(section);
    setAddName("");
    setAddColor("mint");
    setAddIcon("tag");
  }

  function saveAdd() {
    if (!addName.trim() || !addSection) return;
    addMut.mutate({ name: addName.trim(), color: addColor, kind: addSection, icon: addIcon });
  }

  function doReset() {
    const rows = DEFAULT_CAT_DEFS.map((d) => ({
      name: t(d.nameKey),
      color: d.color,
      kind: d.kind,
      icon: d.icon,
    }));
    resetMut.mutate(rows);
  }

  function handleClose() {
    onClose();
    setConfirmReset(false);
    setAddSection(null);
  }

  const variable = cats.filter((c) => c.kind === "variable");
  const fixed = cats.filter((c) => c.kind === "fixed");

  function renderSection(items: Category[], section: "variable" | "fixed") {
    const label =
      section === "variable"
        ? t("settings.categories.section.variable")
        : t("settings.categories.section.fixed");
    return (
      <div className="space-y-0.5">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-1 pb-1">
          {label}
        </p>
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-2 py-2.5 rounded-xl hover:bg-muted/40 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CategoryIcon iconKey={c.icon} color={c.color} size="sm" />
              <span className="text-sm truncate">
                {CATEGORY_NAME_TO_KEY[c.name] ? t(CATEGORY_NAME_TO_KEY[c.name]) : c.name}
              </span>
            </div>
            <button
              onClick={() => deleteMut.mutate(c.id)}
              disabled={deleteMut.isPending}
              className="shrink-0 p-1.5 text-muted-foreground hover:text-negative transition rounded-lg"
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {addSection === section ? (
          <div className="mt-2 p-3 rounded-xl bg-muted/50 space-y-3">
            <input
              autoFocus
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={t("settings.categories.add.placeholder")}
              className="w-full bg-transparent text-sm outline-none border-b border-border pb-1.5"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveAdd();
                if (e.key === "Escape") setAddSection(null);
              }}
            />
            {/* Icon picker */}
            <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto">
              {ICON_PICKER_KEYS.map((iconKey) => (
                <button
                  key={iconKey}
                  type="button"
                  onClick={() => setAddIcon(iconKey)}
                  className={`rounded-lg transition ${
                    addIcon === iconKey ? "ring-2 ring-offset-1 ring-foreground scale-105" : "opacity-40 hover:opacity-80"
                  }`}
                >
                  <CategoryIcon iconKey={iconKey} color={addColor} size="sm" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {CAT_COLORS.map((cl) => (
                <button
                  key={cl.value}
                  onClick={() => setAddColor(cl.value)}
                  className={`size-5 rounded-full ${cl.cls} transition-all ${
                    addColor === cl.value
                      ? "ring-2 ring-offset-1 ring-foreground scale-110"
                      : "opacity-50"
                  }`}
                />
              ))}
              <div className="flex-1" />
              <button
                onClick={() => setAddSection(null)}
                className="text-xs text-muted-foreground px-2 py-1"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={saveAdd}
                disabled={!addName.trim() || addMut.isPending}
                className="text-xs font-medium px-3 py-1 rounded-lg bg-foreground text-background disabled:opacity-50 transition"
              >
                {addMut.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  t("settings.categories.save")
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => openAdd(section)}
            className="w-full text-left px-2 py-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition"
          >
            <Plus className="size-3.5" />
            {t("settings.categories.add")}
          </button>
        )}
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="rounded-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="size-4" /> {t("settings.categories.title")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {renderSection(variable, "variable")}
            <div className="border-t border-border-subtle" />
            {renderSection(fixed, "fixed")}
          </div>
        )}

        <div className="pt-3 border-t border-border-subtle">
          {confirmReset ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-snug">
                {t("settings.categories.reset.confirm")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-xs"
                  onClick={() => setConfirmReset(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  className="flex-1 h-9 text-xs bg-negative hover:bg-negative/90 text-white"
                  disabled={resetMut.isPending}
                  onClick={doReset}
                >
                  {resetMut.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    t("settings.categories.reset")
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full text-xs text-muted-foreground hover:text-negative transition flex items-center justify-center gap-1.5 py-2"
            >
              <RotateCcw className="size-3.5" />
              {t("settings.categories.reset")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SecurityDialog ───────────────────────────────────────────────────────────

function SecurityDialog({
  open,
  onClose,
  currentEmail,
}: {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
}) {
  const { t } = useT();
  const [tab, setTab] = useState<"reset" | "password">("reset");

  // Reset link
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdDone, setPwdDone] = useState(false);

  useEffect(() => {
    if (open) {
      setResetSent(false);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdDone(false);
    }
  }, [open]);

  async function sendResetLink() {
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResetLoading(false);
    }
  }

  async function changePassword() {
    if (!currentPwd) return;
    if (newPwd.length < 8 || newPwd !== confirmPwd) return;
    setPwdLoading(true);
    try {
      // Re-authenticate with current password before allowing the change
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPwd,
      });
      if (authError) {
        toast.error(t("settings.security.password.wrongCurrent"));
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdDone(true);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPwdLoading(false);
    }
  }

  const strength =
    newPwd.length === 0
      ? null
      : newPwd.length < 8
        ? "weak"
        : newPwd.length < 12
          ? "good"
          : "strong";
  const strengthColor =
    strength === "weak" ? "bg-negative" : strength === "good" ? "bg-warn" : "bg-positive";
  const strengthBars = strength === "weak" ? 1 : strength === "good" ? 2 : 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="rounded-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> {t("settings.security.label")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current account */}
          <div className="p-4 rounded-2xl bg-muted/50 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-foreground/10 grid place-items-center shrink-0">
              <Shield className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">
                {t("settings.security.dialog.signedIn")}
              </p>
              <p className="text-sm font-medium truncate">{currentEmail}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted">
            {(["reset", "password"] as const).map((tab_) => (
              <button
                key={tab_}
                onClick={() => setTab(tab_)}
                className={`py-2 text-sm font-medium rounded-lg transition ${
                  tab === tab_
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab_ === "reset"
                  ? t("settings.security.tab.reset")
                  : t("settings.security.tab.password")}
              </button>
            ))}
          </div>

          {/* Reset link tab */}
          {tab === "reset" &&
            (resetSent ? (
              <div className="text-center py-8 space-y-3">
                <div className="size-14 rounded-full bg-positive/10 grid place-items-center mx-auto">
                  <CheckCircle2 className="size-7 text-positive" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("settings.security.reset.sent.title")}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t("settings.security.reset.sent.desc", { email: currentEmail })}
                  </p>
                </div>
                <button
                  onClick={() => setResetSent(false)}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  {t("settings.security.reset.retry")}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-snug">
                  {t("settings.security.reset.desc")}
                </p>
                <Button
                  onClick={() => void sendResetLink()}
                  disabled={resetLoading}
                  className="w-full"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />{" "}
                      {t("settings.security.reset.sending")}
                    </>
                  ) : (
                    t("settings.security.reset.button")
                  )}
                </Button>
              </div>
            ))}

          {/* Password tab */}
          {tab === "password" &&
            (pwdDone ? (
              <div className="text-center py-8 space-y-3">
                <div className="size-14 rounded-full bg-positive/10 grid place-items-center mx-auto">
                  <CheckCircle2 className="size-7 text-positive" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {t("settings.security.password.done.title")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("settings.security.password.done.desc")}
                  </p>
                </div>
                <button
                  onClick={() => setPwdDone(false)}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  {t("settings.security.password.changeAgain")}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Current password — required to confirm identity */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("settings.security.password.current")}</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPwd ? "text" : "password"}
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder={t("settings.security.password.current.placeholder")}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCurrentPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showCurrentPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border-subtle" />

                <div className="space-y-1.5">
                  <Label className="text-xs">{t("settings.security.password.label")}</Label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder={t("settings.security.password.placeholder")}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {strength && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className={`h-1 flex-1 rounded-full transition-colors ${n <= strengthBars ? strengthColor : "bg-muted"}`}
                          />
                        ))}
                      </div>
                      <span
                        className={`text-[10px] font-medium capitalize ${
                          strength === "weak"
                            ? "text-negative"
                            : strength === "good"
                              ? "text-warn"
                              : "text-positive"
                        }`}
                      >
                        {strength}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t("settings.security.password.confirm")}</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void changePassword();
                      }}
                      placeholder={t("settings.security.password.repeat")}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {confirmPwd && newPwd !== confirmPwd && (
                    <p className="text-[11px] text-negative flex items-center gap-1">
                      <XCircle className="size-3" /> {t("settings.security.password.noMatch")}
                    </p>
                  )}
                  {confirmPwd && newPwd === confirmPwd && newPwd.length >= 8 && (
                    <p className="text-[11px] text-positive flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> {t("settings.security.password.match")}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => void changePassword()}
                  disabled={
                    pwdLoading ||
                    !currentPwd ||
                    !newPwd ||
                    !confirmPwd ||
                    newPwd !== confirmPwd ||
                    newPwd.length < 8
                  }
                  className="w-full"
                >
                  {pwdLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />{" "}
                      {t("settings.security.password.saving")}
                    </>
                  ) : (
                    t("settings.security.password.button")
                  )}
                </Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ProfileEditDialog ────────────────────────────────────────────────────────

type UsernameStatus = "idle" | "own" | "checking" | "available" | "taken" | "invalid";

function ProfileEditDialog({
  open,
  onClose,
  profile,
  userId,
  t,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  userId: string;
  t: (k: string) => string;
}) {
  const updateProfile = useUpdateProfile();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName1, setLastName1] = useState("");
  const [lastName2, setLastName2] = useState("");
  const [address, setAddress] = useState("");
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localUsername, setLocalUsername] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  // Pre-fill all fields when dialog opens
  useEffect(() => {
    if (open) {
      setFirstName(profile.first_name ?? "");
      setLastName1(profile.last_name_1 ?? "");
      setLastName2(profile.last_name_2 ?? "");
      setAddress(profile.address ?? "");
      setLocalAvatar(profile.avatar_url ?? null);
      setLocalUsername(profile.financial_username ?? "");
      setUsernameStatus(profile.financial_username?.trim() ? "own" : "idle");
    }
  }, [open, profile]);

  // Debounced uniqueness check whenever localUsername changes
  useEffect(() => {
    const normalised = localUsername.trim().toLowerCase().replace(/^@/, "");
    const current = (profile.financial_username ?? "").trim();

    if (!normalised) {
      setUsernameStatus("idle");
      return;
    }
    if (normalised === current) {
      setUsernameStatus("own");
      return;
    }

    const fmtCheck = financialUsernameSchema.safeParse(normalised);
    if (!fmtCheck.success) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const found = await searchUserByUsername(normalised);
        setUsernameStatus(!found || found.id === userId ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [localUsername, profile.financial_username, userId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(userId, file);
      setLocalAvatar(`${url}?t=${Date.now()}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save() {
    const trimFirst = firstName.trim();
    const trimLast1 = lastName1.trim();
    if (!trimFirst || !trimLast1) return;

    const avatarBase = localAvatar?.split("?")[0] ?? profile.avatar_url ?? undefined;
    const normUsername = localUsername.trim().toLowerCase().replace(/^@/, "");
    const usernameChanged = normUsername !== (profile.financial_username ?? "").trim();
    const includeUsername = usernameChanged && usernameStatus === "available" && !!normUsername;

    try {
      await updateProfile.mutateAsync({
        first_name: trimFirst,
        last_name_1: trimLast1,
        last_name_2: lastName2.trim() || null,
        full_name: [trimFirst, trimLast1, lastName2.trim()].filter(Boolean).join(" "),
        address: address.trim() || null,
        ...(avatarBase ? { avatar_url: avatarBase } : {}),
        ...(includeUsername ? { financial_username: normUsername } : {}),
      });

      // Auto-generate username if still empty after save
      if (!profile.financial_username?.trim() && !includeUsername) {
        try {
          await regenerateUsername();
          await qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        } catch {
          /* non-critical */
        }
      }

      onClose();
    } catch {
      /* toast shown by useUpdateProfile */
    }
  }

  const initials =
    [firstName[0], lastName1[0]]
      .filter(Boolean)
      .map((s) => s.toUpperCase())
      .join("") || "U";

  function copyUsername() {
    void navigator.clipboard.writeText(`@${localUsername}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const saveBlocked =
    usernameStatus === "taken" || usernameStatus === "checking" || usernameStatus === "invalid";

  const UsernameIcon = () => {
    if (usernameStatus === "checking")
      return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
    if (usernameStatus === "taken") return <XCircle className="size-3.5 text-negative" />;
    if (usernameStatus === "available") return <CheckCircle2 className="size-3.5 text-positive" />;
    if (usernameStatus === "own") return <Copy className="size-3.5" />;
    return null;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="rounded-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("settings.privacy.dialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative group focus:outline-none"
            >
              <div className="size-20 rounded-full overflow-hidden bg-foreground text-background grid place-items-center text-2xl font-semibold">
                {localAvatar ? (
                  <img src={localAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center pointer-events-none">
                <Camera className="size-5 text-white" />
              </div>
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/60 grid place-items-center">
                  <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
            <p className="text-[11px] text-muted-foreground">{t("settings.privacy.photo.hint")}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <User className="size-3 text-muted-foreground" />
                {t("settings.privacy.firstName")}
              </Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoCapitalize="words"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("settings.privacy.lastName1")}</Label>
              <Input
                value={lastName1}
                onChange={(e) => setLastName1(e.target.value)}
                autoCapitalize="words"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("settings.privacy.lastName2")}
            </Label>
            <Input
              value={lastName2}
              onChange={(e) => setLastName2(e.target.value)}
              placeholder={t("settings.privacy.lastName2.placeholder")}
              autoCapitalize="words"
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="size-3 text-muted-foreground" />
              {t("settings.privacy.address")}
            </Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("settings.privacy.address.placeholder")}
            />
          </div>

          {/* Username — editable with availability check */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <AtSign className="size-3 text-muted-foreground" />
              {t("settings.privacy.username")}
            </Label>
            <div
              className={`flex items-center gap-2 px-3 rounded-xl border transition ${
                usernameStatus === "taken"
                  ? "border-negative bg-negative/5"
                  : usernameStatus === "invalid"
                    ? "border-warn/60 bg-warn/5"
                    : usernameStatus === "available"
                      ? "border-positive/60 bg-positive/5"
                      : "border-input bg-background"
              }`}
            >
              <span className="text-sm text-muted-foreground font-mono shrink-0">@</span>
              <input
                value={localUsername.replace(/^@/, "")}
                onChange={(e) =>
                  setLocalUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))
                }
                placeholder={t("settings.privacy.username.placeholder")}
                className="flex-1 py-2.5 text-sm font-mono bg-transparent outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                onClick={usernameStatus === "own" ? copyUsername : undefined}
                className="shrink-0 text-muted-foreground hover:text-foreground transition"
                tabIndex={-1}
              >
                {usernameStatus === "own" && copied ? (
                  <Check className="size-3.5 text-positive" />
                ) : (
                  <UsernameIcon />
                )}
              </button>
            </div>
            <p
              className={`text-[11px] leading-snug ${
                usernameStatus === "taken"
                  ? "text-negative"
                  : usernameStatus === "invalid"
                    ? "text-warn"
                    : usernameStatus === "available"
                      ? "text-positive"
                      : "text-muted-foreground"
              }`}
            >
              {usernameStatus === "taken"
                ? t("settings.privacy.username.taken")
                : usernameStatus === "invalid"
                  ? t("settings.privacy.username.invalid")
                  : usernameStatus === "available"
                    ? t("settings.privacy.username.available")
                    : usernameStatus === "idle"
                      ? t("settings.privacy.username.pending")
                      : t("settings.privacy.username.note")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void save()}
              disabled={
                updateProfile.isPending ||
                uploading ||
                !firstName.trim() ||
                !lastName1.trim() ||
                saveBlocked
              }
              className="flex-1"
            >
              {updateProfile.isPending ? t("settings.privacy.saving") : t("settings.privacy.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition text-left"
    >
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground">
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  );
}

function RowToggle({
  icon,
  label,
  desc,
  value,
  onChange,
  badge,
}: {
  icon: ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onChange: () => void;
  badge?: string;
}) {
  return (
    <div className="w-full flex items-center justify-between px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {badge && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/30">
                {badge}
              </span>
            )}
          </div>
          {desc && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</p>}
        </div>
      </div>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        disabled={!!badge}
        className={badge ? "opacity-40" : ""}
      />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="h-10 w-32 rounded-xl bg-muted animate-pulse" />
      <div className="h-20 rounded-2xl bg-muted animate-pulse" />
      <div className="h-32 rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
