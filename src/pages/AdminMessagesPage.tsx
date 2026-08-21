import { useEffect, useState } from 'react';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useAdminMessages } from '../hooks/useAdminMessages';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { markAdminMessageClicked, markAdminMessageRead } from '../services/adminMessageService';
import { formatSmartDate } from '../lib/format';
import { friendlyError } from '../lib/errors';
import type { AdminMessageKind } from '../types/models';

const KIND_STYLE: Record<AdminMessageKind, { icon: string; ring: string; chip: string; label: string }> = {
  info: { icon: 'ℹ️', ring: 'border-ink-200', chip: 'bg-ink-100 text-ink-700', label: 'עדכון' },
  success: {
    icon: '✅',
    ring: 'border-emerald-200',
    chip: 'bg-emerald-50 text-emerald-800',
    label: 'הודעה טובה',
  },
  warning: {
    icon: '⚠️',
    ring: 'border-amber-200',
    chip: 'bg-amber-50 text-amber-900',
    label: 'שימו לב',
  },
  error: { icon: '🛑', ring: 'border-rose-200', chip: 'bg-rose-50 text-rose-800', label: 'תקלה' },
  maintenance: {
    icon: '🛠️',
    ring: 'border-amber-200',
    chip: 'bg-amber-50 text-amber-900',
    label: 'תחזוקה',
  },
};

/**
 * ═══════════════════════════════════════════════════════════════
 *  הודעות ממנהל המערכת
 * ═══════════════════════════════════════════════════════════════
 *  התיבה האישית: שידורים, הודעות אישיות ותשובות לפניות — כולן באותו
 *  מקום, כי מבחינת המשתמש זו שיחה אחת ולא שלושה ערוצים.
 *
 *  ‼️ readAt נכתב כשההודעה נפתחת בפועל ולא כשהיא מגיעה. הקונסולה
 *     מודדת "זמן עד קריאה", ומספר שנרשם ברגע המסירה הופך את המדד
 *     כולו לחסר ערך.
 * ═══════════════════════════════════════════════════════════════
 */
export default function AdminMessagesPage() {
  const { user } = useAuth();
  const { isOnline } = useConnection();
  const { messages, loading, error, fromCache, unreadCount } = useAdminMessages();
  const [openId, setOpenId] = useState<string | null>(null);

  // ההודעה הראשונה שלא נקראה נפתחת מעצמה — היא הסיבה שנכנסו לכאן
  useEffect(() => {
    if (openId || messages.length === 0) return;
    const firstUnread = messages.find((m) => !m.readAt);
    if (firstUnread) setOpenId(firstUnread.id);
  }, [messages, openId]);

  // סימון כנקרא רק על ההודעה הפתוחה בפועל
  useEffect(() => {
    if (!user || !openId || !isOnline) return;
    const message = messages.find((m) => m.id === openId);
    if (!message || message.readAt) return;
    void markAdminMessageRead(user.uid, openId);
  }, [openId, messages, user, isOnline]);

  return (
    <>
      <TopBar
        title="הודעות ממנהל המערכת"
        subtitle={unreadCount > 0 ? `${unreadCount} חדשות` : undefined}
        back
      />
      <PlainShell hasTopBar>
        <div className="py-4">
          {loading && messages.length === 0 ? (
            <ListSkeleton rows={3} />
          ) : error && !fromCache ? (
            <ErrorState message={friendlyError(error)} onRetry={() => location.reload()} />
          ) : messages.length === 0 ? (
            <EmptyState
              icon="📭"
              title="אין הודעות"
              body="כאן יופיעו עדכוני מערכת ותשובות לפניות ששלחת."
            />
          ) : (
            <ul className="space-y-2.5">
              {messages.map((m) => {
                const style = KIND_STYLE[m.kind] ?? KIND_STYLE.info;
                const isOpen = openId === m.id;
                const unread = !m.readAt;

                return (
                  <li key={m.id} className={`card border ${style.ring} p-0 overflow-hidden`}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : m.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-3 p-4 text-start transition active:bg-ink-50"
                    >
                      <span aria-hidden className="text-xl leading-none">
                        {style.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={`truncate text-sm ${unread ? 'font-bold text-ink-900' : 'font-semibold text-ink-700'}`}
                          >
                            {m.title}
                          </span>
                          {unread && (
                            <span
                              aria-label="לא נקראה"
                              className="h-2 w-2 shrink-0 rounded-full bg-brand-600"
                            />
                          )}
                        </span>
                        {!isOpen && (
                          <span className="mt-0.5 block truncate text-xs text-ink-500">{m.body}</span>
                        )}
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${style.chip}`}>
                            {style.label}
                          </span>
                          {m.relatedFeedback && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                              תשובה לפנייה שלך
                            </span>
                          )}
                          <span>{m.sentAt ? formatSmartDate(m.sentAt) : ''}</span>
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-ink-100 px-4 pb-4 pt-3">
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-800">
                          {m.body}
                        </p>

                        {m.cta?.text && m.cta?.url && (
                          <a
                            href={m.cta.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={() => user && void markAdminMessageClicked(user.uid, m.id)}
                            className="tap mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-700
                                       px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
                          >
                            {m.cta.text}
                            <span aria-hidden>←</span>
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PlainShell>
    </>
  );
}
