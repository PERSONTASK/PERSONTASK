import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { api } from '@/lib/api';
import { APP_URL } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Space } from '@/types';

export function CreateSpaceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (space: Space) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || !user) return;
    setBusy(true);
    try {
      const space = await api.spaces.create({ name: name.trim(), description, owner_id: user.id });
      // Semeia o card de boas-vindas ("ESTÁ PERDIDO?! COMECE POR AQUI") no idioma
      // atual. Não bloqueia a criação do Espaço caso a semeadura falhe.
      try {
        await api.spaces.seedWelcome({
          spaceId: space.id,
          ownerId: user.id,
          boardName: t('welcome.boardName'),
          columnTitle: t('welcome.columnTitle'),
          cardTitle: t('welcome.cardTitle'),
          cardBody: t('welcome.cardBody', {
            url: `${APP_URL}/manual.html`,
            pdf: `${APP_URL}/PERSONTASK-Manual.pdf`,
          }),
        });
      } catch {
        /* segue mesmo se a semeadura falhar */
      }
      setName('');
      setDescription('');
      onCreated(space);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('space.create')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? <Spinner /> : t('common.create')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">{t('space.name')}</label>
          <input
            className="field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('space.namePlaceholder')}
            autoFocus
          />
        </div>
        <div>
          <label className="label">
            {t('space.description')} <span className="text-ink-faint">({t('common.optional')})</span>
          </label>
          <textarea
            className="field mt-1 min-h-[72px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
