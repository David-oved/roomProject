import { get, onDisconnect, push, ref, serverTimestamp, set, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';
import { enqueueNotification } from './outboxService';
import type { ChatMessage, WithId } from '../types/models';

const MAX_TEXT_LENGTH = 2000;

/** מזהה דטרמיניסטי לשיחה פרטית — סדר לקסיקוגרפי כדי ששני הצדדים יתכנסו לאותו נתיב. */
export function dmPairKey(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export const GENERAL_SCOPE = 'general';

export function generalChatPath(code: string): string {
  return `rooms/${code}/chat`;
}

export function dmBasePath(code: string, myUid: string, otherUid: string): string {
  return `dms/${code}/${dmPairKey(myUid, otherUid)}`;
}

function presencePath(code: string, scope: string, uid: string): string {
  return `rooms/${code}/chatPresence/${scope}/${uid}`;
}

/**
 * שולח הודעה לצ'אט הכללי, ומתריע (פוש) למי שלא נוכח עכשיו באותה שיחה.
 */
export async function sendGeneralMessage(
  code: string,
  userId: string,
  userName: string,
  activeMemberIds: string[],
  text: string
): Promise<void> {
  assertOnline('לשלוח הודעה');
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmed) return;

  const path = generalChatPath(code);
  const msgId = push(ref(db, path)).key!;

  await update(ref(db), {
    [`${path}/${msgId}`]: {
      senderId: userId,
      text: trimmed,
      sentAt: serverTimestamp(),
    },
  });

  const recipients = activeMemberIds.filter((id) => id !== userId);
  await notifyAbsent(
    code,
    GENERAL_SCOPE,
    recipients,
    userId,
    'הודעה חדשה בצ׳אט',
    `${userName}: ${trimmed}`,
    `/r/${code}/chat/general`
  );
}

/**
 * שולח הודעה פרטית. יוצר את participants באותה כתיבה אם זו ההודעה
 * הראשונה בין השניים — ‼️ קריאה אחת מקדימה כדי לדעת אם צריך, כי חוקי
 * ה-DB מתירים כתיבת participants רק פעם אחת (לא ניתן "לדרוס" אותה).
 */
export async function sendDirectMessage(
  code: string,
  myUid: string,
  myName: string,
  otherUid: string,
  text: string
): Promise<void> {
  assertOnline('לשלוח הודעה');
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmed) return;

  const base = dmBasePath(code, myUid, otherUid);
  const msgId = push(ref(db, `${base}/messages`)).key!;

  const participantsSnap = await get(ref(db, `${base}/participants`));

  const updates: Record<string, unknown> = {
    [`${base}/messages/${msgId}`]: {
      senderId: myUid,
      text: trimmed,
      sentAt: serverTimestamp(),
    },
  };
  if (!participantsSnap.exists()) {
    updates[`${base}/participants`] = { [myUid]: true, [otherUid]: true };
  }

  await update(ref(db), updates);

  const scope = dmPairKey(myUid, otherUid);
  await notifyAbsent(code, scope, [otherUid], myUid, myName, trimmed, `/r/${code}/chat/dm/${myUid}`);
}

/** התראה רק למי שלא "נוכח" עכשיו באותה שיחה ממש — הוא כבר רואה אותה חיה. */
async function notifyAbsent(
  code: string,
  scope: string,
  recipientIds: string[],
  senderId: string,
  title: string,
  body: string,
  url: string
): Promise<void> {
  await Promise.all(
    recipientIds.map(async (uid) => {
      const present = await get(ref(db, presencePath(code, scope, uid)))
        .then((s) => s.exists())
        .catch(() => false);
      if (present) return;

      void enqueueNotification({
        roomCode: code,
        title,
        body,
        url,
        tag: `chat-${scope}`,
        priority: 'now',
        audience: 'user',
        targetUid: uid,
        actorUid: senderId,
      });
    })
  );
}

/**
 * מסמן "נוכח בשיחה הזו" — נקרא בכניסה למסך שיחה, ומוסר את עצמו ביציאה.
 * onDisconnect הוא רשת ביטחון לניתוק פתאומי (סגירת טאב, אובדן רשת).
 *
 * מחזיר פונקציית ניקוי — יש לקרוא לה ב-cleanup של useEffect.
 */
export function markPresent(code: string, scope: string, uid: string): () => void {
  const r = ref(db, presencePath(code, scope, uid));
  const disconnectHandle = onDisconnect(r);

  void set(r, true);
  void disconnectHandle.remove();

  return () => {
    void disconnectHandle.cancel();
    void set(r, null);
  };
}

/** כמה הודעות לא-שלי עדיין לא סומנו כ-delivered אצלי. */
export function countUndelivered(messages: WithId<ChatMessage>[], myUid: string): number {
  return messages.filter((m) => m.senderId !== myUid && !m.deliveredTo?.[myUid]).length;
}

/** כמה הודעות לא-שלי עדיין לא נקראו על ידי. */
export function countUnread(messages: WithId<ChatMessage>[], myUid: string): number {
  return messages.filter((m) => m.senderId !== myUid && !m.readBy?.[myUid]).length;
}

/** מסמן delivered לכל ההודעות שעדיין לא סומנו — כתיבה אטומית אחת. */
export async function markDelivered(
  path: string,
  messages: WithId<ChatMessage>[],
  myUid: string
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const m of messages) {
    if (m.senderId !== myUid && !m.deliveredTo?.[myUid]) {
      updates[`${path}/${m.id}/deliveredTo/${myUid}`] = true;
    }
  }
  if (Object.keys(updates).length === 0) return;
  await update(ref(db), updates).catch(() => undefined);
}

/** מסמן read (וגם delivered, אם עוד לא) לכל ההודעות שעדיין לא נקראו. */
export async function markRead(
  path: string,
  messages: WithId<ChatMessage>[],
  myUid: string
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const m of messages) {
    if (m.senderId === myUid) continue;
    if (!m.readBy?.[myUid]) updates[`${path}/${m.id}/readBy/${myUid}`] = true;
    if (!m.deliveredTo?.[myUid]) updates[`${path}/${m.id}/deliveredTo/${myUid}`] = true;
  }
  if (Object.keys(updates).length === 0) return;
  await update(ref(db), updates).catch(() => undefined);
}

export type MessageTick = 'sent' | 'delivered' | 'read';

/** מצב הוי"ים לתצוגה — ביחס לרשימת נמענים (חבר יחיד לפרטי, כל השאר לכללי). */
export function tickFor(message: ChatMessage, recipientIds: string[]): MessageTick {
  if (recipientIds.length === 0) return 'read';
  const allRead = recipientIds.every((id) => message.readBy?.[id]);
  if (allRead) return 'read';
  const allDelivered = recipientIds.every((id) => message.deliveredTo?.[id]);
  if (allDelivered) return 'delivered';
  return 'sent';
}
