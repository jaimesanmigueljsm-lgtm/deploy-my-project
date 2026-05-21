import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Shield, CreditCard, Database, Moon, Sun, LogOut, ChevronRight,
  Sparkles, Globe, Download, Languages, Check, TrendingUp,
  Camera, AtSign, Copy, MapPin, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SectionHeader } from "@/components/nest";
import { useT } from "@/i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/features/profile/use-profile";
import { uploadAvatar, type Profile } from "@/features/profile/profile.service";
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
  const [openPrivacy, setOpenPrivacy] = useState(false);

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
          <div className="text-base font-semibold truncate">{profile.full_name ?? t("settings.addName")}</div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
          {profile.financial_username && (
            <div className="text-xs text-muted-foreground font-mono mt-0.5">@{profile.financial_username}</div>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </button>

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
          <Row icon={<Database className="size-4" />} label={t("settings.privacy")} value={t("settings.privacy.value")} onClick={() => setOpenPrivacy(true)} />
        </div>
      </section>

      <Button variant="outline" onClick={signOut} className="w-full h-12 rounded-2xl">
        <LogOut className="size-4 mr-2" /> {t("settings.signOut")}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center pt-2">Nest · v0.1.0-beta · Closed beta</p>

      <ProfileEditDialog
        open={openPrivacy}
        onClose={() => setOpenPrivacy(false)}
        profile={profile}
        userId={user?.id ?? ""}
        t={t}
      />
    </div>
  );
}

// ─── ProfileEditDialog ────────────────────────────────────────────────────────

function ProfileEditDialog({
  open, onClose, profile, userId, t,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  userId: string;
  t: (k: string) => string;
}) {
  const updateProfile = useUpdateProfile();
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [firstName,  setFirstName]  = useState("");
  const [lastName1,  setLastName1]  = useState("");
  const [lastName2,  setLastName2]  = useState("");
  const [address,    setAddress]    = useState("");
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    if (open) {
      setFirstName(profile.first_name  ?? "");
      setLastName1(profile.last_name_1 ?? "");
      setLastName2(profile.last_name_2 ?? "");
      setAddress(profile.address       ?? "");
      setLocalAvatar(profile.avatar_url ?? null);
    }
  }, [open, profile]);

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

  function save() {
    const trimFirst = firstName.trim();
    const trimLast1 = lastName1.trim();
    if (!trimFirst || !trimLast1) return;

    const avatarBase = localAvatar?.split("?")[0] ?? profile.avatar_url ?? undefined;

    updateProfile.mutate(
      {
        first_name:  trimFirst,
        last_name_1: trimLast1,
        last_name_2: lastName2.trim() || null,
        full_name:   [trimFirst, trimLast1, lastName2.trim()].filter(Boolean).join(" "),
        address:     address.trim() || null,
        ...(avatarBase ? { avatar_url: avatarBase } : {}),
      },
      { onSuccess: onClose },
    );
  }

  const initials = [firstName[0], lastName1[0]]
    .filter(Boolean)
    .map((s) => s.toUpperCase())
    .join("") || "U";

  function copyUsername() {
    void navigator.clipboard.writeText(`@${profile.financial_username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
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
              {/* hover overlay */}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center pointer-events-none">
                <Camera className="size-5 text-white" />
              </div>
              {/* uploading spinner */}
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
            <Label className="text-xs text-muted-foreground">{t("settings.privacy.lastName2")}</Label>
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

          {/* Username (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <AtSign className="size-3 text-muted-foreground" />
              {t("settings.privacy.username")}
            </Label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted">
              <span className="flex-1 text-sm font-mono text-muted-foreground">
                @{profile.financial_username}
              </span>
              <button
                onClick={copyUsername}
                className="text-muted-foreground hover:text-foreground transition shrink-0"
                aria-label="Copy username"
              >
                {copied
                  ? <Check className="size-3.5 text-positive" />
                  : <Copy className="size-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("settings.privacy.username.note")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={save}
              disabled={updateProfile.isPending || uploading || !firstName.trim() || !lastName1.trim()}
              className="flex-1"
            >
              {updateProfile.isPending
                ? t("settings.privacy.saving")
                : t("settings.privacy.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
