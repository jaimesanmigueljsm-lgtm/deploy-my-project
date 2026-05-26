import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Loader2, Shield, Brain, Users,
  Eye, EyeOff, Check, ChevronDown, AtSign,
} from "lucide-react";
import { useT } from "@/i18n";
import { previewUsername } from "@/features/family/family.service";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "signin" | "signup" | "signup-success";

// ─── N-mark logo ──────────────────────────────────────────────────────────────

function NMark({ className = "size-10" }: { className?: string }) {
  return (
    <div
      className={`${className} rounded-2xl flex items-center justify-center shrink-0`}
      style={{
        background: "linear-gradient(135deg, oklch(0.68 0.14 158), oklch(0.56 0.13 175))",
        boxShadow: "0 0 0 1px oklch(0.68 0.14 158 / 0.3), 0 8px 24px -4px oklch(0.62 0.14 158 / 0.45)",
      }}
    >
      <span
        className="text-white font-bold text-xl leading-none"
        style={{ letterSpacing: "-0.03em" }}
      >
        N
      </span>
    </div>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────

const formVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeIn" as const } },
};

// ─── Auth page ────────────────────────────────────────────────────────────────

function AuthPage() {
  const navigate = useNavigate();
  const { t, locale, setLocale, locales } = useT();
  const [mode, setMode] = useState<Mode>("signin");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) navigate({ to: "/" });
    });
    return () => { mounted = false; };
  }, [navigate]);

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName]   = useState("");
  const [lastName1, setLastName1]   = useState("");
  const [lastName2, setLastName2]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [formError, setFormError]   = useState("");
  const [confirmedUsername, setConfirmedUsername] = useState("");

  const usernamePreview = mode === "signup" ? previewUsername(firstName, lastName1) : "";

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
      <div className="min-h-screen lg:grid lg:grid-cols-2" style={{ background: "#070c18" }}>

        {/* ── LEFT: premium brand panel (desktop only) ── */}
        <aside
          className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10"
          style={{ background: "#09101e" }}
        >
          {/* Orb: mint top-left */}
          <motion.div
            className="absolute -top-40 -left-32 size-[520px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, oklch(0.68 0.14 158 / 0.18) 0%, transparent 70%)" }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Orb: sky bottom-right */}
          <motion.div
            className="absolute -bottom-28 -right-10 size-[460px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, oklch(0.68 0.14 210 / 0.15) 0%, transparent 70%)" }}
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.06, 1] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          {/* Orb: violet center-right */}
          <motion.div
            className="absolute top-1/3 -right-20 size-[320px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, oklch(0.58 0.14 290 / 0.10) 0%, transparent 70%)" }}
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />

          {/* Logo */}
          <div className="relative flex items-center gap-3">
            <NMark className="size-12" />
            <span
              className="text-white font-bold text-2xl"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
            >
              NOOLY
            </span>
          </div>

          {/* Hero copy */}
          <div className="relative space-y-8 max-w-md">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">
              {t("auth.hero.tagline")}
            </p>
            <h2
              className="text-[44px] leading-[1.05] font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("auth.hero.title")}
            </h2>
            <p className="text-base text-white/60 leading-relaxed">
              {t("auth.hero.subtitle")}
            </p>
            <ul className="space-y-3 pt-4">
              {[
                { icon: Shield, label: t("auth.hero.b1") },
                { icon: Brain,  label: t("auth.hero.b2") },
                { icon: Users,  label: t("auth.hero.b3") },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-xl grid place-items-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <Icon className="size-4 text-white/70" />
                  </div>
                  <span className="text-sm font-medium text-white/75">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Social proof */}
          <div className="relative flex items-center gap-4 text-xs text-white/35">
            <div className="flex -space-x-2">
              {[
                "oklch(0.68 0.14 158)",
                "oklch(0.68 0.14 210)",
                "oklch(0.75 0.14 80)",
                "oklch(0.58 0.14 290)",
              ].map((c, i) => (
                <div
                  key={i}
                  className="size-6 rounded-full"
                  style={{ background: c, outline: "2px solid #09101e" }}
                />
              ))}
            </div>
            <span>10,000+ families · ★ 4.9</span>
          </div>
        </aside>

        {/* ── RIGHT: auth form ── */}
        <main className="relative flex flex-col min-h-screen lg:min-h-0 overflow-hidden">

          {/* Ambient orbs on the form side */}
          <motion.div
            className="absolute -top-24 -right-16 size-[360px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, oklch(0.68 0.14 158 / 0.09) 0%, transparent 70%)" }}
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.06, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-16 -left-16 size-[300px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, oklch(0.58 0.14 290 / 0.07) 0%, transparent 70%)" }}
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />

          {/* Top bar */}
          <div
            className="relative flex items-center justify-between px-6 lg:px-10 lg:pt-8"
            style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}
          >
            <Link to="/auth" className="flex items-center gap-2.5 lg:hidden">
              <NMark className="size-8" />
              <span
                className="text-white font-bold text-lg"
                style={{ letterSpacing: "-0.025em" }}
              >
                NOOLY
              </span>
            </Link>
            <div className="lg:ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 h-9 px-3 rounded-full text-sm text-white/60 hover:text-white/90 transition"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
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

          {/* Form area */}
          <div className="relative flex-1 flex flex-col justify-center px-6 lg:px-10 py-10 max-w-md w-full mx-auto lg:mx-0 lg:ml-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {mode === "signup-success" ? (
                  <SignupSuccess
                    username={confirmedUsername}
                    onSignIn={() => setMode("signin")}
                    t={t}
                  />
                ) : (
                  <>
                    <h1
                      className="font-bold text-[32px] leading-tight tracking-tight text-white"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {mode === "signin" ? t("auth.signin.title") : t("auth.signup.title")}
                    </h1>
                    <p className="text-white/45 mt-2 mb-8 text-sm leading-relaxed">
                      {mode === "signin" ? t("auth.signin.subtitle") : t("auth.signup.subtitle")}
                    </p>

                    <form onSubmit={submit} noValidate className="space-y-3.5">
                      {mode === "signup" && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <DarkField>
                              <DarkLabel htmlFor="firstName">
                                {t("auth.firstName")} <span style={{ color: "#f87171" }}>*</span>
                              </DarkLabel>
                              <DarkInput
                                id="firstName" required
                                value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Jaime"
                                autoComplete="given-name"
                              />
                            </DarkField>
                            <DarkField>
                              <DarkLabel htmlFor="lastName1">
                                {t("auth.lastName1")} <span style={{ color: "#f87171" }}>*</span>
                              </DarkLabel>
                              <DarkInput
                                id="lastName1" required
                                value={lastName1} onChange={(e) => setLastName1(e.target.value)}
                                placeholder="García"
                                autoComplete="family-name"
                              />
                            </DarkField>
                          </div>

                          <DarkField>
                            <DarkLabel htmlFor="lastName2">{t("auth.lastName2")}</DarkLabel>
                            <DarkInput
                              id="lastName2"
                              value={lastName2} onChange={(e) => setLastName2(e.target.value)}
                              placeholder={t("auth.lastName2.placeholder")}
                              autoComplete="additional-name"
                            />
                          </DarkField>

                          {usernamePreview && (
                            <div
                              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                              style={{
                                background: "oklch(0.68 0.14 158 / 0.08)",
                                border: "1px solid oklch(0.68 0.14 158 / 0.18)",
                              }}
                            >
                              <AtSign className="size-4 shrink-0" style={{ color: "oklch(0.75 0.14 158)" }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                                  {t("auth.username.preview")}
                                </p>
                                <p className="text-sm font-semibold font-mono truncate" style={{ color: "oklch(0.75 0.14 158)" }}>
                                  {usernamePreview}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <DarkField>
                        <DarkLabel htmlFor="email">{t("auth.email")}</DarkLabel>
                        <DarkInput
                          id="email" type="email" required autoComplete="email"
                          value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@family.com"
                        />
                      </DarkField>

                      <DarkField>
                        <DarkLabel htmlFor="password">{t("auth.password")}</DarkLabel>
                        <div className="relative">
                          <DarkInput
                            id="password"
                            type={showPassword ? "text" : "password"}
                            required minLength={6}
                            autoComplete={mode === "signin" ? "current-password" : "new-password"}
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="pr-11"
                          />
                          <button
                            type="button" onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </DarkField>

                      {formError && (
                        <div
                          className="rounded-xl px-3.5 py-2.5 text-sm"
                          style={{
                            background: "rgba(239,68,68,0.10)",
                            border: "1px solid rgba(239,68,68,0.22)",
                            color: "#fca5a5",
                          }}
                        >
                          {formError}
                        </div>
                      )}

                      <button
                        type="submit" disabled={loading}
                        className="w-full h-12 rounded-2xl text-base font-semibold mt-3 flex items-center justify-center gap-2 text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg, oklch(0.68 0.14 158), oklch(0.56 0.13 175))",
                          boxShadow: "0 8px 28px -6px oklch(0.62 0.14 158 / 0.45)",
                        }}
                      >
                        {loading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            {mode === "signin" ? t("auth.signin.cta") : t("auth.signup.cta")}
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </button>
                    </form>

                    <p className="text-sm text-white/35 text-center mt-6">
                      {mode === "signin" ? t("auth.signin.switch") : t("auth.signup.switch")}{" "}
                      <button
                        type="button"
                        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setFormError(""); }}
                        className="text-white font-semibold hover:underline underline-offset-4"
                      >
                        {mode === "signin" ? t("auth.signin.switchCta") : t("auth.signup.switchCta")}
                      </button>
                    </p>

                    <p className="text-[11px] text-white/20 text-center mt-8 leading-relaxed">
                      {t("auth.terms")}
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  );
}

// ─── Signup success ───────────────────────────────────────────────────────────

function SignupSuccess({
  username, onSignIn, t,
}: {
  username: string;
  onSignIn: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="text-center space-y-6">
      <div
        className="size-16 rounded-2xl grid place-items-center mx-auto"
        style={{
          background: "linear-gradient(135deg, oklch(0.68 0.14 158), oklch(0.56 0.13 175))",
          boxShadow: "0 8px 28px -6px oklch(0.62 0.14 158 / 0.5)",
        }}
      >
        <Check className="size-8 text-white" />
      </div>

      <div>
        <h1
          className="font-bold text-2xl tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("auth.signup.success.title")}
        </h1>
        <p className="text-white/45 mt-2 leading-relaxed text-sm">
          {t("auth.checkInbox")}
        </p>
      </div>

      {username && (
        <div
          className="px-5 py-4 rounded-2xl text-left space-y-1"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <p className="text-xs text-white/35 uppercase tracking-wider font-medium">
            {t("auth.username.preview")}
          </p>
          <p className="text-xl font-bold font-mono" style={{ color: "oklch(0.75 0.14 158)" }}>
            {username}
          </p>
          <p className="text-[11px] text-white/30 leading-relaxed">
            {t("auth.username.note")}
          </p>
        </div>
      )}

      <button
        onClick={onSignIn}
        className="w-full h-12 rounded-2xl font-semibold text-white/60 hover:text-white/90 transition"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)" }}
      >
        {t("auth.signin.cta")}
      </button>
    </div>
  );
}

// ─── Dark form primitives ─────────────────────────────────────────────────────

function DarkField({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function DarkLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs text-white/45 block font-medium">
      {children}
    </label>
  );
}

function DarkInput({ className = "", style, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`w-full h-12 rounded-xl px-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-white/18 transition ${className}`}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        ...style,
      }}
    />
  );
}
