import { HeartPulse } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

/** Readings are back to normal, but a person still has to resolve the alert (recovery policy in docs/development-plan.md). */
export function RecoveredBadge({ className }: { className?: string }) {
  return (
    <Badge
      tone="healthy"
      mono={false}
      icon={<HeartPulse aria-hidden="true" />}
      className={className}
      title="Readings have returned to normal; the alert stays open until someone resolves it"
    >
      Readings normal — awaiting resolution
    </Badge>
  );
}
