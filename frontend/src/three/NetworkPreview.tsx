/**
 * Lightweight network scene for the public landing page. Fed only by props (public preview data),
 * never by authenticated hooks. Reuses the full grid's models, lines and flow particles through the
 * NetworkPreviewNode → GridNode adapter, with fewer particles, hover-only labels and a slow
 * auto-rotation that stops on interaction (and never runs with reduced motion).
 * Falls back to the 2D SVG map when WebGL is unavailable.
 */
import { Component, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { NetworkPreviewNode } from '@/types/api';
import { Grid2D } from './Grid2D';
import { fromPreviewNode, type SceneTheme } from './utils';
import { useRenderCapabilities } from './webgl';

const GridScene = lazy(() => import('./GridScene'));

export interface NetworkPreviewProps {
  nodes: NetworkPreviewNode[];
  /** CSS height of the canvas container (default '100%'). */
  height?: string;
  /** Allow orbit/hover/selection (default true). Disable for purely decorative use. */
  interactive?: boolean;
  /** Called when a node is clicked. */
  onSelect?: (node: NetworkPreviewNode) => void;
  className?: string;
  /** 'light' (default): #F2F0E9 paper, ink lines, lime flow. 'dark': app palette. */
  theme?: SceneTheme;
}

class PreviewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function NetworkPreview({
  nodes,
  height = '100%',
  interactive = true,
  onSelect,
  className,
  theme = 'light',
}: NetworkPreviewProps) {
  const caps = useRenderCapabilities();
  const gridNodes = useMemo(() => nodes.map(fromPreviewNode), [nodes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (id: string) => {
      const n = byId.get(id);
      if (n) onSelect?.(n);
    },
    [byId, onSelect],
  );

  const bg = theme === 'light' ? 'bg-paper' : 'bg-canvas';
  const fallback = (
    <Grid2D
      nodes={gridNodes}
      hoveredId={hoveredId}
      onHover={interactive ? setHoveredId : undefined}
      onSelect={interactive ? handleSelect : undefined}
      interactive={interactive}
      reducedMotion={caps.reducedMotion}
      theme={theme}
    />
  );
  const use3d = caps.webgl && !caps.lowEnd;

  return (
    <div
      className={clsx('relative overflow-hidden', bg, className)}
      style={{ height }}
      role="figure"
      aria-label={`Network preview: ${nodes.length} simulated transformers`}
    >
      {nodes.length === 0 ? null : use3d ? (
        <PreviewBoundary fallback={fallback}>
          <Suspense fallback={null}>
            <GridScene
              nodes={gridNodes}
              hoveredId={hoveredId}
              onHover={interactive ? setHoveredId : undefined}
              onSelect={interactive ? handleSelect : undefined}
              interactive={interactive}
              labels={interactive ? 'hover' : 'none'}
              autoRotate
              reducedMotion={caps.reducedMotion}
              quality={caps.quality === 'high' ? 'high' : 'low'}
              maxParticlesPerEdge={caps.quality === 'high' ? 4 : 2}
              theme={theme}
            />
          </Suspense>
        </PreviewBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
