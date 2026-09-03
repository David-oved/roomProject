// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  חברות בכמה חדרים — ומה המשתמש רואה כשהוא נכנס עם חשבון פתוח
 * ═══════════════════════════════════════════════════════════════════
 *
 *  users/{uid}/rooms הוא מפה, לא ערך יחיד, ואין בשום מקום — לא בקוד
 *  ולא ב-database.rules.json — תקרה על מספר החדרים. חברות בשני חדרים
 *  היא מצב נתמך ומתוכנן, לא מקרה קצה.
 *
 *  כל ההחלטה מה המשתמש רואה בכניסה מרוכזת ב-OnboardingPage, וזה מה
 *  שנבדק כאן. RequireGuest שולח לשם כל משתמש מחובר שמגיע למסך
 *  התחברות, ו-"/" מפנה לשם גם הוא — ולכן זה המסך שכל בעל "חשבון
 *  פתוח" נוחת בו, בלי קשר לאיך הגיע.
 */

const useAuth = vi.fn();
const useRtdbValue = vi.fn();
const getLastRoom = vi.fn<[], string | null>();

vi.mock('../../src/store/AuthContext', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('../../src/hooks/useRtdb', () => ({
  useRtdbValue: (path: string | null) => useRtdbValue(path),
  useRtdbList: () => ({ data: [], loading: false, error: null, fromCache: false, cachedAt: null }),
}));

vi.mock('../../src/lib/prefs', () => ({
  getLastRoom: () => getLastRoom(),
  setLastRoom: () => undefined,
}));

const { default: OnboardingPage } = await import('../../src/pages/OnboardingPage');

const IDLE = { data: null, loading: false, error: null, fromCache: false, cachedAt: null };

/** מרנדר את המסך ומחזיר את הנתיב שבו נחתנו (אחרי Navigate, אם היה). */
function renderOnboarding() {
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/r/:code" element={<div>מסך החדר {location.pathname}</div>} />
        <Route path="/rooms/:code/pending" element={<div data-testid="pending">מסך המתנה</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function signedIn(rooms: string[], displayName = 'דנה כהן') {
  useAuth.mockReturnValue({
    user: { uid: 'uid-1' },
    profile: {
      displayName,
      email: 'dana@example.com',
      rooms: Object.fromEntries(rooms.map((c) => [c, true])),
    },
    loading: false,
  });
}

beforeEach(() => {
  useAuth.mockReset();
  useRtdbValue.mockReset();
  getLastRoom.mockReset();
  getLastRoom.mockReturnValue(null);
  useRtdbValue.mockImplementation(() => IDLE);
});

afterEach(cleanup);

describe('כניסה עם חשבון פתוח — מה מוצג', () => {
  it('אימות עדיין נטען → ספינר, ולא החלטת ניתוב שגויה', () => {
    useAuth.mockReturnValue({ user: null, profile: null, loading: true });
    renderOnboarding();

    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('בלי חדרים → מסך "צרו חדר / הצטרפו", עם שם פרטי בלבד', () => {
    signedIn([]);
    renderOnboarding();

    expect(screen.getByText(/שלום דנה$/)).toBeTruthy();
    expect(screen.getByText('יצירת חדר חדש')).toBeTruthy();
    expect(screen.getByText('הצטרפות לחדר קיים')).toBeTruthy();
  });

  it('חדר אחד → נכנסים ישר לחדר, בלי מסך ביניים', () => {
    signedIn(['ROOM01']);
    renderOnboarding();

    expect(screen.getByText(/מסך החדר/)).toBeTruthy();
    expect(screen.queryByText('לאיזה חדר להיכנס?')).toBeNull();
  });

  it('בלי חדרים אבל עם בקשה ממתינה → מסך ההמתנה של אותו חדר', () => {
    signedIn([]);
    useRtdbValue.mockImplementation((path: string | null) =>
      path === 'joinRequests/uid-1'
        ? { ...IDLE, data: { ROOM07: { status: 'pending', roomName: 'דירת חברים' } } }
        : IDLE
    );
    renderOnboarding();

    expect(screen.getByTestId('pending')).toBeTruthy();
  });
});

describe('חברות בשני חדרים', () => {
  beforeEach(() => {
    signedIn(['ROOM01', 'ROOM02']);
    useRtdbValue.mockImplementation((path: string | null) => {
      if (path === 'roomCodes/ROOM01') return { ...IDLE, data: { name: 'מעונות א׳' } };
      if (path === 'roomCodes/ROOM02') return { ...IDLE, data: { name: 'דירת חברים' } };
      return IDLE;
    });
  });

  it('נתמך: מוצג בוחר חדרים ולא הפניה שרירותית לאחד מהם', () => {
    renderOnboarding();

    expect(screen.getByText('לאיזה חדר להיכנס?')).toBeTruthy();
    expect(screen.queryByText(/מסך החדר/)).toBeNull();
  });

  it('שני החדרים מוצגים — בשם ובקוד', () => {
    renderOnboarding();

    expect(screen.getByText('מעונות א׳')).toBeTruthy();
    expect(screen.getByText('דירת חברים')).toBeTruthy();
    expect(screen.getByText('ROOM01')).toBeTruthy();
    expect(screen.getByText('ROOM02')).toBeTruthy();
  });

  it('המונה מציג את מספר החדרים בפועל', () => {
    renderOnboarding();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('אפשר להמשיך ולהצטרף לחדר שלישי', () => {
    renderOnboarding();

    const join = screen.getByText('הצטרפות לחדר נוסף');
    expect(join.getAttribute('href')).toBe('/rooms/join');
    expect(screen.getByText('יצירת חדר חדש').getAttribute('href')).toBe('/rooms/create');
  });

  /**
   * ‼️ בלי הסידור הזה המשתמש נוחת כל פעם על אותו חדר שרירותי — זה
   *    שיצא ראשון מ-Object.keys — ונאלץ לבחור מחדש בכל כניסה.
   */
  it('החדר האחרון שנצפה עולה לראש הרשימה ומסומן', () => {
    getLastRoom.mockReturnValue('ROOM02');
    renderOnboarding();

    const names = screen.getAllByText(/מעונות א׳|דירת חברים/).map((n) => n.textContent);
    expect(names[0]).toBe('דירת חברים');
    expect(screen.getByText('אחרון')).toBeTruthy();
  });

  it('שם חדר שעדיין נטען לא מפיל את המסך', () => {
    useRtdbValue.mockImplementation(() => IDLE);
    renderOnboarding();

    expect(screen.getByText('לאיזה חדר להיכנס?')).toBeTruthy();
    expect(screen.getAllByText('…')).toHaveLength(2);
  });
});

describe('שלושה חדרים ומעלה — אין תקרה', () => {
  it('כל החדרים מוצגים', () => {
    signedIn(['ROOM01', 'ROOM02', 'ROOM03', 'ROOM04']);
    useRtdbValue.mockImplementation((path: string | null) =>
      path?.startsWith('roomCodes/')
        ? { ...IDLE, data: { name: `חדר ${path.slice(-2)}` } }
        : IDLE
    );
    renderOnboarding();

    expect(screen.getByText('4')).toBeTruthy();
    for (const code of ['ROOM01', 'ROOM02', 'ROOM03', 'ROOM04']) {
      expect(screen.getByText(code)).toBeTruthy();
    }
  });
});
