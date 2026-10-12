import clsx from 'clsx';

/** Labelled on/off switch rendered as a checkbox (keeps native semantics and the label as accessible name). */
export function ToggleFilter({ label, checked, onChange, className }: { label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label
      className={clsx(
        'flex h-9 cursor-pointer select-none items-center gap-2 rounded-sm border px-2.5 text-sm transition-colors duration-fast',
        checked ? 'border-fg/60 bg-raised/60 text-fg' : 'border-line bg-canvas text-fg-muted hover:text-fg',
        className,
      )}
    >
      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--ink))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
