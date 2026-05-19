/**
 * analytics.ts — DISABLED during stability rebuild phase.
 * All functions are no-ops. Re-enable by restoring PostHog integration.
 */

export function initAnalytics(): void {}
export function identifyUser(_userId: string, _traits?: Record<string, unknown>): void {}
export function resetAnalyticsUser(): void {}
export function track(_event: string, _properties?: Record<string, unknown>): void {}

export const Analytics = {
  signUpStarted:            () => {},
  signUpCompleted:          () => {},
  signInCompleted:          () => {},
  signedOut:                () => {},
  onboardingStarted:        () => {},
  onboardingStepCompleted:  (_step: number) => {},
  onboardingCompleted:      (_durationMs: number) => {},
  onboardingAbandoned:      (_lastStep: number) => {},
  tabViewed:                (_tab: string) => {},
  expenseAdded:             (_kind: "fixed" | "variable") => {},
  incomeAdded:              () => {},
  billAdded:                () => {},
  goalCreated:              (_priority: string) => {},
  goalCompleted:            () => {},
  goalViewed:               () => {},
  insightsGenerated:        () => {},
  insightViewed:            (_id: string) => {},
  healthScoreViewed:        (_score: number, _status: string) => {},
  recommendationTapped:     (_id: string) => {},
  familyCreated:            () => {},
  familyInviteSent:         () => {},
  familyInviteAccepted:     () => {},
  familyInviteRejected:     () => {},
  investmentModeActivated:  () => {},
  feedbackOpened:           () => {},
  feedbackSubmitted:        (_type: "bug" | "suggestion" | "general") => {},
  pwaInstallPrompted:       () => {},
  pwaInstalled:             () => {},
  pwaLaunched:              () => {},
  offlineDetected:          () => {},
  onlineRestored:           () => {},
};
