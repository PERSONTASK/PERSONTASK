import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/Spinner';

/** Landing route for OAuth (Google) redirects. Supabase parses the URL, then we forward. */
export function AuthCallback() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (loading) return;
    const next = params.get('next') || '/';
    navigate(session ? next : '/login', { replace: true });
  }, [loading, session, params, navigate]);

  return (
    <div className="flex h-screen items-center justify-center text-brand-indigo">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
