import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, openStream, type StreamPayload } from './api';
import type { Bootstrap } from './types';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מצב גלובלי
 * ═══════════════════════════════════════════════════════════════
 *  שלושה דברים שכל מסך צריך:
 *   1. bootstrap — מילונים, רשימות חדרים/משתמשים, מצב חיבור.
 *   2. version — מונה שמתקדם בכל שינוי בבסיס הנתונים. כל הוק
 *      שמושך נתונים מאזין לו, וכך "חי" מתקבל בלי polling.
 *   3. הודעות מערכת (toasts) ואישורי פעולה.
 * ═══════════════════════════════════════════════════════════════
 */

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface StoreValue {
  boot: Bootstrap | null;
  loading: boolean;
  error: string | null;
  /** גרסת הנתונים בשרת — משתנה בכל שינוי ומפעיל רענון של כל ההוקים. */
  version: number;
  connected: boolean;
  lastPush: StreamPayload | null;
  refreshBoot: () => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastPush, setLastPush] = useState<StreamPayload | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refreshBoot = useCallback(() => {
    api
      .get<Bootstrap>('/bootstrap')
      .then((data) => {
        setBoot(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refreshBoot, [refreshBoot]);

  /* ── זרם השינויים ── */
  useEffect(() => {
    let retry: number | undefined;
    let close = () => {};

    const connect = () => {
      close = openStream(
        (payload) => {
          setConnected(true);
          setLastPush(payload);
          setVersion(payload.version);
        },
        () => {
          setConnected(false);
          // ניתוק זמני קורה (שינה של המחשב, הפעלה מחדש של השרת) —
          // חיבור מחדש בהשהיה במקום להשאיר מסך מת
          close();
          retry = window.setTimeout(connect, 3000);
        },
        () => setConnected(true)
      );
    };
    connect();

    return () => {
      window.clearTimeout(retry);
      close();
    };
  }, []);

  /* bootstrap מרענן את עצמו כשמשהו משתנה — מונים בסרגל הצד חייבים לזוז */
  useEffect(() => {
    if (version > 0) refreshBoot();
  }, [version, refreshBoot]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, text, kind }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      boot,
      loading,
      error,
      version,
      connected,
      lastPush,
      refreshBoot,
      toasts,
      toast,
      dismissToast,
    }),
    [boot, loading, error, version, connected, lastPush, refreshBoot, toasts, toast, dismissToast]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore חייב לרוץ בתוך StoreProvider');
  return ctx;
}

/** קיצור נוח — המילונים נדרשים כמעט בכל מסך. */
export function useDict() {
  const { boot } = useStore();
  return boot?.dictionaries;
}
