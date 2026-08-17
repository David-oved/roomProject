import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useRtdbList, useRtdbValue } from '../hooks/useRtdb';
import { useAuth } from './AuthContext';
import type { Member, RoomMetadata, WithId } from '../types/models';

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
  memberName: (uid: string) => string;
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
  memberName: () => '—',
});

export const useRoom = () => useContext(Ctx);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const roomCode = code ?? null;

  const meta = useRtdbValue<RoomMetadata>(roomCode ? `rooms/${roomCode}/metadata` : null);
  const mem = useRtdbList<Member>(roomCode ? `rooms/${roomCode}/members` : null);

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
      memberName: (uid: string) => members.find((m) => m.id === uid)?.name ?? 'משתמש שנמחק',
    };
  }, [roomCode, meta.data, meta.loading, meta.fromCache, mem.data, mem.loading, mem.fromCache, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
