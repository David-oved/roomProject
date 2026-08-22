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
import { OfflineError } from '../services/guard';
import { friendlyError } from '../lib/errors';
import { CheckIcon, CloseIcon, InfoIcon, OfflineIcon, type IconProps } from '../components/ui/icons';

type ToastTone = 'success' | 'error' | 'warn' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  info: (msg: string) => void;
  /** עוטף קריאת service ומתרגם שגיאות להודעה בעברית */
  run: <T>(fn: () => Promise<T>) => Promise<T | null>;
}

const Ctx = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  run: async () => null,
});

export const useToast = () => useContext(Ctx);

/**
 * ‼️ הגוונים כאן נבחרו לפי יחס ניגודיות מדוד מול טקסט לבן, לא לפי העין:
 *   warn   amber-500 = 2.15:1  →  amber-700 = 5.02:1
 *          זה הגוון של טוסט "אין חיבור לאינטרנט" — ההודעה שהכי חשוב
 *          שתיקרא, ובדיוק היא הייתה הכי פחות קריאה.
 *   success emerald-600 = 3.77:1 → emerald-700 = 5.48:1
 *   error   rose-600 = 4.70:1 ו-info ink-800 = 14.63:1 — עוברים, לא נגענו.
 */
const TONE_STYLES: Record<ToastTone, string> = {
  success: 'bg-emerald-700 text-white',
  error: 'bg-rose-600 text-white',
  warn: 'bg-amber-700 text-white',
  info: 'bg-ink-800 text-white',
};

const TONE_ICONS: Record<ToastTone, (p: IconProps) => JSX.Element> = {
  success: CheckIcon,
  error: CloseIcon,
  warn: OfflineIcon,
  info: InfoIcon,
};

const DURATION_MS = 3800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);

    const timer = window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, DURATION_MS);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(window.clearTimeout);
  }, []);

  const success = useCallback((m: string) => push('success', m), [push]);
  const error = useCallback((m: string) => push('error', m), [push]);
  const warn = useCallback((m: string) => push('warn', m), [push]);
  const info = useCallback((m: string) => push('info', m), [push]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof OfflineError) {
          push('warn', err.message);
        } else {
          push('error', friendlyError(err));
        }
        if (import.meta.env.DEV) console.error(err);
        return null;
      }
    },
    [push]
  );

  // ‼️ אובייקט חדש בכל רינדור כאן = כל האפליקציה מרונדרת מחדש בכל טוסט,
  // וה-Provider הזה עוטף את הכל. push יציב, ולכן ה-API הזה נוצר פעם אחת.
  const api = useMemo<ToastApi>(
    () => ({ success, error, warn, info, run }),
    [success, error, warn, info, run]
  );

  return (
    <Ctx.Provider value={api}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4"
        style={{ top: 'calc(var(--safe-top) + 0.75rem)' }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const Icon = TONE_ICONS[t.tone];
          return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-2.5
                        rounded-xl px-4 py-3 text-sm font-medium shadow-lifted ${TONE_STYLES[t.tone]}`}
          >
            <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center
                                         rounded-full bg-white/20">
              <Icon width={12} height={12} strokeWidth={2.6} />
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
          </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
