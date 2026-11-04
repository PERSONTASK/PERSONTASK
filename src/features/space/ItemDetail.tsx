import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2, Users, Tag, Calendar, CalendarRange, ListChecks, Paperclip, MessageSquare, CheckSquare, Save, Copy, ExternalLink, ArrowRightLeft, Building2, CheckCircle2, Circle,
} from 'lucide-react';
import type { Attachment, Board, Column, Comment, FieldType, Item, ItemFieldValue, Space } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
import { Modal, SidePanel } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import { AssigneePicker } from './AssigneePicker';
import { LabelPicker } from './LabelPicker';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { AttachmentsEditor } from './AttachmentsEditor';
import { CommentsThread } from './CommentsThread';
import { ChecklistsEditor } from './ChecklistsEditor';
import { AddToCardMenu, type AddOption } from './AddToCardMenu';
import { ClientSection } from './ClientSection';
import { ScheduleSection } from './ScheduleSection';

function Section({ id, icon, title, children }: { id?: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-2 scroll-mt-4">
      <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {icon} {title}
      </h4>
      {children}
    </section>
  );
}

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

/** Extrai URLs (http/https) do texto para exibir como links clicáveis. */
function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>()"']+/g) ?? [];
  const cleaned = matches.map((u) => u.replace(/[.,;:!?]+$/, ''));
  return Array.from(new Set(cleaned));
}

const NEW_FIELD_TYPES: FieldType[] = ['text', 'number', 'datetime', 'checkbox', 'select'];

export function ItemDetail({
  itemId,
  onClose,
  onChanged,
}: {
  itemId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.split('-')[0] || 'pt';
  const { user } = useAuth();
  const { space, members, labels, fieldDefs, profileMap, labelMap, can, reloadLabels, reloadFields } = useSpace();

  const [item, setItem] = useState<Item | null>(null);
  const [values, setValues] = useState<ItemFieldValue[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [newField, setNewField] = useState<{ name: string; type: FieldType } | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [linkedSpaces, setLinkedSpaces] = useState<Space[]>([]);

  const canEdit = can('item.edit');
  const canManageFields = can('field.manage');
  const isSpaceAdmin = can('space.manage');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const raw = await api.items.getRaw(itemId);
      const hydrated = api.items.hydrate(raw, profileMap, labelMap);
      const [atts, cmts] = await Promise.all([api.attachments.list(itemId), api.comments.list(itemId)]);
      if (!active) return;
      setItem(hydrated);
      setValues(raw.item_field_values ?? []);
      setAttachments(atts);
      setComments(cmts);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Espaços interligados (para mover/copiar itens) — só carrega para admin.
  useEffect(() => {
    if (isSpaceAdmin && space) api.spaces.links(space.id).then(setLinkedSpaces).catch(() => void 0);
  }, [isSpaceAdmin, space]);

  const valueMap = useMemo(() => {
    const m = new Map<string, ItemFieldValue>();
    values.forEach((v) => m.set(v.field_def_id, v));
    return m;
  }, [values]);

  if (!space) return null;

  // ── Mutations ───────────────────────────────────────────────────────────
  /**
   * Atualiza a tela na hora e grava em seguida. Se a gravação falhar,
   * **desfaz** a mudança otimista — senão a tela mostra um estado que o
   * banco não tem (foi o que aconteceu quando `done_at` ainda não existia:
   * o botão ficava verde e nada era gravado).
   */
  async function patch(p: Partial<Item>) {
    if (!item) return;
    const previous = item;
    setItem({ ...item, ...p });
    try {
      await api.items.update(item.id, p);
      onChanged();
    } catch (e) {
      setItem(previous);
      console.error('[item] não consegui gravar a alteração', e);
      alert(t('item.saveFailed'));
    }
  }

  async function toggleAssignee(uid: string) {
    if (!item) return;
    const current = (item.assignees ?? []).map((a) => a.id);
    const next = current.includes(uid) ? current.filter((x) => x !== uid) : [...current, uid];
    setItem({ ...item, assignees: next.map((id) => profileMap.get(id)!).filter(Boolean) });
    await api.items.setAssignees(item.id, next);
    onChanged();
  }

  async function toggleLabel(lid: string) {
    if (!item) return;
    const current = (item.labels ?? []).map((l) => l.id);
    const next = current.includes(lid) ? current.filter((x) => x !== lid) : [...current, lid];
    setItem({ ...item, labels: next.map((id) => labelMap.get(id)!).filter(Boolean) });
    await api.items.setLabels(item.id, next);
    onChanged();
  }

  async function createLabel(name: string, color: string) {
    const label = await api.labels.create(space!.id, name, color);
    await reloadLabels();
    await toggleLabel(label.id);
  }

  async function setField(defId: string, value: unknown, showOnFace: boolean) {
    if (!item) return;
    await api.fields.setValue({ itemId: item.id, fieldDefId: defId, value, showOnFace });
    setValues((prev) => {
      const rest = prev.filter((v) => v.field_def_id !== defId);
      return [
        ...rest,
        { id: `${item.id}:${defId}`, item_id: item.id, field_def_id: defId, value: value as never, show_on_face: showOnFace },
      ];
    });
    onChanged();
  }

  async function createFieldDef() {
    if (!newField?.name.trim()) return;
    await api.fields.createDef({
      space_id: space!.id,
      name: newField.name.trim(),
      type: newField.type,
      config: newField.type === 'select' ? { options: [] } : {},
      show_on_face_default: false,
      position: fieldDefs.length,
    });
    await reloadFields();
    setNewField(null);
  }

  async function deleteFieldDef(defId: string) {
    const def = fieldDefs.find((d) => d.id === defId);
    if (!confirm(t('fields.deleteConfirm', { name: def?.name ?? '' }))) return;
    await api.fields.removeDef(defId);
    setValues((prev) => prev.filter((v) => v.field_def_id !== defId));
    await reloadFields();
  }

  async function uploadFiles(files: FileList) {
    if (!item || !user) return;
    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      uploaded.push(await api.attachments.upload({ spaceId: space!.id, itemId: item.id, file, uploadedBy: user.id }));
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    onChanged();
  }

  async function removeAttachment(att: Attachment) {
    await api.attachments.remove(att);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    onChanged();
  }

  async function sendComment(body: string, mentionIds: string[]) {
    if (!item || !user) return;
    const c = await api.comments.create({
      itemId: item.id,
      spaceId: space!.id,
      authorId: user.id,
      body,
      mentionUserIds: mentionIds,
    });
    setComments((prev) => [...prev, c]);
    onChanged();
  }

  async function deleteItem() {
    if (!item || !confirm(t('item.deleteConfirm'))) return;
    await api.items.remove(item.id);
    onChanged();
    onClose();
  }

  async function duplicateItem() {
    if (!item || !user) return;
    setDuplicating(true);
    try {
      await api.items.duplicate(item.id, user.id);
      onChanged();
      onClose();
    } finally {
      setDuplicating(false);
    }
  }

  function addChecklist() {
    if (!item) return;
    patch({ checklists: [...item.checklists, { id: crypto.randomUUID(), title: t('checklist.title'), items: [] }] });
  }

  function scrollToSection(id: string) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  }

  function onAdd(o: AddOption) {
    const key = o === 'members' ? 'members' : o;
    setRevealed((s) => new Set(s).add(key));
    if (o === 'checklist') addChecklist();
    if (o === 'field') setNewField({ name: '', type: 'text' });
    scrollToSection(`sec-${key}`);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 150)); // deixa o onBlur pendente (título/descrição) gravar
    setSaving(false);
    onChanged();
    onClose();
  }

  // Uma seção aparece se já tem conteúdo OU foi adicionada pelo menu "+ Adicionar".
  const has = (v: number) => v > 0;
  const show = {
    client: !!item && (!!item.organization_id || !!item.contact_id || revealed.has('client')),
    schedule:
      !!item &&
      // Cards cujo cronograma mora só nas tarefas internas (template,
      // duplicata, importação) não têm os campos avulsos preenchidos —
      // por isso as tarefas também contam para revelar a seção.
      (has((item.schedule_tasks ?? []).length) ||
        !!item.start_at ||
        item.progress != null ||
        item.work_hours != null ||
        item.cost != null ||
        revealed.has('schedule')),
    members: !!item && (has((item.assignees ?? []).length) || revealed.has('members')),
    dates: !!item && (!!item.due_at || revealed.has('dates')),
    fields: fieldDefs.length > 0 || revealed.has('field'),
    attachment: attachments.length > 0 || revealed.has('attachment'),
    checklist: !!item && (has(item.checklists.length) || revealed.has('checklist')),
  };

  return (
    <SidePanel
      open
      onClose={onClose}
      title={loading ? t('common.loading') : t('item.editTitle')}
      footer={
        item ? (
          <>
            {can('item.delete') && (
              <button className="btn-danger" onClick={deleteItem}>
                <Trash2 size={15} /> {t('item.deleteItem')}
              </button>
            )}
            <div className="flex-1" />
            {can('item.create') && (
              <button className="btn-secondary" onClick={duplicateItem} disabled={duplicating}>
                {duplicating ? <Spinner /> : <Copy size={15} />} {t('item.duplicate')}
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>
              {t('common.close')}
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner /> : <Save size={15} />} {t('common.save')}
            </button>
          </>
        ) : undefined
      }
    >
      {loading || !item ? (
        <div className="flex justify-center py-20 text-brand-indigo">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Title */}
          <input
            className="w-full rounded-lg bg-transparent text-lg font-bold outline-none focus:bg-surface-raised focus:px-2 focus:py-1"
            defaultValue={item.title}
            disabled={!canEdit}
            onBlur={(e) => e.target.value.trim() && e.target.value !== item.title && patch({ title: e.target.value.trim() })}
          />

          {/* Concluir: deixa o card verde e cala o aviso de prazo, mesmo vencido */}
          {canEdit && (
            <button
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition sm:w-auto',
                item.done_at
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400'
                  : 'border-line/15 text-ink-soft hover:border-emerald-500/40 hover:text-emerald-600',
              )}
              title={item.done_at ? t('item.reopenHint') : t('item.doneHint')}
              onClick={() => patch({ done_at: item.done_at ? null : new Date().toISOString() })}
            >
              {item.done_at ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              {item.done_at
                ? `${t('item.doneOn')} ${new Date(item.done_at).toLocaleDateString(locale)}`
                : t('item.markDone')}
            </button>
          )}

          {/* + Adicionar */}
          {canEdit && (
            <div className="flex">
              <AddToCardMenu canManageFields={canManageFields} onSelect={onAdd} />
            </div>
          )}

          {/* Mover/copiar para Espaço interligado — só Administrador, e só se houver Espaços interligados */}
          {isSpaceAdmin && linkedSpaces.length > 0 && (
            <button className="btn-secondary w-full sm:w-auto" onClick={() => setMoveOpen(true)}>
              <ArrowRightLeft size={15} /> {t('item.moveToSpace')}
            </button>
          )}

          {/* Cliente (CRM): organização e pessoa de contato vindas dos cadastros */}
          {show.client && (
            <Section id="sec-client" icon={<Building2 size={13} />} title={t('crm.section')}>
              <ClientSection
                spaceId={space.id}
                userId={user?.id ?? ''}
                organizationId={item.organization_id ?? null}
                contactId={item.contact_id ?? null}
                canEdit={canEdit}
                onChange={(p) => patch(p)}
              />
            </Section>
          )}

          {/* Description */}
          <Section icon={<MessageSquare size={13} />} title={t('item.description')}>
            <textarea
              className="field min-h-[80px] resize-y"
              defaultValue={item.description}
              disabled={!canEdit}
              placeholder={t('item.titlePlaceholder')}
              onBlur={(e) => e.target.value !== item.description && patch({ description: e.target.value })}
            />
            {extractUrls(item.description).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {extractUrls(item.description).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-brand-indigo/10 px-2.5 py-1 text-xs font-medium text-brand-indigo transition hover:bg-brand-indigo/20"
                  >
                    <ExternalLink size={12} className="shrink-0" />
                    <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                  </a>
                ))}
              </div>
            )}
          </Section>

          {/* Etiquetas — sempre visível (acesso direto, fora do menu + Adicionar) */}
          <Section icon={<Tag size={13} />} title={t('item.labels')}>
            <LabelPicker
              labels={labels}
              selectedIds={(item.labels ?? []).map((l) => l.id)}
              canManage={can('label.manage')}
              disabled={!canEdit}
              onToggle={toggleLabel}
              onCreate={createLabel}
            />
          </Section>

          {show.members && (
            <Section id="sec-members" icon={<Users size={13} />} title={t('item.assignees')}>
              <AssigneePicker
                members={members}
                selectedIds={(item.assignees ?? []).map((a) => a.id)}
                disabled={!canEdit}
                onToggle={toggleAssignee}
              />
            </Section>
          )}

          {show.schedule && (
            <Section id="sec-schedule" icon={<CalendarRange size={13} />} title={t('schedule.section')}>
              <ScheduleSection
                item={item}
                canEdit={canEdit}
                userId={user?.id ?? ''}
                onChange={(p) => patch(p)}
              />
            </Section>
          )}

          {show.dates && (
            <Section id="sec-dates" icon={<Calendar size={13} />} title={t('item.dueDate')}>
              <input
                type="date"
                className="field max-w-[220px]"
                disabled={!canEdit}
                value={toDateInput(item.due_at)}
                onChange={(e) => patch({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </Section>
          )}

          {show.checklist && (
            <Section id="sec-checklist" icon={<CheckSquare size={13} />} title={t('checklist.section')}>
              <ChecklistsEditor
                checklists={item.checklists}
                disabled={!canEdit}
                onChange={(next) => patch({ checklists: next })}
              />
              {canEdit && (
                <button className="btn-secondary mt-1" onClick={addChecklist}>
                  <CheckSquare size={14} /> {t('checklist.add')}
                </button>
              )}
            </Section>
          )}

          {show.fields && (
            <Section id="sec-field" icon={<ListChecks size={13} />} title={t('item.customFields')}>
              <CustomFieldsEditor
                fieldDefs={fieldDefs}
                valueMap={valueMap}
                disabled={!canEdit}
                onChange={setField}
                onDelete={canManageFields ? deleteFieldDef : undefined}
              />
              {newField && (
                <div className="mt-2 flex items-end gap-2 rounded-lg border border-dashed border-line/15 p-2">
                  <div className="flex-1">
                    <label className="label">{t('fields.fieldName')}</label>
                    <input
                      className="field mt-1 py-1.5"
                      autoFocus
                      value={newField.name}
                      onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && createFieldDef()}
                    />
                  </div>
                  <select
                    className="field w-32 py-1.5"
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}
                  >
                    {NEW_FIELD_TYPES.map((ty) => (
                      <option key={ty} value={ty}>
                        {t(`fields.${ty}`)}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary px-3 py-1.5" onClick={createFieldDef} disabled={!newField.name.trim()}>
                    {t('common.add')}
                  </button>
                  <button className="btn-ghost px-2 py-1.5" onClick={() => setNewField(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </Section>
          )}

          {show.attachment && (
            <Section id="sec-attachment" icon={<Paperclip size={13} />} title={t('item.attachments')}>
              <AttachmentsEditor
                attachments={attachments}
                canEdit={canEdit}
                onUpload={uploadFiles}
                onRemove={removeAttachment}
              />
            </Section>
          )}

          {/* Comments */}
          <Section icon={<MessageSquare size={13} />} title={t('item.comments')}>
            <CommentsThread
              comments={comments}
              members={members}
              canComment={can('comment.create')}
              locale={locale}
              onSend={sendComment}
            />
          </Section>
        </div>
      )}
      {moveOpen && item && user && (
        <MoveCopyDialog
          item={item}
          linkedSpaces={linkedSpaces}
          createdBy={user.id}
          keepDefault={space?.keep_on_migrate ?? true}
          onClose={() => setMoveOpen(false)}
          onDone={(mode) => {
            setMoveOpen(false);
            onChanged();
            if (mode === 'move') onClose();
          }}
        />
      )}
    </SidePanel>
  );
}

function MoveCopyDialog({
  item,
  linkedSpaces,
  createdBy,
  keepDefault,
  onClose,
  onDone,
}: {
  item: Item;
  linkedSpaces: Space[];
  createdBy: string;
  /** Padrão do Espaço para "manter o card aqui". */
  keepDefault: boolean;
  onClose: () => void;
  onDone: (mode: 'copy' | 'move') => void;
}) {
  const { t } = useTranslation();
  const [spaceId, setSpaceId] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnId, setColumnId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /**
   * Manter o card no Espaço de origem. Vem do padrão do Espaço porque
   * tirar o card daqui mexe nos relatórios e no histórico — mas dá para
   * mudar na hora.
   */
  const [keep, setKeep] = useState(keepDefault);

  useEffect(() => {
    if (!spaceId) {
      setBoards([]);
      setBoardId('');
      return;
    }
    api.boards
      .list(spaceId)
      .then((bs) => {
        setBoards(bs);
        setBoardId(bs[0]?.id ?? '');
      })
      .catch(() => setBoards([]));
  }, [spaceId]);

  useEffect(() => {
    if (!boardId) {
      setColumns([]);
      setColumnId('');
      return;
    }
    api.columns
      .list(boardId)
      .then((cs) => {
        setColumns(cs);
        setColumnId(cs[0]?.id ?? '');
      })
      .catch(() => setColumns([]));
  }, [boardId]);

  async function run(mode: 'copy' | 'move') {
    if (!columnId) return;
    setBusy(true);
    setError('');
    try {
      const input = { sourceId: item.id, targetSpaceId: spaceId, targetColumnId: columnId, createdBy };
      if (mode === 'copy') await api.items.copyToSpace(input);
      else await api.items.moveToSpace(input);
      onDone(mode);
    } catch {
      setError(t('errors.permission'));
    } finally {
      setBusy(false);
    }
  }

  const ready = !!spaceId && !!boardId && !!columnId && !busy;

  return (
    <Modal
      open
      onClose={onClose}
      title={t('item.moveCopyTitle')}
      width={430}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={() => run(keep ? 'copy' : 'move')} disabled={!ready}>
            {busy ? <Spinner /> : keep ? <Copy size={15} /> : <ArrowRightLeft size={15} />}{' '}
            {t('item.migrateAction')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t('item.moveCopyHint')}</p>
        <div>
          <label className="label">{t('item.targetSpace')}</label>
          <select className="field mt-1" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">—</option>
            {linkedSpaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {spaceId && (
          <div>
            <label className="label">{t('item.targetBoard')}</label>
            {boards.length > 0 ? (
              <select className="field mt-1" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-xs text-ink-faint">{t('item.targetEmpty')}</p>
            )}
          </div>
        )}
        {boardId && columns.length > 0 && (
          <div>
            <label className="label">{t('item.targetColumn')}</label>
            <select className="field mt-1" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* O que acontece com o card AQUI — a escolha que mexe no histórico */}
        <fieldset className="rounded-xl border border-line/15 p-3">
          <legend className="label px-1">{t('item.originTitle')}</legend>
          <div className="space-y-2">
            {[true, false].map((value) => (
              <label
                key={String(value)}
                className={cn(
                  'flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition',
                  keep === value
                    ? 'border-brand-indigo/50 bg-brand-indigo/5'
                    : 'border-transparent hover:bg-line/5',
                )}
              >
                <input
                  type="radio"
                  name="migrate-origin"
                  className="mt-0.5 accent-brand-indigo"
                  checked={keep === value}
                  onChange={() => setKeep(value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {value ? t('item.keepHere') : t('item.removeHere')}
                  </span>
                  <span className="block text-[11px] leading-snug text-ink-soft">
                    {value ? t('item.keepHereHint') : t('item.removeHereHint')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <span>ℹ️</span>
          <span>{t('item.moveCopyNote')}</span>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
