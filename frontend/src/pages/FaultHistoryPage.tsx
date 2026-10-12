import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Hourglass, Layers, Repeat } from 'lucide-react';
import { useFaultHistory } from '@/hooks/useWorkflows';
import { useUrlState } from '@/hooks/useUrlState';
import { useDateRangeParam, useFocusParam, usePageParams, useServerSort } from '@/hooks/useListUrlParams';
import type { FaultHistoryParams, FaultIncidentDto, FaultType, Severity } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { SeverityBadge } from '@/components/ui/StatusBadges';
import { useNow } from '@/components/ui/useNow';
import { IncidentDetailDrawer } from '@/components/faulthistory/IncidentDetailDrawer';
import { FilterBar } from '@/components/ui/FilterBar';
import { EnumFilter, LocationFilter, TransformerFilter } from '@/components/workflow/FilterControls';
import { RelativeTime } from '@/components/workflow/RelativeTime';
import { RowList, type RowColumn } from '@/components/workflow/RowList';
import { SummaryStrip } from '@/components/workflow/SummaryStrip';
import { formatDateTime, formatDuration, formatNumber, formatWithUnit } from '@/utils/format';
import { FAULT_TYPES, faultTypeLabel, SEVERITIES, severityLabel } from '@/utils/labels';
import { links } from '@/utils/links';

const DEFAULT_SORT = 'startedAt,desc';
const SORT_FIELDS: Record<string, string> = { started: 'startedAt', duration: 'durationSeconds', severity: 'severity' };
const FILTER_KEYS = ['transformerId', 'location', 'faultType', 'severity', 'from', 'to'];

const GRID =
  'lg:grid-cols-[7.25rem_minmax(0,2fr)_minmax(0,1.1fr)_10rem_10rem_6.5rem_6.5rem_5.5rem]';

export default function FaultHistoryPage() {
  const { get, set } = useUrlState();
  const [range, setRange] = useDateRangeParam();
  const { page, size, setPage, setSize } = usePageParams();
  const { sort, tableSort, onSortChange } = useServerSort(DEFAULT_SORT, SORT_FIELDS);
  const { focus, open, close } = useFocusParam();
  const now = useNow(60_000);
  const faultType = get('faultType') as FaultType | undefined;
  const severity = get('severity') as Severity | undefined;

  const params = useMemo<FaultHistoryParams>(() => {
    const p: FaultHistoryParams = { page, size, sort };
    const tid = get('transformerId');
    if (tid) p.transformerId = tid;
    const loc = get('location');
    if (loc) p.location = loc;
    if (faultType && FAULT_TYPES.includes(faultType)) p.faultType = faultType;
    if (severity && SEVERITIES.includes(severity)) p.severity = severity;
    if (range.from) p.from = range.from;
    if (range.to) p.to = range.to;
    return p;
  }, [get, page, size, sort, faultType, severity, range]);

  const list = useFaultHistory(params);
  const setFilter = (key: string) => (v: string) => set({ [key]: v }, { resetPage: true });
  const activeFilters = ['transformerId', 'location', 'faultType', 'severity'].filter((k) => get(k)).length + (get('from') || get('to') ? 1 : 0);
  const hasFilters = activeFilters > 0;
  const clearFilters = () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), { resetPage: true });

  // Summary strictly from the response: totalElements from the server, the rest counted on the loaded page.
  const pageRows = list.data?.content;
  const ongoingOnPage = pageRows?.filter((i) => !i.resolvedAt).length;
  const recurringOnPage = pageRows?.filter((i) => i.recurrenceCount > 0).length;

  const columns: RowColumn<FaultIncidentDto>[] = [
    { key: 'severity', header: 'Severity', sortLabel: 'Peak severity', sortable: true, cell: (i) => <SeverityBadge value={i.severity} /> },
    {
      key: 'fault',
      header: 'Incident',
      rowHeader: true,
      className: 'col-span-2 lg:col-span-1 max-lg:order-2 lg:order-none',
      cell: (i) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-[0.9375rem] font-semibold leading-snug tracking-tight text-fg">{faultTypeLabel[i.faultType]}</span>
          <span className="truncate font-mono text-[0.6875rem] text-fg-muted">
            peak {formatWithUnit(i.peakValue, i.unit)} · limit {formatWithUnit(i.threshold, i.unit)}
            {i.maintenanceIds.length > 0 && ` · ${formatNumber(i.maintenanceIds.length)} task${i.maintenanceIds.length === 1 ? '' : 's'}`}
          </span>
        </span>
      ),
    },
    {
      key: 'transformer',
      header: 'Transformer',
      mobileLabel: 'Transformer',
      className: 'max-lg:order-3 lg:order-none',
      cell: (i) => (
        <span className="flex min-w-0 flex-col">
          <Link to={links.transformer(i.transformerId)} className="self-start font-mono text-xs font-medium text-accent-ink underline-offset-2 hover:underline">
            {i.transformerCode}
          </Link>
          <span className="truncate text-xs text-fg-muted">{i.location}</span>
        </span>
      ),
    },
    {
      key: 'started',
      header: 'Detected',
      sortable: true,
      className: 'max-lg:order-1 lg:order-none max-lg:text-right max-lg:[&>span]:items-end',
      cell: (i) => <RelativeTime at={i.startedAt} now={now} showAbsolute />,
    },
    {
      key: 'resolved',
      header: 'Resolved',
      mobileLabel: 'Resolved',
      className: 'max-lg:order-3 lg:order-none',
      cell: (i) =>
        i.resolvedAt ? (
          <span className="whitespace-nowrap font-mono text-[0.6875rem] text-fg">{formatDateTime(i.resolvedAt)}</span>
        ) : (
          <span className="text-[0.8125rem] text-fg-muted">Not resolved</span>
        ),
    },
    {
      key: 'duration',
      header: 'Duration',
      sortable: true,
      align: 'right',
      mobileLabel: 'Duration',
      className: 'max-lg:order-4 lg:order-none',
      cell: (i) =>
        i.resolvedAt ? (
          <span className="font-mono text-[0.8125rem] tabular-nums text-fg">{formatDuration(i.durationSeconds)}</span>
        ) : (
          <span className="flex flex-col lg:items-end">
            <span className="font-mono text-[0.8125rem] italic text-warning">ongoing</span>
            <span className="font-mono text-[0.6875rem] text-fg-muted" title="Elapsed since detection">
              {formatDuration((now - new Date(i.startedAt).getTime()) / 1000)} so far
            </span>
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      mobileLabel: 'Status',
      className: 'max-lg:order-4 lg:order-none',
      cell: (i) => (i.resolvedAt ? <Badge tone="healthy">Resolved</Badge> : <Badge tone="warning" icon={<Hourglass aria-hidden="true" />}>Ongoing</Badge>),
    },
    {
      key: 'recurrence',
      header: 'Recurs',
      align: 'right',
      mobileLabel: 'Recurrence',
      className: 'max-lg:order-5 lg:order-none',
      cell: (i) =>
        i.recurrenceCount > 0 ? (
          <span className="inline-flex items-center gap-1 font-mono text-[0.8125rem] text-warning" title={`Recurred ${i.recurrenceCount} times`}>
            <Repeat aria-hidden="true" className="h-3 w-3" />×{i.recurrenceCount}
          </span>
        ) : (
          <span className="font-mono text-[0.8125rem] text-fg-muted">0</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Operations · Archive"
        title="Fault history"
        description="Every fault incident from detection to resolution, with readings captured along the way."
      />

      <SummaryStrip
        label="Incident summary"
        scope="From current results"
        items={[
          {
            key: 'matching',
            label: 'Matching incidents',
            value: list.data?.totalElements,
            loading: list.isPending,
            error: list.isError && !list.data,
            icon: <Archive />,
            hint: hasFilters ? 'with the current filters' : 'all recorded incidents',
          },
          {
            key: 'page',
            label: 'On this page',
            value: pageRows?.length,
            loading: list.isPending,
            error: list.isError && !list.data,
            icon: <Layers />,
            hint: list.data ? `page ${list.data.page + 1} of ${Math.max(1, list.data.totalPages)}` : undefined,
          },
          {
            key: 'ongoing',
            label: 'Ongoing',
            value: ongoingOnPage,
            loading: list.isPending,
            error: list.isError && !list.data,
            tone: 'warning',
            icon: <Hourglass />,
            hint: 'on this page',
          },
          {
            key: 'recurring',
            label: 'Recurring',
            value: recurringOnPage,
            loading: list.isPending,
            error: list.isError && !list.data,
            tone: 'warning',
            icon: <Repeat />,
            hint: 'on this page',
          },
        ]}
      />

      <FilterBar layout="stacked" label="Incident filters" activeCount={activeFilters} onReset={clearFilters} bodyClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-12">
        <TransformerFilter value={get('transformerId') ?? ''} onChange={setFilter('transformerId')} className="col-span-2 xl:col-span-3" />
        <LocationFilter value={get('location') ?? ''} onChange={setFilter('location')} className="col-span-2 xl:col-span-3" />
        <EnumFilter label="Fault type" value={params.faultType ?? ''} onChange={setFilter('faultType')} options={FAULT_TYPES} labels={faultTypeLabel} className="md:col-span-2 xl:col-span-3" />
        <EnumFilter label="Severity" value={params.severity ?? ''} onChange={setFilter('severity')} options={SEVERITIES} labels={severityLabel} className="md:col-span-2 xl:col-span-3" />
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-4 xl:col-span-12">
          <span className="font-mono text-label uppercase text-fg-muted">Detected</span>
          <DateRangePicker value={range} onChange={setRange} label="Detected between" />
        </div>
      </FilterBar>

      <section aria-label="Incident archive" className="min-w-0 rounded-sm border border-line bg-panel">
        {list.isPending ? (
          <LoadingBlock className="p-4" lines={8} label="Loading fault history" />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} title="Could not load fault history" onRetry={() => void list.refetch()} retrying={list.isRefetching} />
        ) : (
          <>
            <RowList
              caption="Fault incidents"
              columns={columns}
              rows={list.data.content}
              getRowId={(i) => i.id}
              gridClassName={GRID}
              sort={tableSort}
              onSortChange={onSortChange}
              onRowClick={(i) => open(i.id)}
              rowLabel={(i) => `Open ${faultTypeLabel[i.faultType]} incident on ${i.transformerCode}`}
              rail={(i) => (!i.resolvedAt && i.severity === 'CRITICAL' ? 'critical' : undefined)}
              selectedId={focus}
              updating={list.isPlaceholderData}
              empty={
                <EmptyState
                  title={hasFilters ? 'No incidents match these filters' : 'No fault incidents recorded'}
                  description={hasFilters ? 'Adjust or reset the filters.' : undefined}
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
                itemLabel="incidents"
                onPageChange={setPage}
                onSizeChange={setSize}
              />
            </div>
          </>
        )}
      </section>

      <IncidentDetailDrawer focusId={list.data ? focus : undefined} incident={list.data?.content.find((i) => i.id === focus)} onClose={close} />
    </div>
  );
}
