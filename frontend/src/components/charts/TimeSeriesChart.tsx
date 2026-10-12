import { useMemo, type ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { formatAxisTime, formatDateTime, formatWithUnit, isNum } from '@/utils/format';
import { axisProps, ChartFrame, ChartLegend, chartTheme, TooltipCard } from './chartTheme';
import { toneColor, type Tone } from '@/components/ui/tone';

export interface Series<T> {
  key: keyof T & string;
  label: string;
  color: string;
  /** Dashed stroke (secondary encoding for e.g. "max"). */
  dashed?: boolean;
}

export interface ReferenceMark {
  y: number;
  label: string;
  tone: Tone;
}

export interface TimeSeriesChartProps<T> {
  data: T[];
  /** Key holding an ISO timestamp. */
  xKey: keyof T & string;
  series: Series<T>[];
  /** Unit shown in axis label and tooltips, e.g. "°C". */
  unit: string;
  /** Y-axis label, e.g. "Temperature (°C)". */
  yLabel: string;
  height?: number;
  digits?: number;
  references?: ReferenceMark[];
  /** Fixed y domain; defaults to auto with references included. */
  yDomain?: [number | 'auto', number | 'auto'];
  /** Accessible description of the chart. */
  label: string;
  /** Optional visible text summary under the plot (rendered as the figure caption). */
  caption?: ReactNode;
}

/** Line chart over time, with units in axis + tooltip and optional threshold lines. */
export function TimeSeriesChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  unit,
  yLabel,
  height = 240,
  digits = 1,
  references = [],
  yDomain,
  label,
  caption,
}: TimeSeriesChartProps<T>) {
  const points = useMemo(
    () => data.map((d) => ({ ...d, __t: new Date(String(d[xKey])).getTime() })),
    [data, xKey],
  );
  const span = points.length > 1 ? points[points.length - 1].__t - points[0].__t : 0;

  const domain = useMemo<[number | 'auto' | ((v: number) => number), number | 'auto' | ((v: number) => number)]>(() => {
    if (yDomain) return yDomain;
    if (references.length === 0) return ['auto', 'auto'];
    const refs = references.map((r) => r.y);
    const lo = Math.min(...refs);
    const hi = Math.max(...refs);
    return [(min: number) => Math.floor(Math.min(min, lo) * 0.95), (max: number) => Math.ceil(Math.max(max, hi) * 1.05)];
  }, [yDomain, references]);

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as T & { __t: number };
    return (
      <TooltipCard
        title={formatDateTime(row.__t)}
        rows={series.map((s) => ({
          label: s.label,
          value: formatWithUnit(isNum(row[s.key]) ? (row[s.key] as number) : null, unit, digits),
          color: s.color,
          dashed: s.dashed,
        }))}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
      <ChartFrame height={height} label={label} caption={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeOpacity={0.7} vertical={false} />
            <XAxis
              dataKey="__t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => formatAxisTime(v, span)}
              minTickGap={40}
              {...axisProps}
            />
            <YAxis
              width={52}
              domain={domain}
              tickFormatter={(v: number) => String(Math.round(v * 10) / 10)}
              label={{
                value: yLabel,
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fill: chartTheme.text, fontSize: 10, fontFamily: chartTheme.fontFamily, textAnchor: 'middle' },
              }}
              {...axisProps}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: chartTheme.axis, strokeDasharray: '3 3' }} />
            {references.map((r) => (
              <ReferenceLine
                key={`${r.label}-${r.y}`}
                y={r.y}
                stroke={toneColor[r.tone]}
                strokeDasharray="6 4"
                strokeOpacity={0.8}
                label={{
                  value: `${r.label} ${formatWithUnit(r.y, unit, digits)}`,
                  position: 'insideTopRight',
                  fill: toneColor[r.tone],
                  fontSize: 10,
                  fontFamily: chartTheme.fontFamily,
                }}
              />
            ))}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4, stroke: 'rgb(var(--panel))', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
