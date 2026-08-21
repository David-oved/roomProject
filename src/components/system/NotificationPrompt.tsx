import { useEffect, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../config/firebase';
import { Button } from '../ui/Button';
import { BellIcon, CloseIcon, ShareIcon } from '../ui/icons';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { getState, subscribeToPush, type PushState } from '../../services/pushService';
import { useHintRef } from '../../store/HintContext';

const DISMISS_KEY = 'rm:push-prompt-dismissed';

/**
 * הזמנה להפעיל התראות, במסך הבית.
 *
 * למה יזום ולא רק בהגדרות: משתמש לא הולך לחפש "הגדרות ← התראות".
 * הוא מצפה שישאלו אותו, וכשלא שואלים הוא מסיק שאין התראות בכלל.
 *
 * ולמה לא מיד בכניסה הראשונה: בקשת הרשאה לפני שהמשתמש הבין מה
 * האפליקציה עושה מקבלת "לא" — ואז הדפדפן לא ישאל שוב לעולם, וגם
 * אנחנו לא נוכל. עדיף לשאול כשהוא כבר בפנים, בחדר פעיל.
 */
export function NotificationPrompt() {
  const { user } = useAuth();
  const toast = useToast();

  const [state, setState] = useState<PushState | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const enableHintRef = useHintRef<HTMLButtonElement>(
    'notificationPrompt.enable',
    'מבקש הרשאת דפדפן ומפעיל התראות למכשיר הזה'
  );

  useEffect(() => {
    void getState().then(setState);
  }, []);

  if (!state || dismissed) return null;
  if (state.subscribed) return null;
  // "denied" = הדפדפן כבר חסם. אין טעם לבקש שוב, רק להציק.
  if (state.permission === 'denied') return null;
  if (state.support === 'unsupported') return null;

  function hide() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* מצב פרטי */
    }
  }

  async function enable() {
    if (!user) return;
    setBusy(true);
    try {
      await subscribeToPush(user.uid);
      await update(ref(db, `users/${user.uid}`), { pushEnabled: true });
      toast.success('התראות הופעלו 🔔');
      setState(await getState());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /* ── אייפון בטאב רגיל: קודם התקנה ── */
  if (state.support === 'needs-install') {
    return (
      <section className="relative rounded-card border border-amber-200 bg-amber-50 p-4">
        <DismissButton onClick={hide} />

        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"
          >
            <BellIcon width={19} height={19} />
          </span>
          <div className="min-w-0 flex-1 pe-6">
            <h3 className="font-bold text-amber-900">רוצה לקבל התראות לטלפון?</h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
              באייפון זה אפשרי רק אחרי הוספה למסך הבית:
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-amber-900">
              לחצו על
              <ShareIcon width={16} height={16} className="inline" />
              בתחתית המסך ← <b>הוספה למסך הבית</b>
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* ── אפשר לבקש ── */
  return (
    <section className="relative rounded-card border border-brand-200 bg-gradient-to-b from-brand-50 to-white p-4">
      <DismissButton onClick={hide} />

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"
        >
          <BellIcon width={19} height={19} />
        </span>

        <div className="min-w-0 flex-1 pe-6">
          <h3 className="font-bold text-ink-900">קבלו התראות לטלפון</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            כשמאשרים לכם קנייה, כשמצטרפים לחדר, וכשחסר משהו דחוף — גם כשהאפליקציה
            סגורה.
          </p>

          <Button
            ref={enableHintRef}
            className="mt-3"
            size="sm"
            loading={busy}
            icon={<BellIcon width={17} height={17} />}
            onClick={enable}
          >
            הפעלת התראות
          </Button>
        </div>
      </div>
    </section>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="סגירה"
      className="tap absolute end-1 top-1 grid place-items-center rounded-full
                 text-ink-500 transition hover:bg-black/5 hover:text-ink-600"
    >
      <CloseIcon width={17} height={17} />
    </button>
  );
}
