import { useEffect, useState } from 'react';
import { get, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from '../config/firebase';

/**
 * שמות החדרים של המשתמש, לפי קודים.
 *
 * ‼️ קריאה נקודתית לכל קוד ולא קריאה של roomCodes כולו: הכללים מתירים
 *    קריאה של `roomCodes/$code` בודד לכל משתמש מאומת (כך עובד מסך
 *    ההצטרפות), אבל סריקה של האוסף כולו חסומה — ובצדק, זו רשימת כל
 *    החדרים במערכת.
 *
 * ‼️ get ולא onValue: שם חדר כמעט לא משתנה, ומסך שמציג בורר חדרים לא
 *    צריך מנוי חי לכל אחד מהם.
 */
export function useMyRoomNames(codes: string[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = codes.join(',');

  useEffect(() => {
    if (!isFirebaseConfigured || codes.length === 0) return;
    let cancelled = false;

    void Promise.all(
      codes.map(async (code) => {
        try {
          const snap = await get(ref(db, `roomCodes/${code}/name`));
          return [code, (snap.val() as string | null) ?? code] as const;
        } catch {
          return [code, code] as const; // בלי שם — הקוד עצמו עדיף על ריק
        }
      })
    ).then((entries) => {
      if (!cancelled) setNames(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}
