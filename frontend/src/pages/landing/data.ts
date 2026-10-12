import type { NetworkPreviewNode, TransformerStatus } from '@/types/api';

export type NumericField = 'temperatureC' | 'oilLevelPct' | 'voltageV' | 'currentA' | 'loadPct' | 'healthScore';

/** Mean of a field over nodes that actually report it. Null when nothing reports (never a guess). */
export function average(nodes: NetworkPreviewNode[] | undefined, field: NumericField): number | null {
  if (!nodes?.length) return null;
  let sum = 0;
  let n = 0;
  for (const node of nodes) {
    const v = node[field];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n ? sum / n : null;
}

export function countReporting(nodes: NetworkPreviewNode[] | undefined): number {
  return nodes?.filter((n) => n.status !== 'OFFLINE' && n.temperatureC != null).length ?? 0;
}

export const STATUS_ORDER: TransformerStatus[] = ['HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE'];

export function statusCounts(nodes: NetworkPreviewNode[] | undefined): Record<TransformerStatus, number> {
  const out: Record<TransformerStatus, number> = { HEALTHY: 0, WARNING: 0, CRITICAL: 0, OFFLINE: 0 };
  nodes?.forEach((n) => {
    out[n.status] += 1;
  });
  return out;
}

export const STATUS_LABEL: Record<TransformerStatus, string> = {
  HEALTHY: 'Healthy',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
  OFFLINE: 'Offline',
};

/** Tailwind text color class per status (paired with an icon and text, never color alone). */
export const STATUS_TEXT: Record<TransformerStatus, string> = {
  HEALTHY: 'text-healthy',
  WARNING: 'text-warning',
  CRITICAL: 'text-critical',
  OFFLINE: 'text-offline',
};

export const STATUS_FILL: Record<TransformerStatus, string> = {
  HEALTHY: 'rgb(var(--healthy))',
  WARNING: 'rgb(var(--warning))',
  CRITICAL: 'rgb(var(--critical))',
  OFFLINE: 'rgb(var(--offline))',
};

const SEVERITY_RANK: Record<TransformerStatus, number> = { CRITICAL: 0, WARNING: 1, OFFLINE: 2, HEALTHY: 3 };

/** Nodes needing attention first, then by ascending health. */
export function byAttention(nodes: NetworkPreviewNode[]): NetworkPreviewNode[] {
  return [...nodes].sort(
    (a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || a.healthScore - b.healthScore || a.code.localeCompare(b.code),
  );
}
