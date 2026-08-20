import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRoom } from '../store/RoomContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useRtdbList } from '../hooks/useRtdb';
import { useVisualViewportBounds } from '../hooks/useVisualViewportBounds';
import {
  GENERAL_SCOPE,
  dmBasePath,
  dmPairKey,
  generalChatPath,
  markPresent,
  markRead,
  sendDirectMessage,
  sendGeneralMessage,
  tickFor,
} from '../services/chatService';
import { Avatar } from '../components/ui/Avatar';
import { ChatIcon, CheckDoubleIcon, CheckIcon, ChevronIcon } from '../components/ui/icons';
import { formatTime } from '../lib/format';
import type { ChatMessage, WithId } from '../types/models';

export default function ChatConversationPage() {
  const { code, uid: otherUid } = useParams<{ code: string; uid?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeMembers, memberName, onlineMemberIds } = useRoom();
  const { isOnline } = useConnection();
  const toast = useToast();

  const isGeneral = !otherUid;
  const myUid = user?.uid ?? '';

  const path = isGeneral
    ? generalChatPath(code!)
    : `${dmBasePath(code!, myUid, otherUid!)}/messages`;
  const scopeKey = isGeneral ? GENERAL_SCOPE : dmPairKey(myUid, otherUid ?? '');

  const other = !isGeneral ? activeMembers.find((m) => m.id === otherUid) : null;
  const title = isGeneral ? 'כללי' : (other?.name ?? memberName(otherUid ?? ''));
  const otherOnline = !isGeneral && !!otherUid && onlineMemberIds.has(otherUid);

  // ‼️ מיוצב בזיכרון — הוא נכנס כ-prop לכל בועה, ו-Bubble עטוף ב-memo.
  // מערך חדש בכל רינדור היה מבטל את ה-memo לגמרי.
  const recipientIds = useMemo(
    () =>
      isGeneral
        ? activeMembers.map((m) => m.id).filter((id) => id !== myUid)
        : otherUid
          ? [otherUid]
          : [],
    [isGeneral, activeMembers, myUid, otherUid]
  );

  const { data: messages, loading: messagesLoading } = useRtdbList<ChatMessage>(path);
  const sorted = useMemo(
    () => [...messages].sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0)),
    [messages]
  );

  const listRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const animatedIds = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior });
  }, []);

  const scrollToBottomSmooth = useCallback(() => scrollToBottom('smooth'), [scrollToBottom]);

  // ‼️ מעבר בין שתי שיחות פרטיות (dm/:uid1 ← dm/:uid2) לא ממחזר את
  // הקומפוננטה — אותו תבנית-נתיב, רק פרמטר משתנה (בדיוק כמו הבאג שכבר
  // תוקן ב-SettingsRoomPage). בלי האיפוס הזה: טקסט שהתחלת להקליד לחבר
  // אחד נשלח בטעות לחבר השני, וההודעות של השיחה החדשה "נדבקות" לרצף
  // האנימציה/הגלילה של הקודמת.
  // הטקסט שהוקלד יושב ב-Composer עצמו ומתאפס דרך key={path} — ראו שם.
  useEffect(() => {
    isFirstRender.current = true;
    animatedIds.current = new Set();
  }, [path]);

  // ‼️ סימון "כבר הונפשה" קורה כאן ולא בתוך הרינדור. פעולה על ref בזמן
  // רינדור היא side effect: ב-StrictMode הרינדור הכפול היה מסמן את
  // ההודעה כבר במעבר הראשון, וההנפשה בפועל לא הייתה רצה אף פעם.
  useEffect(() => {
    for (const m of sorted) animatedIds.current.add(m.id);
  }, [sorted]);

  // גובה המסך צמוד ל-visual viewport האמיתי, לא מנוחש — ראו ההסבר המלא
  // ב-useVisualViewportBounds. שורת הכתיבה למטה היא ילד flex רגיל.
  const viewport = useVisualViewportBounds();

  // נוכחות — "כאן" כל עוד המסך הזה פתוח, כדי שהשולח בצד השני ידע לא לשלוח פוש
  useEffect(() => {
    if (!code || !myUid) return;
    return markPresent(code, scopeKey, myUid);
  }, [code, myUid, scopeKey]);

  // סימון נקרא בכל עדכון — ההודעות שכבר מוצגות למשתמש נחשבות נקראו
  useEffect(() => {
    if (!myUid || messages.length === 0) return;
    void markRead(path, messages, myUid);
  }, [messages, myUid, path]);

  // גלילה לתחתית: מיידית בכניסה, חלקה על כל הודעה חדשה אחר כך
  useEffect(() => {
    scrollToBottom(isFirstRender.current ? 'auto' : 'smooth');
    isFirstRender.current = false;
  }, [sorted.length]);

  /** מחזיר האם השליחה הצליחה — ה-Composer מחזיר את הטקסט אם לא. */
  const send = useCallback(
    async (trimmed: string): Promise<boolean> => {
      try {
        if (isGeneral) {
          await sendGeneralMessage(
            code!,
            user!.uid,
            profile!.displayName,
            activeMembers.map((m) => m.id),
            trimmed
          );
        } else if (otherUid) {
          await sendDirectMessage(code!, user!.uid, profile!.displayName, otherUid, trimmed);
        }
        return true;
      } catch (err) {
        // השליחה נכשלה בפועל (לא רק "לא נראה מיד") — מחזירים את הטקסט
        // במקום לאבד אותו בשקט, כדי שהמשתמש יוכל לנסות שוב. כוללים את
        // סיבת הכשל בפועל (למשל permission_denied) כדי שאפשר יהיה לאבחן.
        const reason = err instanceof Error ? err.message : String(err);
        toast.error(`שליחת ההודעה נכשלה: ${reason}`);
        return false;
      }
    },
    [isGeneral, code, user, profile, activeMembers, otherUid, toast]
  );

  return (
    <div
      className="fixed inset-x-0 flex flex-col bg-ink-50"
      style={{ top: viewport.top, height: viewport.height }}
    >
      {/* ── כותרת ── */}
      <header
        className="sticky top-0 z-10 flex shrink-0 items-center gap-2.5 border-b border-ink-200/70
                   bg-white/90 px-2 backdrop-blur-xl safe-x"
        style={{ paddingTop: 'var(--safe-top)', height: 'calc(var(--header-height) + var(--safe-top))' }}
      >
        <button
          onClick={() => navigate(`/r/${code}/chat`)}
          aria-label="חזרה"
          className="tap grid shrink-0 place-items-center rounded-full text-ink-500
                     transition hover:bg-ink-100 hover:text-ink-800"
        >
          <ChevronIcon width={22} height={22} className="rotate-180" />
        </button>

        {isGeneral ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <ChatIcon width={17} height={17} />
          </span>
        ) : (
          <div className="relative shrink-0">
            <Avatar name={title} uid={otherUid} src={other?.avatar} size="sm" />
            {otherOnline && (
              <span
                aria-hidden
                className="absolute -end-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
              />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-ink-900">{title}</h1>
          {isGeneral ? (
            <p className="truncate text-xs text-ink-500">{activeMembers.length} חברים</p>
          ) : (
            <p className={`truncate text-xs ${otherOnline ? 'font-medium text-emerald-600' : 'text-ink-400'}`}>
              {otherOnline ? 'מחובר/ת עכשיו' : 'לא מחובר/ת'}
            </p>
          )}
        </div>
      </header>

      {/* ── הודעות ── */}
      <div
        ref={listRef}
        className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 py-3 safe-x"
      >
        {sorted.length === 0 && messagesLoading ? (
          // ‼️ בכוונה לא מציגים "עדיין אין הודעות" כל עוד עוד לא ידוע בוודאות
          // שאין הודעות — ברשת חלשה זה נראה כאילו הודעות "נעלמות" כשבעצם
          // הן פשוט עוד לא נטענו.
          <div className="flex h-full items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
              <ChatIcon width={22} height={22} />
            </span>
            <p className="text-sm text-ink-500">עדיין אין הודעות. תתחילו את השיחה!</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((m, i) => {
              const mine = m.senderId === myUid;
              const isNew = !animatedIds.current.has(m.id);
              // בצ'אט הכללי מציגים שם+תמונה מעל הודעה של מישהו אחר, אבל רק
              // כשהיא פותחת "רצף" חדש (השולח הקודם היה מישהו אחר) — כמו
              // בכל אפליקציית צ'אט קבוצתי, כדי לא לחזור על אותו שם שוב ושוב.
              const showSender = isGeneral && !mine && sorted[i - 1]?.senderId !== m.senderId;
              const sender = showSender ? activeMembers.find((mem) => mem.id === m.senderId) : undefined;
              return (
                <li
                  key={m.id}
                  className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${
                    isNew ? 'animate-slide-up' : ''
                  }`}
                >
                  {isGeneral && !mine && (
                    <div className="w-7 shrink-0 self-end">
                      {showSender && (
                        <Avatar
                          name={sender?.name ?? memberName(m.senderId)}
                          uid={m.senderId}
                          src={sender?.avatar}
                          size="xs"
                        />
                      )}
                    </div>
                  )}
                  <Bubble
                    message={m}
                    mine={mine}
                    recipientIds={recipientIds}
                    senderName={showSender ? (sender?.name ?? memberName(m.senderId)) : undefined}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── שורת כתיבה — ילד flex רגיל, לא fixed ולא transform. היא
          "עולה" רק כי הקונטיינר שמעליה מצטמצם בדיוק לגובה הנראה בפועל —
          ראו ההערה למעלה. ── */}
      <div
        className="shrink-0 border-t border-ink-200/70 bg-white px-3 py-2.5 safe-x"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.625rem)' }}
      >
        {/* ‼️ key={path} מחליף את setText('') שהיה כאן: מעבר בין שתי שיחות
            פרטיות לא ממחזר את הדף (אותה תבנית-נתיב), אבל כן ממחזר את
            ה-Composer — ולכן הטקסט שהתחלת להקליד לחבר אחד לא נשלח לשני. */}
        <Composer
          key={path}
          ready={!!(user && profile && code)}
          isOnline={isOnline}
          onSend={send}
          onFocus={scrollToBottomSmooth}
        />
      </div>
    </div>
  );
}

/**
 * שורת הכתיבה — מחזיקה את הטקסט המוקלד בעצמה.
 *
 * ‼️ בכוונה קומפוננטה נפרדת: כשה-state הזה ישב בדף, כל תו שהוקלד רינדר
 * מחדש את כל רשימת ההודעות. עכשיו ההקלדה נעצרת כאן.
 */
const Composer = memo(function Composer({
  ready,
  isOnline,
  onSend,
  onFocus,
}: {
  /** האם יש כבר משתמש/פרופיל/קוד חדר — בלעדיהם אין מה לשלוח */
  ready: boolean;
  isOnline: boolean;
  onSend: (trimmed: string) => Promise<boolean>;
  onFocus: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || !ready || sending) return;
    setText('');
    setSending(true);
    const ok = await onSend(trimmed);
    if (!ok) setText(trimmed);
    setSending(false);
  }

  return (
    <div className="flex items-end gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="הודעה…"
        disabled={!isOnline}
        className="h-11 flex-1 rounded-full border border-ink-200 bg-ink-50 px-4 text-[15px]
                   placeholder:text-ink-400 focus:border-brand-400 focus:bg-white
                   focus:outline-none focus:ring-2 focus:ring-brand-500/25"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!isOnline || text.trim().length === 0}
        aria-label="שליחה"
        className="tap grid h-11 w-11 shrink-0 place-items-center rounded-full text-white
                   transition-transform duration-150 active:scale-90
                   bg-gradient-to-br from-brand-500 to-brand-700
                   disabled:from-ink-300 disabled:to-ink-300"
      >
        <SendIcon />
      </button>
    </div>
  );
});

/** ‼️ memo — אחרת כל רינדור של הדף (נוכחות, גובה viewport/מקלדת) מרנדר
 *  מחדש את כל הבועות ברשימה. */
const Bubble = memo(function Bubble({
  message,
  mine,
  recipientIds,
  senderName,
}: {
  message: WithId<ChatMessage>;
  mine: boolean;
  recipientIds: string[];
  /** מוצג רק בצ'אט הכללי, בתחילת רצף הודעות של מישהו שאינו אני */
  senderName?: string;
}) {
  const tick = mine ? tickFor(message, recipientIds) : null;

  return (
    <div
      className={[
        'max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm',
        mine
          ? 'rounded-ee-md bg-gradient-to-br from-brand-600 to-brand-700 text-white'
          : 'rounded-es-md border border-ink-100 bg-white text-ink-900',
      ].join(' ')}
    >
      {senderName && (
        <p className="mb-0.5 truncate text-xs font-bold text-brand-700">{senderName}</p>
      )}
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.text}</p>
      <div
        className={[
          'mt-0.5 flex items-center justify-end gap-1 text-[10px]',
          mine ? 'text-white/75' : 'text-ink-400',
        ].join(' ')}
      >
        <span className="num">{message.sentAt ? formatTime(message.sentAt) : ''}</span>
        {mine && tick && (
          <span className={tick === 'read' ? 'text-sky-300' : ''}>
            {tick === 'sent' ? (
              <CheckIcon width={13} height={13} />
            ) : (
              <CheckDoubleIcon width={15} height={13} />
            )}
          </span>
        )}
      </div>
    </div>
  );
});

/** חץ שליחה — פונה שמאלה, כיוון "קדימה" בממשק עברי */
function SendIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12H4.5M12 4.5 4.5 12 12 19.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
