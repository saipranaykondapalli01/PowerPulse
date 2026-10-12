import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Same pulse mark as the landing header (kept local so auth pages don't pull in the landing chunk). */
export function AuthWordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path d="M1 10 H6 L8 4 L12 16 L14 10 H19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
      PowerPulse
    </span>
  );
}

export interface AuthLayoutProps {
  /** Supporting copy under the headline. */
  aside?: ReactNode;
  /** Mono section label above the headline, e.g. "Operator access". */
  section?: string;
  children: ReactNode;
}

/**
 * Editorial frame for /login and /demo — a continuation of the landing page: paper background,
 * wordmark header with a hairline, a display headline column and a quiet form panel.
 */
export function AuthLayout({ aside, section = 'Access', children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink [color-scheme:light]">
      <header className="border-b border-ink/15">
        <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between gap-4 px-5 sm:px-10">
          <Link to="/" aria-label="PowerPulse home" className="rounded-sm">
            <AuthWordmark />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-sm font-mono text-label uppercase text-muted transition-colors duration-fast hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-content flex-1 grid-cols-1 gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,28rem)] lg:items-center lg:gap-16 lg:py-16">
        <div className="min-w-0">
          <p className="flex items-center gap-3 font-mono text-label uppercase text-muted">
            <span aria-hidden="true">01</span>
            <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
            <span>{section}</span>
          </p>
          <p className="mt-6 max-w-[14ch] font-display text-display-md font-semibold">See the fault before the failure.</p>
          {aside && <div className="mt-6 max-w-md text-base leading-relaxed text-muted">{aside}</div>}
          <dl className="mt-10 hidden max-w-lg grid-cols-3 border-t border-ink/15 pt-4 lg:grid">
            {[
              ['Monitor', 'Health, load and readings'],
              ['Detect', 'Faults and stale sensors'],
              ['Maintain', 'Tasks through resolution'],
            ].map(([k, v]) => (
              <div key={k} className="pr-4">
                <dt className="font-mono text-label uppercase text-ink">{k}</dt>
                <dd className="mt-1 text-xs text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <main id="main-content" className="w-full min-w-0 rounded-sm border border-ink/15 bg-panel p-6 text-fg sm:p-8">
          {children}
        </main>
      </div>

      <footer className="border-t border-ink/15">
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-2 px-5 py-4 font-mono text-label uppercase text-muted sm:px-10">
          <span>Transformer monitoring</span>
          <span>Monitoring · Fault detection · Maintenance</span>
        </div>
      </footer>
    </div>
  );
}
