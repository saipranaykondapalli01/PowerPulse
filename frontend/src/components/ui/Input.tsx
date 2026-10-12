import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import { useFieldContext } from './Field';

export const controlClasses =
  'w-full min-w-0 rounded-sm border border-line bg-canvas px-2.5 text-sm text-fg placeholder:text-fg-muted/70 ' +
  'transition-colors duration-fast hover:border-fg-muted/50 focus:border-accent/70 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-critical/70';

/** Merges explicit a11y props with the surrounding <Field> context. */
export function useControlProps(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: unknown;
  required?: boolean;
}) {
  const ctx = useFieldContext();
  return {
    id: props.id ?? ctx?.id,
    'aria-describedby': props['aria-describedby'] ?? ctx?.describedBy,
    'aria-invalid': (props['aria-invalid'] as boolean | undefined) ?? (ctx?.invalid || undefined),
    'aria-required': props.required || ctx?.required || undefined,
  };
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Leading adornment (icon). */
  leading?: ReactNode;
  /** Trailing adornment, e.g. a unit "kVA". */
  trailing?: ReactNode;
}

/** Text/number/date input. Inside <Field> it picks up id + aria wiring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, ...props },
  ref,
) {
  const a11y = useControlProps(props);
  const input = (
    <input
      ref={ref}
      {...props}
      {...a11y}
      className={clsx(controlClasses, 'h-9', leading && 'pl-8', trailing && 'pr-12', !leading && !trailing && className)}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className={clsx('relative min-w-0', className)}>
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-fg-muted [&>svg]:h-4 [&>svg]:w-4">
          {leading}
        </span>
      )}
      {input}
      {trailing && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-fg-muted">
          {trailing}
        </span>
      )}
    </div>
  );
});
