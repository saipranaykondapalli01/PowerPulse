import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardSummary, useLocations } from '@/hooks/useMonitoring';
import { qk } from '@/hooks/queryKeys';
import { useUrlState } from '@/hooks/useUrlState';
import type { DashboardFilters, TransformerStatus } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { FilterBar } from '@/components/ui/FilterBar';
import { Freshness } from '@/components/ui/Freshness';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { SimulatedBadge } from '@/components/ui/Badge';
import { DashboardKpis } from '@/components/dashboard/DashboardKpis';
import { FaultFrequencyChart, HealthDistributionChart, TrendCharts } from '@/components/dashboard/DashboardCharts';
import { AttentionList, PendingMaintenanceList, RecentAlertsList } from '@/components/dashboard/DashboardTables';
import { TimeRangeFilter } from '@/components/dashboard/TimeRangeFilter';
import { SimulationPanel } from '@/components/simulation/SimulationPanel';
import { statusLabel, TRANSFORMER_STATUSES } from '@/utils/labels';

function useDashboardFilters(): [DashboardFilters, ReturnType<typeof useUrlState>['set']] {
  const { get, set } = useUrlState();
  const location = get('location');
  const status = get('status') as TransformerStatus | undefined;
  const from = get('from');
  const to = get('to');
  const filters = useMemo<DashboardFilters>(() => {
    const f: DashboardFilters = {};
    if (location) f.location = location;
    if (status && TRANSFORMER_STATUSES.includes(status)) f.status = status;
    if (from) f.from = from;
    if (to) f.to = to;
    return f;
  }, [location, status, from, to]);
  return [filters, set];
}

/** Manually refetches every dashboard query plus the fleet list that feeds the attention table. */
function useRefreshDashboard() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: qk.dashboard.all, type: 'active' }),
        qc.refetchQueries({ queryKey: qk.transformers.everything, type: 'active' }),
        qc.refetchQueries({ queryKey: qk.simulation, type: 'active' }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  return { refresh, refreshing };
}

function SectionLabel({ children }: { children: string }) {
  return <h2 className="font-mono text-label uppercase text-fg-muted">{children}</h2>;
}

export default function DashboardPage() {
  const [filters, setFilters] = useDashboardFilters();
  const summary = useDashboardSummary(filters);
  const locations = useLocations();
  const { hash } = useLocation();
  const { refresh, refreshing } = useRefreshDashboard();

  // Support /dashboard#simulation deep links (from the top-bar SIMULATED indicator).
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, summary.isSuccess]);

  const activeCount = [filters.location, filters.status, filters.from || filters.to].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="!mb-0"
        eyebrow="Network overview / Live monitoring"
        title="Transformer Network"
        description="Monitor the health and operational state of your transformer fleet."
        actions={
          <>
            <SimulatedBadge />
            {summary.data && <Freshness at={summary.data.generatedAt} label="Updated" />}
            <Button variant="secondary" icon={<RefreshCw />} loading={refreshing} onClick={() => void refresh()}>
              Refresh
            </Button>
          </>
        }
      />

      <FilterBar
        label="Dashboard filters"
        activeCount={activeCount}
        onReset={() => setFilters({ location: undefined, status: undefined, from: undefined, to: undefined })}
      >
        <Field label="Location" className="w-full sm:w-44">
          <Select value={filters.location ?? ''} onChange={(e) => setFilters({ location: e.target.value })}>
            <option value="">All locations</option>
            {(locations.data ?? []).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" className="w-full sm:w-36">
          <Select value={filters.status ?? ''} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="">All statuses</option>
            {TRANSFORMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
        <TimeRangeFilter value={{ from: filters.from, to: filters.to }} onChange={(r) => setFilters({ from: r.from, to: r.to })} />
      </FilterBar>

      <section aria-label="Key metrics">
        {summary.isError && !summary.data ? (
          <Panel>
            <ErrorState
              error={summary.error}
              title="Could not load the network summary"
              onRetry={() => void summary.refetch()}
              retrying={summary.isRefetching}
            />
          </Panel>
        ) : (
          <DashboardKpis summary={summary.data} loading={summary.isPending} location={filters.location} />
        )}
      </section>

      <section aria-label="Trends" className="flex flex-col gap-2">
        <SectionLabel>Trends</SectionLabel>
        <TrendCharts filters={filters} />
      </section>

      <section aria-label="Triage" className="flex flex-col gap-2">
        <SectionLabel>Triage</SectionLabel>
        {/* Side by side only on 2xl: the attention table needs ~7 columns to stay scannable. */}
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-12">
          <div className="min-w-0 2xl:col-span-7 [&>section]:h-full">
            <AttentionList filters={filters} />
          </div>
          <div className="min-w-0 2xl:col-span-5 [&>section]:h-full">
            {summary.isPending ? (
              <Panel title="Recent alerts">
                <LoadingBlock lines={5} label="Loading recent alerts" />
              </Panel>
            ) : summary.data ? (
              <RecentAlertsList rows={summary.data.recentIncidents} />
            ) : null}
          </div>
        </div>
      </section>

      <section aria-label="Operations and distribution" className="flex flex-col gap-2">
        <SectionLabel>Operations &amp; distribution</SectionLabel>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 lg:col-span-2 xl:col-span-1 [&>section]:h-full">
            {summary.isPending ? (
              <Panel title="Pending maintenance">
                <LoadingBlock lines={5} label="Loading maintenance" />
              </Panel>
            ) : summary.data ? (
              <PendingMaintenanceList rows={summary.data.recentMaintenance} />
            ) : null}
          </div>
          <HealthDistributionChart filters={filters} />
          <FaultFrequencyChart filters={filters} />
        </div>
      </section>

      <SimulationPanel />
    </div>
  );
}
