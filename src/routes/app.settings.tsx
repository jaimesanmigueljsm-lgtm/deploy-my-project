import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Shield, CreditCard, Database, Moon, Sun, LogOut, ChevronRight,
  Sparkles, Globe, Download, Languages, Check, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SectionHeader } from "@/components/nest";
import { useT } from "@/i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/features/profile/use-profile";
import { useExportData } from "@/features/settings/use-settings";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  const nav = useNavigate();
  const { t, locale, setLocale, locales } = useT();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const exportData    = useExportData();

  function toggleTheme() {
    const next = profile?.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("nest.theme", next); } catch { /* sandboxed */ }
    updateProfile.mutate({ theme: next });
  }

  function togglePref(key: string) {
    const cur = (profile?.notification_prefs as Record<string, boolean> | null) ?? {};
    updateProfile.mutate({ notification_prefs: { ...cur, [key]: !cur[key] } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (isLoading || !profile) return <SettingsSkeleton />;

  const email     = user?.email ?? "";
  const initials  = (profile.full_name ?? email)
    .split(/[ @.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";

  const notifPrefs    = (profile.notification_prefs as Record<string, boolean> | null) ?? {};
  const currentLocale = locales.find((l) => l.code === locale)!;

  return (
    <div className="px-4 pt-5 space-y-4 animate-rise">
      <header className="pt-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t("settings.account")}</p>
        <h1 className="text-[22px] font-semibold mt-0.5 tracking-tight">{t("settings.you")}</h1>
      </header>

      {/* Profile card */}
      <div className="card-soft p-5 flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-foreground text-background grid place-items-center text-lg font-semibold">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold truncate">{profile.full_name ?? t("settings.addName")}</div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
        </div>
      </div>

      {/* Plan */}
      <div className="card-soft p-5 relative overflow-hidden" style={{ background: "oklch(0.18 0.02 250)", color: "white" }}>
        <div className="absolute top-0 right-0 size-32 gradient-mint opacity-30 rounded-full blur-3xl -translate-y-12 translate-x-8" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-60 font-medium">{t("settings.plan")}</p>
            <div className="text-lg font-semibold mt-0.5 text-white">Nest Premium</div>
            <p className="text-xs opacity-80 mt-1 text-white">Unlimited insights · Family · Investments</p>
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
          <Row
            icon={<Globe className="size-4" />}
            label={t("settings.currency")}
            value={profile.currency}
            onClick={() => {
              const c = prompt("Currency code (EUR, USD, GBP)…", profile.currency);
              if (c) updateProfile.mutate({ currency: c.toUpperCase() });
            }}
          />
          <RowToggle
            icon={profile.theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            label={t("settings.darkMode")}
            value={profile.theme === "dark"}
            onChange={toggleTheme}
          />
          <RowToggle
            icon={<TrendingUp className="size-4" />}
            label={t("settings.investmentMode")}
            desc={t("settings.investmentMode.desc")}
            value={!!(notifPrefs as Record<string, boolean>).investment_mode}
            onChange={() => togglePref("investment_mode")}
          />
        </div>
      </section>

      {/* Notifications */}
      <section>
        <SectionHeader title={t("settings.notifications")} />
        <div className="card-flat divide-y divide-border-subtle">
          <RowToggle icon={<Bell className="size-4" />} label={t("settings.alerts")}
            value={notifPrefs.alerts ?? true} onChange={() => togglePref("alerts")} />
          <RowToggle icon={<Sparkles className="size-4" />} label={t("settings.weekly")}
            value={notifPrefs.weekly ?? true} onChange={() => togglePref("weekly")} />
          <RowToggle icon={<Sparkles className="size-4" />} label={t("settings.aiInsights")}
            value={notifPrefs.insights ?? true} onChange={() => togglePref("insights")} />
        </div>
      </section>

      {/* Security & data */}
      <section>
        <SectionHeader title={t("settings.security")} />
        <div className="card-flat divide-y divide-border-subtle">
          <Row icon={<Shield className="size-4" />} label={t("settings.security.label")} value="Email & password" onClick={() => toast("Coming soon")} />
          <Row icon={<CreditCard className="size-4" />} label={t("settings.bankConnections")} value="None" onClick={() => toast("Coming soon")} />
          <Row icon={<Download className="size-4" />} label={t("settings.export")} onClick={() => exportData.mutate()} />
          <Row icon={<Database className="size-4" />} label={t("settings.privacy")} value="Your data, your control" onClick={() => toast("Stored privately")} />
        </div>
      </section>

      <Button variant="outline" onClick={signOut} className="w-full h-12 rounded-2xl">
        <LogOut className="size-4 mr-2" /> {t("settings.signOut")}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center pt-2">Nest · v0.1.0-beta · Closed beta</p>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Row({
  icon, label, value, onClick,
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
        <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground">{icon}</div>
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
  icon, label, desc, value, onChange,
}: {
  icon: ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="w-full flex items-center justify-between px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <span className="text-sm font-medium">{label}</span>
          {desc && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</p>}
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
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
