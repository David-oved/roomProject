import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

/**
 * הוק שליפה בסיסי.
 *
 * ‼️ תלוי ב-version מהחנות: כשהשרת מודיע על שינוי, כל שליפה פעילה
 *    רצה מחדש. זה כל מנגנון ה"זמן אמת" של הממשק — אין polling ואין
 *    כפתור רענון שצריך לזכור ללחוץ.
 *
 * live=false לשליפות שלא צריכות להתעדכן לבד (דוח שנוצר, ייצוא).
 */
export function useApi<T>(
  path: string | null,
  params?: Record<string, string | number | undefined | null>,
  options: { live?: boolean } = {}
) {
  const { version, toast } = useStore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const live = options.live !== false;
  const key = JSON.stringify(params ?? {});
  const requestId = useRef(0);

  const load = useCallback(
    (silent = false) => {
      if (!path) {
        setData(null);
        setLoading(false);
        return;
      }
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      api
        .get<T>(path, params)
        .then((result) => {
          // תשובה של בקשה ישנה שהגיעה מאוחר לא תדרוס תשובה חדשה
          if (id !== requestId.current) return;
          setData(result);
          setError(null);
        })
        .catch((err) => {
          if (id !== requestId.current) return;
          setError(err.message);
          if (!silent) toast(err.message, 'error');
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, key, toast]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    if (live && version > 0) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, live]);

  return { data, loading, error, reload: () => load(true), setData };
}

/** פעולות כתיבה — עם מצב "בביצוע" והודעה אוטומטית על שגיאה. */
export function useAction() {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, successMessage?: string): Promise<T | null> => {
      setBusy(true);
      try {
        const result = await fn();
        if (successMessage) toast(successMessage, 'success');
        return result;
      } catch (err) {
        toast(err instanceof Error ? err.message : 'הפעולה נכשלה', 'error');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  return { run, busy };
}
