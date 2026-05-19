# Nest — Development Guide

## Quick start

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `VITE_POSTHOG_KEY` | No | PostHog project key — analytics disabled if unset |
| `VITE_POSTHOG_HOST` | No | PostHog ingestion host (default: app.posthog.com) |
| `VITE_SENTRY_DSN` | No | Sentry DSN — error tracking disabled if unset |
| `VITE_SENTRY_ENV` | No | Sentry environment tag (default: production) |
| `VITE_FLAG_*` | No | Feature flag overrides (see Feature Flags below) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint check |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Single test run (used in CI) |
| `npm run test:coverage` | Coverage report (text + JSON) |
| `npm run format` | Prettier format all files |

## Testing

Tests are in `src/core/finance/__tests__/` and use [Vitest](https://vitest.dev/).

**Test files:**
- `math.test.ts` — pure math utilities (safeDivide, clamp, mean, …)
- `constants.test.ts` — weight sums, threshold invariants, status band coverage
- `health-score.test.ts` — end-to-end health score scenarios
- `forecast.test.ts` — budget forecast projection logic

**Test factories** are in `src/test/factories.ts`. All factories accept partial overrides and use a deterministic reference date (`2026-03-15`) for stable tests.

```bash
# Run all tests once
npm run test:run

# Watch mode during development
npm run test

# Coverage (requires @vitest/coverage-v8)
npm run test:coverage
```

Coverage thresholds (enforced in CI):
- Statements: 70%
- Branches: 65%
- Functions: 70%
- Lines: 70%

## Architecture

```
src/
  core/finance/         Financial engine — pure TypeScript, no framework coupling
    types.ts            All engine input/output types
    constants.ts        Benchmarks, scoring weights, thresholds
    adapters.ts         Supabase row → engine type converters
    utils/              math.ts, date.ts — pure utility functions
    scoring/            health-score.ts — composite 0–1000 score
    budgeting/          forecast.ts — month budget projection
    analytics/          spending intelligence
    investments/        portfolio analytics
    recommendations/    rule-based recommendation engine
  routes/               TanStack Start file-based routing
  features/             Domain feature modules (profile, budget, goals, …)
  hooks/                Shared React hooks
  components/           Shared UI components
  lib/                  Analytics, monitoring, security, feature flags
  i18n/                 Translations (EN, ES, FR, DE, PT, IT)
  integrations/         Supabase client + generated types
```

**Key architectural invariants:**
- The financial engine (`src/core/finance/`) must never import from React, hooks, or Supabase. It only receives a `FinancialEngineContext` and returns typed output.
- Analytics events must never include financial amounts, descriptions, or PII — only bucketed/categorical values.
- All time-sensitive engine calculations receive `asOf: Date` rather than calling `new Date()` internally — this makes them deterministic in tests.

## Feature flags

Flags are resolved in this priority order:

1. URL param `?flag_<name>=true` (dev/QA override)
2. User profile preference (`profiles.notification_prefs.<flag>`)
3. Env var `VITE_FLAG_<SCREAMING_SNAKE>` (`true`/`false`)
4. Hardcoded default in `src/lib/feature-flags.ts`

Available flags: `investment_mode`, `family_invitations`, `ai_insights`, `pwa_install_prompt`.

## Deployment

### Vercel

1. Connect the repository in the Vercel dashboard
2. Set environment variables (see `.env.example`)
3. `vercel.json` handles SPA routing, asset caching, and service worker headers

### Cloudflare Workers (primary)

The project uses `@cloudflare/vite-plugin` for Cloudflare Workers deployment. See Cloudflare dashboard for configuration.

## CI/CD

GitHub Actions runs on every PR and push to `main`/`develop`:

1. **TypeScript** — `tsc --noEmit`
2. **ESLint** — `eslint .`
3. **Unit tests** — `vitest --run`
4. **Build** — `vite build`

All four jobs must pass before a PR can merge (enforced by the `ci-gate` job).
