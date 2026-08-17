import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/Spinner';

/**
 * /invite/:token — o link chega por e-mail com ?s=<nome do Espaço> para exibição.
 * Sem login: oferece entrar/cadastrar (voltando para cá). Com login: aceita o
 * convite via RPC accept_invite e entra no Espaço.
 */
export function InvitePage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const spaceName = params.get('s') || 'PERSONTASK';
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const next = `/invite/${token}${spaceName ? `?s=${encodeURIComponent(spaceName)}` : ''}`;

  useEffect(() => {
    if (loading || !session) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
      if (!active) return;
      if (error) setError(error.message || t('errors.generic'));
      else navigate(`/space/${data}`, { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [loading, session, token, navigate, t]);

  if (loading || (session && !error)) {
    return (
      <div className="flex h-screen items-center justify-center text-brand-indigo">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <AuthLayout
      title={t('auth.acceptInviteTitle', { space: spaceName })}
      subtitle={t('auth.acceptInviteSubtitle')}
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      <div className="space-y-3">
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="btn-primary w-full">
          {t('auth.login')}
        </Link>
        <Link to={`/signup?next=${encodeURIComponent(next)}`} className="btn-secondary w-full">
          {t('auth.signup')}
        </Link>
      </div>
    </AuthLayout>
  );
}
