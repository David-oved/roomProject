import { useCallback, useEffect, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../config/firebase';
import { Button } from '../ui/Button';
import { BellIcon, ShareIcon } from '../ui/icons';
import { useAuth } from '../../store/AuthContext';
import { useConnection } from '../../store/ConnectionContext';
import { useToast } from '../../store/ToastContext';
import {
  getState,
  isIOS,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '../../services/pushService';
import { useHintRef } from '../../store/HintContext';

/**
 * הפעלת התראות פוש.
 *
 * מוצג במסך "החשבון שלי" ולא נדחף למשתמש בכניסה הראשונה — בקשת הרשאה
 * לפני שהמשתמש הבין מה האפליקציה עושה מקבלת "לא", והדפדפן לא ישאל
 * שוב. עדיף לבקש כשהוא כבר בפנים ומבין למה זה טוב לו.
 */
export function NotificationSettings() {
  const { user } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();

  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => void getState().then(setState), []);
  useEffect(refresh, [refresh]);
  const enableHintRef = useHintRef<HTMLButtonElement>(
    'notificationSettings.enable',
    'מבקש הרשאת דפדפן ומפעיל התראות למכשיר הזה'
  );

  if (!state) return null;

  async function enable() {
    if (!user) return;
    setBusy(true);
    try {
      await subscribeToPush(user.uid);
      await update(ref(db, `users/${user.uid}`), { pushEnabled: true });
      toast.success('התראות הופעלו');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function disable() {
    if (!user) return;
    setBusy(true);
    try {
      await unsubscribeFromPush(user.uid);
      await update(ref(db, `users/${user.uid}`), { pushEnabled: false });
      toast.info('התראות כובו');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  /* ── אייפון בטאב רגיל: אין מה לעשות עד שמתקינים ── */
  if (state.support === 'needs-install') {
    return (
      <section className="card p-4">
        <Header />
        <div className="mt-3 rounded-xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900">
          <p className="font-semibold">צריך להוסיף את האפליקציה למסך הבית</p>
          <p className="mt-1 text-[13px] opacity-90">
            באייפון, אפל מאפשרת התראות רק לאפליקציות שהותקנו למסך הבית. בטאב רגיל
            בספארי אין דרך לקבל אותן.
          </p>

          <ol className="mt-3 space-y-2 text-[13px]">
            <li className="flex items-start gap-2">
              <span className="num font-bold">1.</span>
              <span className="flex items-center gap-1.5">
                לחצו על כפתור השיתוף
                <ShareIcon width={16} height={16} className="inline text-amber-700" />
                בתחתית המסך
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="num font-bold">2.</span>
              <span>גללו ובחרו <b>"הוספה למסך הבית"</b></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="num font-bold">3.</span>
              <span>פתחו את RoomMate מהאייקון החדש וחזרו לכאן</span>
            </li>
          </ol>
        </div>
      </section>
    );
  }

  /* ── דפדפן שלא תומך ── */
  if (state.support === 'unsupported') {
    return (
      <section className="card p-4">
        <Header />
        <p className="mt-2 text-sm text-ink-500">
          הדפדפן הזה לא תומך בהתראות. נסו בכרום או בספארי מעודכן.
        </p>
      </section>
    );
  }

  /* ── ההרשאה נחסמה ── */
  if (state.permission === 'denied') {
    return (
      <section className="card p-4">
        <Header />
        <div className="mt-2 rounded-xl bg-rose-50 p-3 text-sm leading-relaxed text-rose-800">
          ההתראות חסומות עבור האתר הזה.
          <span className="mt-1 block text-xs opacity-90">
            {isIOS()
              ? 'הגדרות ← RoomMate ← התראות'
              : 'לחצו על אייקון המנעול בשורת הכתובת ← התראות ← אפשר'}
          </span>
        </div>
      </section>
    );
  }

  /* ── מצב תקין ── */
  return (
    <section className="card p-4">
      <Header />

      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        {state.subscribed
          ? 'המכשיר הזה מקבל התראות — גם כשהאפליקציה סגורה.'
          : 'קבלו התראה כשמאשרים לכם קנייה, כשמצטרפים לחדר, וכשחסר משהו דחוף.'}
      </p>

      <div className="mt-3">
        {state.subscribed ? (
          <Button variant="secondary" fullWidth loading={busy} onClick={disable}>
            כיבוי התראות במכשיר הזה
          </Button>
        ) : (
          <Button
            ref={enableHintRef}
            fullWidth
            loading={busy}
            disabled={!isOnline}
            icon={<BellIcon width={18} height={18} />}
            onClick={enable}
          >
            הפעלת התראות
          </Button>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        אירועים דחופים מגיעים מיד. כל השאר מגיע כתקציר אחד ביום ב-18:00, כדי שלא
        תוצפו בהתראות.
      </p>
    </section>
  );
}

function Header() {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold text-ink-700">
      <BellIcon width={17} height={17} />
      התראות
    </h2>
  );
}
