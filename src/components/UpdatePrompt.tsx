import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Aviso de versão nova.
 *
 * O app é um PWA: o service worker guarda os arquivos para abrir rápido e
 * funcionar offline. O efeito colateral é que **uma aba aberta continua
 * rodando a versão antiga** depois de uma publicação, até ser recarregada —
 * e ninguém adivinha isso sozinho.
 *
 * Então avisamos e deixamos a pessoa decidir a hora. Recarregar na marra
 * seria pior: ela pode estar no meio de uma digitação.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Procura versão nova de hora em hora, para quem deixa a aba aberta
      // o dia todo não ficar preso numa versão antiga.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  // Uma versão nova depois de dispensar o aviso volta a mostrá-lo.
  useEffect(() => {
    if (needRefresh) setDismissed(false);
  }, [needRefresh]);

  if (!needRefresh || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line/15 bg-surface-overlay p-3 shadow-lift sm:left-auto sm:right-4 sm:mx-0"
    >
      <RefreshCw size={18} className="shrink-0 text-brand-indigo" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t('update.title')}</p>
        <p className="text-[11px] leading-snug text-ink-soft">{t('update.hint')}</p>
      </div>
      <button className="btn-primary shrink-0 px-3 py-1.5 text-xs" onClick={() => updateServiceWorker(true)}>
        {t('update.action')}
      </button>
      <button
        className="btn-ghost shrink-0 p-1"
        onClick={() => setDismissed(true)}
        aria-label={t('common.close')}
      >
        <X size={15} />
      </button>
    </div>
  );
}
