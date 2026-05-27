import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://app.posthog.com";

let initialized = false;

function init(): void {
  if (initialized || !KEY || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export const analytics = {
  init,
  capture(event: string, props?: Record<string, unknown>): void {
    if (!initialized) return;
    posthog.capture(event, props);
  },
  identify(uid: string, traits?: Record<string, unknown>): void {
    if (!initialized) return;
    posthog.identify(uid, traits);
  },
  page(path: string): void {
    if (!initialized) return;
    posthog.capture("$pageview", { $current_url: path });
  },
  reset(): void {
    if (!initialized) return;
    posthog.reset();
  },
};
