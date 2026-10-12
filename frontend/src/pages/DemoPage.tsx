import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, FlaskConical } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, ButtonLink } from '@/components/ui/Button';
import { loginErrorMessage } from '@/utils/auth';

/** Dev-only seed account (docs/security.md). Exists only when the backend runs with the `dev` profile. */
const DEMO_EMAIL = 'demo@powerpulse.local';
const DEMO_PASSWORD = 'PowerPulse!Demo1';

export default function DemoPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Demo · PowerPulse';
  }, []);

  const enter = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(loginErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      section="Demo · Simulated network"
      aside={
        <>
          The demo runs on a <strong className="text-ink">simulated</strong> 20-transformer network. Readings are generated
          by the PowerPulse simulator — they are <strong className="text-ink">not real IoT telemetry</strong>.
        </>
      }
    >
      <p className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-raised px-1.5 py-0.5 font-mono text-label uppercase text-fg-muted">
        <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
        Simulated data
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Explore the demo</h1>
      <ol className="mt-4 divide-y divide-line border-y border-line text-sm text-fg-muted">
        {[
          'Watch live (simulated) temperature, oil, load and electrical readings.',
          'Trigger fault scenarios — overheating, low oil, overloading, offline — and see alerts fire.',
          'Create maintenance tasks and follow incidents through to resolution.',
        ].map((t, i) => (
          <li key={t} className="flex gap-3 py-2.5">
            <span aria-hidden="true" className="tabular font-mono text-label text-fg-subtle">
              {String(i + 1).padStart(2, '0')}
            </span>
            {t}
          </li>
        ))}
      </ol>

      {error && (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-sm border border-critical/35 bg-critical-bg px-3 py-2 text-sm text-critical">
          <AlertOctagon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Could not start the demo. {error}
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {status === 'authenticated' ? (
          <ButtonLink to="/dashboard" variant="primary" size="lg" block arrow>
            Continue to dashboard
          </ButtonLink>
        ) : (
          <Button variant="primary" size="lg" block arrow={!busy} loading={busy} onClick={enter} disabled={status === 'loading'}>
            Enter demo
          </Button>
        )}
        <Link to="/login" className="mt-2 text-center text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Have an account? Sign in
        </Link>
      </div>

      <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-fg-muted">
        The demo signs in with the dev-only seed account <span className="font-mono text-fg">{DEMO_EMAIL}</span> (Engineer
        role). It works only when the backend runs with the <span className="font-mono text-fg">dev</span> profile; production
        deployments never create this account.
      </p>
    </AuthLayout>
  );
}
