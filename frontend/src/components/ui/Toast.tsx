import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import clsx from 'clsx';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms; 0 keeps it until dismissed. Default 5000 (errors 8000). */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'description'>> {
  id: number;
  description?: string;
}

export interface ToastApi {
  toast: (o: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const noop = () => {};
const fallback: ToastApi = { toast: noop, success: noop, error: noop, info: noop, warning: noop, dismiss: noop };

/**
 * Access the toast API. Outside a ToastProvider (e.g. isolated tests) it is a no-op.
 * The app mounts ToastProvider inside AppShell.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? fallback;
}

const meta: Record<ToastTone, { Icon: typeof Info; cls: string; label: string }> = {
  success: { Icon: CheckCircle2, cls: 'text-healthy', label: 'Success' },
  error: { Icon: AlertOctagon, cls: 'text-critical', label: 'Error' },
  warning: { Icon: AlertTriangle, cls: 'text-warning', label: 'Warning' },
  info: { Icon: Info, cls: 'text-steel', label: 'Info' },
};

function ToastView({ item, onDismiss: dismissId }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { id } = item;
  const { Icon, cls, label } = meta[item.tone];
  useEffect(() => {
    if (!item.duration) return;
    const t = window.setTimeout(() => dismissId(id), item.duration);
    return () => window.clearTimeout(t);
  }, [item.duration, dismissId, id]);
  return (
    <li
      className={clsx(
        'pointer-events-auto flex w-full items-start gap-3 rounded-sm border border-line bg-panel px-3 py-2.5 text-fg shadow-overlay',
        item.tone === 'error' && 'border-critical/50',
      )}
    >
      <Icon aria-hidden="true" className={clsx('mt-0.5 h-4 w-4 shrink-0', cls)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className="sr-only">{label}: </span>
          {item.title}
        </p>
        {item.description && <p className="mt-0.5 text-xs text-fg-muted">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismissId(id)}
        aria-label="Dismiss notification"
        className="rounded-sm p-0.5 text-fg-muted hover:text-fg"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Provides useToast(). Renders a polite aria-live region (assertive for errors). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((o: ToastOptions) => {
    const tone = o.tone ?? 'info';
    const item: ToastItem = {
      id: ++seq.current,
      title: o.title,
      description: o.description,
      tone,
      duration: o.duration ?? (tone === 'error' ? 8000 : 5000),
    };
    setItems((list) => [...list.slice(-3), item]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
      warning: (title, description) => toast({ title, description, tone: 'warning' }),
    }),
    [toast, dismiss],
  );

  const polite = items.filter((t) => t.tone !== 'error');
  const assertive = items.filter((t) => t.tone === 'error');

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        <ol aria-live="assertive" aria-label="Error notifications" className="flex flex-col gap-2">
          {assertive.map((t) => (
            <ToastView key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </ol>
        <ol aria-live="polite" aria-label="Notifications" className="flex flex-col gap-2">
          {polite.map((t) => (
            <ToastView key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}
