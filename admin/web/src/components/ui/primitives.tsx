import type { ReactNode } from 'react';
import { initials, percent } from '../../lib/format';
import type { Tone } from '../../lib/types';

/** אבני הבניין של הממשק. כולן דקות בכוונה — העיצוב חי ב-styles.css. */

export function Card({
  title,
  subtitle,
  actions,
  children,
  tight,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__head">
          {title && <h2>{title}</h2>}
          {subtitle && <span className="sub">{subtitle}</span>}
          {actions && <div className="actions">{actions}</div>}
        </header>
      )}
      <div className={`card__body${tight ? ' tight' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  delta,
  onClick,
  small,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'danger' | 'warn' | 'success';
  delta?: number;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <div
      className={`stat${tone ? ` tone-${tone}` : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <span className="stat__label">{label}</span>
      <span className={`stat__value${small ? ' small' : ''}`}>{value}</span>
      <span className="stat__hint">
        {hint}
        {delta !== undefined && delta !== 0 && (
          <span className={`delta ${delta > 0 ? 'up' : 'down'}`}>
            {' '}
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
      </span>
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  outline,
}: {
  tone?: Tone;
  children: ReactNode;
  outline?: boolean;
}) {
  return <span className={`badge ${tone}${outline ? ' outline' : ''}`}>{children}</span>;
}

export function Dot({ tone = 'neutral', live }: { tone?: Tone; live?: boolean }) {
  return <span className={`dot ${live ? 'live' : tone}`} />;
}

export function Avatar({ name, size }: { name: string; size?: 'sm' | 'lg' }) {
  return <span className={`avatar${size ? ` ${size}` : ''}`}>{initials(name)}</span>;
}

export function Meter({
  value,
  total,
  tone,
}: {
  value: number;
  total: number;
  tone?: 'success' | 'warn' | 'danger';
}) {
  return (
    <div className="meter">
      <div
        className={`meter__fill${tone ? ` ${tone}` : ''}`}
        style={{ width: `${Math.min(100, percent(value, total))}%` }}
      />
    </div>
  );
}

export function Score({ score, level }: { score: number; level: string }) {
  return <span className={`score ${level}`}>{score}</span>;
}

export function Empty({ icon = '📭', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="col" style={{ gap: 10, padding: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 9}%` }} />
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab${tab.id === active ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="btn-group">
      {options.map((option) => (
        <button
          key={option.id}
          className={option.id === value ? 'active' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'חיפוש…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="input"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}
