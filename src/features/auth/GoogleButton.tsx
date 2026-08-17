import { useTranslation } from 'react-i18next';

/** Google "G" mark (inline, brand-accurate). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.4 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2c-.4.4 6.4-4.7 6.4-14.7 0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="btn-secondary w-full" onClick={onClick} disabled={disabled}>
      <GoogleG />
      {t('auth.loginWithGoogle')}
    </button>
  );
}

export function OrDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
      <span className="h-px flex-1 bg-line/15" />
      {t('auth.orContinueWith')}
      <span className="h-px flex-1 bg-line/15" />
    </div>
  );
}
