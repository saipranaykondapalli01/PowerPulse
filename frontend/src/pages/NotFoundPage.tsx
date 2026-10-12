import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ButtonLink } from '@/components/ui/Button';
import { AuthWordmark } from '@/components/layout/AuthLayout';

export default function NotFoundPage() {
  const { status } = useAuth();
  useEffect(() => {
    document.title = 'Not found · PowerPulse';
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink [color-scheme:light]">
      <header className="border-b border-ink/15">
        <div className="mx-auto flex h-16 w-full max-w-content items-center px-5 sm:px-10">
          <Link to="/" aria-label="PowerPulse home" className="rounded-sm">
            <AuthWordmark />
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center px-5 py-16 sm:px-10">
        <p className="flex items-center gap-3 font-mono text-label uppercase text-muted">
          <span>404</span>
          <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
          <span>No signal</span>
        </p>
        <h1 className="mt-6 max-w-[16ch] font-display text-display-md font-semibold">This page isn’t on the grid.</h1>
        {/* A dead line: the same dashed "offline · no flow" mark used on the network map. */}
        <div aria-hidden="true" className="mt-8 flex max-w-xl items-center gap-2">
          <span className="h-2 w-2 bg-ink" />
          <span className="h-0 flex-1 border-t border-dashed border-ink/40" />
          <span className="h-2 w-2 border border-ink/50" />
        </div>
        <p className="mt-6 max-w-md text-base text-muted">The address may be mistyped, or the page has moved.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          {status === 'authenticated' ? (
            <ButtonLink to="/dashboard" variant="primary" size="lg" arrow>
              Go to dashboard
            </ButtonLink>
          ) : (
            <ButtonLink to="/login" variant="primary" size="lg" arrow>
              Sign in
            </ButtonLink>
          )}
          <ButtonLink to="/" variant="secondary" size="lg">
            Home
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
