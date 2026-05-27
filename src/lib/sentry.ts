import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = (import.meta.env.VITE_SENTRY_ENV as string | undefined) ?? import.meta.env.MODE;

export function initSentry(): void {
  if (!DSN || typeof window === "undefined") return;
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
  });
}

export { Sentry };
