import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, PlayCircle, RotateCcw } from 'lucide-react';
import { useAllTransformers, useSimulationControl, useSimulationStatus } from '@/hooks/useMonitoring';
import { RoleGate } from '@/components/layout/RoleGate';
import { Badge, SimulatedBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, errorMessage } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Freshness } from '@/components/ui/Freshness';
import { scenarioLabel } from '@/utils/labels';
import { formatNumber } from '@/utils/format';
import { links } from '@/utils/links';
import type { ScenarioName, SimulationStatus } from '@/types/api';

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-panel px-4 py-3">
      <dt className="font-mono text-label uppercase text-fg-muted">{label}</dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}

function StatusSummary({ status }: { status: SimulationStatus }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
      <Cell label="State">
        {!status.enabled ? (
          <Badge tone="offline">Disabled</Badge>
        ) : status.running ? (
          <Badge tone="accent" icon={<Play aria-hidden="true" />}>
            Running
          </Badge>
        ) : (
          <Badge tone="warning" icon={<Pause aria-hidden="true" />}>
            Paused
          </Badge>
        )}
      </Cell>
      <Cell label="Tick">
        <span className="tabular font-mono">{formatNumber(status.tick)}</span>
      </Cell>
      <Cell label="Interval">
        <span className="tabular font-mono">{formatNumber(status.intervalSeconds)} s</span>
      </Cell>
      <Cell label="Last tick">
        <Freshness at={status.lastTickAt} bare />
      </Cell>
    </dl>
  );
}

function ActiveScenarios({ status }: { status: SimulationStatus }) {
  return (
    <div>
      <h3 className="font-mono text-label uppercase text-fg-muted">
        Active scenarios <span className="tabular text-fg">· {formatNumber(status.scenarios.length)}</span>
      </h3>
      {status.scenarios.length === 0 ? (
        <p className="mt-1.5 text-xs text-fg-muted">None — all transformers follow nominal simulated behavior.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2">
          {status.scenarios.map((s) => (
            <li key={`${s.transformerId}-${s.name}`} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 bg-panel px-3 py-2 text-sm">
              <Link to={links.transformer(s.transformerId)} className="font-mono text-xs text-accent-ink hover:underline">
                {s.transformerCode}
              </Link>
              <span className="text-fg">{scenarioLabel[s.name] ?? s.name}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="tabular font-mono text-xs text-fg-muted">step {s.step}</span>
                <Freshness at={s.startedAt} bare />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Controls({ status }: { status: SimulationStatus }) {
  const control = useSimulationControl();
  const transformers = useAllTransformers();
  const toast = useToast();
  const [scenario, setScenario] = useState<ScenarioName | ''>('');
  const [transformerId, setTransformerId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const run = (action: 'start' | 'pause' | 'reset', label: string) =>
    control[action].mutate(undefined, {
      onSuccess: () => toast.success(`Simulation ${label}`),
      onError: (e) => toast.error(`Could not ${action} the simulation`, errorMessage(e)),
    });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!scenario || !transformerId) {
      setFormError('Choose a scenario and a transformer.');
      return;
    }
    setFormError(null);
    const code = transformers.data?.find((t) => t.id === transformerId)?.code ?? 'transformer';
    control.scenario.mutate(
      { name: scenario, transformerId },
      {
        onSuccess: () => toast.success('Scenario started', `${scenarioLabel[scenario]} on ${code} (simulated).`),
        onError: (err) => toast.error('Could not run scenario', errorMessage(err)),
      },
    );
  };

  const busy = control.start.isPending || control.pause.isPending || control.reset.isPending;

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-label uppercase text-fg-muted">Simulator</span>
        <Button
          variant="secondary"
          size="sm"
          icon={<Play />}
          onClick={() => run('start', 'started')}
          loading={control.start.isPending}
          disabled={busy || status.running || !status.enabled}
        >
          Start
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Pause />}
          onClick={() => run('pause', 'paused')}
          loading={control.pause.isPending}
          disabled={busy || !status.running}
        >
          Pause
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw />}
          onClick={() => run('reset', 'reset — all scenarios cleared')}
          loading={control.reset.isPending}
          disabled={busy}
        >
          Reset
        </Button>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" aria-label="Run scenario">
        <Field label="Scenario">
          <Select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioName | '')}>
            <option value="">Select scenario…</option>
            {status.availableScenarios.map((s) => (
              <option key={s} value={s}>
                {scenarioLabel[s] ?? s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transformer">
          <Select
            value={transformerId}
            onChange={(e) => setTransformerId(e.target.value)}
            disabled={transformers.isPending}
          >
            <option value="">{transformers.isPending ? 'Loading…' : 'Select transformer…'}</option>
            {(transformers.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary" icon={<PlayCircle />} loading={control.scenario.isPending}>
          Run scenario
        </Button>
        {formError && (
          <p role="alert" className="text-xs text-critical sm:col-span-3">
            {formError}
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Simulator status + controls. Everyone sees status; ADMIN/ENGINEER get Start/Pause/Reset and "Run scenario".
 * Clearly labeled SIMULATED: this drives generated data, not real devices.
 */
export function SimulationPanel({ id = 'simulation' }: { id?: string }) {
  const status = useSimulationStatus();
  return (
    <Panel
      id={id}
      eyebrow="Data source"
      title="Simulation control"
      description="Readings in this environment are generated by the PowerPulse simulator, not real IoT telemetry."
      actions={<SimulatedBadge />}
    >
      {status.isPending ? (
        <LoadingBlock label="Loading simulation status" lines={3} />
      ) : status.isError && !status.data ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} compact />
      ) : (
        <div className="flex flex-col gap-4">
          <StatusSummary status={status.data} />
          <ActiveScenarios status={status.data} />
          <RoleGate
            roles={['ADMIN', 'ENGINEER']}
            fallback={
              <p className="border-t border-line pt-3 text-xs text-fg-muted">
                Read-only: simulation controls are available to Admins and Engineers.
              </p>
            }
          >
            <Controls status={status.data} />
          </RoleGate>
        </div>
      )}
    </Panel>
  );
}
