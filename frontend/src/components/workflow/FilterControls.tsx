import { X } from 'lucide-react';
import { useAllTransformers, useLocations } from '@/hooks/useMonitoring';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';

interface SelectFilterProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  className?: string;
  /** Label for the empty option. */
  allLabel?: string;
  error?: string;
}

/** Transformer picker backed by GET /transformers/all (sorted by code). */
export function TransformerFilter({ value, onChange, label = 'Transformer', className, allLabel = 'All', error }: SelectFilterProps) {
  const all = useAllTransformers();
  const options = [...(all.data ?? [])].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return (
    <Field label={label} className={className} error={error} hint={all.isError ? 'Could not load transformers.' : undefined}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all.isPending ? 'Loading…' : allLabel}</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code} · {t.name}
          </option>
        ))}
        {value && !all.isPending && !options.some((t) => t.id === value) && <option value={value}>Selected transformer</option>}
      </Select>
    </Field>
  );
}

/** Location picker backed by GET /transformers/locations. */
export function LocationFilter({ value, onChange, label = 'Location', className, allLabel = 'All' }: SelectFilterProps) {
  const locations = useLocations();
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {(locations.data ?? []).map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
        {value && !(locations.data ?? []).includes(value) && <option value={value}>{value}</option>}
      </Select>
    </Field>
  );
}

/** Generic enum select filter. */
export function EnumFilter<T extends string>({
  value,
  onChange,
  label,
  options,
  labels,
  className,
  allLabel = 'All',
}: SelectFilterProps & { label: string; options: readonly T[]; labels: Record<T, string> }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" icon={<X />} onClick={onClick}>
      Clear filters
    </Button>
  );
}
