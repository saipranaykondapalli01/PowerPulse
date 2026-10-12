import { usePublicNetworkPreview } from '@/hooks/useMonitoring';
import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { NetworkDiagram } from '../illustrations/NetworkDiagram';
import { byAttention, statusCounts } from '../data';
import { ArrowLink, LiveTag, SectionIndex, StatusMark } from '../ui';
import { PREVIEW_UNAVAILABLE } from './NetworkSection';

const ROUTES = [
  { to: '/dashboard', label: 'Open dashboard' },
  { to: '/grid', label: 'Open 3D grid' },
  { to: '/transformers', label: 'Transformer registry' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/maintenance', label: 'Maintenance' },
];

const ROWS = 8;

/**
 * Shows real application data rather than screenshots: a status board and a node map built
 * from the same public preview feed the app serves, with links into the working routes.
 */
export function Product() {
  const { data, isLoading, isError } = usePublicNetworkPreview();
  const nodes = !isError && data ? data : [];
  const rows = byAttention(nodes).slice(0, ROWS);
  const counts = statusCounts(nodes);

  return (
    <section id="product" aria-labelledby="product-title" className="pp-section border-t border-ink/15">
      <div className="container-content">
        <div className="mb-14 grid grid-cols-1 gap-y-10 md:mb-20 md:grid-cols-12 md:gap-x-8">
          <SectionIndex n="07" label="Product" className="text-muted md:col-span-12" />
          <RevealLines
            id="product-title"
            className="pp-display text-display-lg md:col-span-8"
            lines={['THE PRODUCT,', 'RUNNING NOW.']}
          />
          <p className="self-end text-base leading-relaxed text-muted md:col-span-4">
            Not screenshots. The board and map below are rendered from the live preview feed of the running
            application. All readings are simulated.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Status board */}
          <Reveal variant="clip" className="lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <LiveTag />
              <span className="pp-label text-muted">Status board · needs attention first</span>
            </div>
            <div className="overflow-x-auto border-y border-ink">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">
                  Transformer status board, live simulated data from the public network preview, sorted by attention
                </caption>
                <thead>
                  <tr className="pp-label text-muted">
                    <th scope="col" className="py-3 pr-4 font-medium">Code</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Location</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Status</th>
                    <th scope="col" className="py-3 pr-4 text-right font-medium">Health</th>
                    <th scope="col" className="py-3 text-right font-medium">Load</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((n) => (
                    <tr key={n.id} className="border-t border-ink/15">
                      <th scope="row" className="py-3 pr-4 font-mono text-sm font-medium">{n.code}</th>
                      <td className="max-w-[12rem] truncate py-3 pr-4 text-muted">{n.location}</td>
                      <td className="py-3 pr-4">
                        <StatusMark status={n.status} />
                      </td>
                      <td className="tabular py-3 pr-4 text-right font-mono">{Math.round(n.healthScore)}</td>
                      <td className="tabular py-3 text-right font-mono">
                        {n.loadPct == null ? '—' : `${Math.round(n.loadPct)}%`}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr className="border-t border-ink/15">
                      <td colSpan={5} className="py-10 text-center text-muted" role="status">
                        {isError ? PREVIEW_UNAVAILABLE : isLoading ? 'Loading live data…' : 'No transformers in the preview yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {nodes.length > ROWS && (
              <p className="pp-label mt-3 text-muted">
                Showing {ROWS} of {nodes.length} · {counts.CRITICAL} critical · {counts.WARNING} warning
              </p>
            )}
          </Reveal>

          {/* Node map */}
          <Reveal variant="clip" delay={0.1} className="lg:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="pp-label text-ink">Node map</span>
              <span className="pp-label text-muted">Plan view · same feed</span>
            </div>
            <div className="border border-ink bg-ink p-4 text-paper/85">
              <NetworkDiagram
                nodes={nodes}
                showLabels={nodes.length <= 16}
                className="h-auto w-full"
                title={
                  nodes.length
                    ? `Plan view of ${nodes.length} transformers coloured by status`
                    : 'Schematic network diagram (no live data)'
                }
              />
            </div>
          </Reveal>
        </div>

        <nav aria-label="Open the application" className="mt-14 border-t border-ink/15 pt-6">
          <ul className="flex flex-wrap gap-x-10 gap-y-4">
            {ROUTES.map((r) => (
              <li key={r.to}>
                <ArrowLink to={r.to}>{r.label}</ArrowLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
