import type { SpaceMember } from '@/types';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export function AssigneePicker({
  members,
  selectedIds,
  disabled,
  onToggle,
}: {
  members: SpaceMember[];
  selectedIds: string[];
  disabled?: boolean;
  onToggle: (userId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const sel = selectedIds.includes(m.user_id);
        const name = m.profile?.name ?? '?';
        return (
          <button
            key={m.user_id}
            disabled={disabled}
            onClick={() => onToggle(m.user_id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs transition disabled:opacity-50',
              sel ? 'border-brand-indigo/60 bg-brand-indigo/10 font-semibold' : 'border-line/15 hover:border-ink-faint',
            )}
          >
            <Avatar name={name} src={m.profile?.avatar_url} id={m.user_id} size={20} />
            {name}
            {sel && <Check size={13} className="text-brand-indigo" />}
          </button>
        );
      })}
    </div>
  );
}
