import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  /* ═════════ פאנל המפתח ═════════ */

  describe('פאנל המפתח (developer panel)', () => {
    const DEV_EMAIL = 'wbddwd55@gmail.com';
    /** אותו מנגנון בדיוק בכל הבדיקות: uid כלשהו, עם claim של המייל הנכון. */
    const asDeveloper = () => testEnv.authenticatedContext('uid-anyone', { email: DEV_EMAIL }).database();

    it('חשבון המפתח קורא את כל אוסף המשתמשים בבת אחת — מותר', async () => {
      await assertSucceeds(get(ref(asDeveloper(), 'users')));
    });

    it('חשבון המפתח קורא את כל אוסף roomCodes בבת אחת — מותר', async () => {
      await assertSucceeds(get(ref(asDeveloper(), 'roomCodes')));
    });

    it('חשבון המפתח קורא metadata וחברים של חדר שהוא לא חבר בו — מותר', async () => {
      await assertSucceeds(get(ref(asDeveloper(), `rooms/${OTHER_ROOM}/metadata`)));
      await assertSucceeds(get(ref(asDeveloper(), `rooms/${OTHER_ROOM}/members`)));
    });

    it('הניצול: משתמש עם מייל אחר לא מקבל את אותה גישה, גם עם claim של email', async () => {
      const impostor = testEnv
        .authenticatedContext('uid-impostor', { email: 'not-the-dev@example.com' })
        .database();
      await assertFails(get(ref(impostor, 'users')));
      await assertFails(get(ref(impostor, 'roomCodes')));
      await assertFails(get(ref(impostor, `rooms/${OTHER_ROOM}/metadata`)));
    });

    it('הניצול: המנהל של OTHER_ROOM לא סורק users או roomCodes דרך הרשאתו כמנהל', async () => {
      // OUTSIDER הוא אכן מנהל OTHER_ROOM ורשאי לקרוא את החדר שלו —
      // אבל זה לא אמור לתת לו שום דריסה לאוספים הגלובליים.
      await assertSucceeds(get(ref(as(OUTSIDER), `rooms/${OTHER_ROOM}/metadata`)));
      await assertFails(get(ref(as(OUTSIDER), 'users')));
      await assertFails(get(ref(as(OUTSIDER), 'roomCodes')));
    });

    it('חבר רגיל בחדר שלו עדיין קורא את המטא-דאטה כרגיל — הכלל הישן לא נשבר', async () => {
      // בדיקת רגרסיה: הוספת .read חדש בצומת metadata/members לא אמורה
      // לגעת בכלל הקיים שמאפשר לחבר פעיל לקרוא את rooms/$code כולו.
      await assertSucceeds(get(ref(as(MEMBER), `rooms/${ROOM}/metadata`)));
      await assertSucceeds(get(ref(as(MEMBER), `rooms/${ROOM}/members`)));
    });

    it('הניצול: זר לגמרי (לא חבר, לא המפתח) לא קורא metadata של חדר', async () => {
      await assertFails(get(ref(as(STRANGER), `rooms/${OTHER_ROOM}/metadata`)));
    });

    it('חשבון המפתח לא מקבל שום זכות כתיבה — רק קריאה', async () => {
      // ה-.read החדש לא נלווה בשום .write. כתיבה לפרופיל של מישהו אחר
      // חייבת להיכשל בדיוק כמו לכל משתמש רגיל אחר.
      await assertFails(
        set(ref(asDeveloper(), `users/${MEMBER}/displayName`), 'שם מזויף')
      );
      await assertFails(
        set(ref(asDeveloper(), `rooms/${OTHER_ROOM}/metadata/name`), 'שם מזויף')
      );
    });

    it('הניצול: כתיבת claim מייל בלי חיבור אמיתי לא עוקפת — משתמש לא-מאומת נדחה תמיד', async () => {
      const anon = testEnv.unauthenticatedContext().database();
      await assertFails(get(ref(anon, 'users')));
    });
  });

  /* ═════════ חברות בכמה חדרים במקביל ═════════ */

  /**
   * ‼️ למה זה נבדק בשכבת הכללים ולא רק בממשק.
   *
   * OnboardingPage כבר יודע להציג בוחר חדרים (ראו
   * tests/unit/multiRoom.test.tsx), אבל ממשק שמציג שני חדרים בזמן
   * שהשרת מרשה רק אחד הוא הבטחה ריקה. השאלה "האם משתמש *תכלס* יכול
   * להיות חבר בשני חדרים" נחתכת כאן: users/$uid/rooms/$roomCode הוא
   * wildcard בלי תקרה, ואין שום כלל שסופר חדרים.
   *
   * הבדיקות נועלות שני דברים הפוכים: שהחברות הכפולה באמת עובדת, ושהיא
   * לא הופכת לדלת אחורית — חברות בחדר אחד לא מקנה שום גישה לאחר.
   */
  describe('חברות בשני חדרים', () => {
    /** MEMBER מצטרף גם ל-OTHER_ROOM, בנוסף ל-ROOM שהוא כבר חבר בו. */
    const joinSecondRoom = async () => {
      await given(`rooms/${OTHER_ROOM}/members/${MEMBER}`, {
        name: 'חבר',
        email: 'member@example.com',
        joinedAt: T,
        status: 'active',
        role: 'member',
      });
      await given(`users/${MEMBER}/rooms`, { [ROOM]: true, [OTHER_ROOM]: true });
    };

    it('חבר פעיל בשני חדרים קורא את שניהם', async () => {
      await joinSecondRoom();
      await assertSucceeds(get(ref(as(MEMBER), `rooms/${ROOM}/metadata`)));
      await assertSucceeds(get(ref(as(MEMBER), `rooms/${OTHER_ROOM}/metadata`)));
      await assertSucceeds(get(ref(as(MEMBER), `rooms/${OTHER_ROOM}/members`)));
    });

    it('רשימת החדרים שלו מחזיקה את שניהם, והוא קורא אותה', async () => {
      await joinSecondRoom();
      const snap = await get(ref(as(MEMBER), `users/${MEMBER}/rooms`));
      expect(Object.keys(snap.val() ?? {}).sort()).toEqual([ROOM, OTHER_ROOM].sort());
    });

    it('אין תקרה — אפשר להוסיף חדר שלישי', async () => {
      await joinSecondRoom();
      await assertSucceeds(set(ref(as(MEMBER), `users/${MEMBER}/rooms/ROOM03`), true));
    });

    it('הוא כותב בשני החדרים — חברות כפולה אינה קריאה בלבד', async () => {
      await joinSecondRoom();
      const item = (name: string) => ({
        name,
        category: 'kitchen',
        reportedBy: MEMBER,
        reportedAt: T,
        priority: 'normal',
        status: 'needed',
      });

      await assertSucceeds(set(ref(as(MEMBER), `rooms/${ROOM}/items/i1`), item('חלב')));
      await assertSucceeds(set(ref(as(MEMBER), `rooms/${OTHER_ROOM}/items/i2`), item('לחם')));
    });

    it('שני החדרים נשארים מופרדים — חברות באחד אינה גישה לשלישי', async () => {
      await joinSecondRoom();
      await given('rooms/ROOM03/metadata', {
        name: 'חדר זר',
        createdAt: T,
        createdBy: STRANGER,
        adminId: STRANGER,
        currency: 'ILS',
      });
      await assertFails(get(ref(as(MEMBER), 'rooms/ROOM03/metadata')));
    });

    it('הניצול: רישום עצמי לחדר שלישי אינו הופך לחברות בו', async () => {
      // ‼️ users/$uid/rooms הוא נוחות ניתוב בצד הלקוח, לא מקור הרשאה.
      // מי שיכתוב לעצמו קוד חדר שרירותי — וזה מותר לו — עדיין לא יקבל
      // ממנו שום נתון, כי ההרשאה נגזרת מ-rooms/$code/members בלבד.
      await given('rooms/ROOM03/metadata', {
        name: 'חדר זר',
        createdAt: T,
        createdBy: STRANGER,
        adminId: STRANGER,
        currency: 'ILS',
      });
      await assertSucceeds(set(ref(as(MEMBER), `users/${MEMBER}/rooms/ROOM03`), true));
      await assertFails(get(ref(as(MEMBER), 'rooms/ROOM03/metadata')));
    });

    it('עזיבת חדר אחד לא נוגעת בשני', async () => {
      await joinSecondRoom();

      // בדיוק מה ש-leaveRoom כותב (roomService.ts)
      await assertSucceeds(
        update(ref(as(MEMBER)), {
          [`rooms/${OTHER_ROOM}/members/${MEMBER}/status`]: 'removed',
          [`users/${MEMBER}/rooms/${OTHER_ROOM}`]: null,
        })
      );

      await assertSucceeds(get(ref(as(MEMBER), `rooms/${ROOM}/metadata`)));
      await assertFails(get(ref(as(MEMBER), `rooms/${OTHER_ROOM}/metadata`)));
    });

    it('אפשר להיות מנהל בחדר אחד וחבר רגיל באחר', async () => {
      // ADMIN מנהל את ROOM; מוסיפים אותו כחבר רגיל ב-OTHER_ROOM
      await given(`rooms/${OTHER_ROOM}/members/${ADMIN}`, {
        name: 'אדמין',
        email: 'admin@example.com',
        joinedAt: T,
        status: 'active',
        role: 'member',
      });
      await given(`users/${ADMIN}/rooms`, { [ROOM]: true, [OTHER_ROOM]: true });

      await assertSucceeds(set(ref(as(ADMIN), `rooms/${ROOM}/metadata/name`), 'שם חדש'));
      // ‼️ הגבול: תפקיד המנהל אינו נודד איתו לחדר השני
      await assertFails(set(ref(as(ADMIN), `rooms/${OTHER_ROOM}/metadata/name`), 'שם חדש'));
    });
  });

  /* ═════════ אישור בקשת הצטרפות — מנהל החדר ═════════ */

  /**
   * ‼️ הבדיקות שהיו חסרות כשמנהלי חדרים דיווחו שהם לא מצליחים לאשר
   *    אף אחד.
   *
   * הכשל לא היה בהרשאה של מנהל החדר ולא נגע בחשבון המפתח כלל — הוא
   * היה בהנחה שגויה לגבי מנוע הכללים עצמו:
   *
   *   `root` בכללי RTDB הוא תמיד המצב **לפני** הכתיבה. כתיבה
   *   מרובת-נתיבים אינה משנה את זה — כל נתיב בעדכון נבדק מול אותו
   *   root ישן, ולא מול מה שנתיב אחר באותו עדכון עומד לכתוב.
   *
   * הכלל ב-users/$uid/rooms/$roomCode דרש שהיעד יהיה כבר חבר פעיל,
   * בהנחה שהחברות שנכתבת באותה עדכון אטומית "תיראה" כבר. היא לא. ומה
   * שהופך את זה לכשל מלא ולא חלקי: העדכון אטומי — נתיב אחד שנדחה מפיל
   * את כל השבעה.
   *
   * ‼️ הבדיקה הראשונה כאן היא בכוונה **המטען המדויק** של
   *    approveJoinRequest (roomService.ts), על כל שבעת הנתיבים. בדיקה
   *    של נתיב בודד לא הייתה תופסת את זה: חמישה מהשבעה עברו גם קודם.
   */
  describe('approveJoinRequest', () => {
    /** בדיוק מה ש-roomService שולח כשמנהל לוחץ "אשר". */
    const approvalUpdate = (uid: string) => ({
      [`rooms/${ROOM}/members/${uid}`]: {
        name: 'מבקש',
        email: 'joiner@example.com',
        avatar: null,
        joinedAt: T,
        status: 'active',
        role: 'member',
      },
      [`rooms/${ROOM}/pendingRequests/${uid}/status`]: 'approved',
      [`rooms/${ROOM}/pendingRequests/${uid}/respondedAt`]: T,
      [`joinRequests/${uid}/${ROOM}/status`]: 'approved',
      [`joinRequests/${uid}/${ROOM}/respondedAt`]: T,
      [`users/${uid}/rooms/${ROOM}`]: true,
      [`rooms/${ROOM}/notifications/n1`]: {
        type: 'member_joined',
        actorId: ADMIN,
        actorName: 'אדמין',
        text: 'מבקש הצטרף לחדר',
        entityId: uid,
        createdAt: T,
        readBy: { [ADMIN]: true },
      },
    });

    it('מנהל החדר מאשר בקשה — העדכון האטומי המלא עובר', async () => {
      await assertSucceeds(update(ref(as(ADMIN)), approvalUpdate(JOINER)));
    });

    it('מנהל החדר לבדו מספיק — אין שום דרישה לחשבון המפתח', async () => {
      // ‼️ חשבון המפתח הוא קריאה בלבד ואינו מעורב באישורים כלל.
      //    הבדיקה הזו נועלת את זה: ההרשאה נגזרת מ-metadata/adminId.
      await assertSucceeds(update(ref(as(ADMIN)), approvalUpdate(JOINER)));
      const snap = await get(ref(as(ADMIN), `rooms/${ROOM}/members/${JOINER}/status`));
      expect(snap.val()).toBe('active');
    });

    it('הדגל ברשימת החדרים של המאושר נדלק — בלעדיו הוא לא רואה את החדר', async () => {
      await assertSucceeds(update(ref(as(ADMIN)), approvalUpdate(JOINER)));
      const snap = await get(ref(as(JOINER), `users/${JOINER}/rooms`));
      expect(snap.val()).toEqual({ [ROOM]: true });
    });

    it('המאושר קורא את החדר מיד אחרי האישור', async () => {
      await assertSucceeds(update(ref(as(ADMIN)), approvalUpdate(JOINER)));
      await assertSucceeds(get(ref(as(JOINER), `rooms/${ROOM}/metadata`)));
    });

    it('דחייה עדיין עובדת', async () => {
      await assertSucceeds(
        update(ref(as(ADMIN)), {
          [`rooms/${ROOM}/pendingRequests/${JOINER}/status`]: 'rejected',
          [`rooms/${ROOM}/pendingRequests/${JOINER}/respondedAt`]: T,
          [`joinRequests/${JOINER}/${ROOM}/status`]: 'rejected',
          [`joinRequests/${JOINER}/${ROOM}/respondedAt`]: T,
        })
      );
    });

    it('מנהל של חדר אחר לא מאשר לחדר שאינו שלו', async () => {
      await assertFails(update(ref(as(OUTSIDER)), approvalUpdate(JOINER)));
    });

    it('חבר רגיל אינו מאשר בקשות', async () => {
      await assertFails(update(ref(as(MEMBER)), approvalUpdate(JOINER)));
    });

    /* ── ההגנה שהתיקון חייב לשמור עליה ── */

    /**
     * ‼️ זו הסיבה שהתנאי הוצב שם מלכתחילה, והתיקון לא מבטל אותה.
     *
     * "חדר רפאים": מנהל מדליק את הדגל אצל מישהו שלא ביקש כלום. זו לא
     * הצקה בלבד — כל כתיבה עתידית מרובת-נתיבים של הקורבן (שינוי שם,
     * שמתפזר לכל חדריו) הייתה נכשלת *כולה* בגלל הנתיב הפנטום. מניעת
     * שירות לצמיתות.
     */
    it('הניצול: הדלקת דגל חדר אצל מי שלא ביקש להצטרף — נחסם', async () => {
      await assertFails(set(ref(as(ADMIN), `users/${VICTIM}/rooms/${ROOM}`), true));
    });

    it('הניצול: אותו דבר על משתמש קיים שאינו קשור לחדר — נחסם', async () => {
      await assertFails(set(ref(as(OUTSIDER), `users/${MEMBER}/rooms/${OTHER_ROOM}`), true));
    });

    /**
     * ‼️ הדלת נשארת סגורה כי מנהל אינו יכול *ליצור* בקשה בשם מישהו
     *    אחר — רק המשתמש עצמו יוצר את הבקשה שלו. בלי הנעילה הזו,
     *    התיקון שלמעלה היה פותח מחדש את חדר הרפאים בשני צעדים.
     */
    it('הניצול: מנהל שותל בקשת הצטרפות בשם קורבן — נחסם', async () => {
      await assertFails(
        set(ref(as(ADMIN), `rooms/${ROOM}/pendingRequests/${VICTIM}`), {
          userId: VICTIM,
          displayName: 'קורבן',
          requestedAt: T,
          status: 'pending',
        })
      );
    });

    it('הסרה ועזיבה ממשיכות לכבות את הדגל', async () => {
      await assertSucceeds(update(ref(as(ADMIN)), approvalUpdate(JOINER)));
      await assertSucceeds(set(ref(as(ADMIN), `users/${JOINER}/rooms/${ROOM}`), null));
    });
  });
});
