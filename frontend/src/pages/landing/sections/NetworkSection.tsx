import { lazy, Suspense, useRef } from 'react';
import { useInView } from 'framer-motion';
import { usePublicNetworkPreview } from '@/hooks/useMonitoring';
import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { NetworkDiagram } from '../illustrations/NetworkDiagram';
import { STATUS_LABEL, STATUS_ORDER, STATUS_TEXT, statusCounts } from '../data';
import { ArrowLink, Cta, LiveTag, SectionIndex } from '../ui';

// Loaded only when the section approaches the viewport, so three.js stays out of the initial load.
const NetworkPreview = lazy(() => import('@/three/NetworkPreview'));

export const PREVIEW_UNAVAILABLE = 'Live preview unavailable — start the PowerPulse server';

export function NetworkSection() {
  const { data, isLoading, isError } = usePublicNetworkPreview();
  const stageRef = useRef<HTMLDivElement>(null);
  const near = useInView(stageRef, { once: true, margin: '200px 0px' });
  const nodes = data ?? [];
  const counts = statusCounts(nodes);
  const hasData = !isError && nodes.length > 0;

  let caption: string;
  if (isError) caption = PREVIEW_UNAVAILABLE;
  else if (isLoading) caption = 'Loading live preview…';
  else if (!nodes.length) caption = 'No transformers in the preview yet';
  else caption = `${nodes.length} transformers · simulated readings`;

  const fallback = (
    <div className="flex h-full w-full items-center justify-center p-6 text-paper/80">
      <NetworkDiagram className="h-full max-h-full w-full" title="Schematic of a distribution network (static)" />
    </div>
  );

  return (
    <section id="network" aria-labelledby="network-title" className="pp-section border-t border-ink/15">
      <div className="container-content">
        <div className="grid grid-cols-1 gap-y-10 md:grid-cols-12 md:gap-x-8">
          <SectionIndex n="02" label="Network" className="text-muted md:col-span-12" />
          <RevealLines
            id="network-title"
            className="pp-display text-display-lg md:col-span-12"
            lines={['THE GRID,', 'IN A DIFFERENT LIGHT.']}
            lineClassNames={[undefined, 'md:pl-[12%]']}
          />
          <div className="flex flex-col justify-end gap-6 md:col-span-4 md:col-start-9">
            <p className="text-base leading-relaxed text-muted">
              Every transformer in the simulated network, placed in space and coloured by status, served by the same
              API the operations console uses.
            </p>
          </div>
        </div>

        <Reveal variant="clip" className="mt-14 md:mt-20">
          <figure>
            <div className="pp-label mb-3 flex flex-wrap items-center justify-between gap-3 text-ink">
              {isError ? <LiveTag>Static schematic · live data offline</LiveTag> : <LiveTag />}
              <span className="text-muted">Public preview · /api/v1/public/network-preview</span>
            </div>
            <div
              ref={stageRef}
              className="relative h-[clamp(360px,62vh,720px)] w-full overflow-hidden bg-ink text-paper"
            >
              {hasData && near ? (
                <Suspense fallback={fallback}>
                  <NetworkPreview nodes={nodes} height="100%" interactive theme="dark" className="h-full w-full" />
                </Suspense>
              ) : (
                fallback
              )}
            </div>
            <figcaption className="mt-4 grid grid-cols-1 gap-6 border-t border-ink/15 pt-4 md:grid-cols-12">
              <p className="pp-label text-ink md:col-span-5" role="status">
                {caption}
              </p>
              <ul className="pp-label flex flex-wrap gap-x-6 gap-y-2 text-muted md:col-span-4" aria-label="Transformers by status">
                {STATUS_ORDER.map((s) => (
                  <li key={s} className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 bg-current ${STATUS_TEXT[s]}`} />
                    {STATUS_LABEL[s]} {hasData ? counts[s] : '—'}
                  </li>
                ))}
              </ul>
              <div className="md:col-span-3 md:text-right">
                <ArrowLink to="/grid">Open the 3D grid</ArrowLink>
              </div>
            </figcaption>
          </figure>
        </Reveal>

        <div className="mt-12 flex md:justify-end">
          <Cta to="/grid" tone="outline">
            EXPLORE THE FULL GRID
          </Cta>
        </div>
      </div>
    </section>
  );
}
