import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { NetworkDiagram } from '../illustrations/NetworkDiagram';
import { TransformerSymbol } from '../illustrations/TransformerSymbol';
import { SectionIndex } from '../ui';

export const CAPABILITIES = [
  {
    title: 'Monitoring',
    to: '/dashboard',
    body: 'Live temperature, oil level, load, voltage and current for every transformer, with network-wide summaries and trends.',
  },
  {
    title: 'Fault detection',
    to: '/alerts',
    body: 'Threshold rules for overheating, low oil, overloading, abnormal voltage and current, sensor failure and stale readings.',
  },
  {
    title: 'Health scoring',
    to: '/transformers',
    body: 'A weighted 0–100 score per transformer, so the registry can be sorted by what needs attention first.',
  },
  {
    title: '3D visualization',
    to: '/grid',
    body: 'The whole network in space, coloured by status. Select a transformer to inspect it in context.',
  },
  {
    title: 'Maintenance',
    to: '/maintenance',
    body: 'Tasks with priority, assignment and due dates, linked to the alerts and transformers they resolve.',
  },
  {
    title: 'Analytics',
    to: '/reports',
    body: 'Fault frequency, health distribution and maintenance throughput, exportable for review.',
  },
] as const;

function Row({ i, className, compact }: { i: number; className?: string; compact?: boolean }) {
  const c = CAPABILITIES[i];
  return (
    <Link
      to={c.to}
      className={clsx('pp-row group grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-4 border-t border-ink/15 py-7 md:gap-x-8 md:py-10',
        compact ? 'md:grid-cols-9' : 'md:grid-cols-12',
        className)}
    >
      <span className="pp-label text-muted md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
      <span className={clsx('pp-row__title pp-display text-display-sm md:text-display-md', compact ? 'md:col-span-4' : 'md:col-span-6')}>
        {c.title}
      </span>
      <span className="pp-row-arrow md:order-last md:col-span-1 md:justify-self-end">
        <ArrowRight aria-hidden="true" className="h-6 w-6 md:h-8 md:w-8" strokeWidth={1.5} />
      </span>
      <span className={clsx('col-span-3 mt-4 flex flex-col gap-3 md:mt-0', compact ? 'md:col-span-3' : 'md:col-span-4')}>
        <span className="max-w-md text-base leading-relaxed text-muted">{c.body}</span>
        <span className="pp-label text-ink">{c.to}</span>
      </span>
    </Link>
  );
}

/**
 * Editorial index rather than a card grid: large numbered rows for most capabilities, one
 * split composition with a drawing (3D visualization), and one inset "spec" row (Health scoring).
 */
export function Capabilities() {
  return (
    <section id="capabilities" aria-labelledby="capabilities-title" className="pp-section border-t border-ink/15">
      <div className="container-content">
        <div className="mb-16 grid grid-cols-1 gap-y-10 md:mb-24 md:grid-cols-12 md:gap-x-8">
          <SectionIndex n="06" label="Capabilities" className="text-muted md:col-span-12" />
          <RevealLines
            id="capabilities-title"
            className="pp-display text-display-lg md:col-span-9"
            lines={['ONE PLATFORM,', 'SIX INSTRUMENTS.']}
            lineClassNames={[undefined, 'md:pl-[10%]']}
          />
        </div>

        <nav aria-label="Capabilities">
          <Reveal>
            <Row i={0} />
            <Row i={1} />
          </Reveal>

          {/* Inset spec row */}
          <Reveal>
            <div className="grid grid-cols-1 border-t border-ink/15 md:grid-cols-12 md:gap-x-8">
              <div className="hidden items-center justify-center border-r border-ink/15 md:col-span-3 md:flex" aria-hidden="true">
                <TransformerSymbol className="h-16 w-auto text-ink" />
              </div>
              <Row i={2} compact className="border-t-0 md:col-span-9" />
            </div>
          </Reveal>

          {/* Split composition */}
          <Reveal>
            <div className="grid grid-cols-1 border-t border-ink/15 bg-ink text-paper md:grid-cols-12">
              <Link to={CAPABILITIES[3].to} className="pp-row group flex flex-col justify-between gap-10 p-6 md:col-span-5 md:p-10">
                <span className="pp-label text-paper/60">04</span>
                <span>
                  <span className="pp-row__title pp-display block text-display-sm">{CAPABILITIES[3].title}</span>
                  <span className="mt-4 block max-w-sm text-base leading-relaxed text-paper/70">{CAPABILITIES[3].body}</span>
                  <span className="pp-label mt-4 inline-flex items-center gap-3 text-paper">
                    {CAPABILITIES[3].to}
                    <ArrowRight aria-hidden="true" className="pp-row-arrow h-5 w-5" strokeWidth={1.5} />
                  </span>
                </span>
              </Link>
              <div className="border-t border-paper/15 p-6 text-paper/80 md:col-span-7 md:border-l md:border-t-0 md:p-10" aria-hidden="true">
                <NetworkDiagram className="h-auto w-full" title="" />
              </div>
            </div>
          </Reveal>

          <Reveal>
            <Row i={4} />
            <Row i={5} className="border-b" />
          </Reveal>
        </nav>
      </div>
    </section>
  );
}
