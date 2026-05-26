import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function NoolySplash({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1100);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center select-none"
          style={{ background: "#070c18" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Ambient pulse */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 50%, oklch(0.40 0.14 158 / 0.12) 0%, transparent 70%)",
            }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Logo group */}
          <motion.div
            className="relative flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.82, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* N mark */}
            <div
              className="size-[72px] rounded-[22px] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, oklch(0.68 0.14 158), oklch(0.56 0.13 175))",
                boxShadow:
                  "0 0 0 1px oklch(0.68 0.14 158 / 0.3), 0 20px 60px -10px oklch(0.62 0.14 158 / 0.55)",
              }}
            >
              <span
                className="text-white font-bold text-4xl leading-none"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
              >
                N
              </span>
            </div>

            {/* Wordmark */}
            <motion.span
              className="text-white font-bold text-2xl tracking-[-0.02em] leading-none"
              style={{ fontFamily: "var(--font-display)" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.35, ease: "easeOut" }}
            >
              NOOLY
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
