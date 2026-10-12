import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Check, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { useNotificationActions, useNotifications, useUnreadCount } from '@/hooks/useWorkflows';
import { useUrlState } from '@/hooks/useUrlState';
import { usePageParams } from '@/hooks/useListUrlParams';
import type { NotificationDto, NotificationListParams, NotificationType } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { toneChip, toneText } from '@/components/ui/tone';
import { useNow } from '@/components/ui/useNow';
import { dayKey, dayLabel, notificationMeta } from '@/components/notifications/notificationMeta';
import { FilterBar } from '@/components/ui/FilterBar';
import { EnumFilter } from '@/components/workflow/FilterControls';
import { formatDateTime, formatNumber, formatRelative } from '@/utils/format';
import { notificationTypeLabel } from '@/utils/labels';
import { linkForResource } from '@/utils/links';

const TYPES = Object.keys(notificationTypeLabel) as NotificationType[];

export default function NotificationsPage() {
  const { get, set } = useUrlState();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(30_000);
  const { page, size, setPage, setSize } = usePageParams();
  const { markRead, markAllRead } = useNotificationActions();
  const unread = useUnreadCount();
  const readFilter = get('read');
  const type = get('type') as NotificationType | undefined;

  const params = useMemo<NotificationListParams>(() => {
    const p: NotificationListParams = { page, size };
    if (readFilter === 'unread') p.read = false;
    if (readFilter === 'read') p.read = true;
    if (type && TYPES.includes(type)) p.type = type;
    return p;
  }, [page, size, readFilter, type]);

  const list = useNotifications(params);
  const activeFilters = (readFilter ? 1 : 0) + (type ? 1 : 0);
  const hasFilters = activeFilters > 0;
  const clearFilters = () => set({ read: undefined, type: undefined }, { resetPage: true });

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: NotificationDto[] }[] = [];
    for (const n of list.data?.content ?? []) {
      const k = dayKey(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(n);
      else out.push({ key: k, label: dayLabel(n.createdAt, now), items: [n] });
    }
    return out;
  }, [list.data, now]);

  const onMarkRead = async (n: NotificationDto) => {
    try {
      await markRead.mutateAsync(n.id);
    } catch (e) {
      toast.error('Could not mark as read', errorMessage(e));
    }
  };

  const onOpen = async (n: NotificationDto) => {
    const href = linkForResource(n.relatedType, n.relatedId);
    if (!n.read) markRead.mutate(n.id, { onError: (e) => toast.error('Could not mark as read', errorMessage(e)) });
    if (href) navigate(href);
  };

  const onMarkAll = async () => {
    if (markAllRead.isPending) return;
    try {
      await markAllRead.mutateAsync();
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error('Could not mark all as read', errorMessage(e));
    }
  };

  const unreadCount = unread.data?.count;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Insights · Inbox"
        title="Notifications"
        description="Alerts, assignments and reminders addressed to you."
        meta={
          unreadCount !== undefined && (
            <p className="inline-flex items-center gap-2 font-mono text-label uppercase text-fg-muted">
              <span aria-hidden="true" className={clsx('h-1.5 w-1.5 rounded-full', unreadCount > 0 ? 'bg-accent ring-1 ring-accent-ink/40' : 'bg-line-strong')} />
              {unreadCount > 0 ? `${formatNumber(unreadCount)} unread` : 'All caught up'}
            </p>
          )
        }
        actions={
          <Button
            variant="secondary"
            icon={<CheckCheck />}
            onClick={() => void onMarkAll()}
            loading={markAllRead.isPending}
            disabled={unreadCount === 0}
          >
            Mark all read
          </Button>
        }
      />

      <FilterBar layout="stacked" label="Notification filters" activeCount={activeFilters} onReset={clearFilters} bodyClassName="grid-cols-2 md:grid-cols-4">
        <Field label="Show">
          <Select value={readFilter ?? ''} onChange={(e) => set({ read: e.target.value }, { resetPage: true })}>
            <option value="">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </Select>
        </Field>
        <EnumFilter label="Type" value={params.type ?? ''} onChange={(v) => set({ type: v }, { resetPage: true })} options={TYPES} labels={notificationTypeLabel} />
      </FilterBar>

      <section aria-label="Notification list" className="min-w-0 rounded-sm border border-line bg-panel">
        {list.isPending ? (
          <LoadingBlock className="p-4" lines={6} label="Loading notifications" />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} title="Could not load notifications" onRetry={() => void list.refetch()} retrying={list.isRefetching} />
        ) : list.data.content.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title={hasFilters ? 'No notifications match these filters' : 'You are all caught up'}
            description={hasFilters ? undefined : 'New alerts and assignments will appear here.'}
            action={
              hasFilters ? (
                <Button size="sm" variant="secondary" onClick={clearFilters}>
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className={clsx('transition-opacity duration-fast motion-reduce:transition-none', list.isPlaceholderData && 'opacity-60')}>
              {groups.map((g) => (
                <section key={g.key} aria-label={g.label}>
                  <h2 className="border-b border-line bg-raised/50 px-4 py-1.5 font-mono text-label uppercase text-fg-muted">
                    {g.label}
                    <span className="ml-2 text-fg-muted/80">· {g.items.length}</span>
                  </h2>
                  <ul aria-label={`Notifications · ${g.label}`} className="divide-y divide-line/80">
                    {g.items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        now={now}
                        onOpen={() => void onOpen(n)}
                        onMarkRead={() => void onMarkRead(n)}
                        marking={markRead.isPending && markRead.variables === n.id}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="border-t border-line">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                totalElements={list.data.totalElements}
                size={list.data.size}
                itemLabel="notifications"
                onPageChange={setPage}
                onSizeChange={setSize}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function NotificationRow({
  n,
  now,
  onOpen,
  onMarkRead,
  marking,
}: {
  n: NotificationDto;
  now: number;
  onOpen: () => void;
  onMarkRead: () => void;
  marking: boolean;
}) {
  const href = linkForResource(n.relatedType, n.relatedId);
  const meta = notificationMeta[n.type] ?? { label: n.type, Icon: Bell, tone: 'neutral' as const };
  const { Icon } = meta;
  return (
    <li className={clsx('relative flex items-start gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-raised/40', !n.read && 'bg-canvas/60')}>
      {!n.read && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      <span
        aria-hidden="true"
        className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border', toneChip[meta.tone])}
      >
        <Icon className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="group min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        aria-label={`${n.read ? '' : 'Unread: '}${n.title}${href ? '' : ' (mark as read)'}`}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.06em]">
          <span className={toneText[meta.tone === 'neutral' ? 'neutral' : meta.tone]}>{meta.label}</span>
          {!n.read && (
            <span className="inline-flex items-center gap-1 text-accent-ink">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-accent-ink/40" />
              <span>Unread</span>
            </span>
          )}
        </span>
        <span className={clsx('mt-1 block text-sm leading-snug', n.read ? 'text-fg-muted' : 'font-semibold text-fg')}>{n.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{n.message}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.6875rem] text-fg-muted">
          <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
            {formatRelative(n.createdAt, now)}
          </time>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{formatDateTime(n.createdAt)}</span>
          {href && <span aria-hidden="true">·</span>}
          {href && (
            <span className="inline-flex items-center gap-1 text-accent-ink group-hover:underline">
              Open record <ArrowRight aria-hidden="true" className="h-3 w-3 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          )}
        </span>
      </button>
      {!n.read && (
        <IconButton size="sm" label={`Mark "${n.title}" as read`} icon={<Check />} onClick={onMarkRead} disabled={marking} />
      )}
    </li>
  );
}
