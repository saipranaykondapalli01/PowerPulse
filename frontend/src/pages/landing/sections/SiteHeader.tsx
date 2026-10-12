import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import clsx from 'clsx';
import { Menu, X } from 'lucide-react';
import { scrollToHash } from '../ui';

export const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#network', label: 'Network' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#about', label: 'About' },
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path d="M1 10 H6 L8 4 L12 16 L14 10 H19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      </svg>
      PowerPulse
    </span>
  );
}

/**
 * Fixed header: transparent over the hero, then solid paper with a hairline after scrolling.
 * Mobile: a full-screen menu dialog with focus trap, Esc to close and focus return.
 */
export function SiteHeader() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(scrollY, 'change', (y) => setSolid(y > 24));

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const onAnchor = (e: React.MouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    scrollToHash(e, reduce);
  };

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-base ease-out',
        solid ? 'border-b border-ink/15 bg-paper' : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container-content flex h-[var(--header-h)] items-center justify-between gap-6">
        <a href="#top" onClick={onAnchor} aria-label="PowerPulse, back to top" className="shrink-0">
          <Wordmark />
        </a>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={onAnchor} className="pp-label py-2 text-ink/80 transition-colors hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-6 md:flex">
          <Link to="/login" className="pp-label py-2 text-ink/80 hover:text-ink">
            Sign In
          </Link>
          <Link
            to="/dashboard"
            className="pp-label border border-ink bg-ink px-4 py-2.5 text-paper transition-colors duration-base hover:bg-accent hover:text-ink"
          >
            Launch Dashboard
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="pp-label inline-flex items-center gap-2 py-2 md:hidden"
          aria-expanded={open}
          aria-controls="pp-mobile-menu"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
          Menu
        </button>
      </div>

      {open && (
        <div
          ref={dialogRef}
          id="pp-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[70] flex flex-col bg-paper md:hidden"
        >
          <div className="container-content flex h-[var(--header-h)] items-center justify-between border-b border-ink/15">
            <Wordmark />
            <button type="button" onClick={close} className="pp-label inline-flex items-center gap-2 py-2">
              <X aria-hidden="true" className="h-5 w-5" />
              Close
            </button>
          </div>
          <nav aria-label="Mobile" className="container-content flex flex-1 flex-col justify-between py-10">
            <ul className="space-y-1">
              {NAV_LINKS.map((l, i) => (
                <li key={l.href} className="border-b border-ink/10">
                  <a href={l.href} onClick={onAnchor} className="flex items-baseline gap-4 py-4">
                    <span className="pp-label text-muted">0{i + 1}</span>
                    <span className="pp-display text-display-sm">{l.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <Link to="/login" className="pp-cta pp-cta--outline" onClick={() => setOpen(false)}>
                Sign In
              </Link>
              <Link to="/dashboard" className="pp-cta pp-cta--solid" onClick={() => setOpen(false)}>
                Launch Dashboard
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
