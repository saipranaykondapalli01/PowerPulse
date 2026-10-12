import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Boxes, ChevronRight, ClipboardPlus, Gauge, Hand, MapPin, Pencil, Siren } from 'lucide-react';
import { useSimulationControl, useSimulationStatus, useTransformer } from '@/hooks/useMonitoring';
import { useSettings } from '@/hooks/useAdmin';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/apiClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { SimulatedBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Freshness } from '@/components/ui/Freshness';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadges';
import { HealthBreakdown } from '@/components/transformers/HealthBreakdown';
import { ReadingHistory } from '@/components/transformers/ReadingHistory';
import { TransformerFormDialog } from '@/components/transformers/TransformerFormDialog';
import {
  ActiveAlerts,
  AssetSpecs,
  CurrentReadings,
  MaintenanceHistory,
  PreviousFaults,
  Recommendations,
} from '@/components/transformers/DetailSections';
import { MaintenanceCreateDialog } from '@/components/maintenance/MaintenanceCreateDialog';
import { RecordReadingDialog } from '@/components/transformers/RecordReadingDialog';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/components/ui/ErrorState';
import { links } from '@/utils/links';

function SectionLabel({ children }: { children: string }) {
  return <h2 className="font-mono text-label uppercase text-fg-muted">{children}</h2>;
}

export default function TransformerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useTransformer(id);
  const { hasRole } = useAuth();
  const canReadSettings = hasRole('ADMIN', 'ENGINEER');
  const settings = useSettings(canReadSettings);
  const [editOpen, setEditOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading transformer">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Skeleton className="h-72 lg:col-span-4" />
          <Skeleton className="h-72 lg:col-span-8" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (detail.isError && !detail.data) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Transformer not found"
        description="It may have been removed or the link is wrong."
        action={<ButtonLink to="/transformers" variant="secondary">Back to registry</ButtonLink>}
      />
    ) : (
      <ErrorState error={detail.error} title="Could not load this transformer" onRetry={() => void detail.refetch()} />
    );
  }

  const t = detail.data;
  const label = `${t.code} · ${t.name}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 font-mono text-label uppercase text-fg-muted">
            <li>
              <Link to="/transformers" className="hover:text-fg hover:underline">
                Transformers
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li>
              <span aria-current="page" className="text-fg">
                {t.code}
              </span>
            </li>
          </ol>
        </nav>
        <PageHeader
          className="!mb-0"
          eyebrow={`${t.code} · Asset profile`}
          title={t.name}
          meta={
            <>
              <StatusBadge value={t.status} />
              {t.latestReading?.source === 'SIMULATED' && <SimulatedBadge />}
              <Freshness at={t.lastReadingAt} stale={t.stale} label="Last reading" />
              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <MapPin aria-hidden="true" className="h-3 w-3" />
                {t.location}
              </span>
            </>
          }
          actions={
            <>
              <ButtonLink to={links.grid(t.id)} variant="secondary" icon={<Boxes />}>
                Open in 3D grid
              </ButtonLink>
              <ButtonLink to={links.alertsForTransformer(t.id)} variant="secondary" icon={<Siren />}>
                View alerts
              </ButtonLink>
              <RoleGate roles={['ADMIN', 'ENGINEER', 'TECHNICIAN']}>
                <Button variant="secondary" icon={<Gauge />} onClick={() => setReadingOpen(true)}>
                  Record reading
                </Button>
              </RoleGate>
              <RoleGate roles={['ADMIN', 'ENGINEER']}>
                <Button variant="secondary" icon={<Pencil />} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button variant="primary" icon={<ClipboardPlus />} onClick={() => setMaintOpen(true)}>
                  Create maintenance
                </Button>
              </RoleGate>
            </>
          }
        />
      </div>

      <ManualHoldNotice transformerId={t.id} />

      <section aria-label="Condition and telemetry" className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel
          eyebrow="Condition index"
          title="Health score"
          description="Prioritisation heuristic (0–100). Not the same as alert severity."
          className="lg:col-span-4"
        >
          <HealthBreakdown score={t.healthScore} status={t.status} factors={t.healthFactors} />
        </Panel>
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-8">
          <CurrentReadings t={t} />
          <AssetSpecs t={t} />
        </div>
      </section>

      <section aria-label="Reading history" className="flex flex-col gap-2">
        <SectionLabel>Trends</SectionLabel>
        <ReadingHistory transformer={t} settings={settings.data} />
      </section>

      <section aria-label="Faults and guidance" className="flex flex-col gap-2">
        <SectionLabel>Faults &amp; guidance</SectionLabel>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-7 [&>section]:h-full">
            <ActiveAlerts id={t.id} />
          </div>
          <div className="min-w-0 xl:col-span-5 [&>section]:h-full">
            <Recommendations t={t} />
          </div>
        </div>
      </section>

      <section aria-label="History" className="flex flex-col gap-2">
        <SectionLabel>History</SectionLabel>
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          <PreviousFaults id={t.id} />
          <MaintenanceHistory id={t.id} />
        </div>
      </section>

      <RecordReadingDialog open={readingOpen} onClose={() => setReadingOpen(false)} transformer={t} />
      <TransformerFormDialog open={editOpen} onClose={() => setEditOpen(false)} transformer={t} />
      <MaintenanceCreateDialog
        open={maintOpen}
        onClose={() => setMaintOpen(false)}
        transformerId={t.id}
        transformerLabel={label}
        defaultPriority={t.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM'}
      />
    </div>
  );
}

/** Shown while the simulator skips this transformer because its readings are being entered manually. */
function ManualHoldNotice({ transformerId }: { transformerId: string }) {
  const sim = useSimulationStatus();
  const { scenario } = useSimulationControl();
  const toast = useToast();
  const held = sim.data?.scenarios.some((s) => s.transformerId === transformerId && s.name === 'manual');
  if (!held) return null;
  const resume = () =>
    scenario.mutate(
      { name: 'healthy', transformerId },
      {
        onSuccess: () => toast.success('Simulation resumed', 'The simulator will generate readings for this unit again.'),
        onError: (e) => toast.error('Could not resume simulation', errorMessage(e)),
      },
    );
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-panel px-4 py-3"
    >
      <p className="flex items-start gap-2.5 text-sm text-fg">
        <Hand aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
        <span>
          <span className="font-medium">Manual readings.</span>{' '}
          <span className="text-fg-muted">
            The simulator is skipping this transformer. It shows OFFLINE if no reading is entered within the sensor
            timeout.
          </span>
        </span>
      </p>
      <RoleGate roles={['ADMIN', 'ENGINEER']}>
        <Button variant="secondary" size="sm" loading={scenario.isPending} onClick={resume}>
          Resume simulation
        </Button>
      </RoleGate>
    </div>
  );
}
