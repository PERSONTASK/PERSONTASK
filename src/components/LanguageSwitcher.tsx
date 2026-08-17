import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/i18n';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.split('-')[0] || 'pt';
  return (
    <label className={`inline-flex items-center gap-1.5 text-ink-soft ${className ?? ''}`}>
      <Globe size={16} className="shrink-0" />
      <select
        value={SUPPORTED_LANGUAGES.some((l) => l.code === current) ? current : 'pt'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="cursor-pointer rounded-md bg-transparent py-1 pr-1 text-sm font-medium outline-none"
        aria-label="Language"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-surface-raised text-ink">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
