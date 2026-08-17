/** צבע יציב לכל משתמש — נגזר מה-uid, כך שהוא זהה בכל מכשיר. */
const PALETTE = [
  'bg-teal-100 text-teal-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-lime-100 text-lime-800',
  'bg-fuchsia-100 text-fuchsia-800',
  'bg-cyan-100 text-cyan-800',
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** ראשי תיבות: "דנה לוי" → "דל", "יוסי" → "יו" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const;

interface AvatarProps {
  name: string;
  uid?: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, uid, src, size = 'md', className = '' }: AvatarProps) {
  const tone = PALETTE[hashCode(uid || name) % PALETTE.length];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-1 ring-ink-200 ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`${SIZES[size]} ${tone} grid shrink-0 place-items-center rounded-full
                  font-bold ring-1 ring-black/5 ${className}`}
    >
      {initials(name)}
    </span>
  );
}
