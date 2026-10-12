/**
 * Presentation formatters. Pure functions; no business rules.
 * All timestamps from the API are ISO-8601 UTC and are rendered in the viewer's local time.
 */
import type { Instant } from '@/types/api';

export const EMPTY = '—';

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { minimumFractionDigits: min, maximumFractionDigits: max });
    nfCache.set(key, f);
  }
  return f;
}

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 1234.5 → "1,234.5" (digits = max fraction digits). Null → "—". */
export function formatNumber(v: number | null | undefined, digits = 0, minDigits = 0): string {
  if (!isNum(v)) return EMPTY;
  return nf(Math.min(minDigits, digits), digits).format(v);
}

/** Number + unit: "72.4 °C", "86 %". Null → "—". */
export function formatWithUnit(v: number | null | undefined, unit: string, digits = 1): string {
  if (!isNum(v)) return EMPTY;
  return unit ? `${formatNumber(v, digits)} ${unit}` : formatNumber(v, digits);
}

export const formatTemp = (v: number | null | undefined) => formatWithUnit(v, '°C', 1);
export const formatPct = (v: number | null | undefined, digits = 0) => formatWithUnit(v, '%', digits);
export const formatVolts = (v: number | null | undefined) => formatWithUnit(v, 'V', 0);
export const formatAmps = (v: number | null | undefined) => formatWithUnit(v, 'A', 0);
export const formatKva = (v: number | null | undefined) => formatWithUnit(v, 'kVA', 0);
export const formatPf = (v: number | null | undefined) => formatNumber(v, 2, 2);

/** Compact large numbers: 12_400 → "12.4K". */
export function formatCompact(v: number | null | undefined): string {
  if (!isNum(v)) return EMPTY;
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

function toDate(v: Instant | Date | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "9 Oct 2026, 14:05" in local time. */
export function formatDateTime(v: Instant | Date | number | null | undefined): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "9 Oct 2026". */
export function formatDate(v: Instant | Date | number | null | undefined): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "14:05" (or "14:05:09" with seconds). */
export function formatTime(v: Instant | Date | number | null | undefined, seconds = false): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  });
}

/** Short axis tick: time of day for spans ≤ 36 h, otherwise "9 Oct". */
export function formatAxisTime(v: Instant | number, spanMs: number): string {
  const d = toDate(v);
  if (!d) return '';
  if (spanMs <= 36 * 3600_000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Seconds → "45 s", "12 min", "3 h 20 min", "2 d 4 h". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!isNum(seconds)) return EMPTY;
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h} h ${rm} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

/** Age in seconds → "just now", "12 s ago", "3 min ago", "2 h ago", "4 d ago". */
export function formatAge(seconds: number | null | undefined): string {
  if (!isNum(seconds)) return EMPTY;
  const s = Math.max(0, Math.round(seconds));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Relative time from an instant to `now` ("12 s ago", "in 3 h"). */
export function formatRelative(v: Instant | Date | null | undefined, now: number = Date.now()): string {
  const d = toDate(v);
  if (!d) return EMPTY;
  const diff = (now - d.getTime()) / 1000;
  if (diff >= 0) return formatAge(diff);
  return `in ${formatDuration(-diff)}`;
}

/** ISO instant → value for <input type="datetime-local"> (local time, minute precision). */
export function toLocalInput(v: Instant | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO instant (UTC). Empty → undefined. */
export function fromLocalInput(v: string): Instant | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Signed delta with unit: "+3.2 °C" / "−1 %". */
export function formatDelta(v: number | null | undefined, unit = '', digits = 1): string {
  if (!isNum(v)) return EMPTY;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(v), digits)}${unit ? ` ${unit}` : ''}`;
}
