import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, remove, set } from 'firebase/database';
import {
  ADMIN,
  HTTPS_AVATAR,
  JOINER,
  MEMBER,
  MEMBER2,
  OTHER_ROOM,
  OUTSIDER,
  REJECTED,
  ROOM,
  STRANGER,
  T,
  TRACKER_AVATAR,
  VICTIM,
  hasEmulator,
  makeTestEnv,
  outboxEntry,
  purchase,
  seed,
  settlement,
} from './helpers';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  בדיקות כללי האבטחה של Realtime Database
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ‼️ למה הקובץ הזה קיים בכלל: database.rules.json הוא ~50KB של לוגיקת
 *  הרשאות שהיא **כל** ההגנה על הנתונים (אין שרת אפליקציה בפרויקט).
 *  עד עכשיו לא הייתה לו שום בדיקה אוטומטית, ובדיוק בגלל זה שרדו בו
 *  ארבע חורי הרשאה שנסגרו בסבב האבטחה. כל בדיקה כאן היא נעילה של
 *  התנהגות שכבר נשברה פעם אחת.
 *
 *  ‼️ כל תיקון מיוצג בשני כיוונים — מקרה שחייב לעבור ומקרה שחייב
 *  להיחסם. בדיקת "נחסם" לבדה מסוכנת: אפשר לספק אותה בטעות ע"י כלל
 *  שחוסם גם את הזרימה הלגיטימית, וזו תקלת ייצור ולא תיקון.
 *
 *  ‼️ כל הבדיקות בקובץ אחד במכוון. vitest מריץ קבצים במקביל, ושתי
 *  סביבות בדיקה שמנקות את אותו מרחב שמות באמולטור היו דורסות זו את זו.
 *
 *  הרצה: npm run test:rules
 */

let testEnv: RulesTestEnvironment;

describe.skipIf(!hasEmulator)('database.rules.json', () => {
  beforeAll(async () => {
    testEnv = await makeTestEnv();
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await seed(testEnv);
  });

  /** ה-DB כפי שהוא נראה למשתמש מאומת מסוים. */
  const as = (uid: string) => testEnv.authenticatedContext(uid).database();

  /** זריעה שעוקפת כללים — נקודת פתיחה, לא הדבר הנבדק. */
  const given = (path: string, value: unknown) =>
    testEnv.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), path), value));

  /* ═════════ תיקון 2 — זיוף אישור סגירת חשבון ═════════ */

  describe('settlements/$id/confirmedBy', () => {
    it('הנושה (to) מאשר שקיבל — מותר', async () => {
      await given(`rooms/${ROOM}/settlements/s1`, settlement());
      await assertSucceeds(
        set(ref(as(MEMBER2), `rooms/${ROOM}/settlements/s1/confirmedBy`), MEMBER2)
      );
    });

    it('הניצול: החייב יוצר סגירת חשבון שכבר "מאושרת" ומוחק את חובו — נחסם', async () => {
      // ‼️ זה בדיוק הווקטור שהיה פתוח. הכלל הישן בדק רק
      // newData.val() === to — והחייב יודע מצוין מהו ה-uid של הנושה.
      await assertFails(
        set(
          ref(as(MEMBER), `rooms/${ROOM}/settlements/s2`),
          settlement({ confirmedBy: MEMBER2 })
        )
      );
    });

    it('החייב מאשר בשם הנושה על רשומה קיימת — נחסם', async () => {
      await given(`rooms/${ROOM}/settlements/s1`, settlement());
      await assertFails(
        set(ref(as(MEMBER), `rooms/${ROOM}/settlements/s1/confirmedBy`), MEMBER2)
      );
    });

    it('הנושה מאשר בשם מישהו אחר — נחסם', async () => {
      await given(`rooms/${ROOM}/settlements/s1`, settlement());
      await assertFails(
        set(ref(as(MEMBER2), `rooms/${ROOM}/settlements/s1/confirmedBy`), MEMBER)
      );
    });

    it('יצירה רגילה עם confirmedBy: null — מותר', async () => {
      // בדיוק המטען ש-createSettlement שולח (purchaseService.ts).
      // ‼️ הבדיקה הזו היא הרשת שמונעת מהתיקון לשבור את הזרימה האמיתית.
      await assertSucceeds(
        set(ref(as(MEMBER), `rooms/${ROOM}/settlements/s3`), settlement({ confirmedBy: null }))
      );
    });
  });

  /* ═════════ תיקון 1 — התראת פוש לכל uid ═════════ */

  describe('outbox/$entryId', () => {
    it('חבר מודיע לחבר אחר באותו חדר — מותר', async () => {
      await assertSucceeds(
        set(
          ref(as(MEMBER), 'outbox/e1'),
          outboxEntry({ targetUid: MEMBER2, excludeUid: MEMBER })
        )
      );
    });

    it('הניצול: מנהל החדר שלו עצמו מכוון ל-uid זר לגמרי — נחסם', async () => {
      // ‼️ הלב של הפרצה: "מנהל" אינה הרשאה נדירה — כל אחד יוצר חדר
      // ומקבל אותה תוך שניות. הכלל הישן קיבל את זה כאישור לכל נמען.
      await assertFails(
        set(
          ref(as(OUTSIDER), 'outbox/e2'),
          outboxEntry({ roomCode: OTHER_ROOM, targetUid: VICTIM, excludeUid: OUTSIDER })
        )
      );
    });

    it('מנהל מודיע למי שבקשתו נדחתה — מותר (rejectJoinRequest)', async () => {
      // הנדחה אינו חבר ולעולם לא היה. בלי החריג הצר הזה הוא לא היה
      // מקבל את הודעת הדחייה בכלל.
      await assertSucceeds(
        set(
          ref(as(ADMIN), 'outbox/e3'),
          outboxEntry({ targetUid: REJECTED, excludeUid: ADMIN })
        )
      );
    });

    it('מבקש הצטרפות ממתין מודיע למנהל — מותר (הענף השני נשמר)', async () => {
      await assertSucceeds(
        set(
          ref(as(JOINER), 'outbox/e4'),
          outboxEntry({ targetUid: ADMIN, excludeUid: JOINER })
        )
      );
    });

    it('מבקש ממתין מנסה להודיע למי שאינו המנהל — נחסם', async () => {
      await assertFails(
        set(
          ref(as(JOINER), 'outbox/e5'),
          outboxEntry({ targetUid: MEMBER2, excludeUid: JOINER })
        )
      );
    });

    it('חבר מודיע ל-uid שאינו שייך לחדר — נחסם', async () => {
      await assertFails(
        set(
          ref(as(MEMBER), 'outbox/e6'),
          outboxEntry({ targetUid: VICTIM, excludeUid: MEMBER })
        )
      );
    });

    it('התראה לכל החדר (audience=room) אינה דורשת targetUid — מותר', async () => {
      await assertSucceeds(
        set(
          ref(as(MEMBER), 'outbox/e7'),
          outboxEntry({ audience: 'room', excludeUid: MEMBER })
        )
      );
    });

    it('מי שאינו חבר בחדר לא יכול להודיע לכל החדר — נחסם', async () => {
      await assertFails(
        set(
          ref(as(OUTSIDER), 'outbox/e8'),
          outboxEntry({ audience: 'room', excludeUid: OUTSIDER })
        )
      );
    });

    /* ── תיקון 8: url זורם ל-window.location.hash ── */

    it('url של נתיב פנימי — מותר', async () => {
      await assertSucceeds(
        set(
          ref(as(MEMBER), 'outbox/e9'),
          outboxEntry({ targetUid: MEMBER2, excludeUid: MEMBER, url: `/r/${ROOM}/balances` })
        )
      );
    });

    it('url של כתובת חיצונית מלאה — נחסם', async () => {
      await assertFails(
        set(
          ref(as(MEMBER), 'outbox/e10'),
          outboxEntry({
            targetUid: MEMBER2,
            excludeUid: MEMBER,
            url: 'https://evil.example/steal',
          })
        )
      );
    });

    it("url יחסי-פרוטוקול '//evil.example' — נחסם", async () => {
      await assertFails(
        set(
          ref(as(MEMBER), 'outbox/e11'),
          outboxEntry({ targetUid: MEMBER2, excludeUid: MEMBER, url: '//evil.example' })
        )
      );
    });
  });

  /* ═════════ תיקון 3 — פתחת החירום למחיקת קנייה ═════════ */

  describe('purchases/$id — מחיקה', () => {
    it('המנהל מוחק קנייה approved — מותר', async () => {
      // ‼️ בלי זה, רשומה שגויה או זדונית שנכנסה כ-approved (וקניות
      // נכנסות ישר כ-approved) נשארה במאזן לנצח — אף אחד לא יכול היה
      // להסיר אותה.
      await given(`rooms/${ROOM}/purchases/p1`, purchase());
      await assertSucceeds(remove(ref(as(ADMIN), `rooms/${ROOM}/purchases/p1`)));
    });

    it('חבר רגיל מוחק קנייה approved — נחסם', async () => {
      await given(`rooms/${ROOM}/purchases/p1`, purchase());
      await assertFails(remove(ref(as(MEMBER2), `rooms/${ROOM}/purchases/p1`)));
    });

    it('הקונה עצמו מוחק קנייה approved — נחסם', async () => {
      // הפתחה ניתנה למנהל בלבד; הקונה לא מוחק רשומה שכבר נכנסה למאזן.
      await given(`rooms/${ROOM}/purchases/p1`, purchase());
      await assertFails(remove(ref(as(MEMBER), `rooms/${ROOM}/purchases/p1`)));
    });

    it('הקונה מוחק קנייה שעדיין pending — מותר (ללא רגרסיה)', async () => {
      await given(
        `rooms/${ROOM}/purchases/p2`,
        purchase({ status: 'pending', approvedBy: null })
      );
      await assertSucceeds(remove(ref(as(MEMBER), `rooms/${ROOM}/purchases/p2`)));
    });
  });

  /* ═════════ תיקון 7 — אווטאר כמשואת מעקב ═════════ */

  describe('avatar בהעתקי ה-fan-out', () => {
    it('members: אווטאר https — מותר', async () => {
      await assertSucceeds(
        set(ref(as(MEMBER), `rooms/${ROOM}/members/${MEMBER}/avatar`), HTTPS_AVATAR)
      );
    });

    it('members: משואת מעקב http — נחסם', async () => {
      // נטענת בדפדפן של כל שותף בכל רינדור של רשימת החברים.
      await assertFails(
        set(ref(as(MEMBER), `rooms/${ROOM}/members/${MEMBER}/avatar`), TRACKER_AVATAR)
      );
    });

    it('pendingRequests: אווטאר https — מותר', async () => {
      await assertSucceeds(
        set(ref(as(STRANGER), `rooms/${ROOM}/pendingRequests/${STRANGER}`), {
          userId: STRANGER,
          displayName: 'זר מנומס',
          email: 'stranger@example.com',
          avatar: HTTPS_AVATAR,
          requestedAt: T,
          status: 'pending',
        })
      );
    });

    it('pendingRequests: משואת מעקב http — נחסם', async () => {
      // ‼️ החמור מבין השניים: את הבקשה שולח **זר** שיודע רק את קוד
      // החדר, והתמונה נטענת אוטומטית במסך הבקשות של המנהל.
      await assertFails(
        set(ref(as(STRANGER), `rooms/${ROOM}/pendingRequests/${STRANGER}`), {
          userId: STRANGER,
          displayName: 'זר עוקב',
          email: 'stranger@example.com',
          avatar: TRACKER_AVATAR,
          requestedAt: T,
          status: 'pending',
        })
      );
    });
  });

  /* ═════════ תיקון 10 — התחזות בשם המציג ═════════ */

  describe('notifications/$id/actorName', () => {
    const notification = (over: Record<string, unknown> = {}) => ({
      type: 'item_added',
      actorId: MEMBER,
      actorName: 'חבר',
      text: 'חבר דיווח שחסר חלב',
      entityId: 'item-1',
      createdAt: T,
      readBy: { [MEMBER]: true },
      ...over,
    });

    it('שם שתואם ל-members/$uid/name — מותר', async () => {
      await assertSucceeds(
        set(ref(as(MEMBER), `rooms/${ROOM}/notifications/n1`), notification())
      );
    });

    it('שם שתואם ל-users/$uid/displayName — מותר', async () => {
      // ‼️ שני המקורות מותרים בכוונה: יש חלון אמיתי שבו members/name
      // ו-displayName נבדלים (שינוי שם בזמן שבקשת ההצטרפות ממתינה).
      await given(`users/${MEMBER}/displayName`, 'שם חדש לגמרי');
      await assertSucceeds(
        set(
          ref(as(MEMBER), `rooms/${ROOM}/notifications/n2`),
          notification({ actorName: 'שם חדש לגמרי' })
        )
      );
    });

    it('הניצול: חבר מפרסם התראה בשם "מנהל החדר" — נחסם', async () => {
      await assertFails(
        set(
          ref(as(MEMBER), `rooms/${ROOM}/notifications/n3`),
          notification({ actorName: 'מנהל החדר' })
        )
      );
    });
  });
});
