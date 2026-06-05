import { Link, Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Home, Wallet, Target, BarChart3, Users, User } from "lucide-react";
import { useT } from "@/i18n";
import { OfflineBanner } from "@/components/offline-banner";
import { queryKeys } from "@/lib/query-keys";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const uid = user.id;

    // CRITICAL FIX: localStorage key namespaced by user ID to prevent multi-user collision
    // Key format: nooly.onboarded.{user_id} ensures each user has independent onboarding state
    const localStorageKey = `nooly.onboarded.${uid}`;
    let localStorageOnboarded = false;
    try {
      localStorageOnboarded = localStorage.getItem(localStorageKey) === 'true';

      // MIGRATION: Clean up old non-namespaced key if it exists
      // This prevents multi-user collision from legacy keys
      const oldKey = 'nooly.onboarded';
      if (localStorage.getItem(oldKey) !== null) {
        // Migrate old key to new namespaced key if not already set
        if (!localStorageOnboarded && localStorage.getItem(oldKey) === 'true') {
          localStorage.setItem(localStorageKey, 'true');
          localStorageOnboarded = true;
          console.log("[app.tsx] Migrated legacy onboarding key to namespaced key");
        }
        // Remove old key to prevent future collisions
        localStorage.removeItem(oldKey);
        console.log("[app.tsx] Cleaned up legacy onboarding key");
      }
    } catch {
      // localStorage unavailable in some environments - non-critical
    }

    // FAST PATH: If localStorage says onboarded, trust it immediately (no network delay)
    // Still fetch profile in background for other data, but don't block navigation
    if (localStorageOnboarded) {
      // Background fetch (non-blocking) to refresh profile data
      queryClient.fetchQuery({
        queryKey: queryKeys.profile(uid),
        queryFn: async () => {
          const { data: p } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
          return p || null;
        },
        staleTime: 5 * 60_000,
      }).catch((error) => {
        // Ignore background fetch errors - user can still navigate with cached data
        console.warn("[app.tsx] Background profile fetch failed:", error);
      });

      // Continue to /app immediately without waiting for DB
      // This prevents network errors from blocking navigation
      return;
    }

    // SLOW PATH: localStorage says NOT onboarded, verify with DB (source of truth)
    // This only runs on first login per device or after localStorage clear
    const prof = await queryClient.fetchQuery({
      queryKey: queryKeys.profile(uid),
      queryFn: async () => {
        const { data: p, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (error) {
          console.error("[app.tsx] Profile fetch error:", error);
          // If fetch fails AND localStorage is empty, safer to redirect to auth
          // This prevents infinite loops on persistent network failures
          throw error;
        }
        if (!p) {
          console.error("[app.tsx] Profile not found for user:", uid);
          return null;
        }
        return p;
      },
      staleTime: 5 * 60_000,
    });

    const dbOnboarded = prof?.onboarded === true;

    // Redirect to onboarding ONLY if both DB and localStorage say not onboarded
    // This prevents race conditions and network errors from causing false redirects
    if (!dbOnboarded && !localStorageOnboarded) {
      throw redirect({ to: "/onboarding" });
    }

    // SYNC: If DB says onboarded but localStorage doesn't, sync it
    // This happens on first login on new device or after localStorage clear
    if (dbOnboarded && !localStorageOnboarded) {
      try {
        localStorage.setItem(localStorageKey, 'true');
        console.log("[app.tsx] Synced onboarding state to localStorage");
      } catch (error) {
        console.warn("[app.tsx] Failed to sync localStorage:", error);
      }
    }
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
  component: AppShell,
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
  { to: "/app/analytics", labelKey: "nav.insights", icon: BarChart3 },
  { to: "/app/goals", labelKey: "nav.goals", icon: Target },
  { to: "/app/family", labelKey: "nav.groups", icon: Users },
  { to: "/app/settings", labelKey: "nav.you", icon: User },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

function AppShell() {
  const loc = useLocation();
  const { t } = useT();
  const queryClient = useQueryClient();

  // Invalidate queries when window gains focus (for multi-device sync)
  // CRITICAL: Never invalidate profile query to prevent onboarding loop bug
  useEffect(() => {
    function onFocus() {
      queryClient.invalidateQueries({
        predicate: (query) => {
          // Exclude profile query to prevent onboarding redirect loop
          // Profile is managed separately and shouldn't be invalidated on focus
          const key = query.queryKey[0];
          return key !== 'profile';
        }
      });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

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

      {/* Bottom navigation — glass card, safe-area + keyboard aware */}
      {/* bottom: max(0, 100lvh - 100dvh) lifts the nav above the iOS virtual keyboard */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 pb-[env(safe-area-inset-bottom)]"
        style={{ bottom: "max(0px, calc(100lvh - 100dvh))" }}
      >
        <div className="mx-auto max-w-2xl px-2 pb-2">
          <div className="glass border border-border-subtle rounded-2xl shadow-float flex justify-between items-center p-1 gap-0.5">
            {tabs.map((tab) => {
              const active = tab.exact ? loc.pathname === tab.to : loc.pathname.startsWith(tab.to);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-xl transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.93] ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon
                    className={`size-[17px] shrink-0 transition-transform duration-150 ${active ? "scale-[1.08]" : ""}`}
                    strokeWidth={active ? 2.4 : 1.9}
                  />
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
