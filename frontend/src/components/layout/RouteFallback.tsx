export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] items-center justify-center font-mono text-label uppercase text-fg-muted">
      Loading…
    </div>
  );
}
