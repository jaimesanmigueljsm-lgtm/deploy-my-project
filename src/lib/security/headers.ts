/**
 * headers.ts — HTTP security response headers.
 *
 * Applied by the TanStack Start server middleware in start.ts to every
 * response. These headers are a prerequisite for any fintech deployment.
 *
 * References:
 *  - OWASP Secure Headers Project
 *  - securityheaders.com (target grade: A)
 *  - PCI DSS 4.0 section 6.4.3 (CSP requirement)
 */

/**
 * Content Security Policy directives.
 *
 * Decisions:
 * - `script-src 'self' 'unsafe-inline'`: TanStack Start's SSR hydration
 *   injects inline scripts. A nonce-based approach is the proper fix but
 *   requires framework-level support — tracked as future work.
 * - `connect-src *.supabase.co wss://*.supabase.co`: covers both the REST
 *   API and the Realtime WebSocket subscription.
 * - `font-src fonts.gstatic.com`: Google Fonts stylesheet is loaded from
 *   fonts.googleapis.com (style-src) but font files come from gstatic.
 * - `frame-ancestors 'none'`: equivalent to X-Frame-Options DENY but CSP
 *   level 2 compliant. Both are set for maximum browser compatibility.
 * - `upgrade-insecure-requests`: forces HTTP → HTTPS for sub-resource loads.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Complete set of security response headers.
 * Apply these to every HTTP response from the server.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  // Prevents clickjacking. Also set via CSP frame-ancestors for level 2 support.
  "X-Frame-Options": "DENY",

  // Prevents MIME-type sniffing attacks.
  "X-Content-Type-Options": "nosniff",

  // Forces HTTPS for 1 year, includes subdomains.
  // Preload only once you have confirmed HTTPS is stable on all subdomains.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

  // Controls how much referrer info is sent. Prevents leaking URL paths
  // (which might contain financial route names) to third parties.
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Restricts access to sensitive browser APIs. Deny camera, mic, geolocation
  // entirely — a budget tracker has no business using them.
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "bluetooth=()",
    "interest-cohort=()", // disables FLoC
  ].join(", "),

  // Content Security Policy (see directive comments above)
  "Content-Security-Policy": CSP_DIRECTIVES,
};

/**
 * Applies SECURITY_HEADERS to an existing Headers object (mutates in place).
 * Use when you can modify an existing response's Headers.
 */
export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}
