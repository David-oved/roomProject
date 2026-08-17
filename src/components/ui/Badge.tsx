import type { ReactNode } from 'react';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600',
  brand: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200/70',
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70',
  danger: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/70',
  info: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/70',
};

export function Badge({
  tone = 'neutral',
  children,
  icon,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5
                  text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
