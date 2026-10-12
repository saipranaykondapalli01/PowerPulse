/**
 * Pure helpers shared by the 3D scene, the 2D fallback and the HUD.
 * No React, no three.js imports: everything here is unit-testable in jsdom.
 */
import type { DashboardSummary, NetworkPreviewNode, TransformerDto, TransformerStatus } from '@/types/api';

export type SceneTheme = 'light' | 'dark';

/** Minimal node shape the network views need; adapted from TransformerDto or NetworkPreviewNode. */
export interface GridNode {
  id: string;
  code: string;
  name: string;
  location: string;
  gridX: number;
  gridZ: number;
  connectedTo: string[];
  status: TransformerStatus;
  healthScore: number;
  loadPct: number | null;
  ratedCapacityKva: number;
  activeFaultCount: number;
  stale: boolean;
}

export const STATUS_ORDER: TransformerStatus[] = ['HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE'];

/** Brighter variants of the token hues, for marks inside the dark 3D viewport. */
const STATUS_HEX: Record<TransformerStatus, string> = {
  HEALTHY: '#5CBF78',
  WARNING: '#E8A33E',
  CRITICAL: '#D94A45',
  OFFLINE: '#80837A',
};

/** Light surfaces use the exact status tokens from tokens.css, so map marks match the UI chips. */
const STATUS_HEX_LIGHT: Record<TransformerStatus, string> = {
  HEALTHY: '#27835B',
  WARNING: '#A96B17',
  CRITICAL: '#C83D37',
  OFFLINE: '#6E7068',
};

export const ACCENT_HEX = '#C9F24A';
export const INK_HEX = '#151713';
export const PAPER_HEX = '#F2F0E9';
export const BASE_HEX = '#0F110E';

export function statusColor(status: TransformerStatus, theme: SceneTheme = 'dark'): string {
  return (theme === 'light' ? STATUS_HEX_LIGHT : STATUS_HEX)[status] ?? STATUS_HEX.OFFLINE;
}

const STATUS_LABEL: Record<TransformerStatus, string> = {
  HEALTHY: 'Healthy',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
  OFFLINE: 'Offline',
};

export function statusLabel(status: TransformerStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** Name of the lucide icon used for a status (resolved to a component in StatusIcon.tsx). */
export type StatusIconName = 'CircleCheck' | 'TriangleAlert' | 'OctagonAlert' | 'PowerOff';
const STATUS_ICON: Record<TransformerStatus, StatusIconName> = {
  HEALTHY: 'CircleCheck',
  WARNING: 'TriangleAlert',
  CRITICAL: 'OctagonAlert',
  OFFLINE: 'PowerOff',
};
export function statusIcon(status: TransformerStatus): StatusIconName {
  return STATUS_ICON[status] ?? 'PowerOff';
}

/** Short ASCII glyph usable in SVG text / 3D labels when an icon component is not available. */
export function statusGlyph(status: TransformerStatus): string {
  return { HEALTHY: '✓', WARNING: '!', CRITICAL: '✕', OFFLINE: '–' }[status] ?? '?';
}

// ---------- Adapters ----------
export function fromTransformer(t: TransformerDto): GridNode {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    location: t.location,
    gridX: t.gridX,
    gridZ: t.gridZ,
    connectedTo: t.connectedTo ?? [],
    status: t.status,
    healthScore: t.healthScore,
    loadPct: t.latestReading?.loadPct ?? null,
    ratedCapacityKva: t.ratedCapacityKva,
    activeFaultCount: t.activeFaultCount ?? 0,
    stale: t.stale,
  };
}

export function fromPreviewNode(n: NetworkPreviewNode): GridNode {
  return {
    id: n.id,
    code: n.code,
    name: n.name,
    location: n.location,
    gridX: n.gridX,
    gridZ: n.gridZ,
    connectedTo: n.connectedTo ?? [],
    status: n.status,
    healthScore: n.healthScore,
    loadPct: n.loadPct,
    ratedCapacityKva: n.ratedCapacityKva,
    activeFaultCount: n.activeFaultCount ?? 0,
    stale: false,
  };
}

// ---------- Edges ----------
export interface Edge {
  /** Stable key "a|b" with a < b. */
  key: string;
  a: string;
  b: string;
}

/**
 * Undirected, deduplicated edges from connectedTo lists. A–B and B–A collapse into one edge;
 * self-loops and references to unknown nodes are dropped.
 */
export function dedupeEdges(nodes: Pick<GridNode, 'id' | 'connectedTo'>[]): Edge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const n of nodes) {
    for (const other of n.connectedTo ?? []) {
      if (other === n.id || !ids.has(other)) continue;
      const [a, b] = n.id < other ? [n.id, other] : [other, n.id];
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ key, a, b });
    }
  }
  return edges;
}

// ---------- Flow ----------
/** Mean loadPct of the two endpoints, ignoring nulls; null when neither has a reading. */
export function edgeLoad(a: Pick<GridNode, 'loadPct'>, b: Pick<GridNode, 'loadPct'>): number | null {
  const vals = [a.loadPct, b.loadPct].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** True when an edge should animate flow (neither endpoint OFFLINE). */
export function edgeHasFlow(a: Pick<GridNode, 'status'>, b: Pick<GridNode, 'status'>): boolean {
  return a.status !== 'OFFLINE' && b.status !== 'OFFLINE';
}

/**
 * Particle count for an edge: scales linearly with load (0–120 %), at least 1 when there is any flow.
 * `maxPerEdge` is the count at 100 % load (lowered for mobile / the landing preview).
 */
export function particleDensity(loadPct: number | null, maxPerEdge = 8): number {
  if (loadPct === null || !Number.isFinite(loadPct) || loadPct <= 0 || maxPerEdge <= 0) return 0;
  const clamped = Math.min(loadPct, 120) / 100;
  return Math.max(1, Math.round(clamped * maxPerEdge));
}

/** Particle speed along an edge in curve-lengths per second; faster under higher load. */
export function particleSpeed(loadPct: number | null): number {
  if (loadPct === null || !Number.isFinite(loadPct) || loadPct <= 0) return 0;
  const clamped = Math.min(loadPct, 120) / 100;
  return 0.06 + clamped * 0.18;
}

// ---------- Layout ----------
export interface SceneLayout {
  /** Scene-space [x, z] per node id, centered on the origin. */
  positions: Map<string, [number, number]>;
  /** Radius of the bounding circle around the origin (scene units). */
  radius: number;
  /** Axis-aligned bounds in scene units. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Factor applied to raw grid coordinates. */
  scale: number;
}

/** Target typical spacing between neighboring transformers, in scene units (a tank is ~1.6 wide). */
export const TARGET_SPACING = 7;

/**
 * Centers the network on the origin and rescales it so the median nearest-neighbour distance is
 * about TARGET_SPACING, whatever units the backend uses for gridX/gridZ.
 */
export function computeLayout(nodes: Pick<GridNode, 'id' | 'gridX' | 'gridZ'>[]): SceneLayout {
  const positions = new Map<string, [number, number]>();
  if (nodes.length === 0) {
    return { positions, radius: 10, minX: -10, maxX: 10, minZ: -10, maxZ: 10, scale: 1 };
  }
  const xs = nodes.map((n) => (Number.isFinite(n.gridX) ? n.gridX : 0));
  const zs = nodes.map((n) => (Number.isFinite(n.gridZ) ? n.gridZ : 0));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

  let scale = 1;
  if (nodes.length > 1) {
    const nearest: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      let best = Infinity;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(xs[i] - xs[j], zs[i] - zs[j]);
        if (d > 1e-9 && d < best) best = d;
      }
      if (Number.isFinite(best)) nearest.push(best);
    }
    if (nearest.length > 0) {
      nearest.sort((a, b) => a - b);
      const median = nearest[Math.floor(nearest.length / 2)];
      scale = TARGET_SPACING / median;
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let radius = 0;
  nodes.forEach((n, i) => {
    const x = (xs[i] - cx) * scale;
    const z = (zs[i] - cz) * scale;
    positions.set(n.id, [x, z]);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
    radius = Math.max(radius, Math.hypot(x, z));
  });
  return { positions, radius: Math.max(radius, 6), minX, maxX, minZ, maxZ, scale };
}

// ---------- Filters ----------
export interface GridFilter {
  /** Statuses to show. An empty list shows every status. */
  statuses: TransformerStatus[];
  /** Exact location match; empty string = all locations. */
  location: string;
}

export const DEFAULT_FILTER: GridFilter = { statuses: [], location: '' };

export function matchesFilter(node: Pick<GridNode, 'status' | 'location'>, filter: GridFilter): boolean {
  if (filter.statuses.length > 0 && !filter.statuses.includes(node.status)) return false;
  if (filter.location && node.location !== filter.location) return false;
  return true;
}

export function toggleStatus(list: TransformerStatus[], status: TransformerStatus): TransformerStatus[] {
  return list.includes(status) ? list.filter((s) => s !== status) : [...list, status];
}

// ---------- Summaries ----------
export interface NetworkStats {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  offline: number;
  networkHealth: number | null;
  activeFaults: number;
  totalLoadKva: number;
  totalCapacityKva: number;
}

/** Same formulas as the dashboard summary (docs/development-plan.md), derived client-side. */
export function deriveStats(nodes: GridNode[]): NetworkStats {
  const s: NetworkStats = {
    total: nodes.length,
    healthy: 0,
    warning: 0,
    critical: 0,
    offline: 0,
    networkHealth: null,
    activeFaults: 0,
    totalLoadKva: 0,
    totalCapacityKva: 0,
  };
  let weighted = 0;
  let weight = 0;
  for (const n of nodes) {
    if (n.status === 'HEALTHY') s.healthy++;
    else if (n.status === 'WARNING') s.warning++;
    else if (n.status === 'CRITICAL') s.critical++;
    else s.offline++;
    s.activeFaults += n.activeFaultCount;
    s.totalCapacityKva += n.ratedCapacityKva;
    if (n.status !== 'OFFLINE') {
      weighted += n.healthScore * n.ratedCapacityKva;
      weight += n.ratedCapacityKva;
      if (n.loadPct !== null) s.totalLoadKva += (n.loadPct / 100) * n.ratedCapacityKva;
    }
  }
  if (weight > 0) s.networkHealth = Math.round(weighted / weight);
  return s;
}

/** Prefer the server's dashboard summary (identical numbers to the dashboard); fall back to derived. */
export function statsFromSummary(summary: DashboardSummary | undefined, nodes: GridNode[]): NetworkStats {
  if (!summary) return deriveStats(nodes);
  return {
    total: summary.totalTransformers,
    healthy: summary.healthy,
    warning: summary.warning,
    critical: summary.critical,
    offline: summary.offline,
    networkHealth: summary.networkHealth,
    activeFaults: summary.activeAlerts,
    totalLoadKva: summary.totalLoadKva,
    totalCapacityKva: summary.totalCapacityKva,
  };
}

// ---------- Formatting ----------
export function formatAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'No readings yet';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export function formatNumber(v: number | null | undefined, digits = 0, unit = ''): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`;
}
