import { clsx, type ClassValue } from 'clsx';

/** Tailwind-friendly className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Up to two initials from a name. */
export function getInitials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic avatar color from a string (id or name). */
const AVATAR_COLORS = [
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#14B8A6',
  '#EF4444',
  '#A855F7',
];
export function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Whole days from now until an ISO date (negative = past). null if no date. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  const now = new Date();
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((startThen.getTime() - startNow.getTime()) / 86400000);
}

export type DueTone = 'overdue' | 'soon' | 'ok' | 'none';
export function dueTone(iso: string | null | undefined, leadDays = 3): DueTone {
  const d = daysUntil(iso);
  if (d === null) return 'none';
  if (d < 0) return 'overdue';
  if (d <= leadDays) return 'soon';
  return 'ok';
}

/** Locale-aware short date. */
export function formatDate(iso: string | null | undefined, locale = 'pt'): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(localeTag(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function localeTag(locale: string): string {
  return locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Coarse file classification for icons/colors. */
export type FileKind = 'pdf' | 'sheet' | 'doc' | 'slides' | 'image' | 'other';
export function fileKind(nameOrMime: string): FileKind {
  const s = nameOrMime.toLowerCase();
  if (/(\.pdf|pdf)/.test(s)) return 'pdf';
  if (/(\.xlsx?|\.csv|spreadsheet|excel)/.test(s)) return 'sheet';
  if (/(\.docx?|msword|wordprocessing)/.test(s)) return 'doc';
  if (/(\.pptx?|presentation|powerpoint)/.test(s)) return 'slides';
  if (/(\.(png|jpe?g|gif|webp|svg)|image\/)/.test(s)) return 'image';
  return 'other';
}

/** Extensions accepted by the uploader (documents + images). */
export const ACCEPTED_UPLOAD =
  '.pdf,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Simple id for optimistic UI before the DB assigns one. */
export function tempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

/** Extract @mentions (usernames/emails) from a comment body. */
export function parseMentions(body: string): string[] {
  const matches = body.match(/@([\w.\-+]+)/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}
