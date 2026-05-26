import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n";
import { AuthProvider } from "@/hooks/use-auth";
import { AppLockProvider } from "@/features/app-lock/use-app-lock";
import { NoolySplash } from "@/components/nooly-splash";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">That page drifted off the budget.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Map raw error messages to user-friendly copy.
 * Returns `{ headline, detail, hint }`. `hint` is shown only in non-prod and
 * for fatal misconfiguration (missing env vars, etc.) — it's the actual error
 * text so a developer/tester knows what to fix at a glance.
 */
function getSafeErrorContent(error: Error): { headline: string; detail: string; hint?: string } {
  const msg = error.message ?? "";
  if (msg.includes("Missing Supabase environment variable")) {
    return {
      headline: "Configuration missing",
      detail: "Supabase credentials are not configured. The app cannot start without them.",
      hint: msg, // Show the exact missing variables — invaluable for diagnosis
    };
  }
  if (msg.includes("Authentication required") || msg.includes("JWT")) {
    return { headline: "Session expired", detail: "Please sign in again." };
  }
  if (msg.includes("Access denied") || msg.includes("not found")) {
    return { headline: "Access denied", detail: "You don't have access to this resource." };
  }
  if (msg.includes("Validation failed")) {
    return { headline: "Invalid data", detail: "Some data was invalid. Please check your inputs." };
  }
  if (
    msg.includes("NetworkError") ||
    msg.includes("Failed to fetch") ||
    msg.includes("fetch failed")
  ) {
    return {
      headline: "Network issue",
      detail: "Check your connection and try again.",
    };
  }
  return {
    headline: "Something didn't load",
    detail: "An unexpected error occurred. Please try again.",
    // Always include the raw message so a beta-tester can copy-paste it in feedback.
    hint: msg || undefined,
  };
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[app error]", error);
  const router = useRouter();
  const { headline, detail, hint } = getSafeErrorContent(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{headline}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        {hint && (
          <pre className="mt-4 max-w-full overflow-auto rounded-lg bg-muted px-3 py-2 text-left text-[11px] leading-relaxed text-muted-foreground">
            {hint}
          </pre>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-input px-4 py-2 text-sm">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Viewport: cover lets content sit under notch/Dynamic Island; safe-area CSS handles insets
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },

      // Theme color — two tags for light/dark (browser picks the matching one)
      { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#070c18", media: "(prefers-color-scheme: dark)" },

      // PWA / iOS home screen
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NOOLY" },

      // SEO & social
      { title: "NOOLY — Family financial copilot" },
      {
        name: "description",
        content:
          "An AI-powered family copilot to track income, expenses and savings goals with calm, beautiful clarity.",
      },
      { property: "og:title", content: "NOOLY — Family financial copilot" },
      {
        property: "og:description",
        content: "Track income, expenses and savings goals with AI-powered insight.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },

      // Prevent phone/date auto-detection on iOS (fintech apps must own formatting)
      { name: "format-detection", content: "telephone=no, date=no, address=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // PWA manifest
      { rel: "manifest", href: "/manifest.json" },
      // Apple touch icon (iOS home screen)
      { rel: "apple-touch-icon", href: "/icon.svg" },
      // Favicon
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      // Font preconnects
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppLockProvider>
            <Outlet />
            <Toaster position="top-center" />
          </AppLockProvider>
        </AuthProvider>
      </I18nProvider>
      <AnimatePresence>
        {!splashDone && <NoolySplash onDone={() => setSplashDone(true)} />}
      </AnimatePresence>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}
