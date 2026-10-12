import { Component, lazy, Suspense, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useAllTransformers, useDashboardSummary, useLocations } from '@/hooks/useMonitoring';
import { DetailPanel } from '@/three/DetailPanel';
import { Grid2D } from '@/three/Grid2D';
import { GridFilterBar, GridLegend, GridStats, GridViewControls, TransformerList, type RenderMode } from '@/three/GridHud';
import type { ViewMode } from '@/three/CameraRig';
import { BASE_HEX, DEFAULT_FILTER, fromTransformer, matchesFilter, statsFromSummary, type GridFilter } from '@/three/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useRenderCapabilities } from '@/three/webgl';
import type { TransformerStatus } from '@/types/api';

// three.js + R3F live in this chunk and are only fetched when the 3D view is actually used.
const GridScene = lazy(() => import('@/three/GridScene'));

class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const LG_QUERY = '(min-width: 1024px)';
const subscribeLg = (cb: () => void) => {
  const mq = window.matchMedia?.(LG_QUERY);
  mq?.addEventListener?.('change', cb);
  return () => mq?.removeEventListener?.('change', cb);
};
/** True on lg+ screens, where the selection floats over the viewport instead of stacking under it. */
function useIsLg() {
  return useSyncExternalStore(
    subscribeLg,
    () => window.matchMedia?.(LG_QUERY).matches ?? false,
    () => false,
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[45] flex items-center justify-center" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2 rounded-sm border border-line bg-panel px-3 py-2 font-mono text-label uppercase text-fg-muted">
        <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />
        {children}
      </span>
    </div>
  );
}

export default function GridPage() {
  const caps = useRenderCapabilities();
  const isLg = useIsLg();
  const transformersQ = useAllTransformers();
  const summaryQ = useDashboardSummary();
  const locationsQ = useLocations();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('focus');

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GridFilter>(DEFAULT_FILTER);
  const [highlightFaults, setHighlightFaults] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(selectedId ? 'individual' : 'overview');
  const [cameraToken, setCameraToken] = useState(0);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [renderMode, setRenderMode] = useState<RenderMode>(caps.webgl && !caps.lowEnd ? '3d' : '2d');
  const use3d = renderMode === '3d' && caps.webgl && !sceneFailed;

  const transformers = useMemo(() => transformersQ.data ?? [], [transformersQ.data]);
  const nodes = useMemo(() => transformers.map(fromTransformer), [transformers]);
  const visibleNodes = useMemo(() => nodes.filter((n) => matchesFilter(n, filter)), [nodes, filter]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const selected = useMemo(() => transformers.find((t) => t.id === selectedId) ?? null, [transformers, selectedId]);
  const stats = statsFromSummary(summaryQ.data, nodes);
  const counts = useMemo(() => {
    const c: Partial<Record<TransformerStatus, number>> = {};
    for (const n of nodes) c[n.status] = (c[n.status] ?? 0) + 1;
    return c;
  }, [nodes]);
  const locations = useMemo(
    () => locationsQ.data ?? [...new Set(nodes.map((n) => n.location))].sort(),
    [locationsQ.data, nodes],
  );

  const setFocusParam = useCallback(
    (id: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set('focus', id);
          else next.delete('focus');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const select = useCallback(
    (id: string) => {
      setFocusParam(id);
      setViewMode('individual');
      setCameraToken((t) => t + 1);
    },
    [setFocusParam],
  );

  const clearSelection = useCallback(() => {
    if (!selectedId) return;
    setFocusParam(null);
    setViewMode('overview');
  }, [selectedId, setFocusParam]);

  const focusSelected = useCallback(() => {
    setViewMode('individual');
    setCameraToken((t) => t + 1);
  }, []);

  const resetCamera = useCallback(() => {
    setViewMode('overview');
    setCameraToken((t) => t + 1);
  }, []);

  const onSceneError = useCallback(() => setSceneFailed(true), []);
  const onSceneReady = useCallback(() => setSceneReady(true), []);

  const unknownFocus = !!selectedId && transformersQ.isSuccess && !selected;

  let notice: string | null = null;
  if (!caps.webgl) notice = 'WebGL is unavailable in this browser, so the network is shown as a 2D map.';
  else if (sceneFailed) notice = 'The 3D renderer failed to start, so the network is shown as a 2D map.';
  else if (caps.lowEnd && renderMode === '2d') notice = '2D map selected for this device. Switch to 3D anytime.';

  // ---- Viewport content ----
  let viewport: ReactNode;
  if (transformersQ.isPending) {
    viewport = <Overlay>Loading network…</Overlay>;
  } else if (transformersQ.isError && !transformersQ.data) {
    viewport = (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="text-critical" size={22} aria-hidden="true" />
        <p className="text-sm text-fg">Could not load the transformer network.</p>
        <p className="max-w-sm text-xs text-fg-muted">{transformersQ.error?.message}</p>
        <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => void transformersQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  } else if (nodes.length === 0) {
    viewport = (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-mono text-label uppercase text-fg-muted">No transformers</p>
        <p className="max-w-sm text-sm text-fg">No transformers are registered yet, so there is no network to draw.</p>
        <Link to="/transformers" className="font-mono text-label uppercase text-accent-ink underline-offset-4 hover:underline">
          Go to the registry
        </Link>
      </div>
    );
  } else if (use3d) {
    viewport = (
      <SceneErrorBoundary onError={onSceneError}>
        <Suspense fallback={<Overlay>Loading 3D view…</Overlay>}>
          {!sceneReady && <Overlay>Starting renderer…</Overlay>}
          <GridScene
            nodes={nodes}
            visibleIds={visibleIds}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={select}
            onClearSelection={clearSelection}
            highlightFaults={highlightFaults}
            viewMode={viewMode}
            cameraToken={cameraToken}
            reducedMotion={caps.reducedMotion}
            quality={caps.quality}
            theme="dark"
            onReady={onSceneReady}
          />
        </Suspense>
      </SceneErrorBoundary>
    );
  } else {
    viewport = (
      <Grid2D
        nodes={nodes}
        visibleIds={visibleIds}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onSelect={select}
        onClearSelection={clearSelection}
        highlightFaults={highlightFaults}
        reducedMotion={caps.reducedMotion}
        theme="light"
      />
    );
  }

  const hasData = nodes.length > 0;
  // The 3D scene keeps its dark technical treatment inside a light frame; the 2D map and states are light.
  const darkViewport = use3d && hasData && !transformersQ.isPending;

  return (
    // On lg the page fills the viewport left by the app shell (h-14 top bar + sm:py-6 main padding) so the
    // scene and side column share one height and the transformer list scrolls instead of overflowing.
    <div className="flex flex-col text-fg lg:h-[calc(100dvh-6.5rem)] lg:min-h-[600px]">
      <PageHeader
        eyebrow="Overview / Network"
        title="3D Network Grid"
        actions={
          <p className="inline-flex items-center gap-2 font-mono text-label uppercase text-fg-muted" aria-live="polite">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-accent ring-1 ring-ink/40" />
            {transformersQ.isFetching ? 'Refreshing…' : 'Live · updates every 10 s'}
          </p>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <GridStats stats={stats} visibleCount={hasData ? visibleNodes.length : undefined} />

        <GridFilterBar
          filter={filter}
          onFilterChange={setFilter}
          locations={locations}
          counts={counts}
          highlightFaults={highlightFaults}
          onHighlightFaults={setHighlightFaults}
          className="rounded-sm border border-line bg-panel px-3 py-2"
        />

        {(notice || unknownFocus) && (
          <p role="status" className="rounded-sm border border-line bg-raised/60 px-3 py-2 text-xs text-fg-muted">
            {unknownFocus ? `Transformer "${selectedId}" was not found in the network. ` : ''}
            {notice}
          </p>
        )}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section
            aria-label="Network viewport"
            className="flex min-h-0 flex-col overflow-hidden rounded-sm border border-line-strong bg-panel"
          >
            <div
              className="relative h-[60vh] min-h-[420px] lg:h-auto lg:min-h-0 lg:flex-1"
              style={darkViewport ? { backgroundColor: BASE_HEX } : undefined}
            >
              {viewport}
              {/* Top-left: mode hint + camera/renderer controls. Top-right (lg): the floating selection panel. */}
              <div className="pointer-events-none absolute left-2 top-2 z-50 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1.5 lg:max-w-[calc(100%-21rem)]">
                <GridViewControls
                  viewMode={viewMode}
                  onViewMode={(m) => {
                    setViewMode(m);
                    setCameraToken((t) => t + 1);
                  }}
                  canIndividual={!!selected}
                  onResetCamera={resetCamera}
                  renderMode={use3d ? '3d' : '2d'}
                  onRenderMode={setRenderMode}
                  webglAvailable={caps.webgl && !sceneFailed}
                  className="pointer-events-auto"
                />
                <p
                  className={clsx(
                    'items-center gap-2 rounded-sm border border-line bg-panel/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted',
                    caps.reducedMotion && use3d ? 'inline-flex' : selected ? 'hidden 2xl:inline-flex' : 'hidden sm:inline-flex',
                  )}
                >
                  <span className="text-fg">{use3d ? '3D view' : '2D map'}</span>
                  <span aria-hidden="true">·</span>
                  {caps.reducedMotion && use3d
                    ? 'Reduced motion · animation paused'
                    : use3d
                      ? 'Drag to orbit · scroll to zoom'
                      : 'Select a node for details'}
                </p>
              </div>
              {selected && isLg && (
                <DetailPanel
                  transformer={selected}
                  onClose={clearSelection}
                  onFocus={use3d ? focusSelected : undefined}
                  compact
                  className="absolute right-2 top-2 z-[60] max-h-[calc(100%-1rem)] w-[19rem] overflow-y-auto overscroll-contain shadow-overlay"
                />
              )}
            </div>
            {hasData && <GridLegend className="shrink-0 border-t border-line px-3 py-2" />}
          </section>

          <aside aria-label="Selection and transformer list" className="flex min-h-0 flex-col gap-3 lg:overflow-hidden">
            {selected && !isLg && (
              <DetailPanel
                transformer={selected}
                onClose={clearSelection}
                onFocus={use3d ? focusSelected : undefined}
                className="shrink-0"
              />
            )}
            {hasData && (
              <TransformerList
                nodes={visibleNodes}
                selectedId={selectedId}
                onSelect={select}
                onHover={setHoveredId}
                className="max-h-[26rem] min-h-[10rem] flex-1 lg:max-h-none"
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
