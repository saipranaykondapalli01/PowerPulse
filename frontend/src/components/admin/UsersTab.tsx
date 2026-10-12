import { useMemo, useState } from 'react';
import { CircleCheck, CircleSlash, Pencil, Search, UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { useAdminUsers, useUserActions } from '@/hooks/useAdmin';
import { useUrlState } from '@/hooks/useUrlState';
import { useDebouncedUrlParam } from '@/hooks/useDebouncedUrlParam';
import { usePageParams } from '@/hooks/useListUrlParams';
import { useAuth } from '@/context/AuthContext';
import type { Role, UserDto } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { LoadingBlock } from '@/components/ui/Skeleton';
import { Table, type Column } from '@/components/ui/Table';
import { ClearFiltersButton, EnumFilter } from '@/components/workflow/FilterControls';
import { formatDate } from '@/utils/format';
import { ROLES, roleLabel } from '@/utils/labels';
import { UserFormDialog } from './UserFormDialog';
import { AdminConfirmDialog } from './AdminConfirm';

export function UsersTab() {
  const { user: me } = useAuth();
  const { get, set } = useUrlState();
  const [q, setQ] = useDebouncedUrlParam('q');
  const { page, size, setPage, setSize } = usePageParams();
  const role = get('role') as Role | undefined;
  const [dialog, setDialog] = useState<{ open: boolean; user: UserDto | null }>({ open: false, user: null });
  const [toDeactivate, setToDeactivate] = useState<UserDto | null>(null);
  const [deactivateError, setDeactivateError] = useState<string>();
  const { update } = useUserActions();
  const toast = useToast();

  const setActive = async (u: UserDto, active: boolean) => {
    try {
      await update.mutateAsync({ id: u.id, body: { active } });
      toast.success(active ? 'User reactivated' : 'User deactivated', u.name);
      return true;
    } catch (e) {
      const msg = errorMessage(e, active ? 'Could not reactivate the user.' : 'Could not deactivate the user.');
      if (active) toast.error('User not reactivated', msg);
      else setDeactivateError(msg);
      return false;
    }
  };

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    if (await setActive(toDeactivate, false)) setToDeactivate(null);
  };

  const params = useMemo(() => {
    const p: { page: number; size: number; q?: string; role?: Role } = { page, size };
    const qv = get('q');
    if (qv) p.q = qv;
    if (role && ROLES.includes(role)) p.role = role;
    return p;
  }, [get, page, size, role]);

  const list = useAdminUsers(params);
  const hasFilters = !!params.q || !!params.role;
  const clear = () => set({ q: undefined, role: undefined }, { resetPage: true });

  const columns: Column<UserDto>[] = [
    {
      key: 'name',
      header: 'Name',
      rowHeader: true,
      cell: (u) => (
        <span>
          {u.name}
          {u.id === me?.id && <span className="ml-1.5 text-xs text-fg-muted">(you)</span>}
        </span>
      ),
    },
    { key: 'email', header: 'Email', cell: (u) => <span className="font-mono text-xs">{u.email}</span> },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={u.role === 'ADMIN' ? 'accent' : 'neutral'}>{roleLabel[u.role]}</Badge> },
    { key: 'region', header: 'Region', cell: (u) => u.region ?? <span className="text-fg-muted">All regions</span> },
    {
      key: 'active',
      header: 'Status',
      cell: (u) =>
        u.active ? (
          <Badge tone="healthy" icon={<CircleCheck aria-hidden="true" />}>
            Active
          </Badge>
        ) : (
          <Badge tone="offline" icon={<CircleSlash aria-hidden="true" />}>
            Inactive
          </Badge>
        ),
    },
    { key: 'created', header: 'Created', cell: (u) => <span className="font-mono text-xs text-fg-muted">{formatDate(u.createdAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (u) => (
        <span className="inline-flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDialog({ open: true, user: u })} aria-label={`Edit ${u.name}`}>
            Edit
          </Button>
          {u.id !== me?.id &&
            (u.active ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<UserMinus />}
                className="text-critical hover:bg-critical-bg hover:text-critical"
                onClick={() => {
                  setDeactivateError(undefined);
                  setToDeactivate(u);
                }}
                aria-label={`Deactivate ${u.name}`}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<UserCheck />}
                loading={update.isPending && update.variables?.id === u.id}
                onClick={() => void setActive(u, true)}
                aria-label={`Reactivate ${u.name}`}
              >
                Reactivate
              </Button>
            ))}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="User filters" className="grid grid-cols-2 items-end gap-3 rounded-sm border border-line bg-panel px-4 py-3 md:grid-cols-4">
        <Field label="Search users" className="col-span-2">
          <Input type="search" leading={<Search />} placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <EnumFilter label="Role" value={params.role ?? ''} onChange={(v) => set({ role: v }, { resetPage: true })} options={ROLES} labels={roleLabel} />
        <div className="flex items-end justify-end gap-2">
          {hasFilters && <ClearFiltersButton onClick={clear} />}
          <Button variant="primary" icon={<UserPlus />} onClick={() => setDialog({ open: true, user: null })}>
            Create user
          </Button>
        </div>
      </section>

      <Panel flush>
        {list.isPending ? (
          <LoadingBlock className="p-4" lines={6} label="Loading users" />
        ) : list.isError && !list.data ? (
          <ErrorState error={list.error} title="Could not load users" onRetry={() => void list.refetch()} retrying={list.isRefetching} />
        ) : (
          <>
            <Table
              caption="Users"
              columns={columns}
              rows={list.data.content}
              getRowId={(u) => u.id}
              updating={list.isPlaceholderData}
              maxHeight="calc(100dvh - 24rem)"
              empty={<EmptyState title={hasFilters ? 'No users match these filters' : 'No users'} />}
            />
            <div className="border-t border-line">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                totalElements={list.data.totalElements}
                size={list.data.size}
                itemLabel="users"
                onPageChange={setPage}
                onSizeChange={setSize}
              />
            </div>
          </>
        )}
      </Panel>

      <AdminConfirmDialog
        open={!!toDeactivate}
        title={toDeactivate ? `Deactivate ${toDeactivate.name}?` : 'Deactivate user?'}
        confirmLabel="Deactivate user"
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setToDeactivate(null)}
        busy={update.isPending}
        error={deactivateError}
      >
        <p>
          <span className="font-mono text-fg">{toDeactivate?.email}</span> will no longer be able to sign in. Their history,
          assignments and audit entries are kept.
        </p>
        <p>You can reactivate the account later from this table.</p>
      </AdminConfirmDialog>

      <UserFormDialog
        open={dialog.open}
        user={dialog.user}
        currentUserId={me?.id}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}
