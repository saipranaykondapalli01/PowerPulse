import { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Popover } from '@/components/ui/Popover';
import { Spinner } from '@/components/ui/Spinner';
import { roleLabel } from '@/utils/labels';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <Popover
      label="Account"
      className="w-64"
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label={`Account menu for ${user.name}`}
          className="inline-flex h-9 items-center gap-2 rounded-sm px-1.5 text-fg-muted hover:bg-raised hover:text-fg"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-line bg-raised font-mono text-[0.65rem] text-fg"
          >
            {initials(user.name)}
          </span>
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-xs text-fg">{user.name}</span>
            <span className="block font-mono text-[0.6rem] uppercase">{roleLabel[user.role]}</span>
          </span>
          <ChevronDown aria-hidden="true" className="hidden h-3.5 w-3.5 lg:block" />
        </button>
      )}
    >
      {() => (
        <div>
          <div className="border-b border-line px-3 py-3">
            <p className="text-sm text-fg">{user.name}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
            <p className="mt-1.5 font-mono text-label uppercase text-accent-ink">
              {roleLabel[user.role]}
              {user.region ? ` · ${user.region}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-fg-muted hover:bg-raised hover:text-fg disabled:opacity-60"
          >
            {busy ? <Spinner size="xs" /> : <LogOut aria-hidden="true" className="h-4 w-4" />}
            Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}
