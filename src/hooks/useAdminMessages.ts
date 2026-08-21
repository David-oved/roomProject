import { useMemo } from 'react';
import { useRtdbList, useRtdbValue } from './useRtdb';
import { useAuth } from '../store/AuthContext';
import type { AdminMessage, Suspension, WithId } from '../types/models';

/**
 * תיבת ההודעות ממנהל המערכת.
 *
 * ‼️ הנתיב הוא adminMessages/{uid} ולא צומת בתוך החדר: הודעה ממנהל
 *    המערכת שייכת למשתמש ולא לחדר. משתמש שנמצא בשלושה חדרים אמור
 *    לראות אותה פעם אחת, ומשתמש שעזב את כל החדרים עדיין אמור לקבל
 *    תשובה לפנייה ששלח.
 */
export function useAdminMessages() {
  const { user } = useAuth();
  const state = useRtdbList<AdminMessage>(user ? `adminMessages/${user.uid}` : null);

  const messages = useMemo(
    () => [...state.data].sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0)),
    [state.data]
  );

  const unread = useMemo(() => messages.filter((m) => !m.readAt), [messages]);

  return {
    ...state,
    messages,
    unread,
    unreadCount: unread.length,
    /** ההודעה שראוי להקפיץ עכשיו: החדשה ביותר שטרם נקראה */
    latestUnread: (unread[0] ?? null) as WithId<AdminMessage> | null,
  };
}

/**
 * מצב החסימה של המשתמש הנוכחי.
 *
 * הצומת קיים = חסום. הלקוח יכול לקרוא רק את שלו, ואין לו הרשאת
 * כתיבה כלל — ראו database.rules.json → suspensions.
 */
export function useSuspension() {
  const { user } = useAuth();
  const state = useRtdbValue<Suspension>(user ? `suspensions/${user.uid}` : null);

  return {
    suspension: state.data,
    isSuspended: Boolean(state.data),
    loading: state.loading,
    /**
     * ‼️ שגיאת קריאה אינה נחשבת לחסימה. אחרת תקלת רשת רגעית הייתה
     *    נועלת את המשתמש מחוץ לאפליקציה שלו.
     */
    error: state.error,
  };
}
