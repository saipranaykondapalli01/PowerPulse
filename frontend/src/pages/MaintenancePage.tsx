import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle, Clock, Loader, Plus, Search, UserCheck } from 'lucide-react';
import { useMaintenanceList } from '@/hooks/useWorkflows';
import { useMaintenanceCount } from '@/hooks/useWorkflowCounts';
import { useAssignableUsers } from '@/hooks/useAdmin';
import { useUrlState } from '@/hooks/useUrlState';
import { useDebouncedUrlParam } from '@/hooks/useDebouncedUrlParam';
import { useFocusParam, usePageParams, useServerSort } from '@/hooks/useListUrlParams';
import { useAuth } from '@/context/AuthContext';
import type { MaintenanceDto, MaintenanceListParams, MaintenanceStatus, Priority } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { MaintenanceStatusBadge, OverdueBadge, PriorityBadge } from '@/components/ui/StatusBadges';
import { Tabs } from '@/components/ui/Tabs';
import { useNow } from '@/components/ui/useNow';
import { MaintenanceDetailDrawer } from '@/components/maintenance/MaintenanceDetailDrawer';
import { NewMaintenanceTaskDialog } from '@/components/maintenance/NewMaintenanceTaskDialog';
import { shortId } from '@/components/workflow/DetailBits';
import { FilterBar } from '@/components/ui/FilterBar';
import { EnumFilter, TransformerFilter } from '@/components/workflow/FilterControls';
import { LiveStamp } from '@/components/workflow/LiveStamp';
import { RowList, type RowColumn } from '@/components/workflow/RowList';
import { SummaryStrip } from '@/components/workflow/SummaryStrip';
import { formatDateTime, formatRelative } from '@/utils/format';
import { MAINTENANCE_STATUSES, maintenanceStatusLabel, PRIORITIES, priorityLabel } from '@/utils/labels';
import { links } from '@/utils/links';

type TabId = 'all' | 'overdue' | 'upcoming';
const TABS: TabId[] = ['all', 'overdue', 'upcoming'];
const DEFAULT_SORT = 'dueDate,asc';
const SORT_FIELDS: Record<string, string> = { due: 'dueDate', priority: 'priority', status: 'status', created: 'createdAt' };
const FILTER_KEYS = ['q', 'status', 'priority', 'technicianId', 'transformerId'];

const GRID =
  'lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_6.5rem_minmax(0,1fr)_10.5rem_7.5rem_8rem_1rem]';

const isTerminal = (t: MaintenanceDto) => t.status === 'COMPLETED' || t.status === 'CANCELLED';

export default function MaintenancePage() {
  const { user } = useAuth();
  const isTechnician = user?.role === 'TECHNICIAN';
  const { get, set } = useUrlState();
  const [q, setQ] = useDebouncedUrlParam('q');
  const { page, size, setPage, setSize } = usePageParams();
  const { sort, tableSort, onSortChange } = useServerSort(DEFAULT_SORT, SORT_FIELDS);
  const { focus, open, close } = useFocusParam();
  const [newOpen, setNewOpen] = useState(false);
  const technicians = useAssignableUsers('TECHNICIAN', !isTechnician && !!user);
  const now = useNow(60_000);

  const tabParam = get('tab') as TabId | undefined;
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'all';
  const status = get('status') as MaintenanceStatus | undefined;
  const priority = get('priority') as Priority | undefined;

  const params = useMemo<MaintenanceListParams>(() => {
    const p: MaintenanceListParams = { page, size, sort };
    const qv = get('q');
    if (qv) p.q = qv;
    if (status && MAINTENANCE_STATUSES.includes(status)) p.status = status;
    if (priority && PRIORITIES.includes(priority)) p.priority = priority;
    const tech = get('technicianId');
    if (tech && !isTechnician) p.technicianId = tech;
    const tid = get('transformerId');
    if (tid) p.transformerId = tid;
    if (tab === 'overdue') p.overdue = true;
    if (tab === 'upcoming') p.upcoming = true;
    return p;
  }, [get, page, size, sort, status, priority, tab, isTechnician]);

  const list = useMaintenanceList(params);

  // Real counts (size=1 queries reading totalElements). The backend scopes technicians to their own tasks.
  const ready = !!user;
  const pending = useMaintenanceCount({ status: 'PENDING' }, ready);
  const assigned = useMaintenanceCount({ status: 'ASSIGNED' }, ready);
  const inProgress = useMaintenanceCount({ status: 'IN_PROGRESS' }, ready);
  const completed = useMaintenanceCount({ status: 'COMPLETED' }, ready);
  const overdue = useMaintenanceCount({ overdue: true }, ready);

  const setFilter = (key: string) => (v: string) => set({ [key]: v }, { resetPage: true });
  const activeFilters = FILTER_KEYS.filter((k) => get(k)).length;
  const hasFilters = activeFilters > 0;
  const clearFilters = () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), { resetPage: true });
  const applyQuick = (patch: Record<string, string | undefined>) =>
    set({ ...Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])), tab: undefined, ...patch }, { resetPage: true });
  const onlyStatus = (s: MaintenanceStatus) => tab === 'all' && status === s && activeFilters === 1;

  const statusItem = (key: MaintenanceStatus, count: typeof pending, icon: ReactNode, hint: string) => ({
    key: key.toLowerCase(),
    label: maintenanceStatusLabel[key],
    value: count.data,
    loading: count.isPending,
    error: count.isError,
    icon,
    hint,
    onSelect: () => applyQuick({ status: key }),
    active: onlyStatus(key),
  });

  const columns: RowColumn<MaintenanceDto>[] = [
    {
      key: 'title',
      header: 'Task',
      rowHeader: true,
      className: 'col-span-2 lg:col-span-1',
      cell: (t) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-[0.6875rem] text-fg-muted">
            Task {shortId(t.id)}
            {t.alertId && (
              <>
                {' · '}
                <Link to={links.alert(t.alertId)} className="text-accent-ink underline-offset-2 hover:underline">
                  View alert
                </Link>
              </>
            )}
          </span>
          <span className="truncate text-sm font-medium text-fg" title={t.title}>
            {t.title}
          </span>
        </span>
      ),
    },
    {
      key: 'transformer',
      header: 'Transformer',
      mobileLabel: 'Transformer',
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <Link to={links.transformer(t.transformerId)} className="self-start font-mono text-xs font-medium text-accent-ink underline-offset-2 hover:underline">
            {t.transformerCode}
          </Link>
          <span className="truncate text-xs text-fg-muted">{t.location}</span>
        </span>
      ),
    },
    { key: 'priority', header: 'Priority', sortable: true, mobileLabel: 'Priority', cell: (t) => <PriorityBadge value={t.priority} /> },
    {
      key: 'technician',
      header: 'Technician',
      mobileLabel: 'Technician',
      cell: (t) =>
        t.assignedTechnicianName ? (
          <span className="block truncate text-[0.8125rem] text-fg">{t.assignedTechnicianName}</span>
        ) : (
          <span className="text-[0.8125rem] text-fg-muted">Unassigned</span>
        ),
    },
    {
      key: 'due',
      header: 'Due',
      sortable: true,
      sortLabel: 'Due date',
      mobileLabel: 'Due',
      cell: (t) => {
        const late = t.overdue && !isTerminal(t);
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={late ? 'font-mono text-xs font-medium text-critical lg:whitespace-nowrap' : 'font-mono text-xs text-fg lg:whitespace-nowrap'}>{formatDateTime(t.dueDate)}</span>
            {late ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <OverdueBadge />
                <span className="text-[0.6875rem] text-fg-muted">{formatRelative(t.dueDate, now)}</span>
              </span>
            ) : (
              !isTerminal(t) && <span className="text-[0.6875rem] text-fg-muted">{formatRelative(t.dueDate, now)}</span>
            )}
          </span>
        );
      },
    },
    { key: 'status', header: 'Status', sortable: true, mobileLabel: 'Status', cell: (t) => <MaintenanceStatusBadge value={t.status} /> },
    {
      key: 'created',
      header: 'Updated',
      sortLabel: 'Created',
      sortable: true,
      mobileLabel: 'Updated',
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <time dateTime={t.updatedAt} title={formatDateTime(t.updatedAt)} className="text-[0.8125rem] text-fg">
            {formatRelative(t.updatedAt, now)}
          </time>
          <span className="truncate font-mono text-[0.6875rem] text-fg-muted" title={`Created ${formatDateTime(t.createdAt)}`}>
            created {formatRelative(t.createdAt, now)}
          </span>
        </span>
      ),
    },
    {
      key: 'open',
      header: <span className="sr-only">Open</span>,
      className: 'hidden lg:flex lg:justify-end',
      cell: () => <ChevronRight aria-hidden="true" className="h-4 w-4 text-fg-muted" />,
    },
  ];

  const tabLabel: Record<TabId, string> = { all: 'All', overdue: 'Overdue', upcoming: 'Upcoming' };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Operations · Maintenance"
        title={isTechnician ? 'My tasks' : 'Maintenance'}
        description={
          isTechnician
            ? 'Maintenance tasks assigned to you. Start work, record findings and parts, then complete.'
            : 'Inspection and repair tasks across the network.'
        }
        actions={
          <>
            <LiveStamp updatedAt={list.dataUpdatedAt} fetching={list.isFetching} className="hidden sm:inline-flex" />
            <RoleGate roles={['ADMIN', 'ENGINEER']}>
              <Button variant="primary" icon={<Plus />} onClick={() => setNewOpen(true)}>
                New task
              </Button>
            </RoleGate>
          </>
        }
      />

      <SummaryStrip
        label="Task counts"
        scope={isTechnician ? 'Assigned to you' : 'All tasks'}
        items={[
          statusItem('PENDING', pending, <Circle />, 'not yet assigned'),
          statusItem('ASSIGNED', assigned, <UserCheck />, 'waiting to start'),
          statusItem('IN_PROGRESS', inProgress, <Loader />, 'work under way'),
          statusItem('COMPLETED', completed, <CheckCircle2 />, 'finished'),
          {
            key: 'overdue',
            label: 'Overdue',
            value: overdue.data,
            loading: overdue.isPending,
            error: overdue.isError,
            tone: 'critical',
            icon: <Clock />,
            hint: 'past due, still open',
            onSelect: () => applyQuick({ tab: 'overdue' }),
            active: tab === 'overdue' && !hasFilters,
          },
        ]}
      />

      <FilterBar layout="stacked" label="Task filters" activeCount={activeFilters} onReset={clearFilters} bodyClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-12">
        <Field label="Search" className={isTechnician ? 'col-span-2 md:col-span-4 xl:col-span-5' : 'col-span-2 md:col-span-4 xl:col-span-4'}>
          <Input type="search" leading={<Search />} placeholder="Title or transformer" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <EnumFilter label="Status" value={params.status ?? ''} onChange={setFilter('status')} options={MAINTENANCE_STATUSES} labels={maintenanceStatusLabel} className="xl:col-span-2" />
        <EnumFilter label="Priority" value={params.priority ?? ''} onChange={setFilter('priority')} options={PRIORITIES} labels={priorityLabel} className="xl:col-span-2" />
        {!isTechnician && (
          <Field label="Technician" className="xl:col-span-2" hint={technicians.isError ? 'Could not load technicians.' : undefined}>
            <Select value={get('technicianId') ?? ''} onChange={(e) => setFilter('technicianId')(e.target.value)}>
              <option value="">All</option>
              {(technicians.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <TransformerFilter
          value={get('transformerId') ?? ''}
          onChange={setFilter('transformerId')}
          className={isTechnician ? 'col-span-2 xl:col-span-3' : 'xl:col-span-2'}
        />
      </FilterBar>

      <Tabs
        label="Task views"
        tabs={TABS.map((id) => ({ id, label: tabLabel[id] }))}
        value={tab}
        onChange={(id) => set({ tab: id === 'all' ? undefined : id }, { resetPage: true })}
        panelClassName="pt-3"
      >
        <section aria-label="Task list" className="min-w-0 rounded-sm border border-line bg-panel">
          {list.isPending ? (
            <LoadingBlock className="p-4" lines={8} label="Loading maintenance tasks" />
          ) : list.isError && !list.data ? (
            <ErrorState error={list.error} title="Could not load maintenance tasks" onRetry={() => void list.refetch()} retrying={list.isRefetching} />
          ) : (
            <>
              <RowList
                caption={`${isTechnician ? 'My tasks' : 'Maintenance tasks'} · ${tabLabel[tab]}`}
                columns={columns}
                rows={list.data.content}
                getRowId={(t) => t.id}
                gridClassName={GRID}
                sort={tableSort}
                onSortChange={onSortChange}
                onRowClick={(t) => open(t.id)}
                rowLabel={(t) => `Open task ${t.title} on ${t.transformerCode}`}
                rail={(t) => (t.overdue && !isTerminal(t) ? 'critical' : undefined)}
                selectedId={focus}
                updating={list.isPlaceholderData}
                empty={
                  <EmptyState
                    title={
                      hasFilters
                        ? 'No tasks match these filters'
                        : tab === 'overdue'
                          ? 'Nothing overdue'
                          : tab === 'upcoming'
                            ? 'No upcoming tasks'
                            : isTechnician
                              ? 'No tasks assigned to you'
                              : 'No maintenance tasks yet'
                    }
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
                  itemLabel="tasks"
                  onPageChange={setPage}
                  onSizeChange={setSize}
                />
              </div>
            </>
          )}
        </section>
      </Tabs>

      <MaintenanceDetailDrawer taskId={focus} fallback={list.data?.content.find((t) => t.id === focus)} onClose={close} />
      <RoleGate roles={['ADMIN', 'ENGINEER']}>
        <NewMaintenanceTaskDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(t) => open(t.id)} />
      </RoleGate>
    </div>
  );
}
