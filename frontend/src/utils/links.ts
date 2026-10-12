import type { ResourceType } from '@/types/api';

/** Canonical in-app links. Query params like ?focus= are read by the target pages. */
export const links = {
  transformer: (id: string) => `/transformers/${id}`,
  alert: (id: string) => `/alerts?focus=${encodeURIComponent(id)}`,
  alertsForTransformer: (transformerId: string) => `/alerts?transformerId=${encodeURIComponent(transformerId)}`,
  maintenance: (id: string) => `/maintenance?focus=${encodeURIComponent(id)}`,
  incident: (id: string) => `/fault-history?focus=${encodeURIComponent(id)}`,
  grid: (transformerId?: string) => (transformerId ? `/grid?focus=${encodeURIComponent(transformerId)}` : '/grid'),
  simulationPanel: '/dashboard#simulation',
};

/** Link for a notification/audit "related" resource, or null when there is no page for it. */
export function linkForResource(type: ResourceType | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case 'TRANSFORMER':
      return links.transformer(id);
    case 'ALERT':
      return links.alert(id);
    case 'MAINTENANCE':
      return links.maintenance(id);
    case 'INCIDENT':
      return links.incident(id);
    case 'SIMULATION':
      return links.simulationPanel;
    default:
      return null;
  }
}
