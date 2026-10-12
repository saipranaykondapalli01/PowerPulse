import { useMemo } from 'react';
import type { NetworkPreviewNode } from '@/types/api';
import { STATUS_FILL, STATUS_LABEL } from '../data';

/**
 * Flat, plan-view network diagram.
 * - With `nodes`: drawn from the real preview data (gridX/gridZ positions, connectedTo edges, status).
 * - Without: a neutral schematic (no statuses or values), used as the offline fallback.
 */

const W = 800;
const H = 480;
const PAD = 48;

// Neutral fallback layout: a primary substation feeding three radial feeders with ties.
const SCHEMATIC: { id: string; x: number; y: number; links: string[] }[] = [
  { id: 'S', x: 400, y: 240, links: ['a1', 'b1', 'c1'] },
  { id: 'a1', x: 290, y: 170, links: ['a2'] },
  { id: 'a2', x: 190, y: 120, links: ['a3', 'a4'] },
  { id: 'a3', x: 90, y: 80, links: [] },
  { id: 'a4', x: 140, y: 210, links: ['c3'] },
  { id: 'b1', x: 520, y: 160, links: ['b2'] },
  { id: 'b2', x: 620, y: 110, links: ['b3', 'b4'] },
  { id: 'b3', x: 720, y: 70, links: [] },
  { id: 'b4', x: 690, y: 210, links: [] },
  { id: 'c1', x: 420, y: 340, links: ['c2', 'c4'] },
  { id: 'c2', x: 300, y: 380, links: ['c3'] },
  { id: 'c3', x: 170, y: 330, links: [] },
  { id: 'c4', x: 560, y: 380, links: ['c5'] },
  { id: 'c5', x: 690, y: 330, links: ['b4'] },
];

interface Props {
  nodes?: NetworkPreviewNode[];
  className?: string;
  title?: string;
  showLabels?: boolean;
}

export function NetworkDiagram({ nodes, className, title = 'Network diagram', showLabels = true }: Props) {
  const layout = useMemo(() => {
    if (!nodes?.length) {
      const pos = new Map(SCHEMATIC.map((n) => [n.id, n]));
      const edges = SCHEMATIC.flatMap((n) => n.links.map((l) => [n, pos.get(l)!] as const));
      return { kind: 'schematic' as const, points: SCHEMATIC, edges };
    }
    const xs = nodes.map((n) => n.gridX);
    const zs = nodes.map((n) => n.gridZ);
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const sx = (W - PAD * 2) / Math.max(maxX - minX, 1);
    const sz = (H - PAD * 2) / Math.max(maxZ - minZ, 1);
    const s = Math.min(sx, sz);
    const offX = (W - (maxX - minX) * s) / 2;
    const offZ = (H - (maxZ - minZ) * s) / 2;
    const points = nodes.map((n) => ({ node: n, x: offX + (n.gridX - minX) * s, y: offZ + (n.gridZ - minZ) * s }));
    const byId = new Map(points.map((p) => [p.node.id, p]));
    const seen = new Set<string>();
    const edges: [{ x: number; y: number }, { x: number; y: number }][] = [];
    points.forEach((p) =>
      p.node.connectedTo.forEach((to) => {
        const q = byId.get(to);
        const key = [p.node.id, to].sort().join('|');
        if (q && !seen.has(key)) {
          seen.add(key);
          edges.push([p, q]);
        }
      }),
    );
    return { kind: 'live' as const, points, edges };
  }, [nodes]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={title} fill="none">
      <g stroke="currentColor" strokeOpacity="0.08">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`v${i}`} d={`M${(i + 1) * 80} 0 V${H}`} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${(i + 1) * 80} H${W}`} />
        ))}
      </g>
      <g stroke="currentColor" strokeOpacity="0.5" strokeWidth="1">
        {layout.edges.map(([a, b], i) => (
          <path key={i} d={`M${a.x} ${a.y} H${(a.x + b.x) / 2} V${b.y} H${b.x}`} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {layout.kind === 'schematic'
        ? layout.points.map((p) =>
            p.id === 'S' ? (
              <g key={p.id}>
                <rect x={p.x - 14} y={p.y - 14} width="28" height="28" fill="currentColor" />
                <text x={p.x + 22} y={p.y + 4} className="pp-svg-sub" fill="currentColor">
                  PRIMARY SUB
                </text>
              </g>
            ) : (
              <rect key={p.id} x={p.x - 6} y={p.y - 6} width="12" height="12" stroke="currentColor" strokeWidth="1.5" fill="none" />
            ),
          )
        : layout.points.map(({ node, x, y }) => (
            <g key={node.id}>
              <title>{`${node.code} · ${STATUS_LABEL[node.status]} · health ${Math.round(node.healthScore)}`}</title>
              <rect
                x={x - 7}
                y={y - 7}
                width="14"
                height="14"
                fill={node.status === 'OFFLINE' ? 'none' : STATUS_FILL[node.status]}
                stroke={node.status === 'OFFLINE' ? STATUS_FILL.OFFLINE : 'currentColor'}
                strokeWidth="1.25"
              />
              {node.status === 'CRITICAL' && (
                <rect x={x - 13} y={y - 13} width="26" height="26" stroke={STATUS_FILL.CRITICAL} strokeWidth="1" />
              )}
              {showLabels && layout.points.length <= 40 && (
                <text x={x + 12} y={y - 9} className="pp-svg-sub" fill="currentColor" fillOpacity="0.75">
                  {node.code}
                </text>
              )}
            </g>
          ))}
    </svg>
  );
}
