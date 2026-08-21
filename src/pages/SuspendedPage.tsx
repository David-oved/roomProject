import { useState } from 'react';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { useSuspension } from '../hooks/useAdminMessages';
import { sendFeedback } from '../services/feedbackService';
import { logout } from '../services/authService';
import { formatFullDate } from '../lib/format';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מסך חסימה
 * ═══════════════════════════════════════════════════════════════
 *  מוצג במקום כל תוכן כשקיים suspensions/{uid}. שלושה דברים שהמסך
 *  הזה חייב לעשות, ובלעדיהם הוא רק מתסכל:
 *
 *   1. לומר *למה* — הסיבה שהמנהל רשם, אם רשם.
 *   2. לומר *מתי* — כדי שיהיה ברור שזו החלטה ולא תקלה.
 *   3. לתת דרך לענות. חסימה בלי ערעור היא קיר, וקיר גורם לאנשים
 *      לפתוח חשבון חדש במקום לתקן את מה שקרה.
 *
 *  ‼️ החסימה עצמה אינה נאכפת כאן. המסך הוא חוויית משתמש; מה שבאמת
 *     חוסם הוא שהקונסולה מסירה גישה בצד הנתונים.
 * ═══════════════════════════════════════════════════════════════
 */
export default function SuspendedPage() {
  const { user, profile } = useAuth();
  const { suspension } = useSuspension();
  const toast = useToast();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // הערעור נשלח דרך ערוץ המשוב הרגיל, ולכן הוא צריך חדר שהמשתמש
  // חבר בו. מי שאינו חבר באף חדר לא יכול לכתוב — ואז נשארת רק
  // הודעת ההסבר, בלי טופס שייכשל בשליחה.
  const roomCode = Object.keys(profile?.rooms ?? {})[0] ?? null;

  async function submitAppeal() {
    if (!user || !roomCode || !text.trim() || sending) return;
    setSending(true);
    const result = await toast.run(() =>
      sendFeedback(roomCode, user.uid, {
        type: 'issue',
        subject: 'ערעור על חסימת חשבון',
        body: text.trim(),
      })
    );
    setSending(false);
    if (result) {
      setSent(true);
      setText('');
      toast.success('הערעור נשלח. נחזור אליך בהודעה באפליקציה.');
    }
  }

  return (
    <PlainShell>
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-4 py-10">
        <div className="card p-6 text-center">
          <div aria-hidden className="text-4xl">
            🚫
          </div>
          <h1 className="mt-3 text-lg font-bold text-ink-900">החשבון שלך מושהה</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            מנהל המערכת השהה את הגישה לחשבון הזה. הנתונים והחדרים שלך נשמרים במלואם, ויחזרו
            ברגע שההשהיה תוסר.
          </p>

          {suspension?.reason && (
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-start">
              <p className="text-xs font-semibold text-rose-800">הסיבה שנרשמה</p>
              <p className="mt-0.5 text-sm text-rose-900">{suspension.reason}</p>
            </div>
          )}

          {suspension?.at && (
            <p className="mt-3 text-xs text-ink-500">מתאריך {formatFullDate(suspension.at)}</p>
          )}
        </div>

        {roomCode && !sent && (
          <div className="card p-4">
            <h2 className="text-sm font-bold text-ink-900">חושב שזו טעות?</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              אפשר לכתוב כאן, וההודעה תגיע ישירות למנהל המערכת. התשובה תופיע במסך הזה.
            </p>
            <div className="mt-3">
              <Textarea
                label="מה תרצה שנדע?"
                rows={4}
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                placeholder="למשל: לא ביצעתי את מה שמתואר, או שיש כאן אי הבנה…"
              />
            </div>
            <Button
              className="mt-3"
              fullWidth
              loading={sending}
              disabled={text.trim().length === 0}
              onClick={() => void submitAppeal()}
            >
              שליחת ערעור
            </Button>
          </div>
        )}

        {sent && (
          <div className="card bg-emerald-50 p-4 text-center">
            <p className="text-sm font-semibold text-emerald-900">הערעור נשלח</p>
            <p className="mt-1 text-xs text-emerald-800">
              מנהל המערכת יראה אותו יחד עם פרטי החשבון. התשובה תגיע כהודעה באפליקציה.
            </p>
          </div>
        )}

        <Button variant="secondary" fullWidth onClick={() => void logout()}>
          התנתקות
        </Button>

        <p className="text-center text-xs text-ink-400">{user?.email}</p>
      </div>
    </PlainShell>
  );
}
