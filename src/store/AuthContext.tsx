import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { get, onValue, ref, serverTimestamp, set, update } from 'firebase/database';
import type { User } from 'firebase/auth';
import { db, isFirebaseConfigured } from '../config/firebase';
import { isRegistrationInProgress, subscribeToAuth } from '../services/authService';
import type { UserProfile } from '../types/models';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true });
export const useAuth = () => useContext(Ctx);

/**
 * דופק "נראה לאחרונה".
 *
 * ‼️ נכתב בכל *פתיחה* של האפליקציה ולא רק בהתחברות. authService מעדכן
 *    את lastActiveAt בכניסה עם סיסמה, אבל המשתמש הטיפוסי מתחבר פעם
 *    אחת ואז נשאר מחובר חודשים — ולכן בלי הדופק הזה כל מי שלא התנתק
 *    נראה כ"לא פעיל" בקונסולת הניהול, וחדר חי היה מסומן כנטוש.
 *
 * ‼️ מווסת לשעה: המטרה היא לדעת שהמשתמש חי, לא לתעד כל רענון מסך.
 */
const ACTIVE_THROTTLE_MS = 60 * 60 * 1000;
let lastTouchedAt = 0;

/**
 * ‼️ שעון עצר ל-onAuthStateChanged.
 *
 * `loading: true` כאן חוסם את *כל* האפליקציה — RequireAuth,
 * RequireGuest ו-RequireDeveloper כולם מציגים FullPageSpinner עד
 * שהוא יורד. ואם ה-SDK של Auth לא קורא ל-callback אף פעם (אתחול
 * ההתמדה נתקע בדפדפן שחוסם IndexedDB/localStorage — מצב סודי
 * ב-Samsung Internet, "חסימת נתוני אתרים"), אין שום דבר שיוריד אותו.
 * המשתמש נשאר מול ספינר לנצח, בלי שגיאה ובלי דרך להתקדם.
 *
 * אחרי הגבול הזה מתייחסים למצב כ"לא מחובר": המשתמש רואה את מסך
 * ההתחברות — מסך שאפשר לפעול בו — במקום ספינר אינסופי. אם התשובה
 * האמיתית תגיע אחר כך, ה-callback עדיין ירוץ ויעדכן את המצב.
 */
const AUTH_TIMEOUT_MS = 15_000;

function touchLastActive(uid: string): void {
  const now = Date.now();
  if (now - lastTouchedAt < ACTIVE_THROTTLE_MS) return;
  lastTouchedAt = now;
  void update(ref(db, `users/${uid}`), { lastActiveAt: serverTimestamp() }).catch(() => {
    /* נוחות ניטור בלבד — כישלון כאן לא אמור להפריע לאף אחד */
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ user: null, profile: null, loading: false });
      return;
    }

    let profileUnsub: (() => void) | undefined;
    let healTimer: number | undefined;

    const authTimer = window.setTimeout(() => {
      setState((s) => (s.loading ? { user: null, profile: null, loading: false } : s));
    }, AUTH_TIMEOUT_MS);

    const authUnsub = subscribeToAuth((user) => {
      window.clearTimeout(authTimer);
      profileUnsub?.();
      profileUnsub = undefined;
      window.clearTimeout(healTimer);

      if (!user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }

      // האזנה לפרופיל — כך שינוי שם משתקף מיד בכל המכשירים
      profileUnsub = onValue(
        ref(db, `users/${user.uid}`),
        (snap) => {
          if (!snap.exists()) {
            // ריפוי עצמי של משתמש "יתום": קיים ב-Authentication אך לא ב-DB.
            // קורה כשההרשמה נקטעה באמצע. ראו docs/06-edge-cases.md מקרה 15.

            /**
             * ‼️ משחררים את `loading` עוד לפני הריפוי.
             *
             * בלי זה המסלול הזה היה מסך טעינה אינסופי: כל עוד setState
             * לא נקרא, `loading` נשאר true וכל שומרי הסף מציגים ספינר.
             * וזה לא מקרה קצה של שנייה־שתיים — אם כתיבת הריפוי נכשלת
             * (אין הרשאה, אין רשת), הצומת לעולם לא יופיע וה-callback
             * הזה לעולם לא ייקרא שוב. המשתמש נתקע לצמיתות.
             *
             * profile: null הוא מצב חוקי ומטופל — כך בדיוק נראה גם
             * callback השגיאה כמה שורות מכאן, ו-OnboardingPage יודע
             * להציג מסך פעולה ("צרו חדר / הצטרפו") גם בלעדיו.
             */
            setState({ user, profile: null, loading: false });

            // ‼️ שתי הגנות מפני דריסת השם שהמשתמש הקליד:
            //  1. אם ההרשמה עדיין רצה — היא תכתוב את הפרופיל בעצמה.
            //  2. גם אחרת, ממתינים רגע ובודקים שוב, כי הכתיבה עשויה
            //     להיות באוויר. רק אם הפרופיל באמת חסר — יוצרים.
            if (isRegistrationInProgress()) return;

            healTimer = window.setTimeout(() => {
              void get(ref(db, `users/${user.uid}`)).then((fresh) => {
                if (fresh.exists() || isRegistrationInProgress()) return;
                void set(ref(db, `users/${user.uid}`), {
                  email: user.email ?? '',
                  displayName: user.displayName || 'משתמש',
                  avatar: null,
                  createdAt: serverTimestamp(),
                  lastActiveAt: serverTimestamp(),
                });
              });
            }, 2500);
            return;
          }
          setState({ user, profile: snap.val() as UserProfile, loading: false });
          touchLastActive(user.uid);
        },
        () => setState({ user, profile: null, loading: false })
      );
    });

    return () => {
      window.clearTimeout(authTimer);
      window.clearTimeout(healTimer);
      profileUnsub?.();
      authUnsub();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
