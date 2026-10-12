import { useRef } from 'react';
import { motion, useReducedMotion, useScroll } from 'framer-motion';
import clsx from 'clsx';
import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { ArrowLink, SectionIndex } from '../ui';

const STEPS = [
  {
    title: 'Fault identified',
    state: 'ALERT · NEW',
    body: 'A rule match opens an alert with its severity, fault type and the readings that triggered it.',
  },
  {
    title: 'Alert acknowledged',
    state: 'ALERT · ACKNOWLEDGED',
    body: 'An operator acknowledges the alert, so the team can see someone has picked it up.',
  },
  {
    title: 'Technician assigned',
    state: 'TASK · ASSIGNED',
    body: 'A maintenance task is raised with a priority and due date, and assigned to a technician.',
  },
  {
    title: 'Inspection completed',
    state: 'TASK · COMPLETED',
    body: 'Findings and work notes are recorded against the transformer’s history.',
  },
  {
    title: 'Incident resolved',
    state: 'ALERT · RESOLVED',
    body: 'The alert is resolved and the event joins the fault history, with duration and peak values.',
  },
];

export function Maintenance() {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 75%', 'end 60%'] });

  return (
    <section aria-labelledby="maintenance-title" className="pp-section border-t border-ink/15">
      <div className="container-content grid grid-cols-1 gap-y-14 md:grid-cols-12 md:gap-x-8">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-[calc(var(--header-h)+3rem)]">
            <SectionIndex n="05" label="Maintenance" className="mb-10 text-muted" />
            <RevealLines
              id="maintenance-title"
              className="pp-display text-[clamp(2rem,4.2vw,4.5rem)]"
              lines={['FROM WARNING', 'TO WORK COMPLETED.']}
            />
            <p className="mt-8 max-w-sm text-base leading-relaxed text-muted">
              One record follows the event from first signal to closed incident: who acknowledged it, who was assigned,
              what was found.
            </p>
            <div className="mt-8">
              <ArrowLink to="/maintenance">Open maintenance</ArrowLink>
            </div>
          </div>
        </div>

        <div className="relative md:col-span-7 md:col-start-6">
          {/* Spine: hairline track with an ink fill that follows scroll (both directions). */}
          <div className="absolute bottom-6 left-[11px] top-6 w-px bg-ink/15" aria-hidden="true">
            <motion.div
              className="h-full w-full origin-top bg-ink"
              style={{ scaleY: reduce ? 1 : scrollYProgress }}
            />
          </div>
          <ol ref={listRef} className="relative" aria-label="Maintenance workflow">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative grid grid-cols-[24px_1fr] gap-x-6 pb-14 last:pb-0">
              <span
                aria-hidden="true"
                className={clsx(
                  'relative z-10 mt-2 h-[23px] w-[23px] border border-ink',
                  i === STEPS.length - 1 ? 'bg-accent' : 'bg-paper',
                )}
              >
                <span className="absolute inset-[6px] bg-ink" />
              </span>
              <Reveal delay={0.05}>
                <p className="pp-label flex flex-wrap gap-x-4 text-muted">
                  <span>Step {String(i + 1).padStart(2, '0')}</span>
                  <span className="text-ink">{s.state}</span>
                </p>
                <h3 className="mt-2 font-display text-display-sm font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">{s.body}</p>
              </Reveal>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
