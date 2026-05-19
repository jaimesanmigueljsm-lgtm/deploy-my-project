import { defineConfig } from "vitest/config";
import { resolve } from "path";

/**
 * Vitest configuration — standalone from the Lovable vite config so that
 * TanStack Start's SSR plugins don't interfere with the test runner.
 *
 * Financial engine tests:  environment = "node"  (pure TS, fastest)
 * React component tests:   environment = "jsdom" (via @vitest-environment jsdom)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**"],
    coverage: {
      provider: "v8",
      include: ["src/core/finance/**", "src/lib/**"],
      exclude: ["src/**/*.test.ts", "src/lib/analytics.ts", "src/lib/monitoring.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 70,
        branches:   65,
        functions:  70,
        lines:      70,
      },
    },
    // Deterministic test ordering — prevents flakiness from import side effects
    sequence: { shuffle: false },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
