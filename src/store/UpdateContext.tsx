import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  APP_VERSION,
  canForceUpdate,
  clearForceAttempts,
  fetchRemoteVersion,
  isUpdateAvailable,
  performUpdate,
  recordForceAttempt,
  type VersionManifest,
} from '../lib/version';

export type UpdateStatus =
  | 'idle' // עוד לא נבדק
  | 'checking' // בבדיקה
  | 'current' // מעודכן
  | 'available' // יש עדכון שממתין לרגע בטוח (ובינתיים מוצג באנר)
  | 'updating' // מוריד מחדש את כל הקבצים
  | 'error'; // הבדיקה נכשלה (בד"כ אין רשת)

interface UpdateContextValue {
  status: UpdateStatus;
  /** המניפסט שנקרא מהשרת */
  remote: VersionManifest | null;
  /** הגרסה שרצה כרגע */
  current: string;
  lastCheckedAt: number | null;
  /** המשתמש בחר "אחר כך" */
  dismissed: boolean;
  /** ⚠️ true = כשל בכפיית עדכון, נדרשת התערבות ידנית */
  forceLoopDetected: boolean;
  checkNow: () => void;
  applyUpdate: () => void;
  dismiss: () => void;
}

const UpdateContext = createContext<UpdateContextValue>({
  status: 'idle',
  remote: null,
  current: APP_VERSION,
  lastCheckedAt: null,
  dismissed: false,
  forceLoopDetected: false,
  checkNow: () => {},
  applyUpdate: () => {},
  dismiss: () => {},
});

export const useUpdate = () => useContext(UpdateContext);

/** כל כמה זמן לבדוק מחדש בזמן שהאפליקציה פתוחה */
const POLL_INTERVAL_MS = 15 * 60 * 1000;

/**
 * ═══════════════════════════════════════════════════════════════════
 *  עדכון אוטומטי — ברירת המחדל
 * ═══════════════════════════════════════════════════════════════════
 *
 *  גרסה חדשה מותקנת מעצמה, בלי לשאול. קודם לכן העדכון חיכה ללחיצה,
 *  וזה נכשל בדיוק במקום שבו הוא הכי נחוץ: משתמש שתקוע במסך טעינה
 *  (ראו ההערה ב-index.html) לעולם לא יגיע לכפתור שיחלץ אותו. מנגנון
 *  העדכון הוא פתח המילוט של האפליקציה — הוא לא יכול להיות תלוי בכך
 *  שהמשתמש יראה משהו וילחץ עליו.
 *
 *  ‼️ מה שנשמר מהמנגנון הקודם, ולמה:
 *
 *   • שומר הלולאה (canForceUpdate) — חובה. version.json שעודכן בלי
 *     build תואם היה נועל את המשתמש בלולאת רענון אינסופית. אחרי שני
 *     ניסיונות מפסיקים, ונופלים לבאנר הידני.
 *
 *   • הבאנר — נשאר כרשת גיבוי לכל מקרה שבו העדכון האוטומטי נדחה או
 *     נחסם. הוא לא הדרך הרגילה יותר.
 *
 *  ‼️ ומה שנוסף: לא מרעננים באמצע הקלדה. performUpdate טוען את הדף
 *     מחדש, וטעינה מחדש בזמן שמישהו מקליד הודעה בצ'אט או ממלא סכום
 *     קנייה מוחקת לו את מה שכתב. במצב כזה העדכון ממתין — לרגע שבו
 *     האפליקציה עוברת לרקע, או לבדיקה הבאה. forceUpdate: true גובר
 *     גם על ההמתנה הזו, לשחרורים קריטיים.
 */

/**
 * האם המשתמש באמצע הקלדה.
 *
 * ‼️ isContentEditable ולא רק תגיות: שדות עשירים אינם input.
 */
function isUserTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [remote, setRemote] = useState<VersionManifest | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [forceLoopDetected, setForceLoopDetected] = useState(false);

  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** יש עדכון שממתין — נדחה כי המשתמש היה באמצע הקלדה */
  const pendingRef = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    if (!navigator.onLine) return; // אין רשת — אין מה לבדוק

    inFlight.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus((s) => (s === 'available' ? s : 'checking'));

    try {
      // מפעילים גם בדיקת עדכון ל-Service Worker עצמו, לא רק ל-version.json.
      // בלי זה SW חדש שהדפדפן כבר הוריד יכול לשבת "ממתין" בלי סיבה נראית
      // לעין — במיוחד בטאב דפדפן רגיל שלא עובר רענון מלא הרבה זמן.
      void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => undefined);

      const manifest = await fetchRemoteVersion(controller.signal);
      setRemote(manifest);
      setLastCheckedAt(Date.now());

      if (!isUpdateAvailable(manifest)) {
        // אנחנו מעודכנים — מאפסים את מונה הניסיונות הכפויים
        clearForceAttempts();
        pendingRef.current = false;
        setStatus('current');
        setDismissed(false);
        return;
      }

      // ── יש גרסה חדשה ──
      pendingRef.current = true;

      /**
       * ‼️ שומר הלולאה קודם לכל השאר.
       *
       * אם כבר ניסינו פעמיים באותו סשן והגרסה עדיין לא תואמת, סימן
       * ש-version.json עודכן בלי build מתאים. עוד ניסיון אוטומטי היה
       * רענון אינסופי שהמשתמש לא יכול לצאת ממנו — לכן מכאן והלאה
       * באנר ידני בלבד.
       */
      if (!canForceUpdate()) {
        setForceLoopDetected(true);
        setStatus('available');
        return;
      }

      // המתנה לרגע בטוח — אלא אם השחרור מסומן כקריטי
      if (!manifest.forceUpdate && isUserTyping()) {
        setStatus('available');
        return;
      }

      recordForceAttempt();
      setStatus('updating');
      void performUpdate();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setStatus('error');
      if (import.meta.env.DEV) console.warn('בדיקת גרסה נכשלה:', err);
    } finally {
      inFlight.current = false;
    }
  }, []);

  const applyUpdate = useCallback(() => {
    setStatus('updating');
    void performUpdate();
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    // 1) בדיקה מיידית בכניסה לאפליקציה
    void check();

    // 2) בכל חזרה לחזית — הדרך שבה משתמשי PWA "נכנסים מחדש":
    //    האפליקציה לא נסגרת, היא רק עוברת לרקע.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void check();
        return;
      }

      /**
       * ‼️ המעבר לרקע הוא הרגע הטוב ביותר לעדכן: המשתמש לא מסתכל, לא
       *    מקליד, ולא מאבד כלום — הוא פשוט יחזור לאפליקציה מעודכנת.
       *    בלי זה עדכון שנדחה בגלל הקלדה היה ממתין עד לבדיקה התקופתית
       *    הבאה (רבע שעה), או עד שהמשתמש יבחין בבאנר.
       */
      if (pendingRef.current && canForceUpdate()) {
        pendingRef.current = false;
        recordForceAttempt();
        void performUpdate();
      }
    };

    // 3) כשהרשת חוזרת
    const onOnline = () => void check();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onVisible);

    // 4) בדיקה תקופתית לסשנים ארוכים
    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [check]);

  return (
    <UpdateContext.Provider
      value={{
        status,
        remote,
        current: APP_VERSION,
        lastCheckedAt,
        dismissed,
        forceLoopDetected,
        checkNow: () => void check(),
        applyUpdate,
        dismiss,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}
