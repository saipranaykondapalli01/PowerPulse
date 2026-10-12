import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { SectionIndex } from '../ui';

const LEAD = [
  'Temperature creeping past its usual band.',
  'Oil level drifting lower, week over week.',
  'Load, voltage and current leaving their normal range.',
  'Each reading on its own is a clue. Together they point',
  'to the transformer that needs a closer look, before it fails.',
];

const SIGNALS = [
  { key: 'TEMPERATURE', unit: '°C', text: 'Sustained heat can point to overloading, a cooling problem or insulation under stress.' },
  { key: 'OIL LEVEL', unit: '%', text: 'A falling level can indicate a leak, and less oil means less cooling and insulation.' },
  { key: 'LOAD', unit: '% RATED', text: 'Running above rated capacity raises temperature and accelerates ageing.' },
  { key: 'VOLTAGE', unit: 'V', text: 'Out-of-band voltage can signal supply problems or an unsuitable tap setting.' },
  { key: 'CURRENT', unit: 'A', text: 'Unusual current can reveal phase imbalance or a problem downstream.' },
];

export function Intro() {
  return (
    <section aria-labelledby="intro-title" className="pp-section border-t border-ink/15">
      <div className="container-content grid grid-cols-1 gap-y-14 md:grid-cols-12 md:gap-x-8">
        <SectionIndex n="01" label="Signal" className="text-muted md:col-span-12" />
        <RevealLines
          id="intro-title"
          className="pp-display text-display-lg md:col-span-10"
          lines={['EVERY TRANSFORMER', 'TELLS A STORY.']}
          lineClassNames={[undefined, 'md:pl-[20%]']}
        />

        <RevealLines
          as="p"
          className="pp-lead text-ink md:col-span-7 md:col-start-6"
          lines={LEAD}
          delay={0.1}
        />

        <div className="md:col-span-12">
          <p className="pp-label mb-6 text-muted">What abnormal readings can mean</p>
          <dl className="grid grid-cols-1 border-t border-ink/15 sm:grid-cols-2 lg:grid-cols-5">
            {SIGNALS.map((s, i) => (
              <Reveal
                key={s.key}
                delay={i * 0.06}
                className="border-b border-ink/15 py-6 sm:pr-6 lg:border-b-0 lg:border-r lg:px-5 lg:first:pl-0 lg:last:border-r-0"
              >
                <dt className="flex items-baseline justify-between gap-3">
                  <span className="pp-label text-ink">{s.key}</span>
                  <span className="pp-label text-muted">{s.unit}</span>
                </dt>
                <dd className="mt-4 text-sm leading-relaxed text-muted">{s.text}</dd>
              </Reveal>
            ))}
          </dl>
          <p className="mt-6 max-w-prose text-sm text-muted">
            PowerPulse checks each reading against configurable warning and critical thresholds. A match is a reason to
            investigate, not a diagnosis.
          </p>
        </div>
      </div>
    </section>
  );
}
