import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CircleDot, Loader, OctagonAlert, Repeat, Search } from 'lucide-react';
import { useAlertList } from '@/hooks/useWorkflows';
import { useAlertCount } from '@/hooks/useWorkflowCounts';
import { useUrlState } from '@/hooks/useUrlState';
import { useDebouncedUrlParam } from '@/hooks/useDebouncedUrlParam';
import { useDateRangeParam, useFocusParam, usePageParams, useServerSort } from '@/hooks/useListUrlParams';
import type { AlertDto, AlertListParams, AlertStatus, FaultType, Severity } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { SeverityBadge } from '@/components/ui/StatusBadges';
import { useNow } from '@/components/ui/useNow';
import { AlertDetailDrawer } from '@/components/alerts/AlertDetailDrawer';
import { AlertWorkflowMeter } from '@/components/alerts/AlertWorkflow';
import { RecoveredBadge } from '@/components/alerts/RecoveredBadge';
import { FilterBar } from '@/components/ui/FilterBar';
import { ToggleFilter } from '@/components/workflow/FilterBar';
import { EnumFilter, LocationFilter, TransformerFilter } from '@/components/workflow/FilterControls';
import { LiveStamp } from '@/components/workflow/LiveStamp';
import { RelativeTime } from '@/components/workflow/RelativeTime';
import { RowList, type RowColumn } from '@/components/workflow/RowList';
import { SummaryStrip } from '@/components/workflow/SummaryStrip';
import { formatDateTime, formatRelative, formatWithUnit } from '@/utils/format';
import { ALERT_STATUSES, alertStatusLabel, FAULT_TYPES, faultTypeLabel, SEVERITIES, severityLabel } from '@/utils/labels';
import { links } from '@/utils/links';

const DEFAULT_SORT = 'createdAt,desc';
const SORT_FIELDS: Record<string, string> = { created: 'createdAt', severity: 'severity', status: 'status' };
const FILTER_KEYS = ['q', 'status', 'severity', 'faultType', 'location', 'transformerId', 'from', 'to', 'active'];

const GRID =
  'lg:grid-cols-[7.25rem_minmax(0,2.6fr)_minmax(0,1.1fr)_7.5rem_10rem_minmax(0,1.25fr)_minmax(0,1fr)]';

export default function AlertsPage() {
  const { get, set } = useUrlState();
  const [q, setQ] = useDebouncedUrlParam('q');
  const [range, setRange] = useDateRangeParam();
  const { page, size, setPage, setSize } = usePageParams();
  const { sort, tableSort, onSortChange } = useServerSort(DEFAULT_SORT, SORT_FIELDS);
  const { focus, open, close } = useFocusParam();
  const now = useNow(30_000);

  const activeOnly = get('active') !== 'all';
  const status = get('status') as AlertStatus | undefined;
  const severity = get('severity') as Severity | undefined;
  const faultType = get('faultType') as FaultType | undefined;

  const params = useMemo<AlertListParams>(() => {
    const p: AlertListParams = { page, size, sort };
    const qv = get('q');
    if (qv) p.q = qv;
    if (status && ALERT_STATUSES.includes(status)) p.status = status;
    if (severity && SEVERITIES.includes(severity)) p.severity = severity;
    if (faultType && FAULT_TYPES.includes(faultType)) p.faultType = faultType;
    const loc = get('location');
    if (loc) p.location = loc;
    const tid = get('transformerId');
    if (tid) p.transformerId = tid;
    if (activeOnly) p.active = true;
    if (range.from) p.from = range.from;
    if (range.to) p.to = range.to;
    return p;
  }, [get, page, size, sort, status, severity, faultType, activeOnly, range]);

  const list = useAlertList(params);

  // Live counts across the whole network: size=1 queries, reading totalElements. Never derived from the visible page.
  const activeCount = useAlertCount({ active: true });
  const criticalCount = useAlertCount({ active: true, severity: 'CRITICAL' });
  const newCount = useAlertCount({ active: true, status: 'NEW' });
  const inProgressCount = useAlertCount({ active: true, status: 'IN_PROGRESS' });

  const setFilter = (key: string) => (v: string) => set({ [key]: v }, { resetPage: true });
  const activeFilters = FILTER_KEYS.filter((k) => get(k)).length;
  const hasFilters = activeFilters > 0;
  const clearFilters = () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), { resetPage: true });
  /** Apply a summary count as the filter set (everything else reset). */
  const applyQuick = (patch: Record<string, string | undefined>) =>
    set({ ...Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), ...patch }, { resetPage: true });
  const onlyFilters = (...keys: string[]) => FILTER_KEYS.every((k) => (keys.includes(k) ? !!get(k) : !get(k)));

  const columns: RowColumn<AlertDto>[] = [
    {
      key: 'severity',
      header: 'Severity',
      sortable: true,
      cell: (a) => <SeverityBadge value={a.severity} />,
    },
    {
      key: 'alert',
      header: 'Alert',
      rowHeader: true,
      className: 'col-span-2 lg:col-span-1 max-lg:order-2 lg:order-none',
      cell: (a) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[0.9375rem] font-semibold leading-snug tracking-tight text-fg">{faultTypeLabel[a.faultType]}</span>
            {a.recurrenceCount > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] text-warning" title="Times this fault has recurred">
                <Repeat aria-hidden="true" className="h-3 w-3" />
                Recurred ×{a.recurrenceCount}
              </span>
            )}
          </span>
          <span className="line-clamp-2 text-xs leading-relaxed text-fg-muted">{a.description}</span>
          {a.recovered && a.status !== 'RESOLVED' && <RecoveredBadge className="mt-1 self-start" />}
        </span>
      ),
    },
    {
      key: 'transformer',
      header: 'Transformer',
      mobileLabel: 'Transformer',
      className: 'max-lg:order-3 lg:order-none',
      cell: (a) => (
        <span className="flex min-w-0 flex-col">
          <Link to={links.transformer(a.transformerId)} className="self-start font-mono text-xs font-medium text-accent-ink underline-offset-2 hover:underline">
            {a.transformerCode}
          </Link>
          <span className="truncate text-xs text-fg-muted">{a.location}</span>
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Measured / limit',
      mobileLabel: 'Measured / limit',
      align: 'right',
      className: 'max-lg:order-3 lg:order-none',
      cell: (a) => (
        <span className="flex flex-col font-mono tabular-nums lg:items-end">
          <span className="text-[0.8125rem] font-medium text-fg">{formatWithUnit(a.measuredValue, a.unit)}</span>
          <span className="text-[0.6875rem] text-fg-muted">limit {formatWithUnit(a.threshold, a.unit)}</span>
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Detected',
      sortable: true,
      className: 'max-lg:order-1 lg:order-none max-lg:text-right max-lg:[&>span]:items-end',
      cell: (a) => <RelativeTime at={a.createdAt} now={now} showAbsolute />,
    },
    {
      key: 'status',
      header: 'Workflow',
      sortLabel: 'Workflow status',
      sortable: true,
      mobileLabel: 'Workflow',
      className: 'max-lg:order-4 lg:order-none',
      cell: (a) => (
        <span className="flex min-w-0 flex-col gap-1">
          <AlertWorkflowMeter status={a.status} />
          <span className="truncate text-[0.6875rem] text-fg-muted">
            {a.acknowledgedAt ? (
              <>
                Ack’d{' '}
                <time dateTime={a.acknowledgedAt} title={formatDateTime(a.acknowledgedAt)}>
                  {formatRelative(a.acknowledgedAt, now)}
                </time>
                {a.acknowledgedBy ? ` · ${a.acknowledgedBy}` : ''}
              </>
            ) : a.status === 'RESOLVED' ? (
              'Closed'
            ) : (
              'Not acknowledged'
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      mobileLabel: 'Assignee',
      className: 'max-lg:order-4 lg:order-none',
      cell: (a) =>
        a.assignedUserName ? (
          <span className="block truncate text-[0.8125rem] text-fg">{a.assignedUserName}</span>
        ) : (
          <span className="text-[0.8125rem] text-fg-muted">Unassigned</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Operations · Alerts"
        title="Alerts"
        description="Faults detected from transformer readings. Open an alert to acknowledge, assign, resolve or raise maintenance."
        actions={<LiveStamp updatedAt={list.dataUpdatedAt} fetching={list.isFetching} />}
      />

      <SummaryStrip
        label="Alert counts"
        scope="Live · all transformers"
        items={[
          {
            key: 'active',
            label: 'Active alerts',
            value: activeCount.data,
            loading: activeCount.isPending,
            error: activeCount.isError,
            icon: <BellRing />,
            hint: 'open and not resolved',
            onSelect: () => applyQuick({}),
            active: activeOnly && onlyFilters(),
          },
          {
            key: 'critical',
            label: 'Critical',
            value: criticalCount.data,
            loading: criticalCount.isPending,
            error: criticalCount.isError,
            tone: 'critical',
            icon: <OctagonAlert />,
            hint: 'active, critical severity',
            onSelect: () => applyQuick({ severity: 'CRITICAL' }),
            active: onlyFilters('severity') && severity === 'CRITICAL',
          },
          {
            key: 'new',
            label: 'Unacknowledged',
            value: newCount.data,
            loading: newCount.isPending,
            error: newCount.isError,
            tone: 'accent',
            icon: <CircleDot />,
            hint: 'active, status New',
            onSelect: () => applyQuick({ status: 'NEW' }),
            active: onlyFilters('status') && status === 'NEW',
          },
          {
            key: 'in-progress',
            label: 'In progress',
            value: inProgressCount.data,
            loading: inProgressCount.isPending,
            error: inProgressCount.isError,
            icon: <Loader />,
            hint: 'being worked on',
            onSelect: () => applyQuick({ status: 'IN_PROGRESS' }),
            active: onlyFilters('status') && status === 'IN_PROGRESS',
          },
        ]}
      />

      <FilterBar
        layout="stacked"
        label="Alert filters"
        activeCount={activeFilters}
        onReset={clearFilters}
        bodyClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-12"
      >
        <Field label="Search" className="col-span-2 md:col-span-4 xl:col-span-4">
          <Input type="search" leading={<Search />} placeholder="Transformer, description…" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <EnumFilter label="Severity" value={params.severity ?? ''} onChange={setFilter('severity')} options={SEVERITIES} labels={severityLabel} className="xl:col-span-2" />
        <EnumFilter label="Status" value={params.status ?? ''} onChange={setFilter('status')} options={ALERT_STATUSES} labels={alertStatusLabel} className="xl:col-span-2" />
        <EnumFilter label="Fault type" value={params.faultType ?? ''} onChange={setFilter('faultType')} options={FAULT_TYPES} labels={faultTypeLabel} className="xl:col-span-2" />
        <LocationFilter value={get('location') ?? ''} onChange={setFilter('location')} className="xl:col-span-2" />
        <TransformerFilter value={get('transformerId') ?? ''} onChange={setFilter('transformerId')} className="col-span-2 md:col-span-2 xl:col-span-3" />
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-2 xl:col-span-6">
          <span className="font-mono text-label uppercase text-fg-muted">Detected</span>
          <DateRangePicker value={range} onChange={setRange} label="Detected between" />
        </div>
        <div className="col-span-2 flex flex-col justify-end md:col-span-4 xl:col-span-3">
          <ToggleFilter
            label="Active only"
            checked={activeOnly}
            onChange={(v) => set({ active: v ? undefined : 'all' }, { resetPage: true })}
            className="self-start xl:self-stretch"
          />
        </div>
      </FilterBar>

      <section aria-label="Alert list" className="min-w-0 rounded-sm border border-line bg-panel">
        {list.isPending ? (
          <LoadingBlock className="p-4" lines={8} label="Loading alerts" />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} title="Could not load alerts" onRetry={() => void list.refetch()} retrying={list.isRefetching} />
        ) : (
          <>
            <RowList
              caption="Alerts"
              columns={columns}
              rows={list.data.content}
              getRowId={(a) => a.id}
              gridClassName={GRID}
              sort={tableSort}
              onSortChange={onSortChange}
              onRowClick={(a) => open(a.id)}
              rowLabel={(a) => `Open ${faultTypeLabel[a.faultType]} alert on ${a.transformerCode}`}
              rail={(a) => (a.severity === 'CRITICAL' && a.status !== 'RESOLVED' ? 'critical' : undefined)}
              selectedId={focus}
              updating={list.isPlaceholderData}
              empty={
                <EmptyState
                  title={hasFilters ? 'No alerts match these filters' : activeOnly ? 'No active alerts' : 'No alerts'}
                  description={
                    hasFilters
                      ? activeOnly
                        ? 'Only active alerts are shown. Turn off "Active only" to include resolved alerts.'
                        : 'Adjust or reset the filters.'
                      : 'Every transformer is running within its thresholds.'
                  }
                  action={
                    hasFilters ? (
                      <Button size="sm" variant="secondary" onClick={clearFilters}>
                        Reset filters
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
            <div className="border-t border-line">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                totalElements={list.data.totalElements}
                size={list.data.size}
                itemLabel="alerts"
                onPageChange={setPage}
                onSizeChange={setSize}
              />
            </div>
          </>
        )}
      </section>

      <AlertDetailDrawer alertId={focus} fallback={list.data?.content.find((a) => a.id === focus)} onClose={close} />
    </div>
  );
}
