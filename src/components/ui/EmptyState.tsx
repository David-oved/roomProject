import type { ReactNode } from 'react';

export function EmptyState({
  icon = '📭',
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div aria-hidden className="text-4xl">
        {icon}
      </div>
      <h3 className="text-base font-bold text-ink-800">{title}</h3>
      {body && <p className="max-w-xs text-sm leading-relaxed text-ink-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="⚠️"
      title="משהו השתבש"
      body={message || 'לא הצלחנו לטעון את הנתונים.'}
      action={
        onRetry && (
          <button
            onClick={onRetry}
            className="tap rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold
                       text-ink-700 transition hover:bg-ink-50"
          >
            נסה שוב
          </button>
        )
      }
    />
  );
}
