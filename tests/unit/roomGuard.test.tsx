// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  RequireRoomMember — שלושה מצבים שנראים זהים ואינם
 * ═══════════════════════════════════════════════════════════════════
 *
 *  לשומר הזה מגיעים שלושה מצבים שכולם נראים כמו "אין מטא-דאטה":
 *
 *   1. החדר באמת לא קיים / המשתמש הוסר ממנו (permission_denied)
 *      → החוצה ל-onboarding. זו הזרימה הנכונה.
 *
 *   2. החיבור לשרת לא נוצר (פסק זמן)
 *      → מסך "נסה שוב". ‼️ ניווט ל-onboarding כאן היה יוצר לולאה:
 *        משתמש עם חדר אחד מוחזר משם מיד לאותו חדר, שוב נכשל, שוב
 *        החוצה — כל עוד אין רשת.
 *
 *   3. עדיין טוען → ספינר.
 *
 *  ובנוסף: חבר שהוסר לעומת מי שמעולם לא היה חבר — ההבחנה שמונעת את
 *  לולאת הניתוב מול מסך ההמתנה (ראו ההערה ב-guards.tsx).
 */

const useRoom = vi.fn();

vi.mock('../../src/store/RoomContext', () => ({
  useRoom: () => useRoom(),
}));

vi.mock('../../src/store/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' }, profile: null, loading: false }),
}));

const { RequireRoomMember } = await import('../../src/components/auth/guards');

const BASE = {
  roomCode: 'ROOM01',
  metadata: null as unknown,
  members: [],
  activeMembers: [],
  myMembership: null as unknown,
  isAdmin: false,
  isArchived: false,
  loading: false,
  fromCache: false,
  error: null as Error | null,
  memberName: () => '—',
  memberAvatar: () => null,
  onlineMemberIds: new Set<string>(),
};

const META = { name: 'מעונות א׳', adminId: 'uid-admin' };

function renderGuard() {
  render(
    <MemoryRouter initialEntries={['/r/ROOM01']}>
      <Routes>
        <Route path="/r/:code" element={<RequireRoomMember />}>
          <Route index element={<div data-testid="room">תוכן החדר</div>} />
        </Route>
        <Route path="/onboarding" element={<div data-testid="onboarding">מסך פתיחה</div>} />
        <Route path="/rooms/:code/pending" element={<div data-testid="pending">המתנה</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useRoom.mockReset();
});

afterEach(cleanup);

describe('RequireRoomMember', () => {
  it('טוען → ספינר', () => {
    useRoom.mockReturnValue({ ...BASE, loading: true });
    renderGuard();

    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('חבר פעיל → תוכן החדר', () => {
    useRoom.mockReturnValue({
      ...BASE,
      metadata: META,
      myMembership: { status: 'active', role: 'member', name: 'דנה' },
    });
    renderGuard();

    expect(screen.getByTestId('room')).toBeTruthy();
  });

  it('חבר שהוסר → החוצה ל-onboarding, ולא ללולאה מול מסך ההמתנה', () => {
    useRoom.mockReturnValue({
      ...BASE,
      metadata: META,
      myMembership: { status: 'removed', role: 'member', name: 'דנה' },
    });
    renderGuard();

    expect(screen.getByTestId('onboarding')).toBeTruthy();
  });

  it('מעולם לא היה חבר → מסך ההמתנה', () => {
    useRoom.mockReturnValue({ ...BASE, metadata: META, myMembership: null });
    renderGuard();

    expect(screen.getByTestId('pending')).toBeTruthy();
  });

  it('permission_denied בלי מטא-דאטה → החוצה ל-onboarding (הוסרת מהחדר)', () => {
    useRoom.mockReturnValue({
      ...BASE,
      metadata: null,
      error: Object.assign(new Error('permission_denied'), { code: 'permission_denied' }),
    });
    renderGuard();

    expect(screen.getByTestId('onboarding')).toBeTruthy();
  });

  /**
   * ‼️ בלי זה: onboarding → חדר אחד → חזרה לחדר → פסק זמן → onboarding.
   *    לולאה שקטה של 20 שניות במקום מסך שאפשר לפעול בו.
   */
  it('פסק זמן בחיבור → מסך "נסה שוב", ולא ניווט החוצה', async () => {
    const { RtdbTimeoutError } = await import('../../src/hooks/useRtdb');
    useRoom.mockReturnValue({ ...BASE, metadata: null, error: new RtdbTimeoutError() });
    renderGuard();

    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(screen.getByText('משהו השתבש')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeTruthy();
  });
});
