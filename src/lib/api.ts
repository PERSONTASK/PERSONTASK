import { supabase, BUCKETS, APP_URL } from './supabase';
import type {
  AccessProfile,
  Attachment,
  Board,
  Column,
  Comment,
  CustomFieldDef,
  Invite,
  Item,
  ItemFieldValue,
  Label,
  Permission,
  Profile,
  Space,
  SpaceMember,
} from '@/types';

// Raw item row with embedded relations (before hydration with profile/label maps).
interface RawItem extends Omit<Item, 'assignees' | 'labels' | 'attachments' | 'comments'> {
  item_assignees?: { user_id: string }[];
  item_labels?: { label_id: string }[];
  item_field_values?: ItemFieldValue[];
  attachments?: { count: number }[];
  comments?: { count: number }[];
}

function embeddedCount(rel?: { count: number }[]): number {
  return rel?.[0]?.count ?? 0;
}

export const api = {
  // ── Espaços ───────────────────────────────────────────────────────────
  spaces: {
    async listMine(): Promise<(Space & { boardCount: number; memberCount: number })[]> {
      const { data, error } = await supabase
        .from('spaces')
        .select('*, boards(count), space_members(count)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        ...(s as Space),
        boardCount: embeddedCount(s.boards),
        memberCount: embeddedCount(s.space_members),
      }));
    },
    async get(id: string): Promise<Space> {
      const { data, error } = await supabase.from('spaces').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Space;
    },
    async create(input: { name: string; description?: string; owner_id: string }): Promise<Space> {
      // Inserir com return=minimal e reler em consulta separada.
      // O `.insert().select()` (return=representation) falha na criação do Espaço:
      // a policy de SELECT (is_space_member) não enxerga a própria linha recém-criada
      // dentro da mesma instrução (função STABLE + associação do dono criada por
      // trigger AFTER INSERT). A releitura numa consulta nova passa normalmente.
      const id = crypto.randomUUID();
      const { error } = await supabase.from('spaces').insert({
        id,
        name: input.name,
        description: input.description ?? '',
        owner_id: input.owner_id,
      });
      if (error) throw error;
      const { data, error: selErr } = await supabase.from('spaces').select('*').eq('id', id).single();
      if (selErr) throw selErr;
      return data as Space;
    },
    async update(id: string, patch: Partial<Space>): Promise<void> {
      const { error } = await supabase.from('spaces').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('spaces').delete().eq('id', id);
      if (error) throw error;
    },
    async links(spaceId: string): Promise<Space[]> {
      const { data, error } = await supabase
        .from('space_links')
        .select('linked:spaces!space_links_linked_space_id_fkey(*)')
        .eq('space_id', spaceId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.linked as Space);
    },
    async link(spaceId: string, linkedSpaceId: string): Promise<void> {
      const { error } = await supabase
        .from('space_links')
        .insert({ space_id: spaceId, linked_space_id: linkedSpaceId });
      if (error) throw error;
    },
  },

  // ── Membros & perfis de acesso ─────────────────────────────────────────
  members: {
    async list(spaceId: string): Promise<SpaceMember[]> {
      const { data, error } = await supabase
        .from('space_members')
        .select('*, profile:profiles(*), access_profile:access_profiles(*)')
        .eq('space_id', spaceId);
      if (error) throw error;
      return (data ?? []) as unknown as SpaceMember[];
    },
    async setAccessProfile(spaceId: string, userId: string, accessProfileId: string): Promise<void> {
      const { error } = await supabase
        .from('space_members')
        .update({ access_profile_id: accessProfileId })
        .eq('space_id', spaceId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    async remove(spaceId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', userId);
      if (error) throw error;
    },
  },

  accessProfiles: {
    async list(spaceId: string): Promise<AccessProfile[]> {
      const { data, error } = await supabase
        .from('access_profiles')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as AccessProfile[];
    },
    async create(spaceId: string, name: string, permissions: Permission[]): Promise<AccessProfile> {
      const { data, error } = await supabase
        .from('access_profiles')
        .insert({ space_id: spaceId, name, permissions })
        .select()
        .single();
      if (error) throw error;
      return data as AccessProfile;
    },
    async update(id: string, patch: Partial<AccessProfile>): Promise<void> {
      const { error } = await supabase.from('access_profiles').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('access_profiles').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // ── Convites ───────────────────────────────────────────────────────────
  invites: {
    async list(spaceId: string): Promise<Invite[]> {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('space_id', spaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
    async create(input: {
      spaceId: string;
      email: string;
      accessProfileId: string;
      invitedBy: string;
    }): Promise<Invite> {
      const { data, error } = await supabase
        .from('invites')
        .insert({
          space_id: input.spaceId,
          email: input.email.toLowerCase().trim(),
          access_profile_id: input.accessProfileId,
          invited_by: input.invitedBy,
        })
        .select()
        .single();
      if (error) throw error;
      // Dispara o e-mail de convite (Edge Function). Não bloqueia a UI se falhar.
      supabase.functions
        .invoke('send-invite', { body: { inviteId: (data as Invite).id, appUrl: APP_URL } })
        .catch(() => void 0);
      return data as Invite;
    },
    async revoke(id: string): Promise<void> {
      const { error } = await supabase.from('invites').update({ status: 'revoked' }).eq('id', id);
      if (error) throw error;
    },
  },

  // ── Painéis ────────────────────────────────────────────────────────────
  boards: {
    async list(spaceId: string): Promise<Board[]> {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('space_id', spaceId)
        .order('position');
      if (error) throw error;
      return (data ?? []) as Board[];
    },
    async create(spaceId: string, name: string, position: number): Promise<Board> {
      const { data, error } = await supabase
        .from('boards')
        .insert({ space_id: spaceId, name, position })
        .select()
        .single();
      if (error) throw error;
      return data as Board;
    },
    async rename(id: string, name: string): Promise<void> {
      const { error } = await supabase.from('boards').update({ name }).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('boards').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // ── Colunas ────────────────────────────────────────────────────────────
  columns: {
    async list(boardId: string): Promise<Column[]> {
      const { data, error } = await supabase
        .from('columns')
        .select('*')
        .eq('board_id', boardId)
        .order('position');
      if (error) throw error;
      return (data ?? []) as Column[];
    },
    async create(input: {
      boardId: string;
      spaceId: string;
      title: string;
      color: string;
      position: number;
    }): Promise<Column> {
      const { data, error } = await supabase
        .from('columns')
        .insert({
          board_id: input.boardId,
          space_id: input.spaceId,
          title: input.title,
          color: input.color,
          position: input.position,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Column;
    },
    async update(id: string, patch: Partial<Column>): Promise<void> {
      const { error } = await supabase.from('columns').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('columns').delete().eq('id', id);
      if (error) throw error;
    },
    async reorder(orderedIds: string[]): Promise<void> {
      await Promise.all(
        orderedIds.map((id, i) => supabase.from('columns').update({ position: i }).eq('id', id)),
      );
    },
  },

  // ── Itens ──────────────────────────────────────────────────────────────
  items: {
    async listByBoard(columnIds: string[]): Promise<RawItem[]> {
      if (columnIds.length === 0) return [];
      const { data, error } = await supabase
        .from('items')
        .select(
          `*,
           item_assignees(user_id),
           item_labels(label_id),
           item_field_values(*),
           attachments(count),
           comments(count)`,
        )
        .in('column_id', columnIds)
        .order('position');
      if (error) throw error;
      return (data ?? []) as unknown as RawItem[];
    },
    /** Hidrata assignees/labels/contagens usando mapas do Espaço. */
    hydrate(
      raw: RawItem,
      profileMap: Map<string, Profile>,
      labelMap: Map<string, Label>,
    ): Item {
      return {
        ...(raw as Item),
        assignees: (raw.item_assignees ?? [])
          .map((a) => profileMap.get(a.user_id))
          .filter(Boolean) as Profile[],
        labels: (raw.item_labels ?? [])
          .map((l) => labelMap.get(l.label_id))
          .filter(Boolean) as Label[],
        field_values: raw.item_field_values ?? [],
        attachments: Array.from({ length: embeddedCount(raw.attachments) }) as unknown as Attachment[],
        comments: Array.from({ length: embeddedCount(raw.comments) }) as unknown as Comment[],
      };
    },
    async getRaw(id: string): Promise<RawItem> {
      const { data, error } = await supabase
        .from('items')
        .select(`*, item_assignees(user_id), item_labels(label_id), item_field_values(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as RawItem;
    },
    /** Duplica um Item por completo (conteúdo, checklists, campos, etiquetas, responsáveis e anexos). */
    async duplicate(sourceId: string, createdBy: string): Promise<void> {
      const { data: src, error } = await supabase
        .from('items')
        .select('*, item_assignees(user_id), item_labels(label_id), item_field_values(field_def_id, value, show_on_face)')
        .eq('id', sourceId)
        .single();
      if (error) throw error;
      const s = src as any;
      const newId = crypto.randomUUID();

      const checklists = (s.checklists ?? []).map((cl: any) => ({
        id: crypto.randomUUID(),
        title: cl.title,
        items: (cl.items ?? []).map((it: any) => ({ id: crypto.randomUUID(), text: it.text, done: it.done })),
      }));

      const ins = await supabase.from('items').insert({
        id: newId,
        column_id: s.column_id,
        space_id: s.space_id,
        title: `${s.title} (cópia)`,
        description: s.description ?? '',
        checklists,
        position: (s.position ?? 0) + 0.5,
        due_at: s.due_at,
        created_by: createdBy,
      });
      if (ins.error) throw ins.error;

      const assignees = (s.item_assignees ?? []).map((a: any) => ({ item_id: newId, user_id: a.user_id }));
      if (assignees.length) await supabase.from('item_assignees').insert(assignees);

      const lbls = (s.item_labels ?? []).map((l: any) => ({ item_id: newId, label_id: l.label_id }));
      if (lbls.length) await supabase.from('item_labels').insert(lbls);

      const fvs = (s.item_field_values ?? []).map((v: any) => ({
        item_id: newId,
        field_def_id: v.field_def_id,
        value: v.value,
        show_on_face: v.show_on_face,
      }));
      if (fvs.length) await supabase.from('item_field_values').insert(fvs);

      // Anexos: copia o arquivo no Storage e cria um novo registro apontando para a cópia.
      const { data: atts } = await supabase.from('attachments').select('*').eq('item_id', sourceId);
      for (const a of atts ?? []) {
        const newPath = `${s.space_id}/${newId}/${crypto.randomUUID()}-${a.file_name}`;
        const cp = await supabase.storage.from(BUCKETS.attachments).copy(a.storage_path, newPath);
        if (!cp.error) {
          await supabase.from('attachments').insert({
            item_id: newId,
            space_id: s.space_id,
            storage_path: newPath,
            file_name: a.file_name,
            mime_type: a.mime_type,
            size_bytes: a.size_bytes,
            uploaded_by: createdBy,
          });
        }
      }
    },
    async create(input: {
      columnId: string;
      spaceId: string;
      title: string;
      position: number;
      createdBy: string;
    }): Promise<Item> {
      const { data, error } = await supabase
        .from('items')
        .insert({
          column_id: input.columnId,
          space_id: input.spaceId,
          title: input.title,
          position: input.position,
          created_by: input.createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Item;
    },
    async update(id: string, patch: Partial<Item>): Promise<void> {
      const clean: Record<string, unknown> = { ...patch };
      delete clean.assignees;
      delete clean.labels;
      delete clean.field_values;
      delete clean.attachments;
      delete clean.comments;
      const { error } = await supabase.from('items').update(clean).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
    },
    async setColumn(id: string, columnId: string, position: number): Promise<void> {
      const { error } = await supabase.from('items').update({ column_id: columnId, position }).eq('id', id);
      if (error) throw error;
    },
    async reorder(orderedIds: string[]): Promise<void> {
      await Promise.all(
        orderedIds.map((id, i) => supabase.from('items').update({ position: i }).eq('id', id)),
      );
    },
    async setAssignees(itemId: string, userIds: string[]): Promise<void> {
      await supabase.from('item_assignees').delete().eq('item_id', itemId);
      if (userIds.length) {
        const { error } = await supabase
          .from('item_assignees')
          .insert(userIds.map((user_id) => ({ item_id: itemId, user_id })));
        if (error) throw error;
      }
      // Notifica novos responsáveis (Edge Function; não bloqueia a UI).
      if (userIds.length) {
        supabase.functions
          .invoke('notify-item-assigned', { body: { itemId, userIds } })
          .catch(() => void 0);
      }
    },
    async setLabels(itemId: string, labelIds: string[]): Promise<void> {
      await supabase.from('item_labels').delete().eq('item_id', itemId);
      if (labelIds.length) {
        const { error } = await supabase
          .from('item_labels')
          .insert(labelIds.map((label_id) => ({ item_id: itemId, label_id })));
        if (error) throw error;
      }
    },
  },

  // ── Etiquetas ──────────────────────────────────────────────────────────
  labels: {
    async list(spaceId: string): Promise<Label[]> {
      const { data, error } = await supabase.from('labels').select('*').eq('space_id', spaceId);
      if (error) throw error;
      return (data ?? []) as Label[];
    },
    async create(spaceId: string, name: string, color: string): Promise<Label> {
      const { data, error } = await supabase
        .from('labels')
        .insert({ space_id: spaceId, name, color })
        .select()
        .single();
      if (error) throw error;
      return data as Label;
    },
    async update(id: string, patch: Partial<Label>): Promise<void> {
      const { error } = await supabase.from('labels').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('labels').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // ── Campos personalizados ──────────────────────────────────────────────
  fields: {
    async listDefs(spaceId: string): Promise<CustomFieldDef[]> {
      const { data, error } = await supabase
        .from('custom_field_defs')
        .select('*')
        .eq('space_id', spaceId)
        .order('position');
      if (error) throw error;
      return (data ?? []) as CustomFieldDef[];
    },
    async createDef(input: Omit<CustomFieldDef, 'id'>): Promise<CustomFieldDef> {
      const { data, error } = await supabase.from('custom_field_defs').insert(input).select().single();
      if (error) throw error;
      return data as CustomFieldDef;
    },
    async updateDef(id: string, patch: Partial<CustomFieldDef>): Promise<void> {
      const { error } = await supabase.from('custom_field_defs').update(patch).eq('id', id);
      if (error) throw error;
    },
    async removeDef(id: string): Promise<void> {
      const { error } = await supabase.from('custom_field_defs').delete().eq('id', id);
      if (error) throw error;
    },
    async values(itemId: string): Promise<ItemFieldValue[]> {
      const { data, error } = await supabase
        .from('item_field_values')
        .select('*')
        .eq('item_id', itemId);
      if (error) throw error;
      return (data ?? []) as ItemFieldValue[];
    },
    async setValue(input: {
      itemId: string;
      fieldDefId: string;
      value: unknown;
      showOnFace: boolean;
    }): Promise<void> {
      const { error } = await supabase.from('item_field_values').upsert(
        {
          item_id: input.itemId,
          field_def_id: input.fieldDefId,
          value: input.value,
          show_on_face: input.showOnFace,
        },
        { onConflict: 'item_id,field_def_id' },
      );
      if (error) throw error;
    },
  },

  // ── Anexos ─────────────────────────────────────────────────────────────
  attachments: {
    async list(itemId: string): Promise<Attachment[]> {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as Attachment[];
    },
    async upload(input: {
      spaceId: string;
      itemId: string;
      file: File;
      uploadedBy: string;
    }): Promise<Attachment> {
      const path = `${input.spaceId}/${input.itemId}/${crypto.randomUUID()}-${input.file.name}`;
      const up = await supabase.storage.from(BUCKETS.attachments).upload(path, input.file, {
        contentType: input.file.type,
        upsert: false,
      });
      if (up.error) throw up.error;
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          item_id: input.itemId,
          space_id: input.spaceId,
          storage_path: path,
          file_name: input.file.name,
          mime_type: input.file.type,
          size_bytes: input.file.size,
          uploaded_by: input.uploadedBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Attachment;
    },
    async signedUrl(path: string): Promise<string> {
      const { data, error } = await supabase.storage
        .from(BUCKETS.attachments)
        .createSignedUrl(path, 60 * 10);
      if (error) throw error;
      return data.signedUrl;
    },
    async remove(att: Attachment): Promise<void> {
      await supabase.storage.from(BUCKETS.attachments).remove([att.storage_path]);
      const { error } = await supabase.from('attachments').delete().eq('id', att.id);
      if (error) throw error;
    },
  },

  // ── Comentários & menções ──────────────────────────────────────────────
  comments: {
    async list(itemId: string): Promise<Comment[]> {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(*)')
        .eq('item_id', itemId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as Comment[];
    },
    async create(input: {
      itemId: string;
      spaceId: string;
      authorId: string;
      body: string;
      mentionUserIds: string[];
    }): Promise<Comment> {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          item_id: input.itemId,
          space_id: input.spaceId,
          author_id: input.authorId,
          body: input.body,
        })
        .select('*, author:profiles!comments_author_id_fkey(*)')
        .single();
      if (error) throw error;
      const comment = data as unknown as Comment;
      if (input.mentionUserIds.length) {
        await supabase
          .from('comment_mentions')
          .insert(input.mentionUserIds.map((uid) => ({ comment_id: comment.id, mentioned_user_id: uid })));
        supabase.functions
          .invoke('notify-mention', { body: { commentId: comment.id } })
          .catch(() => void 0);
      }
      return comment;
    },
  },

  // ── Storage (fundos/logos de Espaço e avatares) ────────────────────────
  storage: {
    async uploadSpaceAsset(spaceId: string, file: File): Promise<string> {
      const path = `${spaceId}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from(BUCKETS.spaceBackgrounds).upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (up.error) throw up.error;
      return supabase.storage.from(BUCKETS.spaceBackgrounds).getPublicUrl(path).data.publicUrl;
    },
    async uploadAvatar(userId: string, file: File): Promise<string> {
      const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from(BUCKETS.avatars).upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (up.error) throw up.error;
      return supabase.storage.from(BUCKETS.avatars).getPublicUrl(path).data.publicUrl;
    },
  },

  // ── "Meus Itens e Colunas" (perfil pessoal) ────────────────────────────
  me: {
    async items(userId: string): Promise<{ id: string; title: string; space_id: string; due_at: string | null }[]> {
      const { data, error } = await supabase
        .from('item_assignees')
        .select('item:items(id, title, space_id, due_at)')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.item).filter(Boolean);
    },
    async columns(userId: string): Promise<{ id: string; title: string; space_id: string }[]> {
      const { data, error } = await supabase
        .from('column_assignees')
        .select('column:columns(id, title, space_id)')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.column).filter(Boolean);
    },
  },
};
