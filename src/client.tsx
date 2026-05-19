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
 * WHY installSynchronousRouterTransitions exists:
 *   TanStack Router's Transitioner assigns router.startTransition during render
 *   and then immediately starts the initial route load in a layout effect. If
 *   that first load is wrapped in React.startTransition, typing into auth inputs
 *   can synchronously flush the pending transition and freeze the page.
 *
 *   The previous useLayoutEffect patch ran too late on some browsers because the
 *   child Transitioner layout effect can fire before the wrapper effect. Defining
 *   startTransition as an accessor before rendering makes TanStack's render-time
 *   assignment a no-op, so the initial load stays synchronous and inputs remain
 *   responsive.
 */
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider, type AnyRouter } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

function installSynchronousRouterTransitions(router: AnyRouter) {
  const runImmediately = (fn: () => void) => fn();

  Object.defineProperty(router, "startTransition", {
    configurable: true,
    get: () => runImmediately,
    set: () => {
      // Keep navigation updates outside React.startTransition to avoid input freezes.
    },
  });
}

const rootEl = document.getElementById("root");

if (rootEl) {
  // Production CSR: #root exists from postbuild.js, $_TSR absent
  const router = getRouter();
  installSynchronousRouterTransitions(router);
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
} else {
  // Dev SSR: full document rendered by TanStack Start server, hydrate it
  hydrateRoot(document, <StartClient />);
}
