/**
 * nest/index.tsx — Shared primitive components for the NOOLY design system.
 *
 * Design principles applied here:
 *  · Card hover: translateY(-1px) + shadow bump via .card-interactive
 *  · Row press: row-hover utility for background + active:scale feedback
 *  · Skeletons: horizontal shimmer sweep via .skeleton class
 *  · Focus: :focus-visible ring defined globally in styles.css
 *  · Numbers: tabular-nums always; .num for inline, .num-display for larger
 */

import { type ReactNode, type CSSProperties } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryMeta, getColorClasses } from "@/lib/categories";

// Re-export the standalone components that live in sibling files so consumers
// keep using a single canonical import path: `@/components/nest`.
export { UserAvatarLink } from "./user-avatar-link";

// ─── Skeleton ────────────────────────────────────────────────────────────────
// Use <Skeleton> instead of `animate-pulse bg-muted` everywhere.
// The shimmer animation is defined in styles.css as .skeleton.

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden="true" />;
}

// Convenience composed shapes
export function SkeletonText({ className, style }: { className?: string; style?: CSSProperties }) {
  return <Skeleton className={cn("h-3 rounded", className)} style={style} />;
}

export function SkeletonBlock({ className, style }: { className?: string; style?: CSSProperties }) {
  return <Skeleton className={cn("rounded-2xl", className)} style={style} />;
}

// ─── TrendBadge ──────────────────────────────────────────────────────────────

export function TrendBadge({
  value,
  suffix = "%",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold num",
        positive ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative",
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {positive ? "+" : ""}
      {value.toFixed(value % 1 === 0 ? 0 : 1)}
      {suffix}
    </span>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3 px-0.5">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight leading-snug">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  suffix,
  icon,
  tone = "neutral",
  children,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon?: ReactNode;
  tone?: "mint" | "sky" | "warn" | "violet" | "neutral";
  children?: ReactNode;
}) {
  const iconStyles: Record<string, string> = {
    mint: "bg-positive-soft text-positive",
    sky: "bg-sky-soft text-sky",
    warn: "bg-warn-soft text-warn",
    violet: "bg-violet-soft text-violet",
    neutral: "bg-neutral-soft text-foreground",
  };
  return (
    <div className="card-flat p-4">
      <div className="flex items-center justify-between">
        <span className="label-overline">{label}</span>
        {icon && (
          <span
            className={cn("size-7 rounded-full grid place-items-center shrink-0", iconStyles[tone])}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 num-display text-2xl font-semibold">{value}</div>
      {suffix && <div className="text-[11px] text-muted-foreground mt-0.5">{suffix}</div>}
      {children}
    </div>
  );
}

// ─── MetricRow ────────────────────────────────────────────────────────────────
// Hover: soft background reveal + press scale.
// Uses row-hover and press-scale utilities defined in styles.css.

export function MetricRow({
  label,
  value,
  sublabel,
  trend,
  leading,
  onClick,
}: {
  label: string;
  value: string;
  sublabel?: string;
  trend?: number;
  leading?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3.5 text-left",
        onClick && "row-hover press-scale cursor-pointer",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {leading}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate leading-snug">{label}</div>
          {sublabel && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{sublabel}</div>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <div className="text-sm font-semibold num leading-snug">{value}</div>
        {trend !== undefined && <TrendBadge value={trend} className="mt-0.5" />}
      </div>
    </Tag>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────
// SVG ring with smooth stroke-dasharray transition.
// Optional glow for excellent scores (≥ 85).

export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  label,
  sublabel,
  color = "var(--positive)",
  glow,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  glow?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  const dash = (clamped / 100) * c;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="var(--color-border)"
          fill="none"
        />
        {/* Glow filter for excellent scores */}
        {glow && (
          <defs>
            <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          filter={glow ? "url(#ring-glow)" : undefined}
          style={{
            transition: "stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num-display text-base font-bold leading-none">
          {label ?? Math.round(value)}
        </div>
        {sublabel && (
          <div className="label-overline mt-0.5" style={{ fontSize: "8.5px" }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft p-8 flex flex-col items-center text-center animate-rise">
      <div
        className="size-14 rounded-2xl grid place-items-center mb-4"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.95 0.05 158 / 0.7), oklch(0.96 0.03 235 / 0.5))",
        }}
      >
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="font-semibold text-sm tracking-tight">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── InsightCard ─────────────────────────────────────────────────────────────
// Slightly elevated hover — communicates that insights are discrete items.

export function InsightCard({
  tone = "mint",
  icon,
  title,
  body,
}: {
  tone?: "mint" | "sky" | "warn" | "violet";
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const iconStyles: Record<string, string> = {
    mint: "bg-positive-soft text-positive",
    sky: "bg-sky-soft text-sky",
    warn: "bg-warn-soft text-warn",
    violet: "bg-violet-soft text-violet",
  };
  return (
    <div className="card-flat p-4 flex gap-3 transition-[transform,box-shadow] duration-150 hover:shadow-[var(--shadow-xs)] active:scale-[0.99]">
      <div
        className={cn(
          "size-9 rounded-xl grid place-items-center shrink-0 mt-0.5",
          iconStyles[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold leading-snug text-foreground">{title}</div>
        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── CategoryDot ─────────────────────────────────────────────────────────────

export function CategoryDot({
  color = "mint",
  size = "sm",
  className,
}: {
  color?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const colorMap: Record<string, string> = {
    mint: "bg-positive",
    sky: "bg-sky",
    warn: "bg-warn",
    violet: "bg-violet",
    neutral: "bg-muted-foreground",
  };
  const sizeClass = size === "md" ? "size-2.5" : "size-2";
  return (
    <span
      className={cn(
        "rounded-full shrink-0",
        sizeClass,
        colorMap[color] ?? "bg-muted-foreground",
        className,
      )}
    />
  );
}

// ─── CategoryIcon ─────────────────────────────────────────────────────────────
// Renders the Lucide icon for a category in a colored pill.
// iconKey: the string stored in categories.icon (DB). color: optional DB override.

export function CategoryIcon({
  iconKey,
  color,
  size = "md",
  className,
}: {
  iconKey: string;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = getCategoryMeta(iconKey);
  const Icon = meta.icon;
  const resolvedColor = color ?? meta.color;
  const { soft, text } = getColorClasses(resolvedColor);
  const containerCls = size === "sm" ? "size-7 rounded-lg" : "size-9 rounded-xl";
  const iconCls = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span className={cn("grid place-items-center shrink-0", containerCls, soft, text, className)}>
      <Icon className={iconCls} />
    </span>
  );
}

// ─── SubScoreBar ─────────────────────────────────────────────────────────────
// Progress bar for health score sub-dimensions.
// Bar width transitions smoothly after mount via CSS transition.

export function SubScoreBar({
  label,
  value,
  score,
}: {
  label: string;
  value: string;
  score: number;
}) {
  const color =
    score >= 80
      ? "var(--positive)"
      : score >= 60
        ? "var(--sky)"
        : score >= 40
          ? "var(--warn)"
          : "var(--negative)";

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[112px] shrink-0 text-[11px] text-muted-foreground truncate">{label}</div>
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: color,
            transition: "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      <div
        className="w-7 text-right text-[11px] font-semibold num tabular-nums shrink-0"
        style={{ color }}
      >
        {score}
      </div>
      <div className="w-[72px] text-right text-[10px] text-muted-foreground truncate shrink-0">
        {value}
      </div>
    </div>
  );
}

// ─── HealthStatusBadge ────────────────────────────────────────────────────────

type HealthStatus = "excellent" | "strong" | "healthy" | "improving" | "unstable";

export function HealthStatusBadge({ status, label }: { status: HealthStatus; label?: string }) {
  const styles: Record<HealthStatus, string> = {
    excellent: "bg-positive-soft text-positive",
    strong: "bg-sky-soft text-sky",
    healthy: "bg-sky-soft text-sky",
    improving: "bg-warn-soft text-warn",
    unstable: "bg-negative-soft text-negative",
  };
  const fallbackLabels: Record<HealthStatus, string> = {
    excellent: "Excellent",
    strong: "Strong",
    healthy: "Healthy",
    improving: "Improving",
    unstable: "Unstable",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        styles[status],
      )}
    >
      {label ?? fallbackLabels[status]}
    </span>
  );
}

// ─── ImpactChip ───────────────────────────────────────────────────────────────

export function ImpactChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-positive-soft text-positive text-[11px] font-semibold">
      {label}
    </span>
  );
}

// ─── SeverityDot ─────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info" | "positive";

export function SeverityDot({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: "bg-negative",
    warning: "bg-warn",
    info: "bg-sky",
    positive: "bg-positive",
  };
  return <span className={cn("size-1.5 rounded-full shrink-0 mt-1.5", colors[severity])} />;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  values,
  width = 80,
  height = 28,
  color = "var(--positive)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(" ");
  const lastY = height - ((values[values.length - 1] - min) / span) * (height - 4) - 2;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

// ─── DividerLine ─────────────────────────────────────────────────────────────
// Hairline divider with optional label.

export function DividerLine({ label }: { label?: string } = {}) {
  if (label) {
    return (
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-border-subtle" />
        <span className="label-overline">{label}</span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
    );
  }
  return <div className="h-px bg-border-subtle my-1" />;
}

// ─── Re-exports ──────────────────────────────────────────────────────────────
// Keeps the single import path `@/components/nest` working for new components
// extracted into their own files.

export { UserAvatarLink } from "./user-avatar-link";
