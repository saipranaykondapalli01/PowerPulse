import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTransformerSearch } from '@/hooks/useTransformerSearch';
import { StatusBadge } from '@/components/ui/StatusBadges';
import { Spinner } from '@/components/ui/Spinner';
import { links } from '@/utils/links';

/** Global transformer search (combobox): debounced 250 ms, ↑/↓ to move, Enter to open, Esc to close. */
export function GlobalSearch({ className }: { className?: string }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = useDebouncedValue(text, 250);
  const search = useTransformerSearch(q);
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = search.data?.content ?? [];
  const show = open && text.trim().length > 0;

  const go = (id: string) => {
    setOpen(false);
    setText('');
    setActive(-1);
    inputRef.current?.blur();
    navigate(links.transformer(id));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      const target = results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (target) {
        e.preventDefault();
        go(target.id);
      } else if (text.trim()) {
        e.preventDefault();
        setOpen(false);
        navigate(`/transformers?q=${encodeURIComponent(text.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className={clsx('relative', className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search transformers
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        placeholder="Search code, name, location…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-sm border border-line bg-canvas pl-8 pr-8 text-sm text-fg placeholder:text-fg-muted/70 focus:border-accent/70"
      />
      {search.isFetching && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted">
          <Spinner size="xs" />
        </span>
      )}
      {show && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching transformers"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-sm border border-line bg-panel py-1 shadow-overlay"
        >
          {search.isError && <li className="px-3 py-2 text-xs text-critical">Search failed. Try again.</li>}
          {!search.isError && q === text && search.isSuccess && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-fg-muted">No transformers match “{text.trim()}”.</li>
          )}
          {results.map((t, i) => (
            <li
              key={t.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(t.id)}
              onMouseEnter={() => setActive(i)}
              className={clsx(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm',
                i === active ? 'bg-raised' : 'hover:bg-raised/60',
              )}
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs text-fg">{t.code}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {t.name} · {t.location}
                </span>
              </span>
              <StatusBadge value={t.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
