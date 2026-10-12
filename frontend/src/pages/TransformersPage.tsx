import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useLocations, useTransformerList } from '@/hooks/useMonitoring';
import { useUrlState } from '@/hooks/useUrlState';
import { useDebouncedUrlParam } from '@/hooks/useDebouncedUrlParam';
import type { TransformerDto, TransformerListParams, TransformerStatus } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { FilterBar } from '@/components/ui/FilterBar';
import { Freshness } from '@/components/ui/Freshness';
import { HealthGauge } from '@/components/ui/HealthGauge';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { SeverityBadge, StatusBadge } from '@/components/ui/StatusBadges';
import { Table, type Column, type SortState } from '@/components/ui/Table';
import { SimulatedBadge } from '@/components/ui/Badge';
import { TransformerFormDialog } from '@/components/transformers/TransformerFormDialog';
import { TransformerCardList } from '@/components/transformers/TransformerCardList';
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery';
import { formatAmps, formatDate, formatKva, formatNumber, formatPct, formatPf, formatTemp, formatVolts } from '@/utils/format';
import { statusLabel, TRANSFORMER_STATUSES } from '@/utils/labels';
import { links } from '@/utils/links';

export const DEFAULT_SORT = 'healthScore,asc';
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'healthScore,asc', label: 'Lowest health' },
  { value: 'latestReading.temperatureC,desc', label: 'Highest temperature' },
  { value: 'latestReading.oilLevelPct,asc', label: 'Lowest oil level' },
  { value: 'latestReading.loadPct,desc', label: 'Highest load' },
  { value: 'code,asc', label: 'Code (A–Z)' },
  { value: 'lastReadingAt,desc', label: 'Last reading (newest)' },
];

/** Table column key → backend sort field (docs/api-contracts.md). */
const SORT_FIELDS: Record<string, string> = {
  code: 'code',
  name: 'name',
  capacity: 'ratedCapacityKva',
  temp: 'latestReading.temperatureC',
  oil: 'latestReading.oilLevelPct',
  load: 'latestReading.loadPct',
  health: 'healthScore',
  status: 'status',
  reading: 'lastReadingAt',
};

const DEFAULT_SIZE = 20;
const FILTER_KEYS = ['q', 'location', 'status', 'minCapacity', 'maxCapacity', 'minHealth', 'maxHealth'] as const;

export default function TransformersPage() {
  const { get, getNumber, set } = useUrlState();
  const navigate = useNavigate();
  const locations = useLocations();
  const [q, setQ] = useDebouncedUrlParam('q');
  const [minCap, setMinCap] = useDebouncedUrlParam('minCapacity', 400);
  const [maxCap, setMaxCap] = useDebouncedUrlParam('maxCapacity', 400);
  const [minHealth, setMinHealth] = useDebouncedUrlParam('minHealth', 400);
  const [maxHealth, setMaxHealth] = useDebouncedUrlParam('maxHealth', 400);
  const [registerOpen, setRegisterOpen] = useState(false);
  // Table on md+, stacked rows on phones. Falls back to the table when matchMedia is unavailable.
  const wide = useMediaQuery(MD_UP, true);

  const statusParam = get('status') as TransformerStatus | undefined;
  const params = useMemo<TransformerListParams>(() => {
    const p: TransformerListParams = {
      page: getNumber('page') ?? 0,
      size: getNumber('size') ?? DEFAULT_SIZE,
      sort: get('sort') ?? DEFAULT_SORT,
    };
    const qv = get('q');
    if (qv) p.q = qv;
    const loc = get('location');
    if (loc) p.location = loc;
    if (statusParam && TRANSFORMER_STATUSES.includes(statusParam)) p.status = statusParam;
    const nums = ['minCapacity', 'maxCapacity', 'minHealth', 'maxHealth'] as const;
    for (const k of nums) {
      const n = getNumber(k);
      if (n !== undefined) p[k] = n;
    }
    return p;
  }, [get, getNumber, statusParam]);

  const list = useTransformerList(params);

  const [sortField, sortDir] = (params.sort ?? DEFAULT_SORT).split(',');
  const tableSort: SortState | null = (() => {
    const key = Object.entries(SORT_FIELDS).find(([, f]) => f === sortField)?.[0];
    return key ? { key, dir: sortDir === 'desc' ? 'desc' : 'asc' } : null;
  })();

  const activeCount = FILTER_KEYS.filter((k) => get(k)).length;
  const hasFilters = activeCount > 0;
  const clearFilters = () =>
    set(
      { q: undefined, location: undefined, status: undefined, minCapacity: undefined, maxCapacity: undefined, minHealth: undefined, maxHealth: undefined },
      { resetPage: true },
    );

  const columns: Column<TransformerDto>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      rowHeader: true,
      cell: (t) => (
        <Link to={links.transformer(t.id)} className="font-mono text-xs text-accent-ink hover:underline">
          {t.code}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <span className="block max-w-[13rem] truncate">{t.name}</span>
          {/* Location folds under the name until the dedicated column fits (2xl). */}
          <span className="block max-w-[13rem] truncate text-xs text-fg-muted 2xl:hidden">{t.location}</span>
        </span>
      ),
    },
    { key: 'location', header: 'Location', className: 'hidden 2xl:table-cell', cell: (t) => <span className="text-fg-muted">{t.location}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (t) => <StatusBadge value={t.status} /> },
    { key: 'health', header: 'Health', sortable: true, cell: (t) => <HealthGauge score={t.healthScore} status={t.status} /> },
    { key: 'temp', header: 'Temp', sortable: true, align: 'right', cell: (t) => formatTemp(t.latestReading?.temperatureC) },
    { key: 'oil', header: 'Oil', sortable: true, align: 'right', cell: (t) => formatPct(t.latestReading?.oilLevelPct) },
    { key: 'load', header: 'Load', sortable: true, align: 'right', cell: (t) => formatPct(t.latestReading?.loadPct) },
    { key: 'voltage', header: 'Voltage', align: 'right', className: 'hidden 2xl:table-cell', cell: (t) => formatVolts(t.latestReading?.voltageV) },
    { key: 'current', header: 'Current', align: 'right', className: 'hidden 2xl:table-cell', cell: (t) => formatAmps(t.latestReading?.currentA) },
    { key: 'pf', header: 'PF', align: 'right', className: 'hidden 2xl:table-cell', cell: (t) => formatPf(t.latestReading?.powerFactor) },
    { key: 'capacity', header: 'Rating', sortable: true, align: 'right', cell: (t) => formatKva(t.ratedCapacityKva) },
    {
      key: 'faults',
      header: 'Active faults',
      align: 'right',
      cell: (t) =>
        t.activeFaultCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            {t.highestActiveSeverity && <SeverityBadge value={t.highestActiveSeverity} />}
            {formatNumber(t.activeFaultCount)}
          </span>
        ) : (
          <span className="text-fg-muted">0</span>
        ),
    },
    { key: 'reading', header: 'Last reading', sortable: true, cell: (t) => <Freshness at={t.lastReadingAt} stale={t.stale} bare /> },
    {
      key: 'maintenance',
      header: 'Last maintenance',
      className: 'hidden 2xl:table-cell',
      cell: (t) => <span className="font-mono text-xs text-fg-muted">{t.lastMaintenanceAt ? formatDate(t.lastMaintenanceAt) : 'Never'}</span>,
    },
  ];

  const sortOptions = SORT_OPTIONS.some((o) => o.value === params.sort)
    ? SORT_OPTIONS
    : [...SORT_OPTIONS, { value: params.sort!, label: 'Custom (table header)' }];

  const total = list.data?.totalElements;
  const emptyState = (
    <EmptyState
      title={hasFilters ? 'No transformers match these filters' : 'No transformers registered yet'}
      description={hasFilters ? 'Adjust or reset the filters.' : undefined}
      action={
        hasFilters ? (
          <Button size="sm" variant="secondary" onClick={clearFilters}>
            Reset filters
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="!mb-0"
        eyebrow="Assets / Registry"
        title="Transformer Registry"
        description="Every registered transformer with its latest reading, health score and status."
        meta={
          <>
            <span className="font-mono text-label uppercase text-fg-muted" aria-live="polite">
              {total === undefined ? (
                'Loading assets…'
              ) : (
                <>
                  <span className="tabular text-fg">{formatNumber(total)}</span>{' '}
                  {hasFilters ? (total === 1 ? 'asset matches filters' : 'assets match filters') : total === 1 ? 'registered asset' : 'registered assets'}
                </>
              )}
            </span>
            <SimulatedBadge />
          </>
        }
        actions={
          <RoleGate roles={['ADMIN', 'ENGINEER']}>
            <Button variant="primary" icon={<Plus />} onClick={() => setRegisterOpen(true)}>
              Register transformer
            </Button>
          </RoleGate>
        }
      />

      <FilterBar
        label="Registry filters"
        activeCount={activeCount}
        onReset={clearFilters}
      >
        <Field label="Search" className="w-full sm:w-60">
          <Input type="search" leading={<Search />} placeholder="Code, name or location" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label="Location" className="w-[calc(50%-0.375rem)] sm:w-44">
          <Select value={get('location') ?? ''} onChange={(e) => set({ location: e.target.value }, { resetPage: true })}>
            <option value="">All</option>
            {(locations.data ?? []).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" className="w-[calc(50%-0.375rem)] sm:w-36">
          <Select value={params.status ?? ''} onChange={(e) => set({ status: e.target.value }, { resetPage: true })}>
            <option value="">All</option>
            {TRANSFORMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sort by" className="w-full sm:w-48">
          <Select value={params.sort} onChange={(e) => set({ sort: e.target.value === DEFAULT_SORT ? undefined : e.target.value }, { resetPage: true })}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="flex w-full min-w-0 gap-1.5 sm:w-auto">
          <legend className="sr-only">Rated capacity range (kVA)</legend>
          <Field label="Min kVA" className="w-1/2 sm:w-24">
            <Input type="number" min={0} inputMode="numeric" value={minCap} onChange={(e) => setMinCap(e.target.value)} />
          </Field>
          <Field label="Max kVA" className="w-1/2 sm:w-24">
            <Input type="number" min={0} inputMode="numeric" value={maxCap} onChange={(e) => setMaxCap(e.target.value)} />
          </Field>
        </fieldset>
        <fieldset className="flex w-full min-w-0 gap-1.5 sm:w-auto">
          <legend className="sr-only">Health score range (0–100)</legend>
          <Field label="Min health" className="w-1/2 sm:w-24">
            <Input type="number" min={0} max={100} inputMode="numeric" value={minHealth} onChange={(e) => setMinHealth(e.target.value)} />
          </Field>
          <Field label="Max health" className="w-1/2 sm:w-24">
            <Input type="number" min={0} max={100} inputMode="numeric" value={maxHealth} onChange={(e) => setMaxHealth(e.target.value)} />
          </Field>
        </fieldset>
      </FilterBar>

      <Panel flush>
        {list.isPending ? (
          <LoadingBlock className="p-4" lines={8} label="Loading transformers" />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} retrying={list.isRefetching} />
        ) : (
          <>
            {wide ? (
              <Table
                caption="Transformer registry"
                columns={columns}
                rows={list.data.content}
                getRowId={(t) => t.id}
                sort={tableSort}
                onSortChange={(s) => set({ sort: `${SORT_FIELDS[s.key]},${s.dir}` }, { resetPage: true })}
                onRowClick={(t) => navigate(links.transformer(t.id))}
                rowLabel={(t) => `Open ${t.code} ${t.name}`}
                updating={list.isPlaceholderData}
                maxHeight="calc(100dvh - 22rem)"
                empty={emptyState}
              />
            ) : (
              <div className={list.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined} aria-busy={list.isPlaceholderData || undefined}>
                <TransformerCardList rows={list.data.content} empty={emptyState} />
              </div>
            )}
            <div className="border-t border-line">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                totalElements={list.data.totalElements}
                size={list.data.size}
                itemLabel="transformers"
                onPageChange={(page) => set({ page: page || undefined })}
                onSizeChange={(size) => set({ size: size === DEFAULT_SIZE ? undefined : size }, { resetPage: true })}
              />
            </div>
          </>
        )}
      </Panel>

      <TransformerFormDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}
