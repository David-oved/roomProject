import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRoom } from '../store/RoomContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useVisualViewportBounds } from '../hooks/useVisualViewportBounds';
import { useAnnouncements } from '../hooks/useRoomData';
import { sendAnnouncement } from '../services/announcementService';
import { MegaphoneIcon, ChevronIcon } from '../components/ui/icons';
import { ErrorState } from '../components/ui/EmptyState';
import { formatSmartDate } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { useHintRef } from '../store/HintContext';

/**
 * הודעות שידור מהמנהל — כל חבר קורא, רק המנהל כותב. אותו דפוס פריסה
 * כמו ChatConversationPage (ראו useVisualViewportBounds), בלי הצורך
 * בוי"ים/נוכחות שבצ'אט הרגיל — זה פיד, לא שיחה.
 */
export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const { roomCode, isAdmin, isArchived, memberName } = useRoom();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();

  const { announcements, loading, error, fromCache } = useAnnouncements();
  const sorted = useMemo(() => [...announcements].reverse(), [announcements]);

  const viewport = useVisualViewportBounds();
  const listRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const sendHintRef = useHintRef<HTMLButtonElement>(
    'announcements.send',
    'שולח הודעת שידור לכל חברי החדר בבת אחת'
  );

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: isFirstRender.current ? 'auto' : 'smooth',
    });
    isFirstRender.current = false;
  }, [sorted.length]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || !user || !profile || !roomCode || sending) return;
    setText('');
    setSending(true);
    const res = await toast.run(() => sendAnnouncement(roomCode, user.uid, profile.displayName, trimmed));
    setSending(false);
    if (res === null) setText(trimmed);
  }

  return (
    // ‼️ left/width ולא inset-x-0 — ראו את ההסבר על זום-צביטה
    // ב-useVisualViewportBounds.
    <div
      className="fixed flex flex-col bg-ink-50"
      style={{
        top: viewport.top,
        left: viewport.left,
        height: viewport.height,
        width: viewport.width,
      }}
    >
      <header
        className="sticky top-0 z-10 flex shrink-0 items-center gap-2.5 border-b border-ink-200/70
                   bg-surface/90 px-2 backdrop-blur-xl safe-x"
        style={{ paddingTop: 'var(--safe-top)', height: 'calc(var(--header-height) + var(--safe-top))' }}
      >
        <button
          onClick={() => navigate(`/r/${roomCode}`)}
          aria-label="חזרה"
          className="tap grid shrink-0 place-items-center rounded-full text-ink-500
                     transition hover:bg-ink-100 hover:text-ink-800"
        >
          <ChevronIcon width={22} height={22} className="rotate-180" />
        </button>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
          <MegaphoneIcon width={17} height={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-ink-900">הודעות מהמנהל</h1>
          <p className="truncate text-xs text-ink-500">
            {isAdmin ? 'כל החברים רואים את מה שתשלח כאן' : 'רק המנהל יכול לשלוח כאן'}
          </p>
        </div>
      </header>

      <div ref={listRef} className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 py-3 safe-x">
        {sorted.length === 0 && loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
          </div>
        ) : error && !fromCache ? (
          <ErrorState message={friendlyError(error)} onRetry={() => location.reload()} />
        ) : sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
              <MegaphoneIcon width={22} height={22} />
            </span>
            <p className="text-sm text-ink-500">
              {isAdmin ? 'עוד לא שלחת הודעה לחברי החדר' : 'המנהל עדיין לא שלח הודעות'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {sorted.map((a) => (
              /*
               * ‼️ שידור ממנהל *המערכת* מקבל מסגרת ותג נפרדים. בלי ההבחנה
               *    הזו, הודעה מערכתית נראית כאילו מנהל החדר כתב אותה —
               *    ואז מישהו משיב לאדם הלא נכון, או מתעלם מהודעה שחשוב
               *    שיקרא דווקא בגלל שהוא סומך על מי שלדעתו כתב אותה.
               */
              <li
                key={a.id}
                className={`card p-3.5 ${
                  a.fromSystemAdmin ? 'border border-brand-200 bg-brand-50/60' : ''
                }`}
              >
                {a.fromSystemAdmin && (
                  <span
                    className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand-100
                               px-2 py-0.5 text-[11px] font-bold text-brand-800"
                  >
                    🛡️ מנהל המערכת
                  </span>
                )}
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-900">
                  {a.text}
                </p>
                <p className="mt-1.5 text-xs text-ink-500">
                  {a.fromSystemAdmin ? 'הודעת מערכת' : memberName(a.senderId)} ·{' '}
                  {a.sentAt ? formatSmartDate(a.sentAt) : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <div
          className="shrink-0 border-t border-ink-200/70 bg-surface px-3 py-2.5 safe-x"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.625rem)' }}
        >
          <div className="flex items-end gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={isArchived ? 'החדר בארכיון' : 'הודעה לכל חברי החדר…'}
              disabled={!isOnline || isArchived}
              // ‼️ text-[16px] — ראו ההערה הזהה ב-ChatConversationPage.
              className="h-11 flex-1 rounded-full border border-ink-200 bg-ink-50 px-4 text-[16px]
                         placeholder:text-ink-500 focus:border-brand-400 focus:bg-surface
                         focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
            <button
              ref={sendHintRef}
              type="button"
              onClick={() => void submit()}
              disabled={!isOnline || isArchived || text.trim().length === 0}
              aria-label="שליחה"
              className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full text-white
                         transition-transform duration-150 active:scale-90
                         bg-gradient-to-br from-brand-500 to-brand-700
                         disabled:from-ink-300 disabled:to-ink-300"
            >
              <MegaphoneIcon width={18} height={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
