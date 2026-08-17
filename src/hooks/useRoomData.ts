import { useMemo } from 'react';
import { useRtdbList } from './useRtdb';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { computeBalances } from '../lib/money';
import type {
  AppNotification,
  Item,
  ItemStatus,
  JoinRequest,
  Purchase,
  Settlement,
  WithId,
} from '../types/models';

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/**
 * מוצרי החדר, ממוינים לפי עדיפות ואז לפי טריות.
 * הסינון בזיכרון ולא ב-query: בחדר מעונות יש עשרות פריטים, וטעינה
 * אחת עם סינון מקומי מהירה מריבוי שאילתות.
 */
export function useItems(status?: ItemStatus | 'open') {
  const { roomCode } = useRoom();
  const state = useRtdbList<Item>(roomCode ? `rooms/${roomCode}/items` : null);

  const items = useMemo(() => {
    const list = state.data.filter((i) => {
      if (status === 'open') return i.status !== 'done';
      if (status) return i.status === status;
      return true;
    });
    return list.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (b.reportedAt ?? 0) - (a.reportedAt ?? 0)
    );
  }, [state.data, status]);

  return { ...state, items };
}

export function usePurchases() {
  const { roomCode } = useRoom();
  const state = useRtdbList<Purchase>(roomCode ? `rooms/${roomCode}/purchases` : null);

  const purchases = useMemo(
    () => [...state.data].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [state.data]
  );

  const pendingApproval = useMemo(
    () => purchases.filter((p) => p.status === 'pending'),
    [purchases]
  );

  return { ...state, purchases, pendingApproval };
}

export function useSettlements() {
  const { roomCode } = useRoom();
  return useRtdbList<Settlement>(roomCode ? `rooms/${roomCode}/settlements` : null);
}

/**
 * מאזנים — נתון **נגזר** מיומן הקניות, לא נתון עצמאי.
 * כך אישור כפול של קנייה לא מכפיל את החוב, ותמיד אפשר לחשב מחדש.
 */
export function useBalances() {
  const { activeMembers, members } = useRoom();
  const { user } = useAuth();
  const { purchases, loading: pLoading } = usePurchases();
  const { data: settlements, loading: sLoading } = useSettlements();

  const balances = useMemo(() => {
    // כוללים גם חברים שהוסרו — החובות שלהם לא נעלמים
    const ids = members.map((m) => m.id);
    return computeBalances(purchases, settlements, ids);
  }, [purchases, settlements, members]);

  const myBalance = user ? (balances[user.uid] ?? 0) : 0;

  /** בדיקת שפיות: סכום כל המאזנים בחדר חייב להיות בדיוק 0 */
  const isConsistent = useMemo(
    () => Object.values(balances).reduce((a, b) => a + b, 0) === 0,
    [balances]
  );

  return {
    balances,
    myBalance,
    isConsistent,
    activeMembers,
    loading: pLoading || sLoading,
  };
}

export function useNotifications() {
  const { roomCode } = useRoom();
  const { user } = useAuth();
  const state = useRtdbList<AppNotification>(
    roomCode ? `rooms/${roomCode}/notifications` : null
  );

  const notifications = useMemo(
    () =>
      [...state.data]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 50),
    [state.data]
  );

  const unreadCount = useMemo(
    () => (user ? notifications.filter((n) => !n.readBy?.[user.uid]).length : 0),
    [notifications, user]
  );

  return { ...state, notifications, unreadCount };
}

/** בקשות הצטרפות ממתינות — קריא למנהל בלבד (נאכף ב-Rules). */
export function useJoinRequests(): {
  requests: WithId<JoinRequest>[];
  loading: boolean;
} {
  const { roomCode, isAdmin } = useRoom();
  const state = useRtdbList<JoinRequest>(
    isAdmin && roomCode ? `rooms/${roomCode}/pendingRequests` : null
  );

  const requests = useMemo(
    () =>
      state.data
        .filter((r) => r.status === 'pending')
        .sort((a, b) => (a.requestedAt ?? 0) - (b.requestedAt ?? 0)),
    [state.data]
  );

  return { requests, loading: state.loading };
}
