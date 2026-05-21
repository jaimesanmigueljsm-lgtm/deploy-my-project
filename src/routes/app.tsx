import { Link, Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { Home, Wallet, Target, BarChart3, Users, User } from "lucide-react";
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
    // Apply theme synchronously before the shell renders to avoid flash.
    // localStorage is the authoritative source after the first visit — it's updated
    // synchronously on every toggle, so it's always ahead of the 5-min-cached DB value.
    if (typeof document !== "undefined") {
      let isDark: boolean;
      try {
        const stored = localStorage.getItem("nest.theme");
        isDark = stored !== null ? stored === "dark" : prof?.theme === "dark";
      } catch {
        isDark = prof?.theme === "dark";
      }
      document.documentElement.classList.toggle("dark", isDark);
      try {
        localStorage.setItem("nest.theme", isDark ? "dark" : "light");
      } catch {
        // localStorage unavailable in some sandboxed environments — safe to ignore
      }
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
  to: "/app" | "/app/budget" | "/app/goals" | "/app/analytics" | "/app/family" | "/app/settings";
  labelKey: string;
  icon: typeof Home;
  exact?: boolean;
};

const tabs: TabDef[] = [
  { to: "/app", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/app/budget", labelKey: "nav.budget", icon: Wallet },
  { to: "/app/goals", labelKey: "nav.goals", icon: Target },
  { to: "/app/analytics", labelKey: "nav.insights", icon: BarChart3 },
  { to: "/app/family", labelKey: "nav.family", icon: Users },
  { to: "/app/settings", labelKey: "nav.you", icon: User },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

function AppShell() {
  const loc = useLocation();
  const { t } = useT();

  // Sync dark mode across browser tabs when the user changes the theme in another tab
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "nest.theme") {
        document.documentElement.classList.toggle("dark", e.newValue === "dark");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Offline indicator (top, safe-area aware) */}
      <OfflineBanner />

      <main className="mx-auto max-w-2xl pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-0">
        <Outlet />
      </main>

      {/* Bottom navigation — glass card, safe-area aware */}
      <nav className="fixed bottom-0 inset-x-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-2 pb-2">
          <div className="glass border border-border-subtle rounded-2xl shadow-float flex justify-between items-center p-1 gap-0.5">
            {tabs.map((tab) => {
              const active = tab.exact ? loc.pathname === tab.to : loc.pathname.startsWith(tab.to);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-xl transition-all ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                  <span className="text-[9px] font-medium tracking-tight truncate max-w-full">
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
