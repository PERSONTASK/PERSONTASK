import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/Spinner';
import { isPasswordValid } from '@/lib/validation';

type Status = 'checking' | 'ready' | 'invalid' | 'done';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // O supabase-js (detectSessionInUrl) processa o token do link do e-mail e emite
  // o evento PASSWORD_RECOVERY, criando uma sessão temporária de recuperação.
  useEffect(() => {
    let settled = false;
    const ready = () => {
      settled = true;
      setStatus((s) => (s === 'checking' ? 'ready' : s));
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) ready();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) ready();
    });
    const timer = setTimeout(() => {
      if (!settled) setStatus('invalid');
    }, 3500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(password)) return setError(t('auth.passwordHint'));
    if (password !== confirm) return setError(t('validation.passwordMismatch'));
    setBusy(true);
    try {
      await updatePassword(password);
      setStatus('done');
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch {
      setError(t('auth.resetInvalid'));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'checking') {
    return (
      <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.checkingLink')}>
        <div className="flex justify-center py-8 text-brand-indigo">
          <Spinner className="h-7 w-7" />
        </div>
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetInvalid')}>
        <Link to="/forgot-password" className="btn-primary w-full justify-center">
          {t('auth.sendResetLink')}
        </Link>
      </AuthLayout>
    );
  }

  if (status === 'done') {
    return (
      <AuthLayout title={t('auth.resetTitle')} subtitle="">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={28} />
          </div>
          <p className="text-sm text-ink-soft">{t('auth.resetSuccess')}</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="password">
            {t('auth.newPassword')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <p className="mt-1 text-xs text-ink-faint">{t('auth.passwordHint')}</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            {t('auth.confirmPassword')}
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="field mt-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? <Spinner /> : t('auth.updatePassword')}
        </button>
      </form>
    </AuthLayout>
  );
}
