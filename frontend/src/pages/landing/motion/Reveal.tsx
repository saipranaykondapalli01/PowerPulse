import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { DUR_REVEAL, DUR_SLOW, EASE_REVEAL, VIEW_MARGIN } from './tokens';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** 'rise' = short fade-up; 'clip' = inset wipe from the top edge (for diagrams and panels). */
  variant?: 'rise' | 'clip';
}

/** One-shot in-view reveal using only transform, opacity and clip-path. Static with reduced motion. */
export function Reveal({ children, className, delay = 0, variant = 'rise' }: RevealProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: VIEW_MARGIN });

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  if (variant === 'clip') {
    // Observe an unclipped wrapper: Chromium intersects against the target's own clip-path,
    // so a fully clipped target would never report as visible.
    const hiddenClip = { clipPath: 'inset(0% 0% 100% 0%)' };
    return (
      <div ref={ref} className={className}>
        <motion.div
          initial={hiddenClip}
          animate={inView ? { clipPath: 'inset(0% 0% 0% 0%)' } : hiddenClip}
          transition={{ duration: DUR_REVEAL * 1.2, ease: EASE_REVEAL, delay }}
        >
          {children}
        </motion.div>
      </div>
    );
  }

  const hidden = { opacity: 0, y: 24 };
  const visible = { opacity: 1, y: 0 };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={hidden}
      animate={inView ? visible : hidden}
      transition={{ duration: DUR_SLOW, ease: EASE_REVEAL, delay }}
    >
      {children}
    </motion.div>
  );
}
