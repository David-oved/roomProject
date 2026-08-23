// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  עדכון תוכנה בלי אישור משתמש
 * ═══════════════════════════════════════════════════════════════════
 *
 *  גרסה חדשה חייבת להגיע למשתמש בלי שיצטרך ללחוץ על שום דבר.
 *
 *  ‼️ למה זה קריטי ולא נוחות: מנגנון העדכון הוא פתח המילוט של
 *     האפליקציה — הוא רץ מחוץ לשער האימות ובכל מצב, גם כשכל השאר
 *     שבור (ראו ההערה ב-App.tsx). משתמש שתקוע במסך טעינה לעולם לא
 *     יראה באנר ולא ילחץ על כפתור. עדכון שממתין ללחיצה הוא בדיוק
 *     עדכון שלא יגיע למי שהכי זקוק לו.
 *
 *  ושלוש הגנות שחייבות לשרוד את השינוי:
 *   1. שומר הלולאה — version.json בלי build תואם היה מרענן לנצח.
 *   2. לא מרעננים באמצע הקלדה — רענון מוחק למשתמש את מה שכתב.
 *   3. אין רשת → אין בדיקה בכלל.
 */

const fetchRemoteVersion = vi.fn();
const isUpdateAvailable = vi.fn();
const performUpdate = vi.fn();
const canForceUpdate = vi.fn(() => true);
const recordForceAttempt = vi.fn();
const clearForceAttempts = vi.fn();

vi.mock('../../src/lib/version', () => ({
  APP_VERSION: '1.0.0',
  BUILD_TIME: 'test',
  BUILD_ID: 'test',
  fetchRemoteVersion: (...a: unknown[]) => fetchRemoteVersion(...a),
  isUpdateAvailable: (...a: unknown[]) => isUpdateAvailable(...a),
  performUpdate: () => performUpdate(),
  canForceUpdate: () => canForceUpdate(),
  recordForceAttempt: () => recordForceAttempt(),
  clearForceAttempts: () => clearForceAttempts(),
}));

const { UpdateProvider, useUpdate } = await import('../../src/store/UpdateContext');

const MANIFEST = (over: Record<string, unknown> = {}) => ({
  version: '1.1.0',
  forceUpdate: false,
  title: 'עדכון',
  notes: [],
  ...over,
});

type Snapshot = ReturnType<typeof useUpdate>;

function renderProvider() {
  const sink: { current: Snapshot | null } = { current: null };
  function Probe() {
    sink.current = useUpdate();
    return null;
  }
  render(
    <UpdateProvider>
      <Probe />
    </UpdateProvider>
  );
  return sink;
}

/** נותן ל-check() האסינכרוני להסתיים. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  fetchRemoteVersion.mockReset();
  isUpdateAvailable.mockReset();
  performUpdate.mockReset();
  canForceUpdate.mockReset();
  recordForceAttempt.mockReset();
  clearForceAttempts.mockReset();

  canForceUpdate.mockReturnValue(true);
  fetchRemoteVersion.mockResolvedValue(MANIFEST());
  isUpdateAvailable.mockReturnValue(true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('גרסה חדשה מותקנת מעצמה', () => {
  it('‼️ מתעדכן בלי שאיש לחץ על כלום', async () => {
    renderProvider();
    await settle();

    expect(performUpdate).toHaveBeenCalledTimes(1);
  });

  it('המסך עובר למצב "מעדכן" — המשתמש רואה מה קורה', async () => {
    const sink = renderProvider();
    await settle();

    expect(sink.current?.status).toBe('updating');
  });

  it('כל עדכון אוטומטי נספר בשומר הלולאה', async () => {
    renderProvider();
    await settle();

    expect(recordForceAttempt).toHaveBeenCalledTimes(1);
  });

  it('אין גרסה חדשה — לא נוגעים בכלום', async () => {
    isUpdateAvailable.mockReturnValue(false);
    const sink = renderProvider();
    await settle();

    expect(performUpdate).not.toHaveBeenCalled();
    expect(sink.current?.status).toBe('current');
    expect(clearForceAttempts).toHaveBeenCalled();
  });

  it('אין רשת — אין בדיקה ואין עדכון', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderProvider();
    await settle();

    expect(fetchRemoteVersion).not.toHaveBeenCalled();
    expect(performUpdate).not.toHaveBeenCalled();
  });

  it('כשל בשליפת המניפסט לא מרענן כלום', async () => {
    fetchRemoteVersion.mockRejectedValue(new Error('offline'));
    const sink = renderProvider();
    await settle();

    expect(performUpdate).not.toHaveBeenCalled();
    expect(sink.current?.status).toBe('error');
  });
});

describe('שומר הלולאה — ההגנה שאסור לאבד', () => {
  /**
   * ‼️ בלי זה: version.json עם גרסה שה-build לא מכיר = רענון אינסופי
   *    שהמשתמש לא יכול לצאת ממנו. עדכון אוטומטי הופך את זה מתרחיש
   *    נדיר לתרחיש שקורה לכולם בבת אחת.
   */
  it('אחרי מכסת הניסיונות — מפסיקים לרענן ונופלים לבאנר', async () => {
    canForceUpdate.mockReturnValue(false);
    const sink = renderProvider();
    await settle();

    expect(performUpdate).not.toHaveBeenCalled();
    expect(sink.current?.status).toBe('available');
    expect(sink.current?.forceLoopDetected).toBe(true);
  });

  it('גם forceUpdate: true לא עוקף את שומר הלולאה', async () => {
    canForceUpdate.mockReturnValue(false);
    fetchRemoteVersion.mockResolvedValue(MANIFEST({ forceUpdate: true }));
    renderProvider();
    await settle();

    expect(performUpdate).not.toHaveBeenCalled();
  });

  it('הבאנר עדיין מאפשר עדכון ידני כשהאוטומטי נעצר', async () => {
    canForceUpdate.mockReturnValue(false);
    const sink = renderProvider();
    await settle();

    act(() => sink.current?.applyUpdate());
    expect(performUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('לא מרעננים באמצע הקלדה', () => {
  /** מדמה שדה קלט ממוקד. */
  function focusInput() {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    return input;
  }

  it('המשתמש מקליד — העדכון ממתין ולא מוחק לו את מה שכתב', async () => {
    focusInput();
    const sink = renderProvider();
    await settle();

    expect(performUpdate).not.toHaveBeenCalled();
    expect(sink.current?.status).toBe('available');
  });

  it('‼️ forceUpdate: true גובר גם על ההקלדה — לשחרורים קריטיים', async () => {
    focusInput();
    fetchRemoteVersion.mockResolvedValue(MANIFEST({ forceUpdate: true }));
    renderProvider();
    await settle();

    expect(performUpdate).toHaveBeenCalledTimes(1);
  });

  it('מעבר לרקע מחיל את העדכון שהמתין — בלי לחכות לבדיקה הבאה', async () => {
    focusInput();
    renderProvider();
    await settle();
    expect(performUpdate).not.toHaveBeenCalled();

    // המשתמש יצא מהאפליקציה — הרגע הבטוח ביותר לעדכן
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(performUpdate).toHaveBeenCalledTimes(1);
  });

  it('מעבר לרקע בלי עדכון ממתין לא עושה כלום', async () => {
    isUpdateAvailable.mockReturnValue(false);
    renderProvider();
    await settle();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(performUpdate).not.toHaveBeenCalled();
  });
});
