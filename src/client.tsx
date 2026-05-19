/**
 * Unified client entry — works in both dev (SSR) and production (CSR).
 *
 * Dev mode (vite dev / TanStack Start SSR):
 *   The server renders a full HTML document with no #root element.
 *   We use hydrateRoot(document, <StartClient />) so React attaches
 *   event handlers to the server-rendered DOM without re-rendering.
 *
 * Production (Vercel static SPA via postbuild.js):
 *   postbuild.js creates index.html with <div id="root"> + spinner.
 *   No SSR — $_TSR bootstrap is absent. We use createRoot(#root) for
 *   pure CSR, bypassing hydrateStart() which requires $_TSR.
 *
 * WHY RouterProviderNoTransition exists:
 *   TanStack Router's RouterProvider overwrites router.startTransition in its
 *   render body to wrap every navigation in React.startTransition. While that
 *   transition is pending (the initial beforeLoad calls supabase.auth.getSession
 *   which is async), any user interaction (focus, keydown) triggers a synchronous
 *   flush of the entire pending transition on the main thread → instant freeze.
 *
 *   Fix: a useLayoutEffect in the wrapper runs AFTER RouterProvider's render
 *   (which sets router.startTransition) but BEFORE RouterProvider's useEffect
 *   (which fires the first navigation). It patches router.startTransition back
 *   to a direct call so the initial async beforeLoad work is not deferred as a
 *   React transition. Subsequent navigations re-render RouterProvider which
 *   resets the wrapper, but by then the initial load is complete.
 */
import { StrictMode, useLayoutEffect } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider, type AnyRouter } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

function RouterProviderNoTransition({ router }: { router: AnyRouter }) {
  useLayoutEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (router as any).startTransition = (fn: () => void) => fn();
  }, [router]);
  return <RouterProvider router={router} />;
}

const rootEl = document.getElementById("root");

if (rootEl) {
  // Production CSR: #root exists from postbuild.js, $_TSR absent
  const router = getRouter();
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProviderNoTransition router={router} />
    </StrictMode>,
  );
} else {
  // Dev SSR: full document rendered by TanStack Start server, hydrate it
  hydrateRoot(document, <StartClient />);
}
