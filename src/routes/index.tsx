import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });

    const uid = data.session.user.id;
    // Use the same cache key as useProfile() so /app's beforeLoad gets a cache
    // hit and child routes have the full profile ready immediately on mount.
    const prof = await queryClient.fetchQuery({
      queryKey: queryKeys.profile(uid),
      queryFn: async () => {
        const { data: p } = await supabase
          .from("profiles").select("*").eq("id", uid).maybeSingle();
        return p ?? null;
      },
      staleTime: 5 * 60_000,
    });
    throw redirect({ to: prof?.onboarded ? "/app" : "/onboarding" });
  },
  component: () => (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background, #f8fafc)" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  ),
});
