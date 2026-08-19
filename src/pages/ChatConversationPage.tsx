import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRoom } from '../store/RoomContext';
import { useConnection } from '../store/ConnectionContext';
import { useRtdbList } from '../hooks/useRtdb';
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
  const { activeMembers, memberName } = useRoom();
  const { isOnline } = useConnection();

  const isGeneral = !otherUid;
  const myUid = user?.uid ?? '';

  const path = isGeneral
    ? generalChatPath(code!)
    : `${dmBasePath(code!, myUid, otherUid!)}/messages`;
  const scopeKey = isGeneral ? GENERAL_SCOPE : dmPairKey(myUid, otherUid ?? '');

  const other = !isGeneral ? activeMembers.find((m) => m.id === otherUid) : null;
  const title = isGeneral ? 'כללי' : (other?.name ?? memberName(otherUid ?? ''));

  const recipientIds = isGeneral
    ? activeMembers.map((m) => m.id).filter((id) => id !== myUid)
    : otherUid
      ? [otherUid]
      : [];

  const { data: messages } = useRtdbList<ChatMessage>(path);
  const sorted = useMemo(
    () => [...messages].sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0)),
    [messages]
  );

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const animatedIds = useRef<Set<string>>(new Set());

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
    const behavior = isFirstRender.current ? 'auto' : 'smooth';
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior });
    isFirstRender.current = false;
  }, [sorted.length]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || !user || !profile || !code || sending) return;
    setText('');
    setSending(true);
    try {
      if (isGeneral) {
        await sendGeneralMessage(
          code,
          user.uid,
          profile.displayName,
          activeMembers.map((m) => m.id),
          trimmed
        );
      } else if (otherUid) {
        await sendDirectMessage(code, user.uid, profile.displayName, otherUid, trimmed);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-ink-50">
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
          <Avatar name={title} uid={otherUid} src={other?.avatar} size="sm" />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-ink-900">{title}</h1>
          {isGeneral && (
            <p className="truncate text-xs text-ink-500">{activeMembers.length} חברים</p>
          )}
        </div>
      </header>

      {/* ── הודעות ── */}
      <div ref={listRef} className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 py-3 safe-x">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
              <ChatIcon width={22} height={22} />
            </span>
            <p className="text-sm text-ink-500">עדיין אין הודעות. תתחילו את השיחה!</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((m) => {
              const mine = m.senderId === myUid;
              const isNew = !animatedIds.current.has(m.id);
              animatedIds.current.add(m.id);
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'} ${
                    isNew ? 'animate-slide-up' : ''
                  }`}
                >
                  <Bubble message={m} mine={mine} recipientIds={recipientIds} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── שורת כתיבה — לא fixed, כך שהיא נשארת מעל המקלדת ── */}
      <div
        className="shrink-0 border-t border-ink-200/70 bg-white px-3 py-2.5 safe-x"
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
      </div>
    </div>
  );
}

function Bubble({
  message,
  mine,
  recipientIds,
}: {
  message: WithId<ChatMessage>;
  mine: boolean;
  recipientIds: string[];
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
}

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
