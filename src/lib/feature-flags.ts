/**
 * feature-flags.ts — Lightweight feature flag foundation for closed beta.
 *
 * Flag resolution order (highest wins):
 *  1. URL param  ?flag_<name>=true/false   (dev/QA overrides)
 *  2. Profile preference                   (per-user overrides via notification_prefs)
 *  3. Env var    VITE_FLAG_<NAME>=true/false
 *  4. Hardcoded defaults                   (safe defaults for all users)
 *
 * Keep flags here explicit — don't generate them from strings.
 */

export type FeatureFlag =
  | "investment_mode"
  | "family_invitations"
  | "ai_insights"
  | "pwa_install_prompt";

// Env-driven defaults — override with VITE_FLAG_<SCREAMING_SNAKE> env vars
const ENV_DEFAULTS: Record<FeatureFlag, boolean> = {
  investment_mode:      import.meta.env.VITE_FLAG_INVESTMENT_MODE === "true",
  family_invitations:   import.meta.env.VITE_FLAG_FAMILY_INVITATIONS !== "false",
  ai_insights:          import.meta.env.VITE_FLAG_AI_INSIGHTS !== "false",
  pwa_install_prompt:   import.meta.env.VITE_FLAG_PWA_INSTALL_PROMPT !== "false",
};

/**
 * Resolve a flag value for a user.
 * @param flag          Flag name
 * @param profileFlags  Parsed notification_prefs from the user's profile (optional)
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  profileFlags?: Record<string, boolean> | null,
): boolean {
  // 1. URL param override (dev/QA only)
  if (typeof window !== "undefined") {
    const val = new URLSearchParams(window.location.search).get(`flag_${flag}`);
    if (val !== null) return val !== "false";
  }

  // 2. Profile-level override (per-user beta access)
  if (profileFlags?.[flag] !== undefined) return !!profileFlags[flag];

  // 3. Env + hardcoded default
  return ENV_DEFAULTS[flag] ?? true;
}

/** React hook version — reads from no context, pure env/URL evaluation. */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag);
}
