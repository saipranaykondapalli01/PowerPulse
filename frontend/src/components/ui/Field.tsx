import { createContext, useContext, useId, type ReactNode } from 'react';
import clsx from 'clsx';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read by Input/Select/Textarea so they get the right id, aria-describedby and aria-invalid automatically. */
export function useFieldContext() {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: ReactNode;
  /** Error message (e.g. from react-hook-form). Rendered with role="alert". */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  /** Explicit id for the control; generated otherwise. */
  id?: string;
  className?: string;
  /** Visually hide the label (still accessible). */
  hideLabel?: boolean;
  children: ReactNode;
}

/**
 * Label + control + hint + error with wired accessibility ids.
 * Usage: <Field label="Email" error={errors.email?.message}><Input {...register('email')} /></Field>
 */
export function Field({ label, error, hint, required, id, className, hideLabel, children }: FieldProps) {
  const gen = useId();
  const controlId = id ?? `f${gen.replace(/:/g, '')}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: !!error, required: !!required }}>
      <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
        <label
          htmlFor={controlId}
          className={clsx('font-mono text-label uppercase text-fg-muted', hideLabel && 'sr-only')}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-accent-ink">
              *
            </span>
          )}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs text-fg-muted">
            {hint}
          </p>
        )}
        {hint && error && (
          <p id={hintId} className="sr-only">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-critical">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
