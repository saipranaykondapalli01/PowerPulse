import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { UsersTab } from '@/components/admin/UsersTab';
import { AuditLogTab } from '@/components/admin/AuditLogTab';

type TabId = 'users' | 'audit';

export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'audit' ? 'audit' : 'users';

  // Each tab has its own filters; switching tabs starts from a clean query string.
  const onTab = (id: TabId) => setParams(id === 'audit' ? { tab: 'audit' } : {}, { replace: true });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="System / Administration" title="Users & audit" description="Manage who can sign in and review every recorded change." />
      <Tabs
        label="Administration sections"
        tabs={[
          { id: 'users', label: 'Users' },
          { id: 'audit', label: 'Audit log' },
        ]}
        value={tab}
        onChange={onTab}
        panelClassName="pt-3"
      >
        {tab === 'users' ? <UsersTab /> : <AuditLogTab />}
      </Tabs>
    </div>
  );
}
