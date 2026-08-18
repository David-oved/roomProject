import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 ' +
    'disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none',
  secondary:
    'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100 ' +
    'disabled:bg-ink-50 disabled:text-ink-300 disabled:border-ink-100',
  ghost:
    'bg-transparent text-ink-600 hover:bg-ink-100 active:bg-ink-200 ' +
    'disabled:text-ink-300 disabled:hover:bg-transparent',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 ' +
    'disabled:bg-ink-200 disabled:text-ink-400',
};

const SIZES: Record<Size, string> = {
  sm: 'h-11 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-13 px-5 text-base rounded-xl gap-2 min-h-[52px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    icon,
    disabled,
    className = '',
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex min-h-[44px] select-none items-center justify-center font-semibold',
        'transition-[background-color,transform,box-shadow] duration-150',
        'active:scale-[.98] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 14 : 18} />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
});
