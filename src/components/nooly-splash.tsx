import { useId, useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimate } from "framer-motion";
import { N_GRAD_START, N_GRAD_MID, N_GRAD_END } from "@/components/nooly-logo";

// ─── OOLY letters (appear after N is drawn) ───────────────────────────────────

const OOLY = ["O", "O", "L", "Y"];

// ─── Ambient particles ────────────────────────────────────────────────────────

const PARTICLES = [
  { w: 2,   x: "17%", y: "74%", delay: 0.5,  dur: 3.5 },
  { w: 3,   x: "80%", y: "67%", delay: 1.0,  dur: 4.2 },
  { w: 1.5, x: "36%", y: "82%", delay: 0.3,  dur: 3.8 },
  { w: 2,   x: "63%", y: "79%", delay: 1.3,  dur: 3.0 },
  { w: 1.5, x: "87%", y: "72%", delay: 0.7,  dur: 3.6 },
  { w: 2.5, x: "9%",  y: "62%", delay: 1.1,  dur: 4.5 },
  { w: 1.5, x: "54%", y: "85%", delay: 0.8,  dur: 3.2 },
];

// ─── Animated N path (drawn via pathLength) ───────────────────────────────────

function AnimatedN({ onDrawn }: { onDrawn: () => void }) {
  const uid  = useId().replace(/:/g, "s");
  const gid  = `sg-${uid}`;
  const fid  = `sf-${uid}`;

  const [scope, animate] = useAnimate();

  useEffect(() => {
    void animate(
      scope.current,
      { pathLength: 1, opacity: 1 },
      { delay: 0.36, duration: 0.72, ease: "easeOut" }
    ).then(() => {
      // brief glow pulse, then signal done
      void animate(scope.current, { filter: [`drop-shadow(0 0 12px ${N_GRAD_MID})`, `drop-shadow(0 0 4px ${N_GRAD_MID})`] }, { duration: 0.4 });
      setTimeout(onDrawn, 180);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg
      viewBox="0 0 260 260"
      width={96}
      height={96}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gid} x1="220" y1="28" x2="40" y2="234" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={N_GRAD_START} />
          <stop offset="42%"  stopColor={N_GRAD_MID}   />
          <stop offset="100%" stopColor={N_GRAD_END}    />
        </linearGradient>
        <filter id={fid} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
          <feFlood floodColor={N_GRAD_MID} floodOpacity="0.25" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        ref={scope}
        d="M 40,234 L 40,28 L 220,234 L 220,28"
        stroke={`url(#${gid})`}
        strokeWidth={57}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${fid})`}
        initial={{ pathLength: 0, opacity: 0 }}
      />
    </svg>
  );
}

// ─── Splash component ─────────────────────────────────────────────────────────

export function NoolySplash({ onDone }: { onDone: () => void }) {
  const [visible,    setVisible]    = useState(true);
  const [nDrawn,     setNDrawn]     = useState(false);
  const [showTagline, setShowTagline] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // After N is drawn, show tagline shortly after
  useEffect(() => {
    if (!nDrawn) return;
    const t = setTimeout(() => setShowTagline(true), 160);
    return () => clearTimeout(t);
  }, [nDrawn]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center select-none overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #060c1c 0%, #070c18 55%, #040911 100%)",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.012 }}
          transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Ambient radial glow ──────────────────────────────────────── */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: "70vw",
              height: "55vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: `radial-gradient(ellipse at center, ${N_GRAD_MID}22 0%, ${N_GRAD_END}08 55%, transparent 75%)`,
            }}
            animate={{ opacity: [0.65, 1, 0.7, 1, 0.65], scale: [1, 1.08, 1.03, 1.1, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── Phase 1: Comet entering from top-left ─────────────────── */}
          <motion.div
            className="absolute pointer-events-none rounded-full"
            style={{
              width: 8,
              height: 8,
              background: "white",
              boxShadow: `0 0 24px 10px ${N_GRAD_MID}cc, 0 0 6px 2px white`,
            }}
            initial={{ x: "-46vw", y: "-38vh", opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0] }}
            transition={{ delay: 0.04, duration: 0.28, ease: "easeIn" }}
          />

          {/* Comet trail */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: "55vw",
              height: 1,
              transformOrigin: "right center",
              background: `linear-gradient(90deg, transparent 0%, ${N_GRAD_MID}50 70%, white 100%)`,
              rotate: "39deg",
              top: "calc(50% - 19vh)",
              left: "-2vw",
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 0], opacity: [0, 0.7, 0] }}
            transition={{ delay: 0.05, duration: 0.28, ease: "easeOut" }}
          />

          {/* Phase 1 → 2 flash burst */}
          <motion.div
            className="absolute pointer-events-none rounded-full"
            style={{
              width: "28vw",
              height: "28vw",
              background: `radial-gradient(circle, ${N_GRAD_MID}40 0%, transparent 70%)`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 0], opacity: [0, 1, 0] }}
            transition={{ delay: 0.30, duration: 0.28, ease: "easeOut" }}
          />

          {/* ── Phase 2 + 3: N draws, then OOLY appears ──────────────── */}
          <div className="relative flex items-center" style={{ gap: "0.06em" }}>

            {/* Animated N ribbon */}
            <AnimatedN onDrawn={() => setNDrawn(true)} />

            {/* OOLY letters appear after N is drawn */}
            {OOLY.map((char, i) => (
              <motion.span
                key={char + i}
                initial={{ opacity: 0, x: -6 }}
                animate={nDrawn ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
                transition={{
                  delay: nDrawn ? i * 0.08 : 0,
                  duration: 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "3.6rem",
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: "rgba(255,255,255,0.90)",
                }}
              >
                {char}
              </motion.span>
            ))}
          </div>

          {/* ── Phase 4: Tagline ─────────────────────────────────────────── */}
          <motion.p
            className="absolute"
            style={{
              bottom: "19%",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.60rem",
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              color: "rgba(255,255,255,0.28)",
              fontFamily: "var(--font-sans)",
            }}
            initial={{ opacity: 0 }}
            animate={showTagline ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            Family Finance
          </motion.p>

          {/* ── Ambient particles ──────────────────────────────────────── */}
          {PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{ width: p.w, height: p.w, left: p.x, top: p.y, background: `${N_GRAD_MID}88` }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.7, 0.4, 0], y: -32 }}
              transition={{ delay: p.delay, duration: p.dur, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
