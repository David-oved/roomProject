import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { onDisconnect, ref, set } from 'firebase/database';
import { db } from '../config/firebase';
import { useRtdbList, useRtdbValue } from '../hooks/useRtdb';
import { useAuth } from './AuthContext';
import type { Member, RoomMetadata, WithId } from '../types/models';
import { setLastRoom } from '../lib/prefs';

interface RoomValue {
  roomCode: string | null;
  metadata: RoomMetadata | null;
  members: WithId<Member>[];
  /** רק חברים פעילים — זה מה שרוב המסכים צריכים */
  activeMembers: WithId<Member>[];
  myMembership: Member | null;
  isAdmin: boolean;
  loading: boolean;
  fromCache: boolean;
  /**
   * ‼️ שגיאת קריאה של החדר עצמו (מטא-דאטה או רשימת החברים).
   * useRtdbList מנקה בכוונה את data ל-[] כשמגיע permission_denied אחרי
   * חיבור חי — ולכן בלי החשיפה הזו "הוסרת מהחדר" נראה על המסך בדיוק
   * כמו "החדר ריק". המסכים מציגים ErrorState על בסיס הערך הזה.
   */
  error: Error | null;
  memberName: (uid: string) => string;
  /** תמונת הפרופיל של חבר, אם יש לו — לשימוש בכל מקום שמציג Avatar */
  memberAvatar: (uid: string) => string | null;
  /** מזהי חברים שהאפליקציה פתוחה אצלם *עכשיו* (לא רק בצ'אט — בכל מסך בחדר) */
  onlineMemberIds: Set<string>;
}

const Ctx = createContext<RoomValue>({
  roomCode: null,
  metadata: null,
  members: [],
  activeMembers: [],
  myMembership: null,
  isAdmin: false,
  loading: true,
  fromCache: false,
  error: null,
  memberName: () => '—',
  memberAvatar: () => null,
  onlineMemberIds: new Set(),
});

export const useRoom = () => useContext(Ctx);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const roomCode = code ?? null;

  const meta = useRtdbValue<RoomMetadata>(roomCode ? `rooms/${roomCode}/metadata` : null);
  const mem = useRtdbList<Member>(roomCode ? `rooms/${roomCode}/members` : null);
  const online = useRtdbValue<Record<string, true>>(roomCode ? `rooms/${roomCode}/online` : null);

  const value = useMemo<RoomValue>(() => {
    const members = mem.data;
    const activeMembers = members.filter((m) => m.status === 'active');
    const myMembership = members.find((m) => m.id === user?.uid) ?? null;

    return {
      roomCode,
      metadata: meta.data,
      members,
      activeMembers,
      myMembership,
      isAdmin: !!user && meta.data?.adminId === user.uid,
      loading: meta.loading || mem.loading,
      fromCache: meta.fromCache || mem.fromCache,
      error: meta.error ?? mem.error,
      memberName: (uid: string) => members.find((m) => m.id === uid)?.name ?? 'משתמש שנמחק',
      memberAvatar: (uid: string) => members.find((m) => m.id === uid)?.avatar ?? null,
      onlineMemberIds: new Set(Object.keys(online.data ?? {})),
    };
  }, [
    roomCode,
    meta.data,
    meta.loading,
    meta.fromCache,
    meta.error,
    mem.data,
    mem.loading,
    mem.fromCache,
    mem.error,
    online.data,
    user,
  ]);

  // זוכרים את החדר הפעיל, כדי לחזור אליו ישירות בכניסה הבאה.
  // רק חברות פעילה נשמרת — אין טעם לזכור חדר שהוסרנו ממנו.
  useEffect(() => {
    if (roomCode && value.myMembership?.status === 'active') setLastRoom(roomCode);
  }, [roomCode, value.myMembership?.status]);

  // "מחובר לאפליקציה" — כל עוד ה-provider הזה מותקן, כלומר כל עוד
  // המשתמש איפשהו בתוך החדר (לא רק במסך הצ'אט). onDisconnect כרשת
  // ביטחון לניתוק פתאומי (סגירת האפליקציה, אובדן רשת).
  const myUid = user?.uid;
  const isActiveMember = value.myMembership?.status === 'active';
  useEffect(() => {
    if (!roomCode || !myUid || !isActiveMember) return;
    const r = ref(db, `rooms/${roomCode}/online/${myUid}`);
    const disconnectHandle = onDisconnect(r);
    void set(r, true);
    void disconnectHandle.remove();
    return () => {
      void disconnectHandle.cancel();
      void set(r, null);
    };
  }, [roomCode, myUid, isActiveMember]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
