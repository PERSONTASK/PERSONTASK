// ── PERSONTASK — modelo de domínio (espelha supabase/schema.sql) ──────────

export type Plan = 'free' | 'premium';
// 'checklist' mantido só para compatibilidade de dados antigos; a UI oferece 'checkbox'.
export type FieldType = 'datetime' | 'text' | 'number' | 'checklist' | 'checkbox' | 'select';
export type InviteStatus = 'pending' | 'accepted' | 'revoked';
export type NotificationType = 'item_assigned' | 'due_soon' | 'mention';

/** Capacidades atribuíveis a um perfil de acesso. */
export type Permission =
  | 'space.admin'
  | 'space.manage'
  | 'members.manage'
  | 'board.create'
  | 'board.edit'
  | 'board.delete'
  | 'column.manage'
  | 'item.create'
  | 'item.edit'
  | 'item.delete'
  | 'label.manage'
  | 'field.manage'
  | 'comment.create';

export const ALL_PERMISSIONS: Permission[] = [
  'space.manage',
  'members.manage',
  'board.create',
  'board.edit',
  'board.delete',
  'column.manage',
  'item.create',
  'item.edit',
  'item.delete',
  'label.manage',
  'field.manage',
  'comment.create',
];

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  plan: Plan;
  locale: string;
  email_notifications: boolean;
  created_at: string;
}

export interface Space {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  bg_color: string;
  bg_image_url: string | null;
  font_family: string;
  logo_url: string | null;
  due_soon_lead_days: number;
  /** Moeda do Espaço em ISO 4217 (BRL, USD, EUR…). Padrão: BRL. */
  currency?: string;
  /**
   * Padrão ao migrar um card para outro Espaço: `true` mantém o card aqui
   * também (cópia), preservando histórico e os números dos relatórios.
   */
  keep_on_migrate?: boolean;
  created_at: string;
}

/** Papel de uma Coluna no funil, para o relatório. */
export type ColumnRole = 'open' | 'won' | 'lost' | 'ignore';

/**
 * Configuração do relatório de Funil de um Painel. Sem ela, o relatório
 * não tem como saber o que é "ganho" nem qual campo é o valor do negócio.
 */
export interface ReportConfig {
  /** Campo personalizado (numérico) que guarda o valor do negócio. */
  valueFieldId: string | null;
  /** Papel de cada Coluna, por id. Coluna ausente = `open`. */
  columnRoles: Record<string, ColumnRole>;
}

export interface AccessProfile {
  id: string;
  space_id: string;
  name: string;
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
}

export interface SpaceMember {
  space_id: string;
  user_id: string;
  access_profile_id: string | null;
  joined_at: string;
  profile?: Profile;
  access_profile?: AccessProfile;
}

export interface Board {
  id: string;
  space_id: string;
  name: string;
  position: number;
  /** Relatório de Funil. Nulo = Painel ainda não configurado. */
  report_config?: ReportConfig | null;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  space_id: string;
  title: string;
  color: string;
  position: number;
  collapsed: boolean;
  created_at: string;
}

export interface Label {
  id: string;
  space_id: string;
  name: string;
  color: string;
}

export interface CustomFieldDef {
  id: string;
  space_id: string;
  name: string;
  type: FieldType;
  config: {
    options?: string[];
    /** Campo numérico exibido como dinheiro, na moeda do Espaço. */
    money?: boolean;
  };
  show_on_face_default: boolean;
  position: number;
}

/** Visões do Painel: quadro, lista e relatório. */
export type ViewMode = 'board' | 'schedule' | 'report';

export type ChecklistValue = { text: string; done: boolean }[];

/** Checklist como recurso próprio do card (não é um campo personalizado). */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}
export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ItemFieldValue {
  id: string;
  item_id: string;
  field_def_id: string;
  value: string | number | boolean | ChecklistValue | null;
  show_on_face: boolean;
}

export interface Attachment {
  id: string;
  item_id: string;
  space_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  item_id: string;
  space_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: Profile;
}

export interface Item {
  id: string;
  column_id: string;
  space_id: string;
  title: string;
  description: string;
  checklists: Checklist[];
  position: number;
  due_at: string | null;
  /**
   * Quando o card foi marcado como CONCLUÍDO (nulo = em aberto). Deixa o
   * semáforo verde e silencia o aviso de prazo, mesmo vencido.
   */
  done_at?: string | null;
  /** CRM: vínculo com o cadastro de Organização (opcional). */
  organization_id?: string | null;
  /** CRM: vínculo com o cadastro de Pessoa de contato (opcional). */
  contact_id?: string | null;
  /** Organização vinculada, trazida junto na listagem do Painel (só id + nome). */
  organization?: { id: string; name: string } | null;
  // ── Cronograma (gestão de projetos) ──
  /** Início planejado. O Término é o `due_at`. */
  start_at?: string | null;
  /** Trabalho: esforço alocado, em horas. */
  work_hours?: number | null;
  /** Custo previsto/acumulado da atividade. */
  cost?: number | null;
  /** % concluído explícito (0–100). Se nulo, usa o % do checklist. */
  progress?: number | null;
  /** Modo de agendamento da tarefa. */
  schedule_mode?: 'manual' | 'auto' | null;
  /** Cronograma do projeto: tarefas dentro deste card (card = projeto). */
  schedule_tasks?: ScheduleTask[];
  /** Calendário de trabalho do projeto (nulo = padrão seg–sex, 8h). */
  schedule_calendar?: ScheduleCalendar | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relações hidratadas na UI:
  assignees?: Profile[];
  labels?: Label[];
  field_values?: ItemFieldValue[];
  attachments?: Attachment[];
  comments?: Comment[];
}

/**
 * Uma linha do cronograma do projeto (guardada em `items.schedule_tasks`).
 * `indent` 0 = fase (EDT "1"), 1 = tarefa (EDT "1.1").
 */
export interface ScheduleTask {
  id: string;
  name: string;
  indent: number;
  start: string | null;
  end: string | null;
  progress: number;
  work: number | null;
  cost: number | null;
  mode: 'manual' | 'auto';
  /**
   * Duração em dias ÚTEIS. No modo automático é a entrada (as datas são
   * calculadas a partir dela); no manual é mantida em sincronia com as datas.
   */
  duration?: number | null;
  /** ids das tarefas predecessoras (término → início). */
  predecessors: string[];
  notes: string;
  /**
   * Recurso único alocado. Formato antigo, mantido para ler cronogramas
   * gravados antes dos múltiplos responsáveis — use `resourceIdsOf()`.
   */
  resourceId?: string | null;
  /** Recursos (pessoas) alocados — o custo soma o custo/hora de todos. */
  resourceIds?: string[] | null;
}

/** Calendário de trabalho de um projeto (dias úteis, feriados, jornada). */
export interface ScheduleCalendar {
  /** Dias da semana que são úteis — 0 = domingo … 6 = sábado. */
  workdays: number[];
  /** Feriados no formato YYYY-MM-DD. */
  holidays: string[];
  /** Horas de trabalho por dia. */
  hoursPerDay: number;
}

/** Recurso (pessoa envolvida) do Espaço, com custo por hora. */
export interface Resource {
  id: string;
  space_id: string;
  name: string;
  role: string | null;
  hourly_cost: number | null;
  email: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Cadastro de Organização (empresa/cliente) — reutilizável entre negócios. */
export interface Organization {
  id: string;
  space_id: string;
  name: string;
  fantasy_name: string | null;
  cnpj: string | null;
  status: string | null;
  system: string | null;
  segment: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Cadastro de Pessoa de contato — reutilizável entre negócios. */
export interface Contact {
  id: string;
  space_id: string;
  organization_id: string | null;
  name: string;
  phone: string | null;
  phone_type: string | null;
  email: string | null;
  email_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invite {
  id: string;
  space_id: string;
  email: string;
  token: string;
  invited_by: string | null;
  access_profile_id: string | null;
  status: InviteStatus;
  created_at: string;
  accepted_at: string | null;
}

/** Face do Item no board: título + trecho da descrição + campos marcados. */
export interface ItemFace {
  labels: Label[];
  faceFields: { def: CustomFieldDef; value: ItemFieldValue }[];
}
