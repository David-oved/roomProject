import { useEffect, useRef } from 'react';
import { useNotifications } from './useRoomData';
import { useAuth } from '../store/AuthContext';
import { useRoom } from '../store/RoomContext';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  התראה מיידית כשהאפליקציה פתוחה ברקע
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ההתראות מהשרת עוברות דרך תור שנשלח כל כמה דקות. אבל האפליקציה
 *  כבר מקבלת כל אירוע **מיידית** דרך ההאזנה ל-RTDB — אז כשהיא פתוחה
 *  ברקע, אין שום סיבה לחכות לשרת. מציגים את ההתראה מקומית, בשנייה
 *  שהאירוע קורה.
 *
 *  מתי זה עוזר: המשתמש עבר לאפליקציה אחרת, המסך כבוי אבל האפליקציה
 *  עדיין בזיכרון, או טאב ברקע בדפדפן. באנדרואיד זה מכסה חלק גדול
 *  מהמקרים. באייפון ה-PWA מושהית כשהיא ברקע, ולכן שם הכיסוי חלקי
 *  והשרת הוא זה שמגיע בסוף.
 *
 *  ‼️ מוצג רק כשהמסך **לא** גלוי. אם המשתמש רואה את האפליקציה, הוא
 *  ממילא רואה את העדכון — התראת מערכת על משהו שמולו היא הצקה.
 * ═══════════════════════════════════════════════════════════════════
 */
export function useLiveNotifications() {
  const { notifications } = useNotifications();
  const { user } = useAuth();
  const { roomCode } = useRoom();

  /**
   * מזהי ההתראות שכבר טופלו.
   *
   * הטעינה הראשונה מביאה את כל ההיסטוריה בבת אחת — בלי הסימון הזה
   * המשתמש היה מוצף ב-50 התראות מערכת ברגע שהאפליקציה עולה.
   */
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    // איפוס במעבר בין חדרים
    seen.current = null;
  }, [roomCode]);

  useEffect(() => {
    if (!user || notifications.length === 0) return;

    // הריצה הראשונה רק מסמנת מה כבר קיים, בלי להציג כלום
    if (seen.current === null) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }

    const fresh = notifications.filter(
      (n) => !seen.current!.has(n.id) && n.actorId !== user.uid
    );
    for (const n of notifications) seen.current.add(n.id);

    if (fresh.length === 0) return;
    if (document.visibilityState === 'visible') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    void (async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) return;

        // התראה אחת מקובצת, לא אחת לכל אירוע
        const first = fresh[0];
        await reg.showNotification(fresh.length === 1 ? 'RoomMate' : 'עדכונים בחדר', {
          body:
            fresh.length === 1
              ? first.text
              : `${first.text} ועוד ${fresh.length - 1} עדכונים`,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          // אותו tag כמו התראות השרת — כך אם שתיהן מגיעות, השנייה
          // מחליפה את הראשונה במקום להיערם כפול
          tag: 'roommate-live',
          dir: 'rtl',
          lang: 'he',
          data: { url: roomCode ? `/r/${roomCode}` : '/' },
        });
      } catch {
        // הצגת התראה מקומית היא בונוס — השרת יגיע בכל מקרה
      }
    })();
  }, [notifications, user, roomCode]);
}
