import { useEffect, useRef, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** Error from the last attempt, shown inside the dialog. */
  error?: string;
}

/** Standalone confirmation step for dangerous admin actions (e.g. deactivating a user from the table). */
export function AdminConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, busy, error }: AdminConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 text-sm text-fg-muted">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
        <div className="space-y-2">{children}</div>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-sm border border-critical/35 bg-critical-bg px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}
    </Dialog>
  );
}

export interface InlineConfirmProps {
  title: string;
  items: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onBack: () => void;
  busy?: boolean;
}

/**
 * Confirmation step rendered inside an already-open dialog (stacking two modal focus traps is avoided).
 * Lists every dangerous change about to be saved.
 */
export function InlineConfirm({ title, items, confirmLabel, onConfirm, onBack, busy }: InlineConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), []);
  return (
    <div role="alertdialog" aria-labelledby="admin-inline-confirm-title" className="rounded-sm border border-critical/35 bg-critical-bg p-3">
      <p id="admin-inline-confirm-title" className="flex items-center gap-2 text-sm font-medium text-critical">
        <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-9 text-sm text-fg">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Go back
        </Button>
        <Button ref={confirmRef} variant="danger" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
