import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * ‼️ המפתח והלוגיקה כאן חייבים להישאר זהים בדיוק לסקריפט המוטבע
 * ב-index.html (שם, לא כאן, נקבע המצב שבו העמוד *מצטייר לראשונה* —
 * הרבה לפני שריאקט בכלל רץ). אם המפתח כאן ישתנה בלי לעדכן גם שם,
 * התוצאה היא מבזק של הערכה הלא-נכונה בכל טעינה: הדפדפן מצייר לפי
 * הסקריפט המוטבע, ואז React "מתקן" את זה רגע אחרי.
 */
const STORAGE_KEY = 'rm:theme';
const THEME_COLOR = { light: '#0f766e', dark: '#0f172a' } as const;

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage חסום (מצב פרטי מחמיר וכו') — נופלים ל'system' בשקט
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
}

interface ThemeValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const Ctx = createContext<ThemeValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => {},
});

export const useTheme = () => useContext(Ctx);

/**
 * ‼️ לא מנוהל ב-useState רגיל ל-DOM — applyTheme רץ גם בסקריפט המוטבע
 * לפני שהקומפוננטה הזו בכלל קיימת. הפרובایדר כאן רק *ממשיך* לסנכרן
 * את מה שכבר קרה, ומאזין לשינוי מערכת כשההעדפה 'system'.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference
  );

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // אין מה לעשות אם האחסון חסום — ההעדפה עדיין תחול בסשן הנוכחי
    }
  }, []);

  useEffect(() => {
    const next: ResolvedTheme = preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference;
    setResolved(next);
    applyTheme(next);

    if (preference !== 'system') return;

    // 'system': עוקבים חי אחרי שינוי הגדרת המכשיר בזמן שהאפליקציה פתוחה
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      const r: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
