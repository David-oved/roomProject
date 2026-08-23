// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { User } from 'firebase/auth';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  AuthProvider — השער שחוסם את כל האפליקציה
 * ═══════════════════════════════════════════════════════════════════
 *
 *  `loading: true` כאן אינו מצב של מסך אחד: RequireAuth, RequireGuest
 *  ו-RequireDeveloper כולם מחזירים FullPageSpinner עד שהוא יורד. כל
 *  מסלול שמשאיר אותו true לנצח הוא מסך טעינה אינסופי לכל האפליקציה.
 *
 *  היו כאן שני מסלולים כאלה, ושניהם מכוסים למטה:
 *
 *   1. פרופיל "יתום" — משתמש שקיים ב-Authentication אך לא ב-RTDB
 *      (הרשמה שנקטעה). ה-callback זיהה את המצב, הפעיל ריפוי עצמי —
 *      ולא נגע ב-loading. אם כתיבת הריפוי נכשלת (אין הרשאה, אין רשת),
 *      הצומת לא מופיע, ה-callback לא נקרא שוב, והמשתמש תקוע לצמיתות.
 *
 *   2. onAuthStateChanged שלא נקרא כלל — קורה כשאתחול ההתמדה של
 *      Firebase Auth נתקע בדפדפן שחוסם IndexedDB/localStorage (מצב
 *      סודי ב-Samsung Internet, "חסימת נתוני אתרים"). בלי שעון עצר,
 *      אין שום דבר שיוריד את `loading`.
 */

let authCallback: ((u: User | null) => void) | null = null;
const subscribeToAuth = vi.fn((cb: (u: User | null) => void) => {
  authCallback = cb;
  return () => undefined;
});

const onValue = vi.fn();
const update = vi.fn(async () => undefined);
const set = vi.fn(async () => undefined);
const get = vi.fn(async () => ({ exists: () => false }));

vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path?: string) => ({ path }),
  onValue: (...args: unknown[]) => onValue(...args),
  update: (...args: unknown[]) => update(...(args as [])),
  set: (...args: unknown[]) => set(...(args as [])),
  get: (...args: unknown[]) => get(...(args as [])),
  serverTimestamp: () => ({ '.sv': 'timestamp' }),
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  isFirebaseConfigured: true,
}));

vi.mock('../../src/services/authService', () => ({
  subscribeToAuth: (cb: (u: User | null) => void) => subscribeToAuth(cb),
  isRegistrationInProgress: () => false,
}));

const { AuthProvider, useAuth } = await import('../../src/store/AuthContext');

const USER = { uid: 'uid-1', email: 'dana@example.com', displayName: 'דנה' } as User;

type AuthSnapshot = ReturnType<typeof useAuth>;

function renderAuth() {
  const sink: { current: AuthSnapshot | null } = { current: null };
  function Probe() {
    sink.current = useAuth();
    return null;
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  return sink;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  authCallback = null;
  subscribeToAuth.mockClear();
  onValue.mockReset();
  set.mockClear();
  get.mockClear();
  onValue.mockImplementation(() => () => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('מצב פתיחה', () => {
  it('מתחיל בטעינה עד שיש תשובה מ-Auth', () => {
    const sink = renderAuth();
    expect(sink.current?.loading).toBe(true);
    expect(subscribeToAuth).toHaveBeenCalled();
  });

  it('אין משתמש — יוצא מטעינה מיד', async () => {
    const sink = renderAuth();
    await act(async () => authCallback?.(null));

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.user).toBeNull();
  });
});

describe('onAuthStateChanged שלא נקרא לעולם', () => {
  it('אחרי שעון העצר — יוצא מטעינה כ"לא מחובר", ולא נשאר על ספינר', async () => {
    const sink = renderAuth();

    // ה-callback לא נקרא — בדיוק המצב בדפדפן שחוסם את אחסון ההתמדה
    await advance(30_000);

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.user).toBeNull();
  });

  it('תשובה שמגיעה באיחור עדיין מתקבלת', async () => {
    const sink = renderAuth();
    await advance(30_000);

    onValue.mockImplementation((_ref: unknown, onNext: (s: unknown) => void) => {
      onNext({ exists: () => true, val: () => ({ displayName: 'דנה', email: '' }) });
      return () => undefined;
    });
    await act(async () => authCallback?.(USER));

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.user?.uid).toBe('uid-1');
    expect(sink.current?.profile?.displayName).toBe('דנה');
  });
});

describe('פרופיל יתום — משתמש ב-Auth בלי צומת ב-RTDB', () => {
  beforeEach(() => {
    onValue.mockImplementation((_ref: unknown, onNext: (s: unknown) => void) => {
      onNext({ exists: () => false });
      return () => undefined;
    });
  });

  it('יוצא מטעינה מיד — גם לפני שהריפוי העצמי רץ', async () => {
    const sink = renderAuth();
    await act(async () => authCallback?.(USER));

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.user?.uid).toBe('uid-1');
    expect(sink.current?.profile).toBeNull();
  });

  it('נשאר מחוץ לטעינה גם כשכתיבת הריפוי נכשלת', async () => {
    set.mockRejectedValueOnce(new Error('permission_denied'));

    const sink = renderAuth();
    await act(async () => authCallback?.(USER));
    await advance(10_000);

    expect(sink.current?.loading).toBe(false);
  });

  it('הריפוי העצמי עדיין רץ — הבדיקה לא ויתרה עליו', async () => {
    renderAuth();
    await act(async () => authCallback?.(USER));
    await advance(5_000);

    expect(get).toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
  });
});

describe('שגיאת קריאה של הפרופיל', () => {
  it('יוצא מטעינה עם משתמש ובלי פרופיל', async () => {
    onValue.mockImplementation(
      (_ref: unknown, _onNext: unknown, onError: (e: Error) => void) => {
        onError(new Error('permission_denied'));
        return () => undefined;
      }
    );

    const sink = renderAuth();
    await act(async () => authCallback?.(USER));

    expect(sink.current?.loading).toBe(false);
    expect(sink.current?.user?.uid).toBe('uid-1');
    expect(sink.current?.profile).toBeNull();
  });
});
