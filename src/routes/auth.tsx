import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Sparkles, ArrowRight, Loader2, Shield, Brain, Users,
  Eye, EyeOff, Check, ChevronDown, AtSign,
} from "lucide-react";
import { useT } from "@/i18n";
import { previewUsername } from "@/features/family/family.service";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

type Mode = "signin" | "signup" | "signup-success";

function AuthPage() {
  const navigate = useNavigate();
  const { t, locale, setLocale, locales } = useT();
  const [mode, setMode] = useState<Mode>("signin");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Signup-only fields
  const [firstName, setFirstName] = useState("");
  const [lastName1, setLastName1] = useState("");
  const [lastName2, setLastName2] = useState("");

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // The predicted username shown after successful signup
  const [confirmedUsername, setConfirmedUsername] = useState("");

  const usernamePreview = mode === "signup"
    ? previewUsername(firstName, lastName1)
    : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (mode === "signup") {
      if (!firstName.trim() || !lastName1.trim()) {
        setFormError(t("auth.name.required"));
        return;
      }
    }
    if (!email.trim()) {
      setFormError(t("auth.email.required"));
      return;
    }
    if (password.length < 6) {
      setFormError(t("auth.password.minlength"));
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name:  firstName.trim(),
              last_name_1: lastName1.trim(),
              last_name_2: lastName2.trim() || null,
            },
          },
        });
        if (error) throw error;
        setConfirmedUsername(usernamePreview);
        setMode("signup-success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "Error";
      const msg = rawMsg.toLowerCase().includes("email not confirmed")
        ? t("auth.error.emailNotConfirmed")
        : rawMsg;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const current = locales.find((l) => l.code === locale)!;

  return (
    <>
    <PwaInstallBanner />
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* LEFT — brand/hero panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden gradient-net text-background p-10">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-32 -left-20 size-[420px] rounded-full bg-mint/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-[380px] rounded-full bg-sky/30 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <div className="size-10 rounded-2xl gradient-mint grid place-items-center shadow-glow">
            <Sparkles className="size-5 text-white" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">Nest</span>
        </div>

        <div className="relative space-y-8 max-w-md">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60 font-medium">
            {t("auth.hero.tagline")}
          </p>
          <h2 className="font-display text-[44px] leading-[1.05] font-bold tracking-tight">
            {t("auth.hero.title")}
          </h2>
          <p className="text-base opacity-75 leading-relaxed">
            {t("auth.hero.subtitle")}
          </p>
          <ul className="space-y-3 pt-4">
            {[
              { icon: Shield, label: t("auth.hero.b1") },
              { icon: Brain,  label: t("auth.hero.b2") },
              { icon: Users,  label: t("auth.hero.b3") },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-white/10 backdrop-blur grid place-items-center">
                  <Icon className="size-4" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-4 text-xs opacity-60">
          <div className="flex -space-x-2">
            {["bg-mint", "bg-sky", "bg-warn", "bg-violet"].map((c, i) => (
              <div key={i} className={`size-6 rounded-full ${c} border-2 border-foreground`} />
            ))}
          </div>
          <span>10,000+ families · ★ 4.9</span>
        </div>
      </aside>

      {/* RIGHT — auth form */}
      <main className="relative flex flex-col min-h-screen lg:min-h-0">
        <div className="flex items-center justify-between px-6 pt-6 lg:px-10 lg:pt-8">
          <Link to="/auth" className="flex items-center gap-2 lg:hidden">
            <div className="size-8 rounded-xl gradient-mint grid place-items-center shadow-glow">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Nest</span>
          </Link>
          <div className="lg:ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 h-9 px-3 rounded-full border border-border-subtle hover:bg-muted/60 transition text-sm">
                  <span className="text-base leading-none">{current.flag}</span>
                  <span className="font-medium">{current.label}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {locales.map((l) => (
                  <DropdownMenuItem key={l.code} onClick={() => setLocale(l.code)} className="gap-2">
                    <span className="text-base">{l.flag}</span>
                    <span className="flex-1">{l.label}</span>
                    {l.code === locale && <Check className="size-4 opacity-70" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 lg:px-10 py-10 max-w-md w-full mx-auto lg:mx-0 lg:ml-12">
          <div key={mode} className="animate-rise">

            {/* ── Signup success screen ─────────────────────────────── */}
            {mode === "signup-success" ? (
              <SignupSuccess
                username={confirmedUsername}
                onSignIn={() => { setMode("signin"); }}
                t={t}
              />
            ) : (
              <>
                <h1 className="font-display text-[34px] leading-tight font-bold tracking-tight">
                  {mode === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
                </h1>
                <p className="text-muted-foreground mt-2 mb-8">
                  {mode === "signin" ? t("auth.signin.subtitle") : t("auth.signup.subtitle")}
                </p>

                <form onSubmit={submit} noValidate className="space-y-3.5">
                  {mode === "signup" && (
                    <>
                      {/* Name row: first name + first surname side-by-side */}
                      <div className="grid grid-cols-2 gap-3">
                        <Field>
                          <Label htmlFor="firstName" className="text-xs text-muted-foreground">
                            {t("auth.firstName")} <span className="text-negative">*</span>
                          </Label>
                          <Input
                            id="firstName" required
                            value={firstName} onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Jaime"
                            autoComplete="given-name"
                            className="h-12 rounded-xl border-border bg-surface"
                          />
                        </Field>
                        <Field>
                          <Label htmlFor="lastName1" className="text-xs text-muted-foreground">
                            {t("auth.lastName1")} <span className="text-negative">*</span>
                          </Label>
                          <Input
                            id="lastName1" required
                            value={lastName1} onChange={(e) => setLastName1(e.target.value)}
                            placeholder="García"
                            autoComplete="family-name"
                            className="h-12 rounded-xl border-border bg-surface"
                          />
                        </Field>
                      </div>

                      {/* Second surname (optional) */}
                      <Field>
                        <Label htmlFor="lastName2" className="text-xs text-muted-foreground">
                          {t("auth.lastName2")}
                        </Label>
                        <Input
                          id="lastName2"
                          value={lastName2} onChange={(e) => setLastName2(e.target.value)}
                          placeholder={t("auth.lastName2.placeholder")}
                          autoComplete="additional-name"
                          className="h-12 rounded-xl border-border bg-surface"
                        />
                      </Field>

                      {/* Live username preview */}
                      {usernamePreview && (
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-mint/10 border border-mint/20">
                          <AtSign className="size-4 text-mint shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              {t("auth.username.preview")}
                            </p>
                            <p className="text-sm font-semibold text-mint font-mono truncate">
                              {usernamePreview}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <Field>
                    <Label htmlFor="email" className="text-xs text-muted-foreground">{t("auth.email")}</Label>
                    <Input
                      id="email" type="email" required autoComplete="email"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@family.com"
                      className="h-12 rounded-xl border-border bg-surface"
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="password" className="text-xs text-muted-foreground">{t("auth.password")}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required minLength={6}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 rounded-xl border-border bg-surface pr-11"
                      />
                      <button
                        type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>

                  {formError && (
                    <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive">
                      {formError}
                    </div>
                  )}

                  <Button
                    type="submit" disabled={loading}
                    className="w-full h-12 rounded-2xl text-base font-semibold mt-3 shadow-card"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : (
                      <>
                        {mode === "signin" ? t("auth.signin.cta") : t("auth.signup.cta")}
                        <ArrowRight className="size-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center mt-6">
                  {mode === "signin" ? t("auth.signin.switch") : t("auth.signup.switch")}{" "}
                  <button
                    type="button"
                    onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setFormError(""); }}
                    className="text-foreground font-semibold underline-offset-4 hover:underline"
                  >
                    {mode === "signin" ? t("auth.signin.switchCta") : t("auth.signup.switchCta")}
                  </button>
                </p>

                <p className="text-[11px] text-muted-foreground text-center mt-8 leading-relaxed">
                  {t("auth.terms")}
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
    </>
  );
}

// ─── Signup success screen ────────────────────────────────────────────────────

function SignupSuccess({
  username, onSignIn, t,
}: {
  username: string;
  onSignIn: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="size-16 rounded-2xl gradient-mint grid place-items-center mx-auto shadow-glow">
        <Check className="size-8 text-white" />
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {t("auth.signup.success.title")}
        </h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          {t("auth.checkInbox")}
        </p>
      </div>

      {username && (
        <div className="card-flat px-5 py-4 text-left space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {t("auth.username.preview")}
          </p>
          <p className="text-xl font-bold font-mono text-mint">{username}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t("auth.username.note")}
          </p>
        </div>
      )}

      <Button
        onClick={onSignIn}
        variant="outline"
        className="w-full h-12 rounded-2xl font-semibold"
      >
        {t("auth.signin.cta")}
      </Button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

