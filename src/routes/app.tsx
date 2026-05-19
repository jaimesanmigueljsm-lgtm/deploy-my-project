import { Link, Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Home, Wallet, Target, LineChart, BarChart3, Users, User } from "lucide-react";
import { useT } from "@/i18n";
import { OfflineBanner } from "@/components/offline-banner";

// ─── Route ────────────────────────────────────────────────────────────────────
//
// beforeLoad runs on the client only (TanStack Start renders SSR but we deploy
// as SPA via scripts/postbuild.js → window guard required).
//
// Auth flow:
//   - No session       → /auth
//   - Session + !onboarded → /onboarding
//   - Session + onboarded  → continue to /app/*
//
// The `theme` field is hydrated here so the dark-mode class is applied before
// any child route renders, avoiding a light→dark flash on app load.

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    const uid = data.session.user.id;
    // Cache the onboarded+theme check so subsequent tab navigations don't re-hit the DB.
    // Uses a dedicated key to avoid type collisions with the full profile cache.
    const prof = await queryClient.fetchQuery({
      queryKey: ["profiles-auth-check", uid],
      queryFn: async () => {
        const { data: p } = await supabase
          .from("profiles")
          .select("onboarded, theme")
          .eq("id", uid)
          .maybeSingle();
        return p ?? null;
      },
      staleTime: 5 * 60_000,
    });
    if (!prof?.onboarded) throw redirect({ to: "/onboarding" });
    // Apply theme synchronously before the shell renders to avoid flash
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", prof?.theme === "dark");
    }
  },
  component: () => (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  ),
});

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  to:
    | "/app"
    | "/app/budget"
    | "/app/goals"
    | "/app/finances"
    | "/app/analytics"
    | "/app/family"
    | "/app/settings";
  labelKey: string;
  icon: typeof Home;
  exact?: boolean;
};

const tabs: TabDef[] = [
  { to: "/app",          labelKey: "nav.home",     icon: Home,      exact: true },
  { to: "/app/budget",   labelKey: "nav.budget",   icon: Wallet },
  { to: "/app/goals",    labelKey: "nav.goals",    icon: Target },
  { to: "/app/finances", labelKey: "nav.invest",   icon: LineChart },
  { to: "/app/analytics",labelKey: "nav.insights", icon: BarChart3 },
  { to: "/app/family",   labelKey: "nav.family",   icon: Users },
  { to: "/app/settings", labelKey: "nav.you",      icon: User },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

function AppShell() {
  const { user } = useAuth();
  const loc = useLocation();
  const { t } = useT();

  // Re-sync theme if it changes server-side via another tab
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        document.documentElement.classList.toggle("dark", data?.theme === "dark");
      });
  }, [user]);

  // beforeLoad already verified the session, so we render the full shell
  // immediately. loading resolves in <100 ms (localStorage read); until then
  // the dashboard shows its own skeleton via useDashboard()/isLoading.

  return (
    <div className="min-h-screen bg-background">
      {/* Offline indicator (top, safe-area aware) */}
      <OfflineBanner />

      <main className="mx-auto max-w-2xl pb-28">
        <Outlet />
      </main>

      {/* Bottom navigation — glass card, safe-area aware */}
      <nav className="fixed bottom-0 inset-x-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-3 pb-3">
          <div className="glass border border-border-subtle rounded-2xl shadow-float flex justify-between items-center p-1">
            {tabs.map((tab) => {
              const active = tab.exact
                ? loc.pathname === tab.to
                : loc.pathname.startsWith(tab.to);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon
                    className="size-[17px]"
                    strokeWidth={active ? 2.4 : 1.9}
                  />
                  <span className="text-[9.5px] font-medium tracking-wide">
                    {t(tab.labelKey)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
