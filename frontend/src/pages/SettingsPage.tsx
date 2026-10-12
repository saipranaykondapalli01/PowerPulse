import { Lock } from 'lucide-react';
import { useSettings } from '@/hooks/useAdmin';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Panel } from '@/components/ui/Panel';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { SettingsForm } from '@/components/settings/SettingsForm';

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const editable = hasRole('ADMIN');
  const settings = useSettings();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="System / Settings"
        title="Settings"
        description="Fault thresholds, health scoring, notifications, locations and simulator behaviour."
        meta={
          !editable ? (
            <Badge tone="neutral" icon={<Lock aria-hidden="true" />}>
              Read-only
            </Badge>
          ) : undefined
        }
      />
      {settings.isPending ? (
        <Panel>
          <LoadingBlock lines={10} label="Loading settings" />
        </Panel>
      ) : settings.isError && !settings.data ? (
        <Panel>
          <ErrorState error={settings.error} title="Could not load settings" onRetry={() => void settings.refetch()} retrying={settings.isRefetching} />
        </Panel>
      ) : (
        // Re-mount when the server version changes so the form picks up fresh defaults.
        <SettingsForm key={settings.data.updatedAt ?? 'initial'} settings={settings.data} editable={editable} />
      )}
    </div>
  );
}
