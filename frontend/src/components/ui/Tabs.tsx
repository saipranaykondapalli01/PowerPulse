import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';

export interface TabItem<K extends string = string> {
  id: K;
  label: ReactNode;
  /** Optional count/marker after the label. */
  badge?: ReactNode;
}

export interface TabsProps<K extends string> {
  tabs: TabItem<K>[];
  value: K;
  onChange: (id: K) => void;
  /** Accessible name for the tablist. */
  label: string;
  /** Content of the active panel. */
  children?: ReactNode;
  className?: string;
  panelClassName?: string;
}

/**
 * WAI-ARIA tabs with roving tabindex: ←/→ move focus and activate, Home/End jump.
 * Renders a single tabpanel labelled by the active tab.
 */
export function Tabs<K extends string>({ tabs, value, onChange, label, children, className, panelClassName }: TabsProps<K>) {
  const base = useId().replace(/:/g, '');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (activeIndex + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((t, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={t.id}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={clsx(
                '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors duration-fast',
                selected ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
      {children !== undefined && (
        <div
          role="tabpanel"
          id={`${base}-panel`}
          aria-labelledby={`${base}-tab-${tabs[activeIndex]?.id}`}
          tabIndex={0}
          className={clsx('pt-4', panelClassName)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
