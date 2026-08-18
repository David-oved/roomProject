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
  | 'available' // יש עדכון, ממתין להחלטת המשתמש
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

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [remote, setRemote] = useState<VersionManifest | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [forceLoopDetected, setForceLoopDetected] = useState(false);

  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

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
        setStatus('current');
        setDismissed(false);
        return;
      }

      // ── יש גרסה חדשה ──
      if (manifest.forceUpdate) {
        if (canForceUpdate()) {
          // עדכון מיידי, בלי לשאול
          recordForceAttempt();
          setStatus('updating');
          void performUpdate();
          return;
        }
        // כפינו כבר פעמיים והגרסה עדיין לא תואמת — כנראה version.json
        // עודכן בלי build מחדש. מפסיקים לכפות כדי לא ללכוד את המשתמש.
        setForceLoopDetected(true);
      }

      setStatus('available');
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
      if (document.visibilityState === 'visible') void check();
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
