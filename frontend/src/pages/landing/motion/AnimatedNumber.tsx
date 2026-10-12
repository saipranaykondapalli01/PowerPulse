import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { EASE_OUT } from './tokens';

export const formatNumber = (v: number, decimals: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

interface AnimatedNumberProps {
  /** null or undefined renders an em dash, never an invented number. */
  value: number | null | undefined;
  decimals?: number;
  className?: string;
}

/**
 * Renders the real value immediately (so it is correct without animation, in tests and for
 * assistive tech), counts up once when it scrolls into view, and tweens on later updates.
 */
export function AnimatedNumber({ value, decimals = 0, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(value ?? 0);
  const text = useTransform(mv, (v) => formatNumber(v, decimals));
  const counted = useRef(false);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    if (reduce || !inView) {
      mv.set(value);
      return;
    }
    if (!counted.current) {
      counted.current = true;
      mv.set(0);
    }
    const controls = animate(mv, value, { duration: 1.4, ease: EASE_OUT });
    return () => controls.stop();
  }, [value, inView, reduce, mv]);

  if (value == null || Number.isNaN(value)) {
    return <span className={className}>—</span>;
  }
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
