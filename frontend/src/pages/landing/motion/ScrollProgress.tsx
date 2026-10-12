import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

/** Thin reading-progress hairline pinned to the top edge. Decorative. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden="true"
      data-testid="scroll-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-ink"
      style={{ scaleX: reduce ? scrollYProgress : smooth }}
    />
  );
}
