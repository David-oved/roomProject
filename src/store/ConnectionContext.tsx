import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onValue, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from '../config/firebase';
import { setOnlineState } from '../services/guard';

interface ConnectionValue {
  /** האמת היחידה: יש רשת **ו**יש חיבור פתוח ל-Firebase */
  isOnline: boolean;
  /** מתי בפעם האחרונה היינו מחוברים */
  lastSyncAt: number | null;
}

const Ctx = createContext<ConnectionValue>({ isOnline: true, lastSyncAt: null });
export const useConnection = () => useContext(Ctx);

/** השהיה לפני שמכריזים על ניתוק — מונעת הבהוב בחיבורים מחדש קצרים */
const DISCONNECT_DEBOUNCE_MS = 2000;

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [fbConnected, setFbConnected] = useState(true);
  const [navOnline, setNavOnline] = useState(() => navigator.onLine);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const debounce = useRef<number | undefined>(undefined);

  // מקור 1 — ה-WebSocket מול Firebase (האמת האמיתית)
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    return onValue(ref(db, '.info/connected'), (snap) => {
      const connected = snap.val() === true;
      window.clearTimeout(debounce.current);

      if (connected) {
        setFbConnected(true); // חיבור — מיד
        setLastSyncAt(Date.now());
      } else {
        debounce.current = window.setTimeout(
          () => setFbConnected(false),
          DISCONNECT_DEBOUNCE_MS
        );
      }
    });
  }, []);

  // מקור 2 — הדפדפן. מזהה מצב טיסה מיידית, לפני ש-Firebase שם לב.
  useEffect(() => {
    const on = () => setNavOnline(true);
    const off = () => setNavOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const isOnline = navOnline && fbConnected;

  // מזרים את המצב לשכבת ה-services, שאינה מכירה React
  useEffect(() => {
    setOnlineState(isOnline);
  }, [isOnline]);

  return <Ctx.Provider value={{ isOnline, lastSyncAt }}>{children}</Ctx.Provider>;
}
