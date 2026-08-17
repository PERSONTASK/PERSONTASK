import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';
import { GoogleButton, OrDivider } from './GoogleButton';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/Spinner';
import { isEmail } from '@/lib/validation';

export function LoginPage() {
  const { t } = useTranslation();
  const { signInWithPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!isEmail(email)) return setError(t('validation.emailInvalid'));
    setBusy(true);
    try {
      await signInWithPassword(email, password);
      navigate(next, { replace: true });
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <GoogleButton onClick={() => signInWithGoogle(next)} disabled={busy} />
      <OrDivider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="field mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t('auth.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : t('auth.login')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('auth.noAccount')}{' '}
        <Link
          to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-semibold text-brand-indigo hover:underline"
        >
          {t('auth.createOne')}
        </Link>
      </p>
    </AuthLayout>
  );
}
