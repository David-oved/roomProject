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

    const toList = (val: Record<string, T> | null) =>
      Object.entries(val ?? {}).map(([id, v]) => ({ ...(v as T), id }));

    // 1) הידרציה מיידית מהמטמון — לא מחכים לרשת
    void readCache<Record<string, T>>(path, uid).then((entry) => {
      if (entry && !gotLive && !cancelled) {
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
        setState((s) => (s.fromCache ? s : { ...s, loading: false, error }));
      }
    );

    return () => {
      cancelled = true;
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

    void readCache<T>(path, uid).then((entry) => {
      if (entry && !gotLive && !cancelled) {
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
        setState((s) => (s.fromCache ? s : { ...s, loading: false, error }));
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [path, uid]);

  return state;
}
