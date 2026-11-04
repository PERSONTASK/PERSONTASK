import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarClock, CalendarPlus, CheckCircle2, ChevronRight } from 'lucide-react';
import { api, ITEMS_CHANGED, type OverdueItem } from '@/lib/api';
import type { Item } from '@/types';
import { effectiveSchedule } from '@/lib/schedule';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';

/** Chave do "já vi" deste Espaço — é por navegador, não vai pro banco. */
const seenKey = (spaceId: string) => `persontask:seen-overdue:${spaceId}`;

function readSeen(spaceId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(spaceId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(spaceId: string, ids: Set<string>) {
  try {
    localStorage.setItem(seenKey(spaceId), JSON.stringify([...ids]));
  } catch {
    /* modo privado / armazenamento bloqueado: o contador só não persiste */
  }
}

/**
 * Sininho de avisos: lista os cards com Término já vencido.
 *
 * O **contador** conta só os avisos ainda não vistos e zera quando a lista é
 * aberta (o "já vi" fica no navegador). Já o **aviso em si** continua na
 * lista enquanto o card estiver vencido — ele só sai quando for resolvido no
 * card (prazo novo ou 100% concluído). Clicar leva direto ao card.
 */
export function NotificationsBell({
  spaceId,
  canEdit,
  reloadToken,
  onOpenItem,
}: {
  spaceId: string;
  /** Sem permissão de editar item, o aviso é só leitura. */
  canEdit: boolean;
  /** Muda quando algo no Espaço foi alterado, para recarregar a lista. */
  reloadToken: number;
  onOpenItem: (item: OverdueItem) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'pt';

  const [items, setItems] = useState<OverdueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(spaceId));
  const [failed, setFailed] = useState(false);
  /** Muda quando um card foi alterado em qualquer lugar do app. */
  const [echo, setEcho] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [postponing, setPostponing] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /** Resolve o aviso na hora e tira o card da lista, sem abrir o card. */
  async function resolve(item: OverdueItem, patch: Partial<Item>) {
    setBusyId(item.id);
    try {
      await api.items.update(item.id, patch);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setPostponing(null);
    } catch (e) {
      console.warn('[alerts] não consegui resolver o aviso', e);
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Qualquer alteração de card recarrega a lista — inclusive quando ela
   * acontece longe daqui (quadro, Lista, relatório, arrastar entre
   * Colunas). O `api` avisa por evento, então o sininho não precisa ser
   * conhecido por cada tela. O atraso agrupa rajadas de edição.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onChanged = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setEcho((n) => n + 1), 800);
    };
    window.addEventListener(ITEMS_CHANGED, onChanged);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(ITEMS_CHANGED, onChanged);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api.items
      .listOverdue(spaceId)
      .then((rows) => {
        if (!alive) return;
        // O filtro fino é o mesmo semáforo do resto do app.
        setItems(rows.filter((item) => effectiveSchedule(item).status === 'red'));
        setFailed(false);
      })
      .catch((e) => {
        // Sem isso, uma consulta quebrada vira "nenhuma tarefa vencida" —
        // o pior tipo de erro, o que parece sucesso.
        setFailed(true);
        console.error('[alerts] falha ao carregar avisos de prazo', e);
      });
    return () => {
      alive = false;
    };
  }, [spaceId, reloadToken, echo]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unseen = useMemo(() => items.filter((i) => !seen.has(i.id)).length, [items, seen]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      // Abrir zera o contador — mas não some com os avisos.
      const ids = new Set(items.map((i) => i.id));
      setSeen(ids);
      writeSeen(spaceId, ids);
    }
  }

  const lateDays = (iso?: string | null) => {
    if (!iso) return 0;
    const due = new Date(iso);
    due.setHours(23, 59, 59, 999);
    return Math.max(1, Math.ceil((Date.now() - due.getTime()) / 86_400_000));
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="btn-ghost relative h-9 w-9 rounded-lg p-0"
        onClick={toggle}
        title={t('alerts.title')}
        aria-label={t('alerts.title')}
      >
        <Bell size={17} className={cn(items.length > 0 && 'text-red-500')} />
        {unseen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unseen > 99 ? '99+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[330px] overflow-hidden rounded-xl border border-line/10 bg-surface-overlay shadow-lift">
          <div className="flex items-center justify-between gap-2 border-b border-line/10 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('alerts.title')}
            </span>
            {items.length > 0 && (
              <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-bold text-red-500">
                {items.length}
              </span>
            )}
          </div>

          {failed ? (
            <p className="px-3 py-6 text-center text-sm text-red-500">{t('alerts.failed')}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">{t('alerts.empty')}</p>
          ) : (
            <div className="max-h-[min(420px,60vh)] overflow-y-auto">
              {items.map((item) => {
                const late = lateDays(item.due_at);
                return (
                  <div key={item.id} className="border-b border-line/5 last:border-0">
                    <button
                      onClick={() => {
                        setOpen(false);
                        onOpenItem(item);
                      }}
                      className="flex w-full items-start gap-2 px-3 pt-2.5 text-left transition hover:bg-line/5"
                    >
                      <CalendarClock size={15} className="mt-0.5 shrink-0 text-red-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className="block truncate text-[11px] text-ink-faint">
                          {item.boardName} · {item.columnTitle}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-red-500">
                          {t('alerts.overdueBy', { count: late })} ·{' '}
                          {item.due_at ? new Date(item.due_at).toLocaleDateString(locale) : ''}
                        </span>
                      </span>
                      <ChevronRight size={14} className="mt-1 shrink-0 text-ink-faint" />
                    </button>

                    {/* Resolver sem abrir o card: concluir ou remarcar o prazo */}
                    {canEdit && (
                      <div className="flex items-center gap-1.5 px-3 pb-2.5 pl-10">
                        <button
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                          onClick={() => resolve(item, { done_at: new Date().toISOString() })}
                          disabled={busyId === item.id}
                        >
                          <CheckCircle2 size={12} /> {t('alerts.markDone')}
                        </button>

                        {postponing === item.id ? (
                          <input
                            type="date"
                            autoFocus
                            className="field h-[26px] w-[140px] px-1.5 py-0 text-[11px]"
                            onBlur={() => setPostponing(null)}
                            onChange={(e) =>
                              e.target.value &&
                              resolve(item, { due_at: new Date(`${e.target.value}T12:00:00`).toISOString() })
                            }
                          />
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 rounded-md bg-line/10 px-2 py-1 text-[11px] font-semibold text-ink-soft transition hover:bg-line/20"
                            onClick={() => setPostponing(item.id)}
                            disabled={busyId === item.id}
                          >
                            <CalendarPlus size={12} /> {t('alerts.postpone')}
                          </button>
                        )}
                        {busyId === item.id && <Spinner />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="border-t border-line/10 px-3 py-2 text-[11px] leading-snug text-ink-faint">
            {t('alerts.hint')}
          </p>
        </div>
      )}
    </div>
  );
}
