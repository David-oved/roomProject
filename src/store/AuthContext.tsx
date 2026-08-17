import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onValue, ref, serverTimestamp, set } from 'firebase/database';
import type { User } from 'firebase/auth';
import { db, isFirebaseConfigured } from '../config/firebase';
import { subscribeToAuth } from '../services/authService';
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

    const authUnsub = subscribeToAuth((user) => {
      profileUnsub?.();
      profileUnsub = undefined;

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
            void set(ref(db, `users/${user.uid}`), {
              email: user.email ?? '',
              displayName: user.displayName || 'משתמש',
              avatar: null,
              createdAt: serverTimestamp(),
              lastActiveAt: serverTimestamp(),
            });
            return;
          }
          setState({ user, profile: snap.val() as UserProfile, loading: false });
        },
        () => setState({ user, profile: null, loading: false })
      );
    });

    return () => {
      profileUnsub?.();
      authUnsub();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
