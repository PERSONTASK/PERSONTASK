import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, Download, Trash2, File, FileText, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import type { Attachment } from '@/types';
import { api } from '@/lib/api';
import { ACCEPTED_UPLOAD, MAX_UPLOAD_BYTES, cn, fileKind, formatBytes } from '@/lib/utils';
import { Spinner } from '@/components/Spinner';

const KIND_STYLE: Record<string, { color: string; bg: string }> = {
  pdf: { color: '#EF4444', bg: 'rgba(239,68,68,.12)' },
  sheet: { color: '#10B981', bg: 'rgba(16,185,129,.12)' },
  doc: { color: '#3B82F6', bg: 'rgba(59,130,246,.12)' },
  slides: { color: '#F97316', bg: 'rgba(249,115,22,.12)' },
  image: { color: '#8B5CF6', bg: 'rgba(139,92,246,.12)' },
  other: { color: '#6366F1', bg: 'rgba(99,102,241,.12)' },
};

function KindIcon({ kind }: { kind: string }) {
  const p = { size: 16, style: { color: KIND_STYLE[kind].color } };
  if (kind === 'sheet') return <FileSpreadsheet {...p} />;
  if (kind === 'image') return <ImageIcon {...p} />;
  if (kind === 'doc' || kind === 'pdf' || kind === 'slides') return <FileText {...p} />;
  return <File {...p} />;
}

export function AttachmentsEditor({
  attachments,
  canEdit,
  onUpload,
  onRemove,
}: {
  attachments: Attachment[];
  canEdit: boolean;
  onUpload: (files: FileList) => Promise<void>;
  onRemove: (att: Attachment) => void;
}) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handle(files: FileList | null) {
    if (!files || !files.length) return;
    setError('');
    for (const f of Array.from(files)) {
      if (f.size > MAX_UPLOAD_BYTES) {
        setError(`"${f.name}" > ${formatBytes(MAX_UPLOAD_BYTES)}`);
        return;
      }
    }
    setBusy(true);
    try {
      await onUpload(files);
    } catch (e) {
      // Sem este catch o erro virava "unhandled rejection": o círculo
      // parava e nada era dito, deixando a pessoa sem saber o que houve.
      console.error('[anexo] falha ao enviar', e);
      setError(e instanceof Error ? e.message : t('item.uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (canEdit) handle(e.dataTransfer.files);
  }

  async function download(att: Attachment) {
    const url = await api.attachments.signedUrl(att.storage_path);
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center transition',
            drag ? 'border-brand-indigo bg-brand-indigo/10' : 'border-line/15 hover:border-brand-indigo/50',
          )}
        >
          <input
            type="file"
            multiple
            accept={ACCEPTED_UPLOAD}
            className="hidden"
            onChange={(e) => handle(e.target.files)}
          />
          {busy ? <Spinner className="text-brand-indigo" /> : <UploadCloud size={24} className="text-ink-faint" />}
          <span className="text-sm text-ink-soft">
            <span className="font-semibold text-brand-indigo">{t('item.dropFiles')}</span>
          </span>
          <span className="text-xs text-ink-faint">{t('item.uploadHint')}</span>
        </label>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {attachments.length === 0 ? (
        <p className="text-xs text-ink-faint">{t('item.noAttachments')}</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((a) => {
            const kind = fileKind(a.file_name);
            return (
              <li
                key={a.id}
                className="flex items-center gap-2.5 rounded-lg border border-line/10 bg-surface-raised p-2"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ background: KIND_STYLE[kind].bg }}
                >
                  <KindIcon kind={kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.file_name}</p>
                  <p className="text-xs text-ink-faint">{formatBytes(a.size_bytes)}</p>
                </div>
                <button
                  className="btn-ghost h-7 w-7 rounded-md p-0"
                  onClick={() => download(a)}
                  title="Download"
                >
                  <Download size={14} />
                </button>
                {canEdit && (
                  <button
                    className="btn-ghost h-7 w-7 rounded-md p-0 hover:text-red-500"
                    onClick={() => onRemove(a)}
                    title={t('common.remove')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
