/**
 * chart.ts — Shared chart design tokens for Recharts.
 *
 * Spread chartTooltipStyle into Recharts <Tooltip contentStyle={...} />.
 * Spread chartCursor into <Tooltip cursor={...} />.
 * Use CHART_COLORS for <Cell fill={CHART_COLORS[i]} />.
 *
 * Keeping these here ensures all charts in the app look identical without
 * copy-pasting inline style objects in every route.
 */

import type { CSSProperties } from "react";

/** Premium tooltip style — spread into Recharts Tooltip contentStyle prop */
export const chartTooltipStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid oklch(0.93 0.005 250)",
  background: "oklch(1 0 0)",
  boxShadow: "0 4px 16px -4px oklch(0.2 0.02 250 / 0.12)",
  padding: "8px 12px",
  fontSize: "12px",
  fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  color: "oklch(0.20 0.02 255)",
};

/** Dark-mode-aware tooltip (check document.documentElement.classList for .dark) */
export function getChartTooltipStyle(): CSSProperties {
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return dark
    ? {
        ...chartTooltipStyle,
        background: "oklch(0.23 0.016 255)",
        border: "1px solid oklch(1 0 0 / 8%)",
        color: "oklch(0.97 0.005 250)",
      }
    : chartTooltipStyle;
}

/** Cursor line style for Recharts charts */
export const chartCursor = {
  stroke: "oklch(0.62 0.14 158)",
  strokeWidth: 1,
  strokeDasharray: "3 5",
};

/** Label style for Recharts axis ticks */
export const chartAxisStyle: CSSProperties = {
  fontSize: "11px",
  fontFamily: "'Inter', ui-sans-serif",
  fill: "oklch(0.52 0.012 255)",
};

/** 5-color palette — mirrors CSS chart tokens */
export const CHART_COLORS = [
  "oklch(0.62 0.14 158)",  // mint
  "oklch(0.58 0.10 235)",  // sky
  "oklch(0.72 0.16 65)",   // warn/amber
  "oklch(0.55 0.16 290)",  // violet
  "oklch(0.55 0.04 255)",  // neutral
] as const;

/** Gradient stop definitions for area charts */
export const CHART_GRADIENT_STOPS = {
  mint:   { top: "oklch(0.62 0.14 158 / 0.30)", bottom: "oklch(0.62 0.14 158 / 0)" },
  sky:    { top: "oklch(0.58 0.10 235 / 0.30)", bottom: "oklch(0.58 0.10 235 / 0)" },
  violet: { top: "oklch(0.55 0.16 290 / 0.30)", bottom: "oklch(0.55 0.16 290 / 0)" },
  warn:   { top: "oklch(0.72 0.16 65  / 0.30)", bottom: "oklch(0.72 0.16 65  / 0)" },
} as const;
