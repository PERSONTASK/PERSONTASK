import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import type { Comment, SpaceMember } from '@/types';
import { Avatar } from '@/components/Avatar';
import { localeTag } from '@/lib/utils';

/** @handle of a member: e-mail local part, else first name (lowercased). */
function handleOf(m: SpaceMember): string {
  const email = m.profile?.email;
  if (email) return email.split('@')[0].toLowerCase();
  return (m.profile?.name ?? '').split(/\s+/)[0].toLowerCase();
}

/** Renders a comment body highlighting @mentions. */
function renderBody(body: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /@([\w.\-+]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = re.exec(body))) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <span key={k++} className="rounded bg-brand-indigo/15 px-1 font-semibold text-brand-indigo">
        @{match[1]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

export function CommentsThread({
  comments,
  members,
  canComment,
  locale,
  onSend,
}: {
  comments: Comment[];
  members: SpaceMember[];
  canComment: boolean;
  locale: string;
  onSend: (body: string, mentionIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.profile && (m.profile.name.toLowerCase().includes(q) || handleOf(m).includes(q)))
      .slice(0, 5);
  }, [mentionQuery, members]);

  function onChange(v: string) {
    setBody(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = before.match(/@([\w.\-+]*)$/);
    setMentionQuery(m ? m[1] : null);
  }

  function pick(m: SpaceMember) {
    const caret = ref.current?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@([\w.\-+]*)$/, `@${handleOf(m)} `);
    const next = before + body.slice(caret);
    setBody(next);
    setMentionQuery(null);
    ref.current?.focus();
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    // Resolve @handles → member ids
    const tokens = (text.match(/@([\w.\-+]+)/g) ?? []).map((x) => x.slice(1).toLowerCase());
    const ids = members
      .filter((m) => tokens.includes(handleOf(m)) || tokens.includes((m.profile?.name ?? '').split(/\s+/)[0].toLowerCase()))
      .map((m) => m.user_id);
    setBusy(true);
    try {
      await onSend(text, Array.from(new Set(ids)));
      setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar
                name={c.author?.name ?? '?'}
                src={c.author?.avatar_url}
                id={c.author_id ?? c.id}
                size={28}
              />
              <div className="flex-1 rounded-lg border border-line/10 bg-surface-raised px-3 py-2">
                <p className="text-xs text-ink-faint">
                  <span className="font-semibold text-ink-soft">{c.author?.name ?? '—'}</span>{' '}
                  · {new Date(c.created_at).toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' })}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{renderBody(c.body)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <div className="relative">
          <div className="flex items-end gap-2">
            <textarea
              ref={ref}
              value={body}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('item.writeComment')}
              rows={2}
              className="field min-h-[56px] flex-1 resize-none"
            />
            <button className="btn-primary h-10 w-10 rounded-lg p-0" onClick={send} disabled={busy || !body.trim()}>
              <Send size={16} />
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute bottom-14 left-0 z-30 w-64 overflow-hidden rounded-lg border border-line/10 bg-surface-overlay shadow-lift">
              {suggestions.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => pick(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-line/5"
                >
                  <Avatar name={m.profile!.name} src={m.profile?.avatar_url} id={m.user_id} size={22} />
                  <span className="font-medium">{m.profile!.name}</span>
                  <span className="text-xs text-ink-faint">@{handleOf(m)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
