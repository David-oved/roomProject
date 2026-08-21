import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useAdminMessages } from '../hooks/useAdminMessages';
import { useMyRoomNames } from '../hooks/useMyRoomNames';
import {
  BODY_MAX,
  SUBJECT_MAX,
  describeEnvironment,
  sendFeedback,
  validateFeedback,
  FeedbackValidationError,
} from '../services/feedbackService';
import { getSentFeedback } from '../lib/prefs';
import { formatSmartDate } from '../lib/format';
import {
  FEEDBACK_TYPE_EMOJI,
  FEEDBACK_TYPE_LABELS,
  type FeedbackType,
} from '../types/models';

const TYPES: FeedbackType[] = ['bug', 'feature', 'issue', 'question', 'compliment', 'other'];

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: 'מה ניסית לעשות, ומה קרה במקום? אם זה קורה כל פעם — כדאי לציין.',
  feature: 'מה היית רוצה שהאפליקציה תדע לעשות, ומתי זה היה עוזר לך?',
  issue: 'מה לא מסתדר בחדר? מאזן, חבר שלא מאושר, משהו אחר?',
  question: 'מה לא ברור? נסביר ונשפר את ההסבר באפליקציה.',
  compliment: 'מה עובד לך טוב? זה עוזר לדעת מה לא לשבור.',
  other: 'כתוב לנו מה על הפרק.',
};

/**
 * ═══════════════════════════════════════════════════════════════
 *  פנייה למנהל המערכת
 * ═══════════════════════════════════════════════════════════════
 *  ‼️ פרטי המכשיר מצורפים אוטומטית, ומוצגים למשתמש לפני השליחה.
 *     אוטומטית — כי דיווח בלי דפדפן וגרסה כמעט תמיד לא ניתן לשחזור.
 *     גלוי — כי צירוף מידע על המכשיר בלי שהמשתמש יודע הוא בדיוק
 *     סוג הדבר שגורם לאנשים להפסיק לדווח.
 * ═══════════════════════════════════════════════════════════════
 */
export default function FeedbackPage() {
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const { messages } = useAdminMessages();

  const myRooms = useMemo(() => Object.keys(profile?.rooms ?? {}), [profile?.rooms]);
  // הבורר מציג שמות ולא קודים — משתמש לא זוכר את החדר שלו לפי AB2K7Q
  const roomNames = useMyRoomNames(myRooms);
  const [roomCode, setRoomCode] = useState(() => params.get('room') ?? myRooms[0] ?? '');
  const [type, setType] = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const [showEnv, setShowEnv] = useState(false);

  const environment = useMemo(() => describeEnvironment(), []);
  const sentHistory = useMemo(() => getSentFeedback(), [sentId]);

  // תשובות שהגיעו — נמצאות בתיבת ההודעות, מקושרות לפי מזהה הפנייה
  const repliesByFeedback = useMemo(() => {
    const map = new Map<string, (typeof messages)[number]>();
    for (const m of messages) if (m.relatedFeedback) map.set(m.relatedFeedback, m);
    return map;
  }, [messages]);

  const effectiveRoom = roomCode || myRooms[0] || '';

  async function submit() {
    if (!user || sending) return;

    try {
      validateFeedback({ type, subject, body });
      setErrors({});
    } catch (err) {
      if (err instanceof FeedbackValidationError) {
        setErrors({ [err.field]: err.message });
        return;
      }
      throw err;
    }

    if (!effectiveRoom) {
      toast.error('צריך להיות חבר בחדר כדי לשלוח פנייה');
      return;
    }

    setSending(true);
    const id = await toast.run(() =>
      sendFeedback(effectiveRoom, user.uid, { type, subject, body })
    );
    setSending(false);

    if (id) {
      setSentId(id);
      setSubject('');
      setBody('');
    }
  }

  return (
    <>
      <TopBar title="פנייה למנהל המערכת" back />
      <PlainShell hasTopBar>
        <div className="space-y-4 py-4">
          {sentId ? (
            <div className="card bg-emerald-50 p-5 text-center">
              <div aria-hidden className="text-3xl">
                ✅
              </div>
              <h2 className="mt-2 text-base font-bold text-emerald-900">הפנייה נשלחה</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-emerald-800">
                תודה. מנהל המערכת רואה את הפנייה יחד עם פרטי המכשיר. אם תהיה תשובה, היא תגיע
                אליך כהודעה באפליקציה.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/messages">
                  <Button variant="secondary" fullWidth>
                    מעבר לתיבת ההודעות
                  </Button>
                </Link>
                <Button variant="ghost" fullWidth onClick={() => setSentId(null)}>
                  שליחת פנייה נוספת
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="card p-4">
                <p className="text-xs leading-relaxed text-ink-500">
                  זה הערוץ הישיר למי שמפתח את האפליקציה. כל פנייה נקראת, וגם אם אין תשובה מיידית
                  — היא נשמרת ומשפיעה על מה שנבנה הלאה.
                </p>
              </div>

              <div className="card p-4">
                <h2 className="text-sm font-bold text-ink-900">על מה מדובר?</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      aria-pressed={type === t}
                      className={`tap flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm
                                  transition ${
                                    type === t
                                      ? 'border-brand-600 bg-brand-50 font-bold text-brand-800'
                                      : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                                  }`}
                    >
                      <span aria-hidden>{FEEDBACK_TYPE_EMOJI[t]}</span>
                      <span className="truncate">{FEEDBACK_TYPE_LABELS[t]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card space-y-3.5 p-4">
                <Input
                  label="נושא"
                  value={subject}
                  maxLength={SUBJECT_MAX}
                  error={errors.subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="בשורה אחת — מה קרה?"
                />

                <Textarea
                  label="פירוט"
                  rows={6}
                  value={body}
                  maxLength={BODY_MAX}
                  error={errors.body}
                  hint={`${body.length}/${BODY_MAX}`}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={PLACEHOLDERS[type]}
                />

                {myRooms.length > 1 && (
                  <div className="space-y-1.5">
                    <label htmlFor="fb-room" className="block text-sm font-medium text-ink-700">
                      באיזה חדר זה קרה?
                    </label>
                    <select
                      id="fb-room"
                      value={effectiveRoom}
                      onChange={(e) => setRoomCode(e.target.value)}
                      className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-[16px]
                                 text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2
                                 focus:ring-brand-600"
                    >
                      {myRooms.map((code) => (
                        <option key={code} value={code}>
                          {roomNames[code] ? `${roomNames[code]} (${code})` : code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => setShowEnv((v) => !v)}
                    aria-expanded={showEnv}
                    className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline"
                  >
                    {showEnv ? 'הסתרת' : 'הצגת'} הפרטים שיישלחו יחד עם הפנייה
                  </button>
                  {showEnv && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-ink-50 p-3 text-xs">
                      {Object.entries(environment).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="text-ink-500">{key}</dt>
                          <dd className="font-medium text-ink-800">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <Button
                  fullWidth
                  loading={sending}
                  disabled={!isOnline || subject.trim().length === 0 || body.trim().length === 0}
                  onClick={() => void submit()}
                >
                  {isOnline ? 'שליחה' : 'אין חיבור לאינטרנט'}
                </Button>
              </div>
            </>
          )}

          {sentHistory.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-bold text-ink-900">הפניות ששלחתי</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                נשמר במכשיר הזה בלבד. תשובות מגיעות לתיבת ההודעות.
              </p>
              <ul className="mt-3 space-y-2">
                {sentHistory.map((entry) => {
                  const reply = repliesByFeedback.get(entry.id);
                  return (
                    <li key={entry.id} className="rounded-xl bg-ink-50 p-3">
                      <div className="flex items-start gap-2">
                        <span aria-hidden>
                          {FEEDBACK_TYPE_EMOJI[entry.type as FeedbackType] ?? '📝'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink-800">
                            {entry.subject}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-500">
                            {formatSmartDate(entry.createdAt)} · חדר {entry.roomCode}
                          </p>
                        </div>
                        {reply ? (
                          <Link
                            to="/messages"
                            className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px]
                                       font-semibold text-emerald-800"
                          >
                            נענתה
                          </Link>
                        ) : (
                          <span className="shrink-0 rounded-full bg-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                            נשלחה
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </PlainShell>
    </>
  );
}
