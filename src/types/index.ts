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
  created_at: string;
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
  config: { options?: string[] };
  show_on_face_default: boolean;
  position: number;
}

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
