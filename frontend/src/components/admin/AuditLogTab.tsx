import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuditLogs } from '@/hooks/useAdmin';
import { useUrlState } from '@/hooks/useUrlState';
import { useDebouncedUrlParam } from '@/hooks/useDebouncedUrlParam';
import { useDateRangeParam, usePageParams } from '@/hooks/useListUrlParams';
import type { AuditLogDto, AuditLogParams, ResourceType } from '@/types/api';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { Table, type Column } from '@/components/ui/Table';
import { ClearFiltersButton, EnumFilter } from '@/components/workflow/FilterControls';
import { formatDateTime } from '@/utils/format';
import { humanize } from '@/utils/labels';
import { linkForResource } from '@/utils/links';

const ENTITY_TYPES: ResourceType[] = ['TRANSFORMER', 'ALERT', 'MAINTENANCE', 'INCIDENT', 'USER', 'SETTINGS', 'SIMULATION'];
const entityLabels = Object.fromEntries(ENTITY_TYPES.map((t) => [t, humanize(t)])) as Record<ResourceType, string>;
const FILTER_KEYS = ['actor', 'entityType', 'action', 'from', 'to'];

const columns: Column<AuditLogDto>[] = [
  { key: 'at', header: 'Time', cell: (a) => <span className="tabular font-mono text-xs text-fg-muted">{formatDateTime(a.at)}</span> },
  { key: 'actor', header: 'Actor', rowHeader: true, cell: (a) => a.actorName },
  { key: 'action', header: 'Action', cell: (a) => <span className="rounded-sm border border-line bg-raised/60 px-1.5 py-0.5 font-mono text-[11px] text-fg">{a.action}</span> },
  { key: 'entity', header: 'Entity type', cell: (a) => entityLabels[a.entityType] ?? a.entityType },
  {
    key: 'id',
    header: 'Entity id',
    cell: (a) => {
      if (!a.entityId) return <span className="text-fg-muted">—</span>;
      const href = linkForResource(a.entityType, a.entityId);
      return href ? (
        <Link to={href} className="font-mono text-xs text-accent-ink hover:underline">
          {a.entityId}
        </Link>
      ) : (
        <span className="font-mono text-xs">{a.entityId}</span>
      );
    },
  },
  { key: 'summary', header: 'Summary', cell: (a) => <span className="block max-w-[28rem] whitespace-normal text-xs">{a.summary}</span> },
];

export function AuditLogTab() {
  const { get, set } = useUrlState();
  const [actor, setActor] = useDebouncedUrlParam('actor');
  const [action, setAction] = useDebouncedUrlParam('action');
  const [range, setRange] = useDateRangeParam();
  const { page, size, setPage, setSize } = usePageParams();
  const entityType = get('entityType') as ResourceType | undefined;

  const params = useMemo<AuditLogParams>(() => {
    const p: AuditLogParams = { page, size };
    const a = get('actor');
    if (a) p.actor = a;
    const act = get('action');
    if (act) p.action = act;
    if (entityType && ENTITY_TYPES.includes(entityType)) p.entityType = entityType;
    if (range.from) p.from = range.from;
    if (range.to) p.to = range.to;
    return p;
  }, [get, page, size, entityType, range]);

  const list = useAuditLogs(params);
  const hasFilters = FILTER_KEYS.some((k) => get(k));
  const clear = () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), { resetPage: true });

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Audit filters" className="grid grid-cols-2 gap-3 rounded-sm border border-line bg-panel px-4 py-3 md:grid-cols-4">
        <Field label="Actor">
          <Input type="search" placeholder="Name" value={actor} onChange={(e) => setActor(e.target.value)} />
        </Field>
        <EnumFilter label="Entity type" value={params.entityType ?? ''} onChange={(v) => set({ entityType: v }, { resetPage: true })} options={ENTITY_TYPES} labels={entityLabels} />
        <Field label="Action" className="col-span-2 md:col-span-1">
          <Input type="search" placeholder="e.g. ALERT_RESOLVED" value={action} onChange={(e) => setAction(e.target.value)} />
        </Field>
        <div className="col-span-2 flex flex-col gap-1.5 md:col-span-4">
          <span className="font-mono text-label uppercase text-fg-muted">Time</span>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={range} onChange={setRange} label="Audit time range" />
            {hasFilters && <ClearFiltersButton onClick={clear} />}
          </div>
        </div>
      </section>

      <Panel flush>
        {list.isPending ? (
          <LoadingBlock className="p-4" lines={8} label="Loading audit log" />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} title="Could not load the audit log" onRetry={() => void list.refetch()} retrying={list.isRefetching} />
        ) : (
          <>
            <Table
              caption="Audit log"
              columns={columns}
              rows={list.data.content}
              getRowId={(a) => a.id}
              updating={list.isPlaceholderData}
              maxHeight="calc(100dvh - 26rem)"
              dense
              empty={<EmptyState title={hasFilters ? 'No audit entries match these filters' : 'No audit entries yet'} />}
            />
            <div className="border-t border-line">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                totalElements={list.data.totalElements}
                size={list.data.size}
                itemLabel="entries"
                onPageChange={setPage}
                onSizeChange={setSize}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
