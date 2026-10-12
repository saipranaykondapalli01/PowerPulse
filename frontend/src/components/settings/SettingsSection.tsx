import { useId, type ReactNode } from 'react';
import clsx from 'clsx';

export interface SettingsSectionProps {
  /** Anchor id (used by the section index). */
  id: string;
  /** Two-digit mono index, e.g. "01". */
  index: string;
  title: string;
  description: ReactNode;
  /** Extra notes under the description (e.g. direction hints, caveats). */
  notes?: ReactNode;
  /** Right-aligned header status (e.g. weights total). */
  status?: ReactNode;
  children: ReactNode;
  /** Remove the control box padding (edge-to-edge tables). */
  flush?: boolean;
  className?: string;
}

/**
 * Editorial settings group: a mono index + title + explanation column beside the controls.
 * Stacks on small screens; two columns from lg.
 */
export function SettingsSection({ id, index, title, description, notes, status, children, flush, className }: SettingsSectionProps) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={clsx('grid scroll-mt-20 grid-cols-1 gap-4 border-t border-line pt-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8', className)}
    >
      <header className="min-w-0">
        <p className="flex items-center gap-2 font-mono text-label uppercase text-fg-muted">
          <span aria-hidden="true" className="tabular">
            {index}
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-line-strong" />
          Settings
        </p>
        <h2 id={headingId} className="mt-2 font-display text-lg font-semibold tracking-tight text-fg">
          {title}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
        {notes && <div className="mt-2 space-y-1 text-xs text-fg-muted">{notes}</div>}
        {status && <div className="mt-3">{status}</div>}
      </header>
      <div className={clsx('min-w-0 rounded-sm border border-line bg-panel', flush ? 'overflow-hidden' : 'p-4')}>{children}</div>
    </section>
  );
}

export const SETTINGS_SECTIONS = [
  { id: 'thresholds', label: 'Monitoring thresholds' },
  { id: 'sensor', label: 'Sensor & recovery' },
  { id: 'weights', label: 'Health score weights' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'locations', label: 'Locations' },
  { id: 'simulation', label: 'Simulation' },
] as const;

/** In-page index of the settings groups (anchor links). */
export function SettingsIndex({ className }: { className?: string }) {
  return (
    <nav aria-label="Settings sections" className={clsx('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
      {SETTINGS_SECTIONS.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="inline-flex items-center gap-1.5 font-mono text-label uppercase text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          <span aria-hidden="true" className="tabular text-fg-subtle">
            {String(i + 1).padStart(2, '0')}
          </span>
          {s.label}
        </a>
      ))}
    </nav>
  );
}
