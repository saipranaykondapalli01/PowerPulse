import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useUrlState } from '@/hooks/useUrlState';
import { useDateRangeParam } from '@/hooks/useListUrlParams';
import type { ReportFilters } from '@/types/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { SimulatedBadge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { DateRangePicker, presetRange } from '@/components/ui/DateRangePicker';
import { CsvExportPanel } from '@/components/reports/CsvExportPanel';
import {
  DowntimeSection,
  FaultFrequencySection,
  IncidentDurationSection,
  MaintenanceSection,
  ReportSectionHeading,
  SummaryTiles,
  TransformerHealthSection,
} from '@/components/reports/ReportSections';
import { LocationFilter } from '@/components/workflow/FilterControls';
import { formatDateTime } from '@/utils/format';

export default function ReportsPage() {
  const { get, set } = useUrlState();
  const [urlRange, setRange] = useDateRangeParam();
  // Default: last 30 days, computed once so the query key stays stable.
  const [defaultRange] = useState(() => presetRange('30d'));
  const range = urlRange.from || urlRange.to ? urlRange : defaultRange;
  const location = get('location');

  const filters = useMemo<ReportFilters>(() => {
    const f: ReportFilters = {};
    if (range.from) f.from = range.from;
    if (range.to) f.to = range.to;
    if (location) f.location = location;
    return f;
  }, [range.from, range.to, location]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Insights / Reports"
        title="Reports"
        description="Network health, incidents and maintenance performance for a period."
        meta={
          <>
            <SimulatedBadge />
            <span className="tabular font-mono text-xs text-fg-muted">
              <span className="sr-only">Reporting window: </span>
              {formatDateTime(range.from)} → {range.to ? formatDateTime(range.to) : 'now'} · {location || 'All locations'}
            </span>
          </>
        }
        actions={
          <a href="#csv-export" className={buttonClasses({ variant: 'secondary', size: 'md' })}>
            <Download aria-hidden="true" className="h-4 w-4" />
            Export CSV
          </a>
        }
      />

      <section
        aria-label="Report filters"
        className="flex flex-col gap-3 rounded-sm border border-line bg-panel px-4 py-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-6"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-mono text-label uppercase text-fg-muted">Period</span>
          <DateRangePicker value={range} onChange={setRange} allowClear={false} presets={['24h', '7d', '30d']} label="Report period" />
        </div>
        <span aria-hidden="true" className="hidden h-12 w-px self-end bg-line lg:block" />
        <LocationFilter value={location ?? ''} onChange={(v) => set({ location: v })} className="w-full sm:w-56" allLabel="All locations" />
      </section>

      <SummaryTiles filters={filters} />

      <ReportSectionHeading index="01" title="Faults & maintenance" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <FaultFrequencySection filters={filters} />
        <MaintenanceSection filters={filters} />
      </div>

      <ReportSectionHeading index="02" title="Fleet condition" />
      <TransformerHealthSection filters={filters} />

      <ReportSectionHeading index="03" title="Incidents & downtime" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <IncidentDurationSection filters={filters} />
        <DowntimeSection filters={filters} />
      </div>

      <ReportSectionHeading index="04" title="Exports" />
      <CsvExportPanel filters={filters} id="csv-export" />
    </div>
  );
}
