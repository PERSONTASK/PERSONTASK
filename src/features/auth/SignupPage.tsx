import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { GoogleButton, OrDivider } from './GoogleButton';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/Spinner';
import { isEmail, isPasswordValid, passwordChecks } from '@/lib/validation';

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-emerald-500' : 'text-ink-faint'}`}>
      {ok ? <Check size={13} /> : <X size={13} />} {children}
    </li>
  );
}

export function SignupPage() {
  const { t } = useTranslation();
  const { signUpWithPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError(t('validation.nameRequired'));
    if (!isEmail(email)) return setError(t('validation.emailInvalid'));
    if (!isPasswordValid(password)) return setError(t('auth.passwordHint'));
    if (password !== confirm) return setError(t('validation.passwordMismatch'));

    setBusy(true);
    try {
      const { needsConfirm } = await signUpWithPassword(name.trim(), email, password);
      if (needsConfirm) setInfo(t('auth.checkEmail'));
      else navigate(next, { replace: true });
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <GoogleButton onClick={() => signInWithGoogle(next)} disabled={busy} />
      <OrDivider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="name">
            {t('auth.name')}
          </label>
          <input
            id="name"
            className="field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            className="field mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            className="field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {password && (
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <Rule ok={checks.length}>{t('validation.passwordLength')}</Rule>
              <Rule ok={checks.upper}>{t('validation.passwordUpper')}</Rule>
              <Rule ok={checks.lower}>{t('validation.passwordLower')}</Rule>
              <Rule ok={checks.number}>{t('validation.passwordNumber')}</Rule>
              <Rule ok={checks.special}>{t('validation.passwordSpecial')}</Rule>
            </ul>
          )}
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            {t('auth.confirmPassword')}
          </label>
          <input
            id="confirm"
            type="password"
            className="field mt-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-emerald-500">{info}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : t('auth.signup')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('auth.haveAccount')}{' '}
        <Link
          to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-semibold text-brand-indigo hover:underline"
        >
          {t('auth.signInInstead')}
        </Link>
      </p>
    </AuthLayout>
  );
}
