import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, CircleSlash, OctagonAlert } from 'lucide-react';
import type { TransformerStatus } from '@/types/api';
import { STATUS_LABEL, STATUS_TEXT } from './data';

/** Mono section index, for example "02 — Network". */
export function SectionIndex({ n, label, className }: { n: string; label: string; className?: string }) {
  return (
    <p className={clsx('pp-label flex items-center gap-3', className)}>
      <span aria-hidden="true">{n}</span>
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
    </p>
  );
}

/** Small "live simulated data" tag with a static (non-pulsing) accent dot. */
export function LiveTag({ children = 'Live simulated data', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={clsx('pp-label inline-flex items-center gap-2', className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 bg-accent ring-1 ring-ink/40" />
      {children}
    </span>
  );
}

type CtaProps = {
  children: ReactNode;
  tone?: 'solid' | 'outline' | 'inverse';
  className?: string;
} & ({ to: string; href?: never; onClick?: never } | { href: string; to?: never; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void });

/** Square, mono-labelled call to action. The arrow slides on hover; the label never moves out of view. */
export function Cta({ children, tone = 'solid', className, ...rest }: CtaProps) {
  const cls = clsx('pp-cta group', `pp-cta--${tone}`, className);
  const inner = (
    <>
      <span>{children}</span>
      <ArrowRight aria-hidden="true" className="pp-cta__arrow h-4 w-4" strokeWidth={1.75} />
    </>
  );
  if ('to' in rest && rest.to) {
    return (
      <Link to={rest.to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={rest.href} onClick={rest.onClick} className={cls}>
      {inner}
    </a>
  );
}

/** Inline text link with an arrow that reveals on hover (the text is always visible). */
export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={clsx('pp-arrow-link group', className)}>
      <span>{children}</span>
      <ArrowUpRight aria-hidden="true" className="pp-arrow-link__icon h-4 w-4" strokeWidth={1.75} />
    </Link>
  );
}

const STATUS_ICON: Record<TransformerStatus, typeof CheckCircle2> = {
  HEALTHY: CheckCircle2,
  WARNING: AlertTriangle,
  CRITICAL: OctagonAlert,
  OFFLINE: CircleSlash,
};

/** Status shown with icon and text, never color alone. */
export function StatusMark({ status, className }: { status: TransformerStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <Icon aria-hidden="true" className={clsx('h-3.5 w-3.5 shrink-0', STATUS_TEXT[status])} strokeWidth={2} />
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}

/** Smooth-scroll to an in-page anchor; respects reduced motion and keeps the real href. */
export function scrollToHash(e: React.MouseEvent<HTMLAnchorElement>, reduce: boolean | null) {
  const hash = e.currentTarget.getAttribute('href');
  if (!hash?.startsWith('#')) return;
  const el = document.querySelector(hash);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', hash);
  if (el instanceof HTMLElement) {
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}
