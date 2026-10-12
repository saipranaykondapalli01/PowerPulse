import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertOctagon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loginErrorMessage, safeNext } from '@/utils/auth';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { RouteFallback } from '@/components/layout/RouteFallback';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { status, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    document.title = 'Sign in · PowerPulse';
  }, []);

  if (status === 'loading') return <RouteFallback />;
  if (status === 'authenticated' && !isSubmitting) return <Navigate to={next} replace />;

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email.trim(), values.password);
      navigate(next, { replace: true });
    } catch (e) {
      setError('root.server', { message: loginErrorMessage(e) });
    }
  };

  const serverError = errors.root?.server?.message;

  return (
    <AuthLayout section="Operator access" aside="Sign in to monitor transformer health, triage alerts and coordinate maintenance across your network.">
      <p className="font-mono text-label uppercase text-fg-muted">Account · Sign in</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-fg-muted">Use the account your administrator created for you.</p>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-sm border border-critical/35 bg-critical-bg px-3 py-2 text-sm text-critical">
            <AlertOctagon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <Field label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="username" inputMode="email" autoFocus {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message} required>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={isSubmitting} arrow={!isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-sm text-fg-muted">
        <p>
          Just exploring?{' '}
          <Link to="/demo" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Try the demo
          </Link>{' '}
          with simulated data.
        </p>
      </div>
    </AuthLayout>
  );
}
