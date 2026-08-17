import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn-ghost h-9 w-9 rounded-lg p-0 ${className ?? ''}`}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
