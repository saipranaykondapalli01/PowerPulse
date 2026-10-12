import { useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { RevealLines } from '../motion/RevealLines';
import { DESKTOP_QUERY, useMediaQuery } from '../motion/useMediaQuery';
import { TransformerSymbol } from '../illustrations/TransformerSymbol';
import { SectionIndex } from '../ui';

export const FAULT_STEPS = [
  {
    title: 'Reading changes',
    tag: 'READING · temperatureC',
    body: 'A new simulated reading arrives. Temperature has been climbing and now crosses the configured warning threshold.',
  },
  {
    title: 'Rule matches',
    tag: 'RULE · OVERHEATING',
    body: 'Every reading is checked against warning and critical thresholds. Here the overheating rule matches.',
  },
  {
    title: 'Alert is created',
    tag: 'ALERT · NEW',
    body: 'An alert opens with a severity taken from the threshold band, and a fault incident is recorded with the readings that triggered it.',
  },
  {
    title: 'Transformer is highlighted',
    tag: 'STATUS → WARNING',
    body: 'The transformer’s status changes, and it is flagged on the dashboard, in the registry and on the 3D grid.',
  },
] as const;

// Chart geometry: the reading line crosses the WARN threshold at x = 300.
const LINE = 'M0 124 L40 120 L80 126 L120 116 L160 112 L200 104 L240 92 L270 80 L300 64 L330 50 L360 42 L400 36';
const OVER = 'M300 64 L330 50 L360 42 L400 36';
const WARN_Y = 64;

function Stage({ active, children, className }: { active: boolean; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={clsx('relative border p-4', active ? 'border-ink' : 'border-dashed border-ink/30', className)}
      initial={false}
      animate={{ opacity: active ? 1 : 0.35 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

/** The technical diagram at a given step. `draw` (0–1) scrubs the reading line when pinned. */
export function FaultDiagram({ step, draw }: { step: number; draw?: MotionValue<number> }) {
  const matched = step >= 1;
  const alerted = step >= 2;
  const flagged = step >= 3;
  return (
    <div className="border border-ink bg-paper p-4 md:p-6" aria-hidden="true">
      <div className="pp-label mb-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-muted">
        <span className="normal-case">temperatureC · simulated</span>
        <span>{matched ? 'THRESHOLD CROSSED' : 'MONITORING'}</span>
      </div>
      <svg viewBox="0 0 400 150" className="h-auto w-full" fill="none">
        {[30, 60, 90, 120].map((y) => (
          <path key={y} d={`M0 ${y} H400`} stroke="currentColor" strokeOpacity="0.08" />
        ))}
        <path d={`M0 ${WARN_Y} H400`} stroke="rgb(var(--warning))" strokeDasharray="4 4" strokeWidth="1.25" />
        <text x="4" y={WARN_Y - 6} fontFamily="var(--font-mono)" fontSize="8" letterSpacing="0.08em" fill="rgb(var(--ink))">
          WARN
        </text>
        <motion.path d={LINE} stroke="currentColor" strokeWidth="2" style={draw ? { pathLength: draw } : undefined} />
        <motion.path
          d={OVER}
          stroke="rgb(var(--warning))"
          strokeWidth="2.5"
          initial={false}
          animate={{ opacity: matched ? 1 : 0 }}
        />
        <motion.g initial={false} animate={{ opacity: matched ? 1 : 0, scale: matched ? 1 : 0.6 }} style={{ originX: '300px', originY: `${WARN_Y}px` }}>
          <circle cx="300" cy={WARN_Y} r="9" stroke="rgb(var(--warning))" strokeWidth="1.5" />
          <circle cx="300" cy={WARN_Y} r="3" fill="rgb(var(--warning))" />
        </motion.g>
      </svg>

      <div className="mt-5 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Stage active={matched}>
          <p className="pp-label text-muted">Rule · Overheating</p>
          <p className="mt-2 font-mono text-sm">temperatureC ≥ warn</p>
          <p className={clsx('pp-label mt-3', matched ? 'text-ink' : 'text-muted')}>{matched ? '✓ Match' : 'Evaluating'}</p>
        </Stage>
        <ArrowRight className="hidden h-4 w-4 self-center text-muted sm:block" />
        <Stage active={alerted} className={alerted ? 'bg-warning/15' : undefined}>
          <p className="pp-label text-muted">Alert</p>
          <p className="mt-2 font-mono text-sm">OVERHEATING</p>
          <p className="pp-label mt-3 inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-warning" />
            Medium · New
          </p>
        </Stage>
        <ArrowRight className="hidden h-4 w-4 self-center text-muted sm:block" />
        <Stage active={flagged}>
          <p className="pp-label text-muted">Transformer</p>
          <TransformerSymbol className="mt-1 h-10 w-auto" tone={flagged ? 'rgb(var(--warning))' : 'currentColor'} />
          <p className="pp-label mt-1">Status {flagged ? 'Warning' : 'Healthy'}</p>
        </Stage>
      </div>
    </div>
  );
}

function StepText({ i, active = true }: { i: number; active?: boolean }) {
  const s = FAULT_STEPS[i];
  return (
    <div className={clsx('transition-opacity duration-base', active ? 'opacity-100' : 'opacity-40')}>
      <p className="pp-label flex gap-3 text-muted">
        <span>{String(i + 1).padStart(2, '0')}</span>
        <span className="normal-case">{s.tag}</span>
      </p>
      <h3 className="mt-2 font-display text-[clamp(1.4rem,2.3vw,2.25rem)] leading-tight font-semibold tracking-tight">{s.title}</h3>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">{s.body}</p>
    </div>
  );
}

function PinnedSequence() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => setStep(Math.min(3, Math.max(0, Math.floor(p * 4)))));
  const draw = useTransform(scrollYProgress, [0, 0.22], [0.12, 1]);
  const rail = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={trackRef} className="relative h-[340vh]" data-testid="fault-sequence" data-mode="pinned">
      <div className="sticky top-[var(--header-h)] flex h-[calc(100vh-var(--header-h))] items-center">
        <div className="container-content grid grid-cols-12 items-center gap-8">
          <div className="relative col-span-5 lg:col-span-4">
            <div className="absolute bottom-0 left-0 top-0 w-px bg-ink/15" aria-hidden="true">
              <motion.div className="h-full w-full origin-top bg-ink" style={{ scaleY: rail }} />
            </div>
            <ol className="space-y-8 pl-6" aria-label="Fault detection sequence">
              {FAULT_STEPS.map((_, i) => (
                <li key={i} aria-current={i === step ? 'step' : undefined}>
                  <StepText i={i} active={i === step} />
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-7 lg:col-span-7 lg:col-start-6">
            <FaultDiagram step={step} draw={draw} />
            <p className="pp-label mt-3 text-muted">Illustrative sequence · how PowerPulse rules evaluate readings</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaticSequence() {
  return (
    <div className="container-content" data-testid="fault-sequence" data-mode="static">
      <ol className="space-y-16" aria-label="Fault detection sequence">
        {FAULT_STEPS.map((_, i) => (
          <li key={i} className="grid grid-cols-1 gap-6 border-t border-ink/15 pt-8 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-5">
              <StepText i={i} />
            </div>
            <div className="md:col-span-7">
              <FaultDiagram step={i} />
            </div>
          </li>
        ))}
      </ol>
      <p className="pp-label mt-6 text-muted">Illustrative sequence · how PowerPulse rules evaluate readings</p>
    </div>
  );
}

export function FaultSequence() {
  const reduce = useReducedMotion();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const pinned = desktop && !reduce;

  return (
    <section aria-labelledby="fault-title" className="border-t border-ink/15 pt-[var(--section-y)]">
      <div className="container-content mb-14 grid grid-cols-1 gap-y-10 md:mb-6 md:grid-cols-12 md:gap-x-8">
        <SectionIndex n="04" label="Fault detection" className="text-muted md:col-span-12" />
        <RevealLines
          id="fault-title"
          className="pp-display text-display-lg md:col-span-9"
          lines={['WHEN THE SIGNAL', 'CHANGES, KNOW.']}
          lineClassNames={[undefined, 'md:pl-[18%]']}
        />
        <p className="self-end text-base leading-relaxed text-muted md:col-span-3">
          Rule-based detection: transparent thresholds you can read, tune and audit. Scroll through one event, from
          reading to highlighted transformer.
        </p>
      </div>
      {pinned ? <PinnedSequence /> : <StaticSequence />}
      <div className="h-[var(--section-y)]" aria-hidden="true" />
    </section>
  );
}
