import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

/** Centered dialog. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-hidden rounded-xl border border-line/10 bg-surface-overlay shadow-lift animate-scale-in"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-line/10 px-5 py-3.5">
          <h3 className="text-sm font-bold">{title}</h3>
          <button className="btn-ghost h-8 w-8 rounded-lg p-0" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line/10 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Right-side drawer (used for Item detail). */
export function SidePanel({
  open,
  onClose,
  title,
  headerExtra,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEscape(open, onClose);
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      onMouseDown={onClose}
    >
      <div
        className={cn(
          'flex h-full w-full max-w-full flex-col border-l border-line/10 bg-surface-base transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-8',
        )}
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line/10 bg-surface-base px-5 py-3.5">
          <h3 className="flex-1 text-sm font-bold">{title}</h3>
          {headerExtra}
          <button className="btn-ghost h-8 w-8 rounded-lg p-0" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line/10 bg-surface-base px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
