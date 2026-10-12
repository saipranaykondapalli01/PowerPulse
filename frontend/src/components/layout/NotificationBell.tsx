import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import clsx from 'clsx';
import { useNotificationActions, useNotifications, useUnreadCount } from '@/hooks/useWorkflows';
import { Popover } from '@/components/ui/Popover';
import { Spinner } from '@/components/ui/Spinner';
import { notificationTypeLabel } from '@/utils/labels';
import { formatRelative } from '@/utils/format';
import { linkForResource } from '@/utils/links';
import type { NotificationDto } from '@/types/api';

/** Top-bar bell: unread count + the 5 latest notifications, with "View all". */
export function NotificationBell() {
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  return (
    <Popover
      label="Latest notifications"
      className="w-[min(22rem,calc(100vw-1.5rem))]"
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm text-fg-muted hover:bg-raised hover:text-fg"
        >
          <Bell aria-hidden="true" className="h-4 w-4" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 min-w-[1rem] rounded-sm bg-critical px-1 text-center font-mono text-[0.6rem] font-semibold leading-4 text-fg"
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      )}
    >
      {(close) => <NotificationList onNavigate={close} />}
    </Popover>
  );
}

function NotificationList({ onNavigate }: { onNavigate: () => void }) {
  const list = useNotifications({ page: 0, size: 5 });
  const { markRead } = useNotificationActions();
  const navigate = useNavigate();

  const open = (n: NotificationDto) => {
    if (!n.read) markRead.mutate(n.id);
    const to = linkForResource(n.relatedType, n.relatedId) ?? '/notifications';
    onNavigate();
    navigate(to);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="font-mono text-label uppercase text-fg-muted">Notifications</p>
        {list.isFetching && <Spinner size="xs" className="text-fg-muted" />}
      </div>
      {list.isPending ? (
        <p className="px-3 py-4 text-xs text-fg-muted">Loading…</p>
      ) : list.isError ? (
        <div className="flex items-center justify-between gap-2 px-3 py-4 text-xs">
          <span className="text-critical">Couldn’t load notifications.</span>
          <button type="button" className="text-fg underline" onClick={() => void list.refetch()}>
            Retry
          </button>
        </div>
      ) : list.data.content.length === 0 ? (
        <p className="px-3 py-4 text-xs text-fg-muted">You’re all caught up.</p>
      ) : (
        <ul className="max-h-96 overflow-y-auto">
          {list.data.content.map((n) => (
            <li key={n.id} className="border-b border-line/60 last:border-b-0">
              <button
                type="button"
                onClick={() => open(n)}
                className="flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-raised"
              >
                <span
                  aria-hidden="true"
                  className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent')}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[0.65rem] uppercase text-fg-muted">
                      {notificationTypeLabel[n.type] ?? n.type}
                      {!n.read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <time dateTime={n.createdAt} className="shrink-0 font-mono text-[0.65rem] text-fg-muted">
                      {formatRelative(n.createdAt)}
                    </time>
                  </span>
                  <span className={clsx('block truncate text-sm', n.read ? 'text-fg-muted' : 'text-fg')}>{n.title}</span>
                  <span className="line-clamp-2 block text-xs text-fg-muted">{n.message}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-3 py-2">
        <Link to="/notifications" onClick={onNavigate} className="text-xs font-medium text-accent-ink hover:underline">
          View all notifications →
        </Link>
      </div>
    </div>
  );
}
