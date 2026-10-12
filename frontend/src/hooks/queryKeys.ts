/** Query-key factory. Invalidate by prefix (e.g. qk.alerts.all) after mutations. */
export const qk = {
  me: ['auth', 'me'] as const,
  dashboard: {
    all: ['dashboard'] as const,
    summary: (f: object) => ['dashboard', 'summary', f] as const,
    trends: (f: object) => ['dashboard', 'trends', f] as const,
    health: (f: object) => ['dashboard', 'health', f] as const,
    faults: (f: object) => ['dashboard', 'faults', f] as const,
  },
  transformers: {
    all: ['transformers'] as const,
    list: (p: object) => ['transformers', 'list', p] as const,
    everything: ['transformers', 'everything'] as const,
    locations: ['transformers', 'locations'] as const,
    detail: (id: string) => ['transformers', 'detail', id] as const,
    readings: (id: string, p: object) => ['transformers', 'readings', id, p] as const,
    alerts: (id: string, p: object) => ['transformers', 'alerts', id, p] as const,
    maintenance: (id: string) => ['transformers', 'maintenance', id] as const,
    incidents: (id: string) => ['transformers', 'incidents', id] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: (p: object) => ['alerts', 'list', p] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
  },
  maintenance: {
    all: ['maintenance'] as const,
    list: (p: object) => ['maintenance', 'list', p] as const,
    detail: (id: string) => ['maintenance', 'detail', id] as const,
  },
  faultHistory: { all: ['faultHistory'] as const, list: (p: object) => ['faultHistory', 'list', p] as const },
  notifications: {
    all: ['notifications'] as const,
    list: (p: object) => ['notifications', 'list', p] as const,
    unread: ['notifications', 'unread'] as const,
  },
  reports: { all: ['reports'] as const, report: (name: string, f: object) => ['reports', name, f] as const },
  settings: ['settings'] as const,
  simulation: ['simulation'] as const,
  users: {
    all: ['users'] as const,
    admin: (p: object) => ['users', 'admin', p] as const,
    assignable: (role?: string) => ['users', 'assignable', role ?? 'any'] as const,
  },
  audit: (p: object) => ['audit', p] as const,
  publicPreview: ['public', 'network-preview'] as const,
};
