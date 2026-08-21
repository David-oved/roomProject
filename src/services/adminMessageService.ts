import { ref, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';

/**
 * תיבת ההודעות ממנהל המערכת.
 *
 * ‼️ הלקוח כותב כאן שני שדות בלבד — readAt ו-clickedAt. כל היתר קפוא
 *    בכללי האבטחה עצמם (ראו database.rules.json → adminMessages).
 *
 * ‼️ אין assertOnline: סימון "נקרא" הוא תופעת לוואי של פתיחת המסך,
 *    ולא פעולה שהמשתמש ביקש. כשאין רשת פשוט לא קורה כלום — עדיף
 *    מלהקפיץ שגיאה על משהו שהמשתמש לא ניסה לעשות.
 */

export async function markAdminMessageRead(userId: string, messageId: string): Promise<void> {
  await update(ref(db, `adminMessages/${userId}/${messageId}`), {
    readAt: serverTimestamp(),
  }).catch(() => {
    /* לא קריטי — הסימון ינסה שוב בפתיחה הבאה */
  });
}

export async function markAdminMessageClicked(userId: string, messageId: string): Promise<void> {
  await update(ref(db, `adminMessages/${userId}/${messageId}`), {
    clickedAt: serverTimestamp(),
  }).catch(() => {
    /* לא קריטי */
  });
}
