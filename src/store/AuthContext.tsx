import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { get, onValue, ref, serverTimestamp, set } from 'firebase/database';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ user: null, profile: null, loading: false });
      return;
    }

    let profileUnsub: (() => void) | undefined;
    let healTimer: number | undefined;

    const authUnsub = subscribeToAuth((user) => {
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
            //
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
        },
        () => setState({ user, profile: null, loading: false })
      );
    });

    return () => {
      window.clearTimeout(healTimer);
      profileUnsub?.();
      authUnsub();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
