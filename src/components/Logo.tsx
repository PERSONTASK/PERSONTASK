import logoLight from '@/assets/logo-full.svg'; // texto escuro → fundos claros
import logoDark from '@/assets/logo-full-dark.svg'; // texto claro → fundos escuros
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

/**
 * Logo do produto, com troca automática por tema.
 * Os caminhos ficam centralizados aqui: substituir os SVGs em
 * `src/assets/logo-full.svg` e `logo-full-dark.svg` atualiza o logo em todo o app.
 */
export function Logo({
  className,
  forceVariant,
}: {
  className?: string;
  /** Força a variante independentemente do tema (ex.: sobre painel colorido). */
  forceVariant?: 'onLight' | 'onDark';
}) {
  const { theme } = useTheme();
  const onDark = forceVariant ? forceVariant === 'onDark' : theme === 'dark';
  return (
    <img
      src={onDark ? logoDark : logoLight}
      alt="PERSONTASK"
      className={cn('h-8 w-auto select-none', className)}
      draggable={false}
    />
  );
}
