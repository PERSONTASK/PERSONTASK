import { colorFromString, getInitials, cn } from '@/lib/utils';

export function Avatar({
  name,
  src,
  id,
  size = 28,
  title,
  className,
}: {
  name: string;
  src?: string | null;
  id?: string;
  size?: number;
  title?: string;
  className?: string;
}) {
  const dim = { width: size, height: size, fontSize: Math.max(9, size * 0.38) };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={title ?? name}
        style={dim}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      title={title ?? name}
      style={{ ...dim, background: colorFromString(id || name) }}
      className={cn('inline-flex items-center justify-center rounded-full font-bold text-white', className)}
    >
      {getInitials(name)}
    </span>
  );
}
