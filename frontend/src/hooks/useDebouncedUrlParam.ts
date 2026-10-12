import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { useUrlState } from './useUrlState';

/**
 * Text input state bound to a URL search param with debounce.
 * Typing updates local state immediately; the URL (and thus queries) update after `delayMs`.
 * External URL changes (e.g. "Clear filters") flow back into the input. Resets `page` on change.
 */
export function useDebouncedUrlParam(key: string, delayMs = 250): [string, (v: string) => void] {
  const { get, set } = useUrlState();
  const urlValue = get(key) ?? '';
  const [text, setText] = useState(urlValue);
  const debounced = useDebouncedValue(text, delayMs);
  const lastSynced = useRef(urlValue);

  useEffect(() => {
    if (debounced === lastSynced.current) return;
    lastSynced.current = debounced;
    set({ [key]: debounced.trim() || undefined }, { resetPage: true });
  }, [debounced, key, set]);

  useEffect(() => {
    if (urlValue === lastSynced.current) return;
    lastSynced.current = urlValue;
    setText(urlValue);
  }, [urlValue]);

  return [text, setText];
}
