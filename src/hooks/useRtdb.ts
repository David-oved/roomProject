import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from '../config/firebase';
import { readCache, writeCache } from '../lib/cache';
import { useAuth } from '../store/AuthContext';

export interface RtdbState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  /** המידע המוצג הגיע מהמטמון המקומי ולא מהשרת */
  fromCache: boolean;
  cachedAt: number | null;
}

/**
 * ‼️ שעון עצר לחיבור שלא מגיע.
 *
 * onValue הוא הבטחה בלי תפוגה: כשאין חיבור פתוח ל-RTDB, ה-SDK פשוט
 * ממשיך לנסות בשקט — הוא לא קורא ל-callback ההצלחה *ולא* ל-callback
 * השגיאה. לכן `loading` נשאר true לנצח, וכל מסך שממתין לו מציג ספינר
 * לנצח. זה בדיוק מה שקרה למשתמשים שה-CSP חסם להם את ה-long-polling
 * (ראו ההערה ב-index.html): שום שגיאה, שום מסך — רק טעינה אינסופית.
 *
 * הגבול הזה הוא רשת הביטחון האחרונה: אחריו המסך מציג הודעת שגיאה עם
 * כפתור ניסיון חוזר, במקום ספינר. הוא נדיב בכוונה — ברשת סלולרית
 * איטית חיבור ראשון יכול לקחת כמה שניות טובות, ואסור שנקטע אותו.
 *
 * ‼️ השעון נעצר ברגע שהגיע *משהו* — נתונים חיים, שגיאה, או אפילו
 *    הידרציה מהמטמון — ולכן הוא לא נוגע במסך שכבר מציג תוכן.
 */
export const RTDB_CONNECT_TIMEOUT_MS = 20_000;

export class RtdbTimeoutError extends Error {
  constructor() {
    super('החיבור לשרת לא נוצר. בדקו את החיבור לאינטרנט ונסו שוב.');
    this.name = 'RtdbTimeoutError';
  }
}

/**
 * מאזין לצומת RTDB ומחזיר אותו כמערך, עם id מהמפתח.
 *
 * ‼️ כל onValue חייב להחזיר unsubscribe. בלי זה נצברות האזנות בכל
 *    מעבר מסך, והאפליקציה נתקעת אחרי כמה דקות.
 */
export function useRtdbList<T>(path: string | null): RtdbState<Array<T & { id: string }>> {
  const { user } = useAuth();
  const [state, setState] = useState<RtdbState<Array<T & { id: string }>>>({
    data: [],
    loading: true,
    error: null,
    fromCache: false,
    cachedAt: null,
  });

  const uid = user?.uid;

  useEffect(() => {
    if (!path || !uid || !isFirebaseConfigured) {
      setState({ data: [], loading: false, error: null, fromCache: false, cachedAt: null });
      return;
    }

    let gotLive = false;
    let cancelled = false;
    let settled = false;

    const toList = (val: Record<string, T> | null) =>
      Object.entries(val ?? {}).map(([id, v]) => ({ ...(v as T), id }));

    const timer = window.setTimeout(() => {
      if (settled || cancelled) return;
      settled = true;
      setState((s) =>
        s.loading ? { ...s, loading: false, error: new RtdbTimeoutError() } : s
      );
    }, RTDB_CONNECT_TIMEOUT_MS);

    // 1) הידרציה מיידית מהמטמון — לא מחכים לרשת
    void readCache<Record<string, T>>(path, uid).then((entry) => {
      if (entry && !gotLive && !cancelled) {
        settled = true;
        setState({
          data: toList(entry.value),
          loading: false,
          error: null,
          fromCache: true,
          cachedAt: entry.cachedAt,
        });
      }
    });

    // 2) האזנה חיה
    const unsubscribe = onValue(
      ref(db, path),
      (snap) => {
        gotLive = true;
        settled = true;
        const val = snap.val() as Record<string, T> | null;
        setState({
          data: toList(val),
          loading: false,
          error: null,
          fromCache: false,
          cachedAt: Date.now(),
        });
        void writeCache(path, uid, val); // 3) שיקוף למטמון
      },
      (error) => {
        // ‼️ אם כבר קיבלנו נתונים חיים, השגיאה כאן כמעט תמיד
        // permission_denied — למשל מנהל שהסיר את המשתמש מהחדר תוך
        // כדי שהמסך פתוח אצלו. בלי לנקות את data, החבר שהוסר ממשיך
        // לראות תמונה קפואה של החדר (חברים, כספים, הכל) לנצח, כי
        // בדיוק העדכון שהיה מראה לו "הוסרת" הוא זה שנחסם.
        settled = true;
        if (gotLive) {
          setState({ data: [], loading: false, error, fromCache: false, cachedAt: null });
        } else {
          setState((s) => (s.fromCache ? s : { ...s, loading: false, error }));
        }
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [path, uid]);

  return state;
}

/** גרסה לצומת יחיד (אובייקט ולא רשימה). */
export function useRtdbValue<T>(path: string | null): RtdbState<T | null> {
  const { user } = useAuth();
  const [state, setState] = useState<RtdbState<T | null>>({
    data: null,
    loading: true,
    error: null,
    fromCache: false,
    cachedAt: null,
  });

  const uid = user?.uid;

  useEffect(() => {
    if (!path || !uid || !isFirebaseConfigured) {
      setState({ data: null, loading: false, error: null, fromCache: false, cachedAt: null });
      return;
    }

    let gotLive = false;
    let cancelled = false;
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled || cancelled) return;
      settled = true;
      setState((s) =>
        s.loading ? { ...s, loading: false, error: new RtdbTimeoutError() } : s
      );
    }, RTDB_CONNECT_TIMEOUT_MS);

    void readCache<T>(path, uid).then((entry) => {
      if (entry && !gotLive && !cancelled) {
        settled = true;
        setState({
          data: entry.value,
          loading: false,
          error: null,
          fromCache: true,
          cachedAt: entry.cachedAt,
        });
      }
    });

    const unsubscribe = onValue(
      ref(db, path),
      (snap) => {
        gotLive = true;
        settled = true;
        const val = snap.val() as T | null;
        setState({
          data: val,
          loading: false,
          error: null,
          fromCache: false,
          cachedAt: Date.now(),
        });
        void writeCache(path, uid, val);
      },
      (error) => {
        // ראו ההערה המקבילה ב-useRtdbList — אותו תיקון, אותה סיבה.
        settled = true;
        if (gotLive) {
          setState({ data: null, loading: false, error, fromCache: false, cachedAt: null });
        } else {
          setState((s) => (s.fromCache ? s : { ...s, loading: false, error }));
        }
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [path, uid]);

  return state;
}
