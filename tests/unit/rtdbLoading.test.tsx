// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  אף מסך לא נתקע על ספינר
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ‼️ הבדיקה שהייתה חסרה כשמשתמשי גלקסי דיווחו על מסך טעינה אינסופי.
 *
 *  onValue של RTDB הוא האזנה בלי תפוגה: כשאין חיבור פתוח לשרת, ה-SDK
 *  ממשיך לנסות בשקט — הוא לא קורא ל-callback ההצלחה, וגם לא לזה של
 *  השגיאה. כל מסך שממתין ל-`loading` פשוט לא יוצא ממנו לעולם, ולמשתמש
 *  אין אפילו הודעת שגיאה ללחוץ עליה.
 *
 *  זה קרה בפועל: ה-CSP חסם את מוביל ה-long-polling (ראו
 *  rtdbTransport.test.ts), החיבור לא נוצר אף פעם, ומכאן — ספינר לנצח.
 *  ה-CSP תוקן, אבל תקלת רשת אחרת תייצר בדיוק את אותו מצב. הבדיקות כאן
 *  שומרות על רשת הביטחון עצמה: אחרי RTDB_CONNECT_TIMEOUT_MS המסך חייב
 *  לצאת מטעינה — עם שגיאה שאפשר להציג ולנסות שוב.
 */

const onValue = vi.fn();
const readCache = vi.fn<[string, string], Promise<unknown>>();

vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => ({ path }),
  onValue: (...args: unknown[]) => onValue(...args),
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  isFirebaseConfigured: true,
}));

vi.mock('../../src/lib/cache', () => ({
  readCache: (path: string, uid: string) => readCache(path, uid),
  writeCache: async () => undefined,
}));

vi.mock('../../src/store/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' }, profile: null, loading: false }),
}));

const { RTDB_CONNECT_TIMEOUT_MS, useRtdbList, useRtdbValue } = await import(
  '../../src/hooks/useRtdb'
);

/** מדווח על המצב האחרון של ה-hook, בלי להיות תלוי ב-DOM. */
function probe<T extends { loading: boolean; error: Error | null }>(
  useHook: () => T,
  sink: { current: T | null }
) {
  return function Probe() {
    sink.current = useHook();
    return null;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  onValue.mockReset();
  readCache.mockReset();
  // ברירת מחדל: אין מטמון, והשרת לא עונה לעולם
  readCache.mockResolvedValue(null);
  onValue.mockImplementation(() => () => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** מריץ את הטיימרים ומאפשר ל-promise-ים התלויים להסתיים. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useRtdbValue — שרת ששותק', () => {
  it('מתחיל בטעינה', async () => {
    const sink: { current: ReturnType<typeof useRtdbValue> | null } = { current: null };
    const Probe = probe(() => useRtdbValue('suspensions/uid-1'), sink);
    render(<Probe />);

    expect(sink.current?.loading).toBe(true);
    expect(sink.current?.error).toBeNull();
  });

  it('עדיין בטעינה רגע לפני הגבול — לא קוטעים חיבור איטי', async () => {
    const sink: { current: ReturnType<typeof useRtdbValue> | null } = { current: null };
    const Probe = probe(() => useRtdbValue('suspensions/uid-1'), sink);
    render(<Probe />);

    await advance(RTDB_CONNECT_TIMEOUT_MS - 1000);
    expect(sink.current?.loading).toBe(true);
  });

  it('אחרי הגבול — יוצא מטעינה עם שגיאה שאפשר להציג', async () => {
    const sink: { current: ReturnType<typeof useRtdbValue> | null } = { current: null };
    const Probe = probe(() => useRtdbValue('suspensions/uid-1'), sink);
    render(<Probe />);

    await advance(RTDB_CONNECT_TIMEOUT_MS + 100);

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.error).toBeInstanceOf(Error);
    expect(sink.current?.error?.name).toBe('RtdbTimeoutError');
    // הודעה בעברית שמשתמש קצה יכול להבין
    expect(sink.current?.error?.message).toMatch(/[֐-׿]/);
  });
});

describe('useRtdbList — שרת ששותק', () => {
  it('אחרי הגבול — יוצא מטעינה עם שגיאה', async () => {
    const sink: { current: ReturnType<typeof useRtdbList> | null } = { current: null };
    const Probe = probe(() => useRtdbList('rooms/ROOM01/members'), sink);
    render(<Probe />);

    await advance(RTDB_CONNECT_TIMEOUT_MS + 100);

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.error?.name).toBe('RtdbTimeoutError');
  });
});

describe('הגבול לא דורס מסך שכבר יש בו תוכן', () => {
  it('נתונים חיים שהגיעו בזמן — אין שגיאת פסק זמן', async () => {
    onValue.mockImplementation((_ref: unknown, onNext: (snap: unknown) => void) => {
      onNext({ val: () => ({ a: { name: 'דנה' } }) });
      return () => undefined;
    });

    const sink: { current: ReturnType<typeof useRtdbList> | null } = { current: null };
    const Probe = probe(() => useRtdbList('rooms/ROOM01/members'), sink);
    render(<Probe />);

    await advance(RTDB_CONNECT_TIMEOUT_MS + 5000);

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.error).toBeNull();
    expect(sink.current?.data).toEqual([{ name: 'דנה', id: 'a' }]);
  });

  it('הידרציה מהמטמון עוצרת את השעון — offline מציג תוכן, לא שגיאה', async () => {
    readCache.mockResolvedValue({
      value: { a: { name: 'דנה' } },
      cachedAt: 1_700_000_000_000,
      uid: 'uid-1',
    });

    const sink: { current: ReturnType<typeof useRtdbList> | null } = { current: null };
    const Probe = probe(() => useRtdbList('rooms/ROOM01/members'), sink);
    render(<Probe />);

    await advance(RTDB_CONNECT_TIMEOUT_MS + 5000);

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.fromCache).toBe(true);
    expect(sink.current?.error).toBeNull();
  });

  it('שגיאה אמיתית מהשרת גוברת — ולא מוחלפת בפסק זמן', async () => {
    onValue.mockImplementation(
      (_ref: unknown, _onNext: unknown, onError: (e: Error) => void) => {
        onError(Object.assign(new Error('permission_denied'), { code: 'permission_denied' }));
        return () => undefined;
      }
    );

    const sink: { current: ReturnType<typeof useRtdbValue> | null } = { current: null };
    const Probe = probe(() => useRtdbValue('rooms/ROOM01/metadata'), sink);
    render(<Probe />);

    await advance(RTDB_CONNECT_TIMEOUT_MS + 5000);

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.error?.message).toBe('permission_denied');
  });
});

describe('ניקוי', () => {
  it('פירוק הרכיב מבטל את השעון — אין setState אחרי unmount', async () => {
    const sink: { current: ReturnType<typeof useRtdbValue> | null } = { current: null };
    const Probe = probe(() => useRtdbValue('suspensions/uid-1'), sink);
    const { unmount } = render(<Probe />);

    unmount();
    const after = sink.current;

    await advance(RTDB_CONNECT_TIMEOUT_MS + 5000);

    // המצב האחרון לא השתנה אחרי הפירוק
    expect(sink.current).toBe(after);
  });
});
