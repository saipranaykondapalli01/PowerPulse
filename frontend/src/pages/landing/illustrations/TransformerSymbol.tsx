/** IEC-style transformer symbol (two interlinked windings) with terminals. Original line art. */
export function TransformerSymbol({ className, tone = 'currentColor' }: { className?: string; tone?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true" fill="none">
      <path d="M0 40 H28 M92 40 H120" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx="48" cy="40" r="20" stroke={tone} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx="72" cy="40" r="20" stroke={tone} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
