import { useMemo } from 'react';
import { useRtdbList } from './useRtdb';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { computeBalances, computeContributions, whoIsNext } from '../lib/money';
import type {
  Announcement,
  AppNotification,
  Item,
  ItemStatus,
  JoinRequest,
  Purchase,
  Settlement,
  Task,
  TaskCompletion,
  TaskTransfer,
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
  const { user } = useAuth();
  const state = useRtdbList<Settlement>(roomCode ? `rooms/${roomCode}/settlements` : null);

  /** תשלומים שמישהו סימן שהעביר לי — ממתינים לאישור שלי */
  const awaitingMyConfirmation = useMemo(
    () => state.data.filter((s) => !s.confirmedBy && s.to === user?.uid),
    [state.data, user]
  );

  /** תשלומים ששלחתי ועדיין לא אושרו בצד השני */
  const awaitingOthers = useMemo(
    () => state.data.filter((s) => !s.confirmedBy && s.from === user?.uid),
    [state.data, user]
  );

  return { ...state, awaitingMyConfirmation, awaitingOthers };
}

/**
 * מאזנים — נתון **נגזר** מיומן הקניות, לא נתון עצמאי.
 * כך אישור כפול של קנייה לא מכפיל את החוב, ותמיד אפשר לחשב מחדש.
 */
export function useBalances() {
  const { activeMembers, members } = useRoom();
  const { user } = useAuth();
  const {
    purchases,
    loading: pLoading,
    error: pError,
    fromCache: pFromCache,
  } = usePurchases();
  const {
    data: settlements,
    loading: sLoading,
    error: sError,
    fromCache: sFromCache,
  } = useSettlements();

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
    // ‼️ בלי החשיפה הזו המסך לא יכול להבחין בין "אין חובות" לבין
    // "אין הרשאה לקרוא את הקניות" — useRtdbList מנקה את data ל-[]
    // כשמסירים את המשתמש מהחדר, וזה נראה בדיוק כמו חדר מאוזן.
    error: pError ?? sError,
    fromCache: pFromCache || sFromCache,
  };
}

/**
 * כמה כל אחד נשא בעלות. נדרש במיוחד כשמשתמשים ב"לקחתי על עצמי",
 * כי אז המאזן תמיד אפס ואין שום דרך אחרת לראות מי באמת קונה.
 */
export function useContributions() {
  const { members, activeMembers } = useRoom();
  const { purchases, loading, error, fromCache } = usePurchases();

  const data = useMemo(
    () => computeContributions(purchases, members.map((m) => m.id)),
    [purchases, members]
  );

  /** הפער בין מי שנשא הכי הרבה למי שנשא הכי מעט, בין חברים פעילים */
  const gap = useMemo(() => {
    const values = activeMembers.map((m) => data.borne[m.id] ?? 0);
    if (values.length < 2) return 0;
    return Math.max(...values) - Math.min(...values);
  }, [data.borne, activeMembers]);

  /** מי נשא הכי פחות ולכן "תורו" לקנות. null כשהפער זניח. */
  const next = useMemo(
    () => whoIsNext(data.borne, activeMembers.map((m) => m.id)),
    [data.borne, activeMembers]
  );

  return { ...data, gap, next, loading, error, fromCache };
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

/** מטלות קבועות, ממוינות לפי תאריך יעד — הקרוב ביותר ראשון. */
export function useTasks() {
  const { roomCode } = useRoom();
  const { user } = useAuth();
  const state = useRtdbList<Task>(roomCode ? `rooms/${roomCode}/tasks` : null);

  const tasks = useMemo(
    () => [...state.data].sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
    [state.data]
  );

  /** המטלות שהתור שלי בהן עכשיו */
  const myTasks = useMemo(
    () => tasks.filter((t) => t.currentAssignee === user?.uid),
    [tasks, user]
  );

  return { ...state, tasks, myTasks };
}

/** בקשות העברת תור במטלה, ממתינות בלבד. */
export function useTaskTransfers() {
  const { roomCode } = useRoom();
  const { user } = useAuth();
  const state = useRtdbList<TaskTransfer>(roomCode ? `rooms/${roomCode}/taskTransfers` : null);

  /** בקשות שממתינות לתשובה שלי */
  const incoming = useMemo(
    () => state.data.filter((t) => t.status === 'pending' && t.toUid === user?.uid),
    [state.data, user]
  );
  /** בקשות ששלחתי ועדיין ממתינות לתשובת הצד השני */
  const outgoing = useMemo(
    () => state.data.filter((t) => t.status === 'pending' && t.fromUid === user?.uid),
    [state.data, user]
  );

  return { ...state, incoming, outgoing };
}

/** כמה מטלות כל אחד השלים ב-30 הימים האחרונים — להצגת הוגנות. */
export function useTaskFairness() {
  const { roomCode } = useRoom();
  const state = useRtdbList<TaskCompletion>(roomCode ? `rooms/${roomCode}/taskCompletions` : null);

  const counts = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const map: Record<string, number> = {};
    for (const c of state.data) {
      if ((c.completedAt ?? 0) < since) continue;
      map[c.completedBy] = (map[c.completedBy] ?? 0) + 1;
    }
    return map;
  }, [state.data]);

  return { counts, loading: state.loading, error: state.error, fromCache: state.fromCache };
}

/** הודעות שידור מהמנהל, החדשה ביותר ראשונה. */
export function useAnnouncements() {
  const { roomCode } = useRoom();
  const state = useRtdbList<Announcement>(roomCode ? `rooms/${roomCode}/announcements` : null);

  const announcements = useMemo(
    () => [...state.data].sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0)),
    [state.data]
  );

  return { ...state, announcements };
}

/** בקשות הצטרפות ממתינות — קריא למנהל בלבד (נאכף ב-Rules). */
export function useJoinRequests(): {
  requests: WithId<JoinRequest>[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
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

  return { requests, loading: state.loading, error: state.error, fromCache: state.fromCache };
}
