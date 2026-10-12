import { useState } from 'react';
import { CircleCheck, Download, OctagonAlert } from 'lucide-react';
import { reportService } from '@/services/reportService';
import type { CsvExportType, ReportFilters } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/components/ui/ErrorState';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/Toast';
import { TransformerFilter } from '@/components/workflow/FilterControls';
import { formatTime } from '@/utils/format';

const EXPORTS: { type: Exclude<CsvExportType, 'readings'>; label: string; description: string }[] = [
  { type: 'transformer-health', label: 'Transformer health', description: 'Health score, status, risk and alert counts per transformer.' },
  { type: 'fault-history', label: 'Fault history', description: 'Every fault raised in the period with severity and resolution.' },
  { type: 'maintenance', label: 'Maintenance', description: 'Tasks created in the period with status, priority and assignee.' },
];

type ExportResult = { ok: true; at: number } | { ok: false; at: number };

/** Last outcome per export, shown next to its button (details go to the toast). */
function ResultLine({ result }: { result?: ExportResult }) {
  if (!result) return <p className="min-h-4 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted">CSV · current filters</p>;
  return result.ok ? (
    <p className="inline-flex min-h-4 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-healthy">
      <CircleCheck aria-hidden="true" className="h-3 w-3" /> Downloaded {formatTime(result.at)}
    </p>
  ) : (
    <p className="inline-flex min-h-4 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-critical">
      <OctagonAlert aria-hidden="true" className="h-3 w-3" /> Export failed · try again
    </p>
  );
}

/** CSV downloads through the authenticated session (GET /reports/export.csv). */
export function CsvExportPanel({ filters, id }: { filters: ReportFilters; id?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<CsvExportType | null>(null);
  const [results, setResults] = useState<Partial<Record<CsvExportType, ExportResult>>>({});
  const [transformerId, setTransformerId] = useState('');
  const [readingsError, setReadingsError] = useState<string>();

  const run = async (type: CsvExportType, label: string) => {
    if (type === 'readings' && !transformerId) {
      setReadingsError('Choose a transformer to export its readings');
      return;
    }
    setBusy(type);
    try {
      await reportService.exportCsv(type, type === 'readings' ? { ...filters, transformerId } : filters);
      setResults((r) => ({ ...r, [type]: { ok: true, at: Date.now() } }));
      toast.success(`${label} CSV downloaded`);
    } catch (e) {
      setResults((r) => ({ ...r, [type]: { ok: false, at: Date.now() } }));
      toast.error(`Could not export ${label.toLowerCase()} CSV`, errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      id={id}
      eyebrow="CSV · UTF-8"
      title="Export CSV"
      description="Each export uses the period and location selected above."
      className="scroll-mt-20"
      flush
    >
      <ul aria-busy={busy !== null || undefined} className="grid grid-cols-1 gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
        {EXPORTS.map((e) => (
          <li key={e.type} className="flex flex-col gap-3 bg-panel p-4">
            <p className="text-xs text-fg-muted">{e.description}</p>
            <div className="mt-auto flex flex-col items-start gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                icon={<Download />}
                loading={busy === e.type}
                disabled={busy !== null && busy !== e.type}
                onClick={() => void run(e.type, e.label)}
              >
                {e.label}
              </Button>
              <div aria-live="polite">
                <ResultLine result={results[e.type]} />
              </div>
            </div>
          </li>
        ))}
        <li className="flex flex-col gap-3 bg-panel p-4">
          <TransformerFilter
            label="Readings for transformer"
            allLabel="Select a transformer"
            value={transformerId}
            error={readingsError}
            onChange={(v) => {
              setTransformerId(v);
              setReadingsError(undefined);
            }}
          />
          <div className="mt-auto flex flex-col items-start gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              icon={<Download />}
              loading={busy === 'readings'}
              disabled={busy !== null && busy !== 'readings'}
              onClick={() => void run('readings', 'Readings')}
            >
              Readings
            </Button>
            <div aria-live="polite">
              <ResultLine result={results.readings} />
            </div>
          </div>
        </li>
      </ul>
    </Panel>
  );
}
