import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/Spinner';
import { isEmail } from '@/lib/validation';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!isEmail(email)) return setError(t('validation.emailInvalid'));
    setBusy(true);
    try {
      await resetPassword(email);
    } catch {
      // Não revelamos se o e-mail existe: mostramos sucesso genérico de qualquer forma.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {sent ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-indigo/10 text-brand-indigo">
            <MailCheck size={26} />
          </div>
          <p className="text-sm text-ink-soft">{t('auth.resetSent')}</p>
          <Link to="/login" className="btn-primary w-full justify-center">
            {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
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
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
            {busy ? <Spinner /> : t('auth.sendResetLink')}
          </button>
          <p className="text-center text-sm text-ink-soft">
            <Link to="/login" className="font-semibold text-brand-indigo hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
