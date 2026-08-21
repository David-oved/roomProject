import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, set, update } from 'firebase/database';
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

    it('pendingRequests: חבר פעיל מוחק את רשומת הבקשה של עצמו (leaveRoom) — מותר', async () => {
      // ‼️ רגרסיה שנתפסה בסבב האבטחה: leaveRoom (roomService.ts) מוחק
      // תמיד rooms/{code}/pendingRequests/{uid} כחלק מהעדכון האטומי,
      // גם כשהקורא כבר חבר. לפני התיקון: ענף "המבקש הטרי" דורש
      // !members.exists() (שקרי לחבר פעיל), וענף המנהל דורש שהקורא
      // יהיה המנהל — ולכן העזיבה נכשלה כליל לכל מי שאינו מנהל.
      await assertSucceeds(remove(ref(as(MEMBER), `rooms/${ROOM}/pendingRequests/${MEMBER}`)));
    });

    it('pendingRequests: חבר פעיל לא יכול לכתוב (לא למחוק) בקשה בשם עצמו', async () => {
      // חייב להישאר חסום: הענף החדש מתיר רק מחיקה (newData לא קיים),
      // לא יצירה/עדכון — אחרת חבר יכול "לאשר" מחדש בקשה משלו.
      await assertFails(
        set(ref(as(MEMBER), `rooms/${ROOM}/pendingRequests/${MEMBER}`), {
          userId: MEMBER,
          displayName: 'חבר',
          requestedAt: T,
          status: 'approved',
        })
      );
    });

    it('pendingRequests: חבר לא יכול למחוק בקשה של uid אחר', async () => {
      await assertFails(remove(ref(as(MEMBER), `rooms/${ROOM}/pendingRequests/${STRANGER}`)));
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

    it('חבר רגיל רושם actorId של עצמו — מותר', async () => {
      await assertSucceeds(
        set(ref(as(MEMBER), `rooms/${ROOM}/notifications/n4`), notification({ actorId: MEMBER }))
      );
    });

    it('הניצול: המנהל מזייף actorId של חבר אחר — נחסם', async () => {
      // ‼️ הכלל הישן התיר לכל כותב שהוא המנהל לרשום כל actorId שרצה,
      // בלי קשר ל-newData — כלומר המנהל יכול היה לייחס פעולה (למשל
      // "דחיית קנייה") לחבר שלא עשה אותה כלל.
      await assertFails(
        set(
          ref(as(ADMIN), `rooms/${ROOM}/notifications/n5`),
          notification({ actorId: MEMBER2, actorName: 'חברה' })
        )
      );
    });
  });
  /* ═════════ הערוץ מול מנהל המערכת ═════════ */

  /**
   * שלושת הצמתים שנוספו יחד עם קונסולת הניהול (docs/13-admin-console.md).
   * שלושתם חולקים אותה תבנית: הלקוח רשאי לעשות בהם דבר אחד ומדויק,
   * וכל השאר סגור — כי הצד השני של הערוץ הוא Admin SDK שעוקף כללים
   * לגמרי, ולכן כאן נמצאת כל ההגבלה שקיימת.
   */

  describe('feedback', () => {
    const feedback = (over: Record<string, unknown> = {}) => ({
      roomCode: ROOM,
      userId: MEMBER,
      type: 'bug',
      subject: 'הכפתור לא עובד',
      body: 'לחצתי ולא קרה כלום',
      createdAt: T,
      ...over,
    });

    it('חבר פעיל שולח משוב על החדר שלו — מותר', async () => {
      await assertSucceeds(set(ref(as(MEMBER), 'feedback/f1'), feedback()));
    });

    it('פרטי מכשיר מצורפים — מותר', async () => {
      await assertSucceeds(
        set(
          ref(as(MEMBER), 'feedback/f2'),
          feedback({ environment: { browser: 'Safari', os: 'iOS', appVersion: '1.21.0' } })
        )
      );
    });

    it('הניצול: כתיבת משוב בשם משתמש אחר — נחסם', async () => {
      await assertFails(set(ref(as(MEMBER), 'feedback/f3'), feedback({ userId: MEMBER2 })));
    });

    it('הניצול: משוב על חדר שהכותב אינו חבר בו — נחסם', async () => {
      // בלי הבדיקה הזו אפשר להציף את תיבת המנהל בפניות על חדרים זרים
      await assertFails(
        set(ref(as(MEMBER), 'feedback/f4'), feedback({ roomCode: OTHER_ROOM }))
      );
    });

    it('עריכת משוב שכבר נשלח — נחסם', async () => {
      await given('feedback/f5', feedback());
      await assertFails(
        set(ref(as(MEMBER), 'feedback/f5'), feedback({ body: 'נוסח אחר לגמרי' }))
      );
    });

    it('מחיקת משוב שכבר נשלח — נחסם', async () => {
      await given('feedback/f6', feedback());
      await assertFails(remove(ref(as(MEMBER), 'feedback/f6')));
    });

    it('סוג משוב שאינו ברשימה — נחסם', async () => {
      await assertFails(set(ref(as(MEMBER), 'feedback/f7'), feedback({ type: 'spam' })));
    });

    it('נושא קצר משלושה תווים — נחסם (אותו סף כמו בלקוח)', async () => {
      await assertFails(set(ref(as(MEMBER), 'feedback/f8'), feedback({ subject: 'אב' })));
    });

    it('הכותב קורא את הפנייה שלו — מותר', async () => {
      await given('feedback/f9', feedback());
      await assertSucceeds(get(ref(as(MEMBER), 'feedback/f9')));
    });

    it('הניצול: חבר קורא פנייה של מישהו אחר — נחסם', async () => {
      await given('feedback/f10', feedback());
      await assertFails(get(ref(as(MEMBER2), 'feedback/f10')));
    });

    it('הניצול: סריקת כל אוסף המשוב — נחסם', async () => {
      await given('feedback/f11', feedback());
      await assertFails(get(ref(as(MEMBER), 'feedback')));
    });
  });

  describe('adminMessages', () => {
    const message = (over: Record<string, unknown> = {}) => ({
      title: 'תחזוקה הלילה',
      body: 'המערכת לא תהיה זמינה בין 02:00 ל-04:00',
      kind: 'warning',
      sentAt: T,
      readAt: null,
      ...over,
    });

    it('המשתמש קורא את התיבה שלו — מותר', async () => {
      await given(`adminMessages/${MEMBER}/m1`, message());
      await assertSucceeds(get(ref(as(MEMBER), `adminMessages/${MEMBER}`)));
    });

    it('הניצול: קריאת התיבה של משתמש אחר — נחסם', async () => {
      await given(`adminMessages/${MEMBER}/m1`, message());
      await assertFails(get(ref(as(MEMBER2), `adminMessages/${MEMBER}`)));
    });

    it('סימון נקרא — מותר', async () => {
      await given(`adminMessages/${MEMBER}/m1`, message());
      await assertSucceeds(
        update(ref(as(MEMBER), `adminMessages/${MEMBER}/m1`), { readAt: T + 1 })
      );
    });

    it('סימון לחיצה על כפתור הפעולה — מותר', async () => {
      await given(`adminMessages/${MEMBER}/m1`, message());
      await assertSucceeds(
        update(ref(as(MEMBER), `adminMessages/${MEMBER}/m1`), { clickedAt: T + 2 })
      );
    });

    it('הניצול: שינוי גוף ההודעה תוך כדי סימון נקרא — נחסם', async () => {
      // ‼️ בלי הקפאת השדות, "מעקב קריאה" הופך לקישוט: המשתמש יכול
      //    לשכתב את מה שהמנהל שלח ואז לטעון שקרא משהו אחר.
      await given(`adminMessages/${MEMBER}/m1`, message());
      await assertFails(
        update(ref(as(MEMBER), `adminMessages/${MEMBER}/m1`), {
          readAt: T + 1,
          body: 'הודעה שלא נשלחה מעולם',
        })
      );
    });

    it('הניצול: יצירת הודעה "ממנהל המערכת" יש מאין — נחסם', async () => {
      await assertFails(set(ref(as(MEMBER), `adminMessages/${MEMBER}/fake`), message()));
    });

    it('הניצול: שתילת הודעה בתיבה של משתמש אחר — נחסם', async () => {
      await assertFails(set(ref(as(MEMBER), `adminMessages/${MEMBER2}/fake`), message()));
    });

    it('מחיקת הודעה מהתיבה — נחסם', async () => {
      await given(`adminMessages/${MEMBER}/m1`, message());
      await assertFails(remove(ref(as(MEMBER), `adminMessages/${MEMBER}/m1`)));
    });
  });

  describe('suspensions', () => {
    const suspension = { at: T, reason: 'שימוש לרעה' };

    it('המשתמש קורא את מצב החסימה של עצמו — מותר', async () => {
      await given(`suspensions/${MEMBER}`, suspension);
      await assertSucceeds(get(ref(as(MEMBER), `suspensions/${MEMBER}`)));
    });

    it('הניצול: מחיקת החסימה של עצמי — נחסם', async () => {
      await given(`suspensions/${MEMBER}`, suspension);
      await assertFails(remove(ref(as(MEMBER), `suspensions/${MEMBER}`)));
    });

    it('הניצול: חסימת משתמש אחר — נחסם', async () => {
      await assertFails(set(ref(as(MEMBER), `suspensions/${MEMBER2}`), suspension));
    });

    it('הניצול: קריאת החסימה של משתמש אחר — נחסם', async () => {
      await given(`suspensions/${MEMBER2}`, suspension);
      await assertFails(get(ref(as(MEMBER), `suspensions/${MEMBER2}`)));
    });
  });

  describe('adminConsole', () => {
    it('הניצול: קריאת מרחב העבודה של המנהל — נחסם', async () => {
      await given('adminConsole/feedbackState/f1', { status: 'new', priority: 'high' });
      await assertFails(get(ref(as(MEMBER), 'adminConsole/feedbackState/f1')));
    });

    it('הניצול: שינוי סטטוס הטיפול בפנייה שלי — נחסם', async () => {
      await assertFails(
        set(ref(as(MEMBER), 'adminConsole/feedbackState/f1'), { status: 'resolved' })
      );
    });

    it('הניצול: כתיבה ליומן הביקורת — נחסם', async () => {
      await assertFails(
        set(ref(as(ADMIN), 'adminConsole/auditLog/x1'), { action: 'לא קרה', at: T })
      );
    });
  });
});
