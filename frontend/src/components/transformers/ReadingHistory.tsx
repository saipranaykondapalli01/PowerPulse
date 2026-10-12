import { useMemo, useState } from 'react';
import { useTransformerReadings } from '@/hooks/useMonitoring';
import { formatDateTime, formatNumber, formatWithUnit } from '@/utils/format';
import type { ReadingDto, SystemSettingsDto, TransformerDetailDto } from '@/types/api';
import { Panel } from '@/components/ui/Panel';
import { Tabs } from '@/components/ui/Tabs';
import { DateRangePicker, presetRange, type DateRange } from '@/components/ui/DateRangePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { metricColors, TimeSeriesChart, type MetricColorKey, type ReferenceMark } from '@/components/charts';

type Metric = 'temperatureC' | 'oilLevelPct' | 'voltageV' | 'currentA' | 'loadPct';

const METRICS: { id: Metric; label: string; unit: string; axis: string; digits: number; color: MetricColorKey }[] = [
  { id: 'temperatureC', label: 'Temperature', unit: '°C', axis: 'Temperature (°C)', digits: 1, color: 'temperature' },
  { id: 'oilLevelPct', label: 'Oil level', unit: '%', axis: 'Oil level (%)', digits: 1, color: 'secondary' },
  { id: 'voltageV', label: 'Voltage', unit: 'V', axis: 'Voltage (V)', digits: 0, color: 'neutral' },
  { id: 'currentA', label: 'Current', unit: 'A', axis: 'Current (A)', digits: 0, color: 'neutral' },
  { id: 'loadPct', label: 'Load', unit: '%', axis: 'Load (% of rated)', digits: 1, color: 'load' },
];

/**
 * Reference lines per metric. Rated values come from the transformer itself (visible to all roles);
 * warning/critical thresholds come from settings, which only ADMIN/ENGINEER can read.
 */
function referencesFor(metric: Metric, t: TransformerDetailDto, settings?: SystemSettingsDto): ReferenceMark[] {
  const th = settings?.thresholds;
  switch (metric) {
    case 'temperatureC':
      return th ? [
        { y: th.temperatureC.warn, label: 'Warn', tone: 'warning' },
        { y: th.temperatureC.critical, label: 'Critical', tone: 'critical' },
      ] : [];
    case 'oilLevelPct':
      return th ? [
        { y: th.oilLevelPct.warn, label: 'Warn', tone: 'warning' },
        { y: th.oilLevelPct.critical, label: 'Critical', tone: 'critical' },
      ] : [];
    case 'loadPct':
      return th ? [
        { y: th.loadPct.warn, label: 'Warn', tone: 'warning' },
        { y: th.loadPct.critical, label: 'Critical', tone: 'critical' },
      ] : [];
    case 'voltageV': {
      const rated = t.secondaryVoltageV;
      const refs: ReferenceMark[] = [{ y: rated, label: 'Rated', tone: 'neutral' }];
      if (th) {
        const c = th.voltageDeviationPct.critical / 100;
        refs.push({ y: rated * (1 + c), label: 'Critical +', tone: 'critical' }, { y: rated * (1 - c), label: 'Critical −', tone: 'critical' });
      }
      return refs;
    }
    case 'currentA': {
      const rated = t.ratedCurrentA;
      const refs: ReferenceMark[] = [{ y: rated, label: 'Rated', tone: 'neutral' }];
      if (th) refs.push({ y: (rated * th.currentPctOfRated.critical) / 100, label: 'Critical', tone: 'critical' });
      return refs;
    }
  }
}

export function ReadingHistory({ transformer, settings }: { transformer: TransformerDetailDto; settings?: SystemSettingsDto }) {
  const [metric, setMetric] = useState<Metric>('temperatureC');
  const [range, setRange] = useState<DateRange>(() => presetRange('24h'));
  const readings = useTransformerReadings(transformer.id, { from: range.from, to: range.to, maxPoints: 500 });
  const m = METRICS.find((x) => x.id === metric)!;
  const references = useMemo(() => referencesFor(metric, transformer, settings), [metric, transformer, settings]);

  return (
    <Panel
      eyebrow="Telemetry history"
      title="Reading history"
      description={
        settings
          ? 'Dashed lines mark configured warning/critical thresholds (demo defaults, not universal safety limits).'
          : 'Rated values shown as reference lines. Thresholds are visible to Admins and Engineers.'
      }
      actions={<DateRangePicker value={range} onChange={setRange} allowClear={false} custom={false} label="History range" />}
    >
      <Tabs
        label="Metric"
        tabs={METRICS.map((x) => ({ id: x.id, label: `${x.label} (${x.unit})` }))}
        value={metric}
        onChange={setMetric}
      >
        {readings.isPending ? (
          <Skeleton className="h-[260px] w-full" />
        ) : readings.isError && !readings.data ? (
          <ErrorState error={readings.error} onRetry={() => void readings.refetch()} compact />
        ) : readings.data.length === 0 ? (
          <EmptyState compact title="No readings in this range" description="Try a longer range." />
        ) : (
          <TimeSeriesChart<ReadingDto & Record<string, unknown>>
            label={`${m.label} over time in ${m.unit}`}
            data={readings.data as (ReadingDto & Record<string, unknown>)[]}
            xKey="recordedAt"
            unit={m.unit}
            yLabel={m.axis}
            digits={m.digits}
            height={260}
            references={references}
            series={[{ key: metric, label: m.label, color: metricColors[m.color] }]}
            caption={(() => {
              const last = readings.data[readings.data.length - 1];
              return (
                <>
                  {formatNumber(readings.data.length)} readings · latest {formatWithUnit(last[metric], m.unit, m.digits)} at{' '}
                  {formatDateTime(last.recordedAt)}
                </>
              );
            })()}
          />
        )}
      </Tabs>
    </Panel>
  );
}
