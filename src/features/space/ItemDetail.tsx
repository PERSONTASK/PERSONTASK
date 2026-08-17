import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2, Users, Tag, Calendar, ListChecks, Paperclip, MessageSquare, CheckSquare, Save, Copy,
} from 'lucide-react';
import type { Attachment, Comment, FieldType, Item, ItemFieldValue } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpace } from '@/contexts/SpaceContext';
import { SidePanel } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { AssigneePicker } from './AssigneePicker';
import { LabelPicker } from './LabelPicker';
import { CustomFieldsEditor } from './CustomFieldsEditor';
import { AttachmentsEditor } from './AttachmentsEditor';
import { CommentsThread } from './CommentsThread';
import { ChecklistsEditor } from './ChecklistsEditor';
import { AddToCardMenu, type AddOption } from './AddToCardMenu';

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

  const canEdit = can('item.edit');
  const canManageFields = can('field.manage');

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

  const valueMap = useMemo(() => {
    const m = new Map<string, ItemFieldValue>();
    values.forEach((v) => m.set(v.field_def_id, v));
    return m;
  }, [values]);

  if (!space) return null;

  // ── Mutations ───────────────────────────────────────────────────────────
  async function patch(p: Partial<Item>) {
    if (!item) return;
    setItem({ ...item, ...p });
    await api.items.update(item.id, p);
    onChanged();
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

          {/* + Adicionar */}
          {canEdit && (
            <div className="flex">
              <AddToCardMenu canManageFields={canManageFields} onSelect={onAdd} />
            </div>
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
    </SidePanel>
  );
}
