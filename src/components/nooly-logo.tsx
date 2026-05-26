import { useId } from "react";
import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NLogoProps {
  /** Rendered pixel size (both width and height). Default 64. */
  size?: number;
  /** Show the dark rounded-square background. Default true. */
  showBackground?: boolean;
  className?: string;
}

interface NRibbonProps {
  /** Framer Motion pathLength (0–1). When undefined, renders static. */
  pathLength?: number;
  /** Size of the SVG viewport. Default 260. */
  vSize?: number;
}

// ─── Shared gradient constants ────────────────────────────────────────────────

export const N_GRAD_START = "#c2ede0";
export const N_GRAD_MID   = "#5fb8a8";
export const N_GRAD_END   = "#74b8d0";

// ─── NRibbon — just the ribbon path (no background) ──────────────────────────
// Used inside NLogo and by NoolySplash for the animated draw.

export function NRibbon({ pathLength: pl, vSize = 260 }: NRibbonProps) {
  const uid  = useId().replace(/:/g, "n");
  const gid  = `ng-${uid}`;
  const fid  = `gf-${uid}`;

  // Path within a vSize×vSize viewBox — proportional N
  const pad  = Math.round(vSize * 0.154);   // ~40 in 260
  const mid  = Math.round(vSize * 0.846);   // ~220 in 260
  const top  = Math.round(vSize * 0.11);    // ~28
  const bot  = Math.round(vSize * 0.90);    // ~234
  const sw   = Math.round(vSize * 0.22);    // stroke width ~57

  const d = `M ${pad},${bot} L ${pad},${top} L ${mid},${bot} L ${mid},${top}`;

  return (
    <svg
      viewBox={`0 0 ${vSize} ${vSize}`}
      width={vSize}
      height={vSize}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient
          id={gid}
          x1={mid} y1={top}
          x2={pad} y2={bot}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor={N_GRAD_START} />
          <stop offset="42%"  stopColor={N_GRAD_MID}   />
          <stop offset="100%" stopColor={N_GRAD_END}    />
        </linearGradient>

        <filter id={fid} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
          <feFlood floodColor={N_GRAD_MID} floodOpacity="0.45" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {pl !== undefined ? (
        // Animated draw path (Framer Motion pathLength)
        <motion.path
          d={d}
          stroke={`url(#${gid})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${fid})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: pl, opacity: pl > 0 ? 1 : 0 }}
        />
      ) : (
        // Static ribbon
        <path
          d={d}
          stroke={`url(#${gid})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${fid})`}
        />
      )}
    </svg>
  );
}

// ─── NLogo — ribbon N inside a dark rounded-square card ──────────────────────

export function NLogo({ size = 64, showBackground = true, className = "" }: NLogoProps) {
  const uid   = useId().replace(/:/g, "n");
  const bgId  = `nlbg-${uid}`;
  const glId  = `nlgl-${uid}`;

  const rx    = Math.round(size * 0.218);   // border-radius ~14 at 64px
  const pad   = size * 0.155;               // padding from edge
  const inner = size - pad * 2;

  if (!showBackground) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        <NRibbon vSize={size} />
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={bgId} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#111B27" />
          <stop offset="100%" stopColor="#0B0F19" />
        </linearGradient>
        <radialGradient id={glId} cx="55%" cy="30%" r="55%">
          <stop offset="0%"   stopColor={N_GRAD_MID} stopOpacity="0.18" />
          <stop offset="100%" stopColor={N_GRAD_MID} stopOpacity="0"    />
        </radialGradient>
      </defs>

      {/* Background rounded square */}
      <rect width={size} height={size} rx={rx} fill={`url(#${bgId})`} />
      {/* Ambient glow overlay */}
      <rect width={size} height={size} rx={rx} fill={`url(#${glId})`} />

      {/* Embedded N ribbon, scaled to inner area */}
      <g transform={`translate(${pad}, ${pad}) scale(${inner / 260})`}>
        <NRibbon vSize={260} />
      </g>
    </svg>
  );
}
