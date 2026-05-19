import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./lib/security/headers";

// ── Security headers ──────────────────────────────────────────────────────────
// Runs on every server response before the handler result is sent to the client.
// Clones the response (Response is immutable once constructed) so we can attach
// headers without altering the original stream.
const securityMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  if (!(response instanceof Response)) return response;

  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

// ── Error boundary ────────────────────────────────────────────────────────────
// Catches unhandled server errors and returns a sanitized HTML page.
// Never expose raw error messages to the client (potential info leakage).
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Log full error server-side only — never sent to client
    console.error("[server error]", error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // securityMiddleware runs first so headers are set even on error responses.
  requestMiddleware: [securityMiddleware, errorMiddleware],
}));
