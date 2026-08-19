import { push, ref, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';
import { enqueueNotification } from './outboxService';

const MAX_TEXT_LENGTH = 1000;

/** מנהל בלבד — נאכף ב-Rules. שידור לכל חברי החדר, אין עריכה אחרי שליחה. */
export async function sendAnnouncement(
  code: string,
  adminId: string,
  adminName: string,
  text: string
): Promise<void> {
  assertOnline('לשלוח הודעה');
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!trimmed) return;

  const msgId = push(ref(db, `rooms/${code}/announcements`)).key!;

  await update(ref(db), {
    [`rooms/${code}/announcements/${msgId}`]: {
      senderId: adminId,
      text: trimmed,
      sentAt: serverTimestamp(),
    },
  });

  void enqueueNotification({
    roomCode: code,
    title: `הודעה מ${adminName}`,
    body: trimmed,
    url: `/r/${code}/announcements`,
    tag: 'announcement',
    priority: 'now',
    audience: 'room',
    actorUid: adminId,
  });
}
