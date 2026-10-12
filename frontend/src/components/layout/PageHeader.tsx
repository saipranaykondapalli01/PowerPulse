import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface PageHeaderProps {
  title: ReactNode;
  /** Mono eyebrow above the title (e.g. a code or section). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions. */
  actions?: ReactNode;
  /** Extra content under the title row (badges, meta). */
  meta?: ReactNode;
  className?: string;
}

/** Page-level h1 block used at the top of every in-app page. */
export function PageHeader({ title, eyebrow, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={clsx('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-5', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 font-mono text-label uppercase text-fg-muted">{eyebrow}</p>}
        <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.875rem] xl:text-[2.125rem]">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-fg-muted">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
