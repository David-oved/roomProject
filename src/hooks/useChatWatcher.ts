import { useEffect, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { useAuth } from '../store/AuthContext';
import { useRoom } from '../store/RoomContext';
import { useToast } from '../store/ToastContext';
import {
  GENERAL_SCOPE,
  countUnread,
  dmBasePath,
  generalChatPath,
  markDelivered,
} from '../services/chatService';
import type { ChatMessage, WithId } from '../types/models';

interface Scope {
  key: string;
  path: string;
  routePath: string;
  /** שם לתצוגה בטוסט — שם השולח יוחלף בזה בצ'אט פרטי */
  label: string | null;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 *  שומר הצ'אט הגלובלי — רץ פעם אחת ב-AppShell, לא בכל מסך שיחה
 * ═══════════════════════════════════════════════════════════════════
 *
 *  שלוש עבודות בו-זמנית, על כל שיחה שהמשתמש שותף בה בחדר (כללית +
 *  אחת לכל חבר פעיל):
 *   1. סימון delivered מיידי — "המכשיר קיבל", בלי קשר לאיזה מסך פתוח.
 *   2. ספירת "לא-נקרא" כוללת — לנורית הקטנה בסרגל הניווט.
 *   3. טוסט מקומי כשההודעה חדשה *ממש* והמשתמש לא רואה אותה חיה כרגע —
 *      לא באותה שיחה בדיוק. אם הוא כן שם, הוא כבר רואה אותה; אם
 *      האפליקציה ברקע לגמרי, זה תפקידו של הפוש האמיתי (Cloudflare
 *      Worker/GitHub Action), לא של ההוק הזה.
 *
 *  ‼️ לא הוקים דינמיים בלולאה — React אוסר מספר משתנה של קריאות hook.
 *  לכן ההאזנות עצמן ידניות (onValue ישיר) בתוך useEffect אחד שרץ
 *  מחדש כשרשימת החברים הפעילים משתנה.
 */
export function useChatWatcher(): { unreadTotal: number } {
  const { user } = useAuth();
  const { roomCode, activeMembers, memberName } = useRoom();
  const toast = useToast();
  const location = useLocation();

  const [unreadByScope, setUnreadByScope] = useState<Record<string, number>>({});
  const seen = useRef<Record<string, Set<string>>>({});
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const myUid = user?.uid;

  useEffect(() => {
    if (!roomCode || !myUid) return;

    const otherIds = activeMembers.map((m) => m.id).filter((id) => id !== myUid);
    const scopes: Scope[] = [
      { key: GENERAL_SCOPE, path: generalChatPath(roomCode), routePath: `/r/${roomCode}/chat/general`, label: null },
      ...otherIds.map((id) => ({
        key: id,
        path: `${dmBasePath(roomCode, myUid, id)}/messages`,
        routePath: `/r/${roomCode}/chat/dm/${id}`,
        label: memberName(id),
      })),
    ];

    setUnreadByScope({});
    seen.current = {};

    const unsubscribers = scopes.map((scope) => {
      const scopeSeen = new Set<string>();
      seen.current[scope.key] = scopeSeen;
      let first = true;

      return onValue(ref(db, scope.path), (snap) => {
        const val = (snap.val() ?? {}) as Record<string, ChatMessage>;
        const messages: WithId<ChatMessage>[] = Object.entries(val).map(([id, v]) => ({
          ...v,
          id,
        }));

        setUnreadByScope((prev) => ({ ...prev, [scope.key]: countUnread(messages, myUid) }));
        void markDelivered(scope.path, messages, myUid);

        // ריצה ראשונה: רק מסמנים מה כבר קיים, בלי לפוצץ טוסטים על היסטוריה
        if (first) {
          first = false;
          for (const m of messages) scopeSeen.add(m.id);
          return;
        }

        const fresh = messages.filter((m) => !scopeSeen.has(m.id) && m.senderId !== myUid);
        for (const m of messages) scopeSeen.add(m.id);
        if (fresh.length === 0) return;

        // כבר באותה שיחה בדיוק — הוא רואה את זה חי, בלי טוסט
        if (locationRef.current === scope.routePath) return;
        if (document.visibilityState !== 'visible') return; // ברקע לגמרי — זה תפקיד הפוש

        const last = fresh[fresh.length - 1];
        toast.info(`${scope.label ?? 'צ׳אט החדר'}: ${last.text}`);
      });
    });

    return () => {
      for (const unsub of unsubscribers) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, myUid, activeMembers.map((m) => m.id).join(',')]);

  const unreadTotal = Object.values(unreadByScope).reduce((a, b) => a + b, 0);
  return { unreadTotal };
}
