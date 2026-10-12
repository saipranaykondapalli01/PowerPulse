import { useMemo, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { StatusIcon } from './StatusIcon';
import {
  ACCENT_HEX,
  INK_HEX,
  computeLayout,
  dedupeEdges,
  edgeHasFlow,
  statusColor,
  statusLabel,
  type GridNode,
  type SceneTheme,
} from './utils';

export interface Grid2DProps {
  nodes: GridNode[];
  visibleIds?: Set<string>;
  selectedId?: string | null;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  onClearSelection?: () => void;
  highlightFaults?: boolean;
  theme?: SceneTheme;
  /** Non-interactive nodes are plain graphics (no buttons / tab stops). */
  interactive?: boolean;
  /** Disable the fault-ring pulse. */
  reducedMotion?: boolean;
  className?: string;
}

const THEME = {
  dark: { text: '#ECEBE4', muted: '#96998D', line: '#6B7363', dead: '#3F443B', node: '#1F231D', select: ACCENT_HEX },
  light: { text: INK_HEX, muted: '#686A61', line: INK_HEX, dead: '#B3B3AA', node: '#FFFFFF', select: INK_HEX },
} as const;

const R = 1.05;

/**
 * 2D SVG fallback of the network (no WebGL, low-end devices, or the user's "2D view").
 * Same nodes, edges, status colors + icon + text, selection and filters as the 3D scene.
 */
export function Grid2D({
  nodes,
  visibleIds,
  selectedId = null,
  hoveredId = null,
  onHover,
  onSelect,
  onClearSelection,
  highlightFaults = false,
  theme = 'dark',
  interactive = true,
  reducedMotion = false,
  className,
}: Grid2DProps) {
  const t = THEME[theme];
  const layout = useMemo(() => computeLayout(nodes), [nodes]);
  const visible = useMemo(() => (visibleIds ? nodes.filter((n) => visibleIds.has(n.id)) : nodes), [nodes, visibleIds]);
  const byId = useMemo(() => new Map(visible.map((n) => [n.id, n])), [visible]);
  const edges = useMemo(() => dedupeEdges(visible), [visible]);

  const pad = 3.5;
  const minX = layout.minX - pad;
  const minZ = layout.minZ - pad;
  const w = Math.max(layout.maxX - layout.minX + pad * 2, 12);
  const h = Math.max(layout.maxZ - layout.minZ + pad * 2 + 1.5, 10);

  const activate = (id: string) => onSelect?.(id);
  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(id);
    }
  };

  return (
    <svg
      role="group"
      aria-label="2D transformer network map"
      viewBox={`${minX} ${minZ} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className={clsx('block h-full w-full', className)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClearSelection?.();
      }}
    >
      <defs>
        <pattern id={`pp-grid-${theme}`} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke={theme === 'dark' ? '#20251D' : '#DCD9CE'} strokeWidth="0.03" />
        </pattern>
      </defs>
      <rect
        x={minX}
        y={minZ}
        width={w}
        height={h}
        fill={`url(#pp-grid-${theme})`}
        onClick={() => onClearSelection?.()}
        aria-hidden="true"
      />

      <g aria-hidden="true">
        {edges.map((e) => {
          const a = byId.get(e.a)!;
          const b = byId.get(e.b)!;
          const pa = layout.positions.get(e.a)!;
          const pb = layout.positions.get(e.b)!;
          const live = edgeHasFlow(a, b);
          return (
            <line
              key={e.key}
              x1={pa[0]}
              y1={pa[1]}
              x2={pb[0]}
              y2={pb[1]}
              stroke={live ? t.line : t.dead}
              strokeWidth={live ? 0.09 : 0.07}
              strokeDasharray={live ? undefined : '0.3 0.25'}
              opacity={0.85}
            />
          );
        })}
      </g>

      {visible.map((n) => {
        const p = layout.positions.get(n.id)!;
        const color = statusColor(n.status, theme);
        const selected = selectedId === n.id;
        const hovered = hoveredId === n.id;
        const dimmed = highlightFaults && n.activeFaultCount === 0;
        const label = `${n.code}, ${statusLabel(n.status)}, health ${Math.round(n.healthScore)}${
          n.activeFaultCount > 0 ? `, ${n.activeFaultCount} active fault${n.activeFaultCount === 1 ? '' : 's'}` : ''
        }`;
        const interactiveProps = interactive
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': label,
              'aria-pressed': selected,
              onClick: () => activate(n.id),
              onKeyDown: (e: KeyboardEvent) => onKey(e, n.id),
              onMouseEnter: () => onHover?.(n.id),
              onMouseLeave: () => onHover?.(null),
              onFocus: () => onHover?.(n.id),
              onBlur: () => onHover?.(null),
              style: { cursor: 'pointer', outline: 'none' },
            }
          : { 'aria-label': label, role: 'img' };
        return (
          <g
            key={n.id}
            transform={`translate(${p[0]} ${p[1]})`}
            opacity={dimmed ? 0.3 : 1}
            data-testid={`grid2d-node-${n.id}`}
            className="group"
            {...interactiveProps}
          >
            {/* Selection halo: an accent disc behind the node, plus the ring below, so it never relies on color alone. */}
            {selected && <circle r={R + 0.55} fill={ACCENT_HEX} opacity={0.7} />}
            {n.activeFaultCount > 0 && !dimmed && (
              <circle
                r={R + 0.45}
                fill="none"
                stroke={statusColor('CRITICAL', theme)}
                strokeWidth={0.1}
                className={reducedMotion ? undefined : 'motion-safe:animate-pulse'}
              />
            )}
            {(selected || hovered) && (
              <circle
                r={R + 0.25}
                fill="none"
                stroke={selected ? t.select : t.muted}
                strokeWidth={selected ? 0.14 : 0.08}
              />
            )}
            {/* Visible keyboard focus ring. */}
            <circle r={R + 0.25} fill="none" stroke={t.select} strokeWidth={0.1} className="opacity-0 group-focus-visible:opacity-100" />
            <circle r={R} fill={t.node} stroke={color} strokeWidth={0.16} />
            <StatusIcon status={n.status} x={-0.6} y={-0.6} width={1.2} height={1.2} color={color} strokeWidth={2.5} />
            <text y={R + 0.95} textAnchor="middle" fontSize={0.72} fontFamily="var(--font-mono)" fontWeight={600} fill={t.text}>
              {n.code}
            </text>
            <text y={R + 1.75} textAnchor="middle" fontSize={0.55} fontFamily="var(--font-mono)" fill={color}>
              {statusLabel(n.status).toUpperCase()}
              {n.status !== 'OFFLINE' ? ` · ${Math.round(n.healthScore)}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default Grid2D;
