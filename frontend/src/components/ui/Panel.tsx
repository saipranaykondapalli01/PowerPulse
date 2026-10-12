import { useId, type ReactNode } from 'react';
import clsx from 'clsx';

export interface PanelProps {
  /** Heading text (rendered as h2 by default). Omit for a bare panel. */
  title?: ReactNode;
  /** Small mono label above the title, e.g. "LIVE · SIMULATED". */
  eyebrow?: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  /** Right-aligned header slot (buttons, filters, links). */
  actions?: ReactNode;
  /** Remove body padding (e.g. for edge-to-edge tables). */
  flush?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
  bodyClassName?: string;
  id?: string;
  children?: ReactNode;
}

/**
 * Hairline-bordered section with an optional header. The app's primary layout block.
 * Renders <section aria-labelledby> when titled.
 */
export function Panel({
  title,
  eyebrow,
  description,
  actions,
  flush,
  headingLevel = 2,
  className,
  bodyClassName,
  id,
  children,
}: PanelProps) {
  const headingId = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const hasHeader = title || eyebrow || actions;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={clsx('min-w-0 rounded-sm border border-line bg-panel', className)}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <p className="mb-0.5 font-mono text-label uppercase text-fg-muted">{eyebrow}</p>}
            {title && (
              <H id={headingId} className="font-display text-sm font-semibold tracking-tight text-fg">
                {title}
              </H>
            )}
            {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(!flush && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Alias: a Panel is the app's card. */
export const Card = Panel;
