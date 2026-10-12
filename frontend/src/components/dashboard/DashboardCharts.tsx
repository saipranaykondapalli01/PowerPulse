import { useDashboardTrends, useFaultFrequency, useHealthDistribution } from '@/hooks/useMonitoring';
import type { DashboardFilters, FaultFrequency, HealthBucket, TrendPoint } from '@/types/api';
import { Panel } from '@/components/ui/Panel';
import { QueryState } from '@/components/ui/QueryState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { healthTone } from '@/components/ui/HealthGauge';
import { toneColor } from '@/components/ui/tone';
import { BarChart, metricColors, metricTints, TimeSeriesChart } from '@/components/charts';
import { faultTypeLabel } from '@/utils/labels';
import { formatDateTime, formatWithUnit, isNum } from '@/utils/format';
import type { FaultType } from '@/types/api';

const chartLoading = <Skeleton className="h-[240px] w-full" />;

/** Most recent bucket that has a value for either key. */
function latestWith(data: TrendPoint[], a: keyof TrendPoint, b: keyof TrendPoint): TrendPoint | undefined {
  for (let i = data.length - 1; i >= 0; i--) {
    if (isNum(data[i][a]) || isNum(data[i][b])) return data[i];
  }
  return undefined;
}

/** One-line text summary of the latest bucket (visible caption, also read by screen readers). */
function LatestSummary({ point, avg, max, unit }: { point?: TrendPoint; avg: keyof TrendPoint; max: keyof TrendPoint; unit: string }) {
  if (!point) return <>No values in the latest bucket.</>;
  return (
    <>
      Latest bucket {formatDateTime(point.bucket)} · avg{' '}
      <span className="tabular text-fg">{formatWithUnit(point[avg] as number | null, unit)}</span> · max{' '}
      <span className="tabular text-fg">{formatWithUnit(point[max] as number | null, unit)}</span>
    </>
  );
}

export function TrendCharts({ filters }: { filters: DashboardFilters }) {
  const trends = useDashboardTrends(filters);
  const empty = <EmptyState compact title="No readings in this range" description="Try a wider time range or reset filters." />;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel
        eyebrow="Telemetry · °C"
        title="Temperature trend"
        description="Top-oil temperature per time bucket across matching transformers."
      >
        <QueryState query={trends} isEmpty={(d: TrendPoint[]) => d.length === 0} empty={empty} loading={chartLoading}>
          {(data) => (
            <TimeSeriesChart
              label="Average and maximum top-oil temperature over time, degrees Celsius"
              data={data as unknown as Record<string, unknown>[]}
              xKey="bucket"
              unit="°C"
              yLabel="Temperature (°C)"
              caption={<LatestSummary point={latestWith(data, 'avgTemperatureC', 'maxTemperatureC')} avg="avgTemperatureC" max="maxTemperatureC" unit="°C" />}
              series={[
                { key: 'avgTemperatureC', label: 'Average', color: metricColors.temperature },
                { key: 'maxTemperatureC', label: 'Maximum', color: metricTints.temperature, dashed: true },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      <Panel eyebrow="Telemetry · % of rating" title="Load trend" description="Load as a percentage of rated capacity per time bucket.">
        <QueryState query={trends} isEmpty={(d: TrendPoint[]) => d.length === 0} empty={empty} loading={chartLoading}>
          {(data) => (
            <TimeSeriesChart
              label="Average and maximum load over time, percent of rated capacity"
              data={data as unknown as Record<string, unknown>[]}
              xKey="bucket"
              unit="%"
              yLabel="Load (% of rated)"
              caption={<LatestSummary point={latestWith(data, 'avgLoadPct', 'maxLoadPct')} avg="avgLoadPct" max="maxLoadPct" unit="%" />}
              series={[
                { key: 'avgLoadPct', label: 'Average', color: metricColors.load },
                { key: 'maxLoadPct', label: 'Maximum', color: metricTints.load, dashed: true },
              ]}
            />
          )}
        </QueryState>
      </Panel>
    </div>
  );
}

export function HealthDistributionChart({ filters }: { filters: DashboardFilters }) {
  const health = useHealthDistribution({ location: filters.location });
  return (
    <Panel eyebrow="Condition" title="Health distribution" description="Transformers per health-score band (0–100).">
      <QueryState
        query={health}
        isEmpty={(d: HealthBucket[]) => d.every((b) => b.count === 0)}
        empty={<EmptyState compact title="No transformers to score" />}
        loading={chartLoading}
      >
        {(data) => (
          <BarChart
            label="Number of transformers per health score band"
            data={data as unknown as Record<string, unknown>[]}
            categoryKey="range"
            series={[{ key: 'count', label: 'Transformers' }]}
            unit="transformers"
            valueLabel="Transformers"
            colorFor={(row) => {
              const b = row as unknown as HealthBucket;
              return toneColor[healthTone((b.min + b.max) / 2)];
            }}
          />
        )}
      </QueryState>
    </Panel>
  );
}

export function FaultFrequencyChart({ filters }: { filters: DashboardFilters }) {
  const faults = useFaultFrequency(filters);
  return (
    <Panel eyebrow="Faults" title="Fault frequency" description="Alerts raised per fault type in the selected range.">
      <QueryState
        query={faults}
        isEmpty={(d: FaultFrequency[]) => d.every((f) => f.count === 0)}
        empty={<EmptyState compact title="No faults recorded" description="No alerts were raised in this range." />}
        loading={chartLoading}
      >
        {(data) => (
          <BarChart
            horizontal
            label="Fault count and critical count per fault type"
            data={data as unknown as Record<string, unknown>[]}
            categoryKey="faultType"
            categoryFormatter={(v) => faultTypeLabel[v as FaultType] ?? v}
            series={[
              { key: 'count', label: 'All severities', color: metricColors.neutral },
              { key: 'critical', label: 'Critical', color: toneColor.critical },
            ]}
            unit="faults"
            valueLabel="Faults"
            height={260}
          />
        )}
      </QueryState>
    </Panel>
  );
}

/** Both distribution charts side by side (kept for callers that render them as a pair). */
export function DistributionCharts({ filters }: { filters: DashboardFilters }) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <HealthDistributionChart filters={filters} />
      <FaultFrequencyChart filters={filters} />
    </div>
  );
}
