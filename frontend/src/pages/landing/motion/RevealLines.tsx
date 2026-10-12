import { Fragment, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { DUR_REVEAL, EASE_REVEAL, STAGGER_LINE, VIEW_MARGIN } from './tokens';

type Tag = 'h1' | 'h2' | 'h3' | 'p';

export interface RevealLinesProps {
  lines: string[];
  as?: Tag;
  id?: string;
  className?: string;
  /** Extra classes per line (by index), used for asymmetric indents. */
  lineClassNames?: (string | undefined)[];
  delay?: number;
  /** Reveal on mount (hero) instead of when scrolled into view. */
  onMount?: boolean;
}

/**
 * Masked line-by-line reveal: each line sits in an overflow-hidden mask and slides up.
 * The text is always in the DOM, so assistive tech reads it immediately; only the transform
 * animates. With reduced motion it renders in place.
 */
export function RevealLines({ lines, as = 'h2', id, className, lineClassNames, delay = 0, onMount }: RevealLinesProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: VIEW_MARGIN });
  const shown = !!reduce || !!onMount || inView;
  const Comp = as as 'h2';

  return (
    <Comp id={id} ref={ref} className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          <span className={clsx('pp-line-mask', lineClassNames?.[i])}>
            <motion.span
              className="block"
              initial={reduce ? false : { y: '110%' }}
              animate={shown ? { y: '0%' } : { y: '110%' }}
              transition={{ duration: DUR_REVEAL, ease: EASE_REVEAL, delay: delay + i * STAGGER_LINE }}
            >
              {line}
            </motion.span>
          </span>
          {i < lines.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Comp>
  );
}
