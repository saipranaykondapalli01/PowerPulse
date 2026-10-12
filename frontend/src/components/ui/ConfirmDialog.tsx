import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { Textarea } from './Textarea';

export interface ConfirmReasonOptions {
  /** Field label, e.g. "Reason". */
  label: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  /** Message when required and empty, or shorter than minLength. Default "<label> is required" / "... at least N characters". */
  requiredMessage?: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Runs on confirm with the trimmed reason ("" when there is no reason field).
   * Return a promise to keep the dialog busy (buttons disabled, not dismissible) until it settles.
   * The dialog never closes itself — close it from the caller once the backend has confirmed.
   */
  onConfirm: (reason: string) => unknown;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for destructive or irreversible actions. */
  tone?: 'default' | 'danger';
  /** External busy flag (e.g. a mutation's isPending). */
  loading?: boolean;
  /** Optional free-text reason captured with the confirmation. */
  reason?: ConfirmReasonOptions;
  /** Form-level error (e.g. from the server). */
  error?: string;
  /** Server-side error for the reason field. */
  reasonError?: string;
  /** Extra content (e.g. more form fields) between the description and the actions. */
  children?: ReactNode;
  size?: 'sm' | 'md';
}

/**
 * Accessible confirmation for destructive or irreversible actions.
 * Optional required reason with inline validation; prevents double submits while pending.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  loading,
  reason,
  error,
  reasonError,
  children,
  size = 'sm',
}: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState<string>();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setLocalError(undefined);
    }
  }, [open]);

  const busy = pending || !!loading;
  const close = () => {
    if (!busy) onClose();
  };

  const validate = (value: string): string | undefined => {
    if (!reason) return undefined;
    const min = reason.minLength ?? (reason.required ? 1 : 0);
    if (reason.required && value.length < min) {
      return (
        reason.requiredMessage ??
        (min > 1 ? `${reason.label} must be at least ${min} characters` : `${reason.label} is required`)
      );
    }
    if (reason.maxLength && value.length > reason.maxLength) {
      return `${reason.label} must be at most ${reason.maxLength} characters`;
    }
    return undefined;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current || busy) return;
    const value = text.trim();
    const invalid = validate(value);
    setLocalError(invalid);
    if (invalid) {
      reasonRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      await onConfirm(value);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const fieldError = localError ?? reasonError;

  return (
    <Dialog open={open} onClose={close} size={size} title={title} description={description} dismissible={!busy}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label={title} aria-busy={busy || undefined}>
        {tone === 'danger' && (
          <p className="flex items-start gap-2 border-l-2 border-critical pl-3 text-xs text-fg-muted">
            <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-critical" />
            This cannot be undone.
          </p>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-sm border border-critical/40 bg-critical-bg px-3 py-2 text-sm text-critical">
            <AlertOctagon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {children}
        {reason && (
          <Field label={reason.label} required={reason.required} error={fieldError} hint={reason.hint}>
            <Textarea
              ref={reasonRef}
              rows={reason.rows ?? 3}
              value={text}
              placeholder={reason.placeholder}
              maxLength={reason.maxLength ? reason.maxLength + 1 : undefined}
              onChange={(e) => {
                setText(e.target.value);
                if (localError) setLocalError(undefined);
              }}
              disabled={busy}
            />
          </Field>
        )}
        <div className="-mx-5 -mb-4 mt-1 flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
