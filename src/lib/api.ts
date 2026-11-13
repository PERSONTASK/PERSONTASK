import { supabase, BUCKETS, APP_URL } from './supabase';
import type {
  AccessProfile,
  Attachment,
  Board,
  Column,
  Comment,
  Contact,
  CustomFieldDef,
  Invite,
  Item,
  ItemFieldValue,
  Label,
  Organization,
  Permission,
  Profile,
  ReportConfig,
  Resource,
  ScheduleTask,
  Space,
  SpaceMember,
} from '@/types';
import type { TemplateDef } from './templates';
import { autoSchedule, DEFAULT_CALENDAR, nextWorkday, rollupTasks } from './schedule';

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

/**
 * Nome seguro para a CHAVE do arquivo no Storage do Supabase.
 *
 * Ele aceita só um conjunto restrito de caracteres: acento, espaço e
 * símbolo são recusados com `Invalid key` — e nome de arquivo em
 * português quase sempre tem ("Tela de reunião_TOTVS Gestão.png").
 *
 * O nome original continua em `attachments.file_name`, que é o que a
 * pessoa vê na lista; isto aqui só limpa o caminho interno.
 */
function storageSafeName(name: string): string {
  const semAcento = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const limpo = semAcento
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  // Corta pela frente, para a extensão (que fica no fim) sobreviver.
  return limpo.slice(-120) || 'arquivo';
}

/** Evento disparado sempre que um card muda. */
export const ITEMS_CHANGED = 'persontask:items-changed';

/**
 * Avisa a interface que algum card mudou. Quem depende de uma visão geral
 * do Espaço — hoje o sininho de prazos — escuta e se recarrega sozinho,
 * sem precisar que cada tela saiba da existência dele.
 */
function itemsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ITEMS_CHANGED));
}

/** Card vencido com o Painel/Coluna onde ele está (para o sininho). */
export interface OverdueItem extends Item {
  boardId: string | null;
  boardName: string;
  columnTitle: string;
}

/**
 * Monta o cronograma modelo de um card de template: fases e tarefas em
 * **modo automático**, com as predecessoras **encadeadas** (cada tarefa
 * depende da anterior; fases não entram na corrente).
 *
 * Com durações de exemplo, o `autoSchedule` já devolve o cronograma
 * **datado** a partir do próximo dia útil — o usuário abre o card e vê um
 * projeto montado, que é só ajustar. Sem durações, nasce em branco.
 */
function buildTemplateSchedule(
  steps?: { name: string; indent: number; duration: number | null }[],
): ScheduleTask[] {
  if (!steps?.length) return [];
  const hours = DEFAULT_CALENDAR.hoursPerDay;

  const tasks: ScheduleTask[] = steps.map((step) => ({
    id: crypto.randomUUID(),
    name: step.name,
    indent: step.indent,
    start: null,
    end: null,
    progress: 0,
    work: step.duration === null ? null : Number((step.duration * hours).toFixed(2)),
    cost: null,
    mode: 'auto',
    duration: step.duration,
    predecessors: [],
    notes: '',
  }));

  let previousTask: string | null = null;
  for (const task of tasks) {
    if (task.indent === 0) continue; // fase: consolida os filhos, não é agendada
    if (previousTask) task.predecessors = [previousTask];
    previousTask = task.id;
  }

  const dated = tasks.some((t) => t.duration !== null);
  if (!dated) return tasks;

  // Começa no próximo dia útil — o exemplo nunca nasce no passado.
  const start = nextWorkday(new Date().toISOString(), DEFAULT_CALENDAR);
  return autoSchedule(tasks, DEFAULT_CALENDAR, start);
}

/**
 * Copia um Item para OUTRO Espaço/Coluna (usado por Espaços interligados).
 * Leva conteúdo portátil (título, descrição, checklists, prazo) e os anexos
 * (recopiados no Storage sob o Espaço de destino). NÃO leva responsáveis,
 * etiquetas nem campos personalizados — esses são específicos de cada Espaço.
 * Roda como o usuário atual: o RLS garante que só quem é membro do Espaço de
 * destino consegue inserir lá (por isso, na prática, só o Administrador que
 * interligou os Espaços — membros comuns nem enxergam o outro Espaço).
 */
/**
 * Leva os valores dos campos personalizados de um Espaço para outro.
 *
 * Campos pertencem ao Espaço, então o do destino é outro registro. Só
 * viaja o valor cujo campo **existe nos dois com o mesmo nome e o mesmo
 * tipo** — comparando o nome sem diferenciar maiúsculas nem espaços nas
 * pontas. Em lista suspensa, a opção escolhida também precisa existir no
 * destino: senão o card chegaria exibindo um valor que o campo de lá não
 * oferece. O que não casa é simplesmente descartado.
 *
 * Devolve quantos valores foram levados, para a tela poder informar.
 */
async function copyMatchingFieldValues(input: {
  sourceItemId: string;
  targetItemId: string;
  sourceSpaceId: string;
  targetSpaceId: string;
}): Promise<number> {
  if (input.sourceSpaceId === input.targetSpaceId) return 0; // mesmo Espaço: nada a traduzir

  const [srcDefs, dstDefs, values] = await Promise.all([
    supabase.from('custom_field_defs').select('id, name, type').eq('space_id', input.sourceSpaceId),
    supabase.from('custom_field_defs').select('id, name, type, config').eq('space_id', input.targetSpaceId),
    supabase
      .from('item_field_values')
      .select('field_def_id, value, show_on_face')
      .eq('item_id', input.sourceItemId),
  ]);

  const rows = values.data ?? [];
  if (!rows.length || !(dstDefs.data ?? []).length) return 0;

  const key = (name: string, type: string) => `${name.trim().toLowerCase()}|${type}`;
  const sourceById = new Map((srcDefs.data ?? []).map((d: any) => [d.id, d]));
  const targetByKey = new Map((dstDefs.data ?? []).map((d: any) => [key(d.name, d.type), d]));

  const toInsert = rows.flatMap((v: any) => {
    const from = sourceById.get(v.field_def_id);
    if (!from) return [];
    const to: any = targetByKey.get(key(from.name, from.type));
    if (!to) return []; // nome ou tipo diferente, ou campo inexistente
    if (to.type === 'select' && v.value !== null && v.value !== '') {
      const options: string[] = to.config?.options ?? [];
      if (!options.includes(String(v.value))) return []; // opção não existe no destino
    }
    return [{
      item_id: input.targetItemId,
      field_def_id: to.id,
      value: v.value,
      show_on_face: v.show_on_face,
    }];
  });

  if (toInsert.length) {
    const r = await supabase.from('item_field_values').insert(toInsert);
    if (r.error) throw r.error;
  }
  return toInsert.length;
}

async function copyItemToSpace(input: {
  sourceId: string;
  targetSpaceId: string;
  targetColumnId: string;
  createdBy: string;
}): Promise<{ id: string; fieldsCopied: number }> {
  const { data: src, error } = await supabase.from('items').select('*').eq('id', input.sourceId).single();
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
    column_id: input.targetColumnId,
    space_id: input.targetSpaceId,
    title: s.title,
    description: s.description ?? '',
    checklists,
    position: 0,
    due_at: s.due_at,
    // Cronograma acompanha o card. Organização/contato NÃO vão: são
    // cadastros do Espaço de origem e não existem no destino.
    start_at: s.start_at ?? null,
    work_hours: s.work_hours ?? null,
    cost: s.cost ?? null,
    progress: s.progress ?? null,
    schedule_mode: s.schedule_mode ?? null,
    schedule_tasks: s.schedule_tasks ?? [],
    created_by: input.createdBy,
  });
  if (ins.error) throw ins.error;

  // Campos personalizados compatíveis entre os dois Espaços.
  const fieldsCopied = await copyMatchingFieldValues({
    sourceItemId: input.sourceId,
    targetItemId: newId,
    sourceSpaceId: s.space_id,
    targetSpaceId: input.targetSpaceId,
  });

  const { data: atts } = await supabase.from('attachments').select('*').eq('item_id', input.sourceId);
  for (const a of atts ?? []) {
    const newPath = `${input.targetSpaceId}/${newId}/${crypto.randomUUID()}-${storageSafeName(a.file_name)}`;
    const cp = await supabase.storage.from(BUCKETS.attachments).copy(a.storage_path, newPath);
    if (!cp.error) {
      await supabase.from('attachments').insert({
        item_id: newId,
        space_id: input.targetSpaceId,
        storage_path: newPath,
        file_name: a.file_name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        uploaded_by: input.createdBy,
      });
    }
  }
  return { id: newId, fieldsCopied };
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
    /**
     * Semeia um Painel + Coluna + card de boas-vindas ("Comece por aqui") num
     * Espaço recém-criado. Usa IDs explícitos + inserts diretos (return=minimal),
     * como em `create`, para não esbarrar em RLS na linha recém-criada.
     */
    async seedWelcome(input: {
      spaceId: string;
      ownerId: string;
      boardName: string;
      columnTitle: string;
      cardTitle: string;
      cardBody: string;
    }): Promise<void> {
      const boardId = crypto.randomUUID();
      const b = await supabase
        .from('boards')
        .insert({ id: boardId, space_id: input.spaceId, name: input.boardName, position: 0 });
      if (b.error) throw b.error;

      const columnId = crypto.randomUUID();
      const c = await supabase.from('columns').insert({
        id: columnId,
        board_id: boardId,
        space_id: input.spaceId,
        title: input.columnTitle,
        color: '#6366F1',
        position: 0,
      });
      if (c.error) throw c.error;

      const it = await supabase.from('items').insert({
        column_id: columnId,
        space_id: input.spaceId,
        title: input.cardTitle,
        description: input.cardBody,
        position: 0,
        created_by: input.ownerId,
      });
      if (it.error) throw it.error;
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
    /** Configuração do relatório de Funil (campo de valor + papel das Colunas). */
    async setReportConfig(id: string, config: ReportConfig | null): Promise<void> {
      const { error } = await supabase.from('boards').update({ report_config: config }).eq('id', id);
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
           organization:organizations(id, name),
           attachments(count),
           comments(count)`,
        )
        .in('column_id', columnIds)
        .order('position');
      if (error) throw error;
      return (data ?? []) as unknown as RawItem[];
    },
    /**
     * Cards do Espaço com Término já passado — alimenta o sininho de avisos.
     * Traz o Painel/Coluna junto para o aviso poder levar direto ao card.
     * O filtro fino (dia inteiro + % concluído) fica no cliente, via
     * `effectiveSchedule`, para bater com o semáforo do resto do app.
     */
    async listOverdue(spaceId: string): Promise<OverdueItem[]> {
      const { data, error } = await supabase
        .from('items')
        .select(
          `id, title, due_at, done_at, progress, checklists, schedule_tasks, column_id,
           columns(id, title, board_id, boards(id, name))`,
        )
        .eq('space_id', spaceId)
        .is('done_at', null) // card concluído na mão não gera aviso
        .not('due_at', 'is', null)
        .lte('due_at', new Date().toISOString())
        .order('due_at');
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        ...(row as Item),
        boardId: row.columns?.board_id ?? null,
        boardName: row.columns?.boards?.name ?? '',
        columnTitle: row.columns?.title ?? '',
      }));
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
        // Cronograma e CRM acompanham a cópia (mesmo Espaço).
        start_at: s.start_at ?? null,
        work_hours: s.work_hours ?? null,
        cost: s.cost ?? null,
        progress: s.progress ?? null,
        schedule_mode: s.schedule_mode ?? null,
        schedule_tasks: s.schedule_tasks ?? [],
        schedule_calendar: s.schedule_calendar ?? null,
        organization_id: s.organization_id ?? null,
        contact_id: s.contact_id ?? null,
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
    /**
     * Cards do Espaço que já têm cronograma de projeto — usado para copiar a
     * estrutura de um projeto para outro sem redigitar.
     */
    async listWithSchedule(
      spaceId: string,
      exceptId?: string,
    ): Promise<{ id: string; title: string; schedule_tasks: ScheduleTask[] }[]> {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, schedule_tasks')
        .eq('space_id', spaceId)
        .order('title');
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({
          id: r.id as string,
          title: r.title as string,
          schedule_tasks: (r.schedule_tasks ?? []) as ScheduleTask[],
        }))
        .filter((r) => r.id !== exceptId && r.schedule_tasks.length > 0);
    },
    /** Copia o Item para outro Espaço interligado (só Administrador na prática — ver copyItemToSpace). */
    /** Devolve quantos campos personalizados couberam no Espaço de destino. */
    async copyToSpace(input: { sourceId: string; targetSpaceId: string; targetColumnId: string; createdBy: string }): Promise<number> {
      const r = await copyItemToSpace(input);
      return r.fieldsCopied;
    },
    /** Move o Item para outro Espaço interligado: copia e remove o original. */
    async moveToSpace(input: { sourceId: string; targetSpaceId: string; targetColumnId: string; createdBy: string }): Promise<number> {
      const r = await copyItemToSpace(input);
      const { error } = await supabase.from('items').delete().eq('id', input.sourceId);
      if (error) throw error;
      return r.fieldsCopied;
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
      itemsChanged();
      return data as Item;
    },
    async update(id: string, patch: Partial<Item>): Promise<void> {
      const clean: Record<string, unknown> = { ...patch };
      delete clean.assignees;
      delete clean.labels;
      delete clean.field_values;
      delete clean.attachments;
      delete clean.comments;
      delete clean.organization; // embed de leitura, não é coluna de `items`
      const { error } = await supabase.from('items').update(clean).eq('id', id);
      if (error) throw error;
      itemsChanged();
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      itemsChanged();
    },
    async setColumn(id: string, columnId: string, position: number): Promise<void> {
      const { error } = await supabase.from('items').update({ column_id: columnId, position }).eq('id', id);
      if (error) throw error;
      itemsChanged();
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
    /** Nova ordem dos campos no card — a lista vem já na ordem desejada. */
    async reorderDefs(orderedIds: string[]): Promise<void> {
      await Promise.all(
        orderedIds.map((id, position) =>
          supabase.from('custom_field_defs').update({ position }).eq('id', id),
        ),
      );
    },
    /**
     * Liga/desliga o campo na face do card **em todos os cards**, não só
     * nos próximos.
     *
     * Cada `item_field_values` guarda o próprio `show_on_face`, para que
     * a pessoa possa esconder o campo num card específico. O efeito
     * colateral é que mudar só o padrão do Espaço não alcançava os cards
     * que já tinham valor — e era isso que fazia parecer que a
     * configuração "não funcionava" nos cards antigos.
     */
    async setFaceVisibility(defId: string, show: boolean): Promise<void> {
      const def = await supabase
        .from('custom_field_defs')
        .update({ show_on_face_default: show })
        .eq('id', defId);
      if (def.error) throw def.error;
      const vals = await supabase
        .from('item_field_values')
        .update({ show_on_face: show })
        .eq('field_def_id', defId);
      if (vals.error) throw vals.error;
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
      const path = `${input.spaceId}/${input.itemId}/${crypto.randomUUID()}-${storageSafeName(input.file.name)}`;
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

  // ── CRM: Organizações ──────────────────────────────────────────────────
  organizations: {
    async list(spaceId: string): Promise<Organization[]> {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('space_id', spaceId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Organization[];
    },
    async create(
      input: Omit<Organization, 'id' | 'created_at' | 'updated_at'>,
    ): Promise<Organization> {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('organizations').insert({ id, ...input });
      if (error) throw error;
      const { data, error: selErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();
      if (selErr) throw selErr;
      return data as Organization;
    },
    async update(id: string, patch: Partial<Organization>): Promise<void> {
      const { error } = await supabase.from('organizations').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // ── CRM: Pessoas de contato ────────────────────────────────────────────
  contacts: {
    async list(spaceId: string): Promise<Contact[]> {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('space_id', spaceId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    async create(input: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('contacts').insert({ id, ...input });
      if (error) throw error;
      const { data, error: selErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (selErr) throw selErr;
      return data as Contact;
    },
    async update(id: string, patch: Partial<Contact>): Promise<void> {
      const { error } = await supabase.from('contacts').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // ── Recursos (pessoas + custo/hora) ────────────────────────────────────
  resources: {
    async list(spaceId: string): Promise<Resource[]> {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('space_id', spaceId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Resource[];
    },
    async create(input: Omit<Resource, 'id' | 'created_at' | 'updated_at'>): Promise<Resource> {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('resources').insert({ id, ...input });
      if (error) throw error;
      const { data, error: selErr } = await supabase
        .from('resources')
        .select('*')
        .eq('id', id)
        .single();
      if (selErr) throw selErr;
      return data as Resource;
    },
    async update(id: string, patch: Partial<Resource>): Promise<void> {
      const { error } = await supabase.from('resources').update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // ── Templates de Painel ────────────────────────────────────────────────
  templates: {
    /**
     * Cria um Painel completo a partir de um template: colunas, etiquetas,
     * campos personalizados e cards de exemplo.
     * Etiquetas e campos que já existam no Espaço (mesmo nome) são
     * reaproveitados — nunca duplicados. Se o usuário não tiver permissão
     * para criar etiquetas/campos, o Painel e as colunas são criados mesmo
     * assim (a parte opcional é simplesmente ignorada).
     * Devolve o id do Painel criado.
     */
    async apply(input: {
      spaceId: string;
      userId: string;
      def: TemplateDef;
      boardPosition: number;
    }): Promise<string> {
      const { spaceId, userId, def } = input;

      // 1) Painel
      const boardId = crypto.randomUUID();
      const b = await supabase
        .from('boards')
        .insert({ id: boardId, space_id: spaceId, name: def.boardName, position: input.boardPosition });
      if (b.error) throw b.error;

      // 2) Colunas
      const columnIds: string[] = [];
      for (let i = 0; i < def.columns.length; i++) {
        const id = crypto.randomUUID();
        const c = await supabase.from('columns').insert({
          id,
          board_id: boardId,
          space_id: spaceId,
          title: def.columns[i].title,
          color: def.columns[i].color,
          position: i,
        });
        if (c.error) throw c.error;
        columnIds.push(id);
      }

      // 3) Etiquetas do Espaço (reaproveita por nome)
      const labelIdByName = new Map<string, string>();
      const { data: existingLabels } = await supabase.from('labels').select('id, name').eq('space_id', spaceId);
      (existingLabels ?? []).forEach((l: any) => labelIdByName.set(String(l.name).toLowerCase(), l.id));
      for (const lb of def.labels) {
        const key = lb.name.toLowerCase();
        if (labelIdByName.has(key)) continue;
        const id = crypto.randomUUID();
        const r = await supabase.from('labels').insert({ id, space_id: spaceId, name: lb.name, color: lb.color });
        if (!r.error) labelIdByName.set(key, id);
      }

      // 4) Campos personalizados do Espaço (reaproveita por nome)
      const { data: existingFields } = await supabase
        .from('custom_field_defs')
        .select('id, name')
        .eq('space_id', spaceId);
      const fieldIdByName = new Map<string, string>();
      (existingFields ?? []).forEach((f: any) => fieldIdByName.set(String(f.name).toLowerCase(), f.id));
      let fieldPosition = existingFields?.length ?? 0;
      for (const f of def.fields) {
        const key = f.name.toLowerCase();
        if (fieldIdByName.has(key)) continue;
        const id = crypto.randomUUID();
        const r = await supabase.from('custom_field_defs').insert({
          id,
          space_id: spaceId,
          name: f.name,
          type: f.type,
          config: {
            ...(f.options ? { options: f.options } : {}),
            ...(f.money ? { money: true } : {}),
          },
          show_on_face_default: f.showOnFace,
          position: fieldPosition++,
        });
        if (!r.error) fieldIdByName.set(key, id);
      }

      // 4b) Cadastros de CRM de exemplo (Organização + Pessoa de contato).
      // Reaproveita por nome, igual às etiquetas — aplicar o template duas
      // vezes não duplica os cadastros.
      const orgIds: (string | null)[] = [];
      if (def.organizations?.length) {
        const { data: existingOrgs } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('space_id', spaceId);
        const orgIdByName = new Map<string, string>();
        (existingOrgs ?? []).forEach((o: any) => orgIdByName.set(String(o.name).toLowerCase(), o.id));

        for (const org of def.organizations) {
          const key = org.name.toLowerCase();
          const found = orgIdByName.get(key);
          if (found) {
            orgIds.push(found);
            continue;
          }
          const id = crypto.randomUUID();
          const r = await supabase.from('organizations').insert({
            id,
            space_id: spaceId,
            name: org.name,
            fantasy_name: org.fantasy_name ?? null,
            cnpj: org.cnpj ?? null,
            status: org.status ?? null,
            system: org.system ?? null,
            segment: org.segment ?? null,
            created_by: userId,
          });
          orgIds.push(r.error ? null : id);
          if (!r.error) orgIdByName.set(key, id);
        }
      }

      const contactIds: (string | null)[] = [];
      if (def.contacts?.length) {
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('space_id', spaceId);
        const contactIdByName = new Map<string, string>();
        (existingContacts ?? []).forEach((c: any) => contactIdByName.set(String(c.name).toLowerCase(), c.id));

        for (const contact of def.contacts) {
          const key = contact.name.toLowerCase();
          const found = contactIdByName.get(key);
          if (found) {
            contactIds.push(found);
            continue;
          }
          const id = crypto.randomUUID();
          const r = await supabase.from('contacts').insert({
            id,
            space_id: spaceId,
            organization_id:
              contact.organizationIndex === undefined ? null : orgIds[contact.organizationIndex] ?? null,
            name: contact.name,
            phone: contact.phone ?? null,
            phone_type: contact.phone_type ?? null,
            email: contact.email ?? null,
            email_type: contact.email_type ?? null,
            created_by: userId,
          });
          contactIds.push(r.error ? null : id);
          if (!r.error) contactIdByName.set(key, id);
        }
      }

      // 5) Cards de exemplo
      for (let i = 0; i < def.cards.length; i++) {
        const card = def.cards[i];
        const itemId = crypto.randomUUID();
        const checklists = card.checklist
          ? [
              {
                id: crypto.randomUUID(),
                title: card.checklist.title,
                items: card.checklist.items.map((text) => ({ id: crypto.randomUUID(), text, done: false })),
              },
            ]
          : [];
        // O cronograma modelo já define o Início/Término do card — é o
        // "término previsto" do projeto, que aparece na face do card.
        const scheduleTasks = buildTemplateSchedule(card.schedule);
        const span = rollupTasks(scheduleTasks);

        const r = await supabase.from('items').insert({
          id: itemId,
          column_id: columnIds[card.columnIndex] ?? columnIds[0],
          space_id: spaceId,
          title: card.title,
          description: card.description ?? '',
          checklists,
          schedule_tasks: scheduleTasks,
          start_at: scheduleTasks.length ? span.start : null,
          due_at: scheduleTasks.length ? span.end : null,
          organization_id:
            card.organizationIndex === undefined ? null : orgIds[card.organizationIndex] ?? null,
          contact_id: card.contactIndex === undefined ? null : contactIds[card.contactIndex] ?? null,
          position: i,
          created_by: userId,
        });
        if (r.error) continue;

        const labelIds = (card.labelIndexes ?? [])
          .map((idx) => labelIdByName.get(def.labels[idx]?.name.toLowerCase() ?? ''))
          .filter(Boolean) as string[];
        if (labelIds.length) {
          await supabase.from('item_labels').insert(labelIds.map((label_id) => ({ item_id: itemId, label_id })));
        }

        // Valores de exemplo dos campos personalizados.
        const values = Object.entries(card.fieldValues ?? {})
          .map(([index, value]) => {
            const field = def.fields[Number(index)];
            const fieldDefId = field && fieldIdByName.get(field.name.toLowerCase());
            if (!fieldDefId) return null;
            return {
              item_id: itemId,
              field_def_id: fieldDefId,
              value,
              show_on_face: field.showOnFace,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);
        if (values.length) await supabase.from('item_field_values').insert(values);
      }

      return boardId;
    },
  },
};
