import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

export interface PopoverProps {
  /** Renders the trigger; spread the given props onto a <button>. */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-haspopup': 'dialog';
    onClick: () => void;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** Accessible label for the panel. */
  label: string;
}

/** Non-modal dropdown panel: toggles on click, closes on outside click / Escape (focus returns to trigger). */
export function Popover({ trigger, children, align = 'right', className, label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLElement>('[aria-controls]')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({ 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': 'dialog', onClick: () => setOpen((o) => !o) })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={clsx(
            'absolute top-full z-40 mt-2 rounded-sm border border-line bg-panel text-fg shadow-overlay',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
