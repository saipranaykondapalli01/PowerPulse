import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { formatNumber } from '@/utils/format';
import { axisProps, ChartFrame, ChartLegend, chartTheme, seriesColors, TooltipCard } from './chartTheme';

export interface BarSeries<T> {
  key: keyof T & string;
  label: string;
  color?: string;
}

export interface BarChartProps<T> {
  data: T[];
  /** Category key (x for vertical bars, y for horizontal). */
  categoryKey: keyof T & string;
  /** Formats category values for ticks and tooltip titles. */
  categoryFormatter?: (v: string) => string;
  series: BarSeries<T>[];
  /** Unit for the value axis/tooltip (e.g. "transformers", "faults"). */
  unit: string;
  valueLabel: string;
  height?: number;
  /** Horizontal bars (long category labels). */
  horizontal?: boolean;
  /** Per-bar color for single-series charts (e.g. health bands). */
  colorFor?: (row: T) => string;
  label: string;
}

/** Bar chart (vertical or horizontal), integer counts, per-bar hover tooltip. */
export function BarChart<T extends Record<string, unknown>>({
  data,
  categoryKey,
  categoryFormatter = (v) => v,
  series,
  unit,
  valueLabel,
  height = 240,
  horizontal,
  colorFor,
  label,
}: BarChartProps<T>) {
  const colors = [seriesColors.primary, seriesColors.secondary, seriesColors.tertiary];
  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as T;
    return (
      <TooltipCard
        title={categoryFormatter(String(row[categoryKey]))}
        rows={series.map((s, i) => ({
          label: s.label,
          value: `${formatNumber(row[s.key] as number)} ${unit}`,
          color: colorFor && series.length === 1 ? colorFor(row) : s.color ?? colors[i],
        }))}
      />
    );
  };

  const categoryAxis = {
    dataKey: categoryKey,
    type: 'category' as const,
    tickFormatter: (v: string) => categoryFormatter(String(v)),
    interval: 0 as const,
    ...axisProps,
  };
  const valueAxis = {
    type: 'number' as const,
    allowDecimals: false,
    ...axisProps,
  };

  return (
    <div className="flex flex-col gap-2">
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: s.color ?? colors[i] }))} />
      <ChartFrame height={height} label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 12, bottom: horizontal ? 16 : 4, left: 4 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid stroke={chartTheme.grid} strokeOpacity={0.7} horizontal={!horizontal} vertical={!!horizontal} />
            {horizontal ? (
              <>
                <XAxis
                  {...valueAxis}
                  label={{ value: valueLabel, position: 'insideBottom', offset: -10, style: { fill: chartTheme.text, fontSize: 10, fontFamily: chartTheme.fontFamily } }}
                />
                <YAxis {...categoryAxis} width={118} />
              </>
            ) : (
              <>
                <XAxis {...categoryAxis} />
                <YAxis
                  {...valueAxis}
                  width={44}
                  label={{
                    value: valueLabel,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: { fill: chartTheme.text, fontSize: 10, fontFamily: chartTheme.fontFamily, textAnchor: 'middle' },
                  }}
                />
              </>
            )}
            <Tooltip content={renderTooltip} cursor={{ fill: 'rgb(var(--raised))', opacity: 0.6 }} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color ?? colors[i]}
                radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              >
                {colorFor && series.length === 1 && data.map((row, idx) => <Cell key={idx} fill={colorFor(row)} />)}
              </Bar>
            ))}
          </RBarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
