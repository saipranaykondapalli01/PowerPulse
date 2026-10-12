import { usePublicNetworkPreview } from '@/hooks/useMonitoring';
import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { AnimatedNumber } from '../motion/AnimatedNumber';
import { average, countReporting, type NumericField } from '../data';
import { SectionIndex } from '../ui';

interface Metric {
  field: NumericField;
  label: string;
  unit: string;
  decimals: number;
  note: string;
}

const METRICS: Metric[] = [
  { field: 'temperatureC', label: 'Temperature', unit: '°C', decimals: 1, note: 'Mean transformer temperature' },
  { field: 'oilLevelPct', label: 'Oil level', unit: '%', decimals: 1, note: 'Mean oil level' },
  { field: 'voltageV', label: 'Voltage', unit: 'V', decimals: 0, note: 'Mean measured voltage' },
  { field: 'currentA', label: 'Current', unit: 'A', decimals: 0, note: 'Mean measured current' },
  { field: 'loadPct', label: 'Load', unit: '%', decimals: 1, note: 'Mean load as % of rated kVA' },
  { field: 'healthScore', label: 'Health', unit: '/100', decimals: 0, note: 'Mean health score' },
];

export function Monitoring() {
  const { data, isError } = usePublicNetworkPreview();
  const nodes = isError ? undefined : data;
  const reporting = countReporting(nodes);

  return (
    <section aria-labelledby="monitoring-title" className="pp-section border-t border-ink/15">
      <div className="container-content grid grid-cols-1 gap-y-12 md:grid-cols-12 md:gap-x-8">
        <SectionIndex n="03" label="Monitoring" className="text-muted md:col-span-12" />
        <RevealLines
          id="monitoring-title"
          className="pp-display text-display-lg md:col-span-7"
          lines={['KNOW WHAT', 'IS HAPPENING.']}
        />
        <div className="flex flex-col justify-end gap-4 md:col-span-4 md:col-start-9">
          <p className="pp-label text-ink">Simulated readings</p>
          <p className="text-base leading-relaxed text-muted">
            {nodes?.length
              ? `Network averages across ${reporting} reporting transformer${reporting === 1 ? '' : 's'}, from the public preview feed. Values update as the simulation runs.`
              : 'Network averages from the public preview feed. Readings appear here when the PowerPulse server is running.'}
          </p>
        </div>

        <div className="md:col-span-12">
          <dl className="grid grid-cols-1 border-t border-ink sm:grid-cols-2 lg:grid-cols-3" aria-label="Simulated network readings">
            {METRICS.map((m, i) => (
              <Reveal
                key={m.field}
                delay={(i % 3) * 0.08}
                className="flex flex-col justify-between gap-8 border-b border-ink/15 py-8 sm:odd:pr-8 lg:border-r lg:px-8 lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(3n+1)]:pl-0"
              >
                <dt className="flex items-baseline justify-between gap-4">
                  <span className="pp-label text-ink">
                    <span className="text-muted">{String(i + 1).padStart(2, '0')} </span>
                    {m.label}
                  </span>
                  <span className="text-xs text-muted">{m.note}</span>
                </dt>
                <dd className="flex items-baseline gap-2" data-testid={`metric-${m.field}`}>
                  <AnimatedNumber
                    value={average(nodes, m.field)}
                    decimals={m.decimals}
                    className="tabular font-display text-metric font-semibold"
                  />
                  <span className="pp-label text-muted">{m.unit}</span>
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
