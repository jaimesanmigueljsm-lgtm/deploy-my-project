import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Letter definitions ───────────────────────────────────────────────────────

const LETTERS: { char: string; hero: boolean }[] = [
  { char: "N", hero: true  },
  { char: "O", hero: false },
  { char: "O", hero: false },
  { char: "L", hero: false },
  { char: "Y", hero: false },
];

// ─── Floating particle config ─────────────────────────────────────────────────

const PARTICLES = [
  { size: 2,   x: "18%",  y: "72%", delay: 0.4,  dur: 3.2 },
  { size: 3,   x: "78%",  y: "65%", delay: 0.9,  dur: 4.0 },
  { size: 1.5, x: "35%",  y: "80%", delay: 0.2,  dur: 3.6 },
  { size: 2,   x: "62%",  y: "78%", delay: 1.2,  dur: 2.8 },
  { size: 1.5, x: "88%",  y: "70%", delay: 0.6,  dur: 3.4 },
  { size: 2.5, x: "10%",  y: "60%", delay: 1.0,  dur: 4.2 },
];

// ─── Splash component ─────────────────────────────────────────────────────────

export function NoolySplash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, []);

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
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Ambient radial glow ─────────────────────────────────────── */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: "75vw",
              height: "55vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, oklch(0.42 0.15 158 / 0.18) 0%, oklch(0.38 0.12 200 / 0.06) 55%, transparent 75%)",
            }}
            animate={{ opacity: [0.7, 1, 0.75, 1, 0.7], scale: [1, 1.08, 1.03, 1.1, 1] }}
            transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── Secondary sky-tinted glow (depth) ──────────────────────── */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              width: "40vw",
              height: "35vh",
              top: "38%",
              left: "55%",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, oklch(0.42 0.12 210 / 0.09) 0%, transparent 70%)",
            }}
            animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.12, 1] }}
            transition={{ duration: 4.0, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          />

          {/* ── Vertical light streak ───────────────────────────────────── */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: "-5%",
              left: "50%",
              width: "1px",
              height: "110%",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.0) 25%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.0) 75%, transparent 100%)",
            }}
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "100%", opacity: [0, 0.9, 0.9, 0] }}
            transition={{ delay: 0.04, duration: 0.30, ease: "easeInOut" }}
          />

          {/* ── NOOLY wordmark ───────────────────────────────────────────── */}
          <div
            className="relative flex items-baseline"
            style={{ gap: "0.008em" }}
          >
            {LETTERS.map(({ char, hero }, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: hero ? 18 : 11, scale: hero ? 0.82 : 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.16 + i * 0.092,
                  duration: hero ? 0.68 : 0.40,
                  ease: hero
                    ? ([0.34, 1.56, 0.64, 1] as [number, number, number, number])
                    : ([0.22, 1, 0.36, 1] as [number, number, number, number]),
                }}
                style={
                  hero
                    ? {
                        fontFamily: "var(--font-display)",
                        fontSize: "5.25rem",
                        fontWeight: 900,
                        lineHeight: 1,
                        letterSpacing: "-0.045em",
                        background:
                          "linear-gradient(135deg, oklch(0.82 0.18 152) 0%, oklch(0.70 0.16 168) 48%, oklch(0.72 0.13 202) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        paddingRight: "0.015em",
                      }
                    : {
                        fontFamily: "var(--font-display)",
                        fontSize: "3.75rem",
                        fontWeight: 900,
                        lineHeight: 1,
                        letterSpacing: "-0.045em",
                        color: "rgba(255,255,255,0.88)",
                      }
                }
              >
                {char}
              </motion.span>
            ))}
          </div>

          {/* ── Tagline ──────────────────────────────────────────────────── */}
          <motion.p
            className="absolute"
            style={{
              bottom: "19%",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "0.62rem",
              letterSpacing: "0.30em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              color: "rgba(255,255,255,0.28)",
              fontFamily: "var(--font-sans)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.92, duration: 0.55, ease: "easeOut" }}
          >
            Family Finance
          </motion.p>

          {/* ── Ambient particles ────────────────────────────────────────── */}
          {PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: p.size,
                height: p.size,
                left: p.x,
                top: p.y,
                background: "oklch(0.75 0.14 158 / 0.55)",
              }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.7, 0.5, 0], y: -28 }}
              transition={{
                delay: p.delay,
                duration: p.dur,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
