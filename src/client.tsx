/**
 * Unified client entry — works in both dev (SSR) and production (CSR).
 *
 * Dev mode (vite dev / TanStack Start SSR):
 *   The server renders a full HTML document with no #root element.
 *   We use hydrateRoot(document, <StartClient />) so React attaches
 *   event handlers to the server-rendered DOM without re-rendering.
 *
 * Production (Vercel static SPA via postbuild.js):
 *   postbuild.js now emits a document-shaped shell, so the same StartClient
 *   hydration path is used in Lovable and Vercel.
 */
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
);
