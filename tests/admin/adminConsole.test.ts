import { describe, expect, it } from 'vitest';
// @ts-expect-error — מודולי השרת של הקונסולה הם JS רגיל, בלי טיפוסים
import { buildWorld } from '../../admin/server/world.mjs';
// @ts-expect-error
import { buildEvents, filterEvents, userTimeline } from '../../admin/server/activity.mjs';
// @ts-expect-error
import { assessRoom, HEALTH_THRESHOLDS } from '../../admin/server/roomHealth.mjs';
// @ts-expect-error
import { analyzeAll, analyzeUser } from '../../admin/server/insights.mjs';
// @ts-expect-error
import { buildFeedbackList, filterFeedback } from '../../admin/server/feedback.mjs';
// @ts-expect-error
import { buildAlerts, inQuietHours, mergeConfig } from '../../admin/server/alerts.mjs';
// @ts-expect-error
import { resolveAudience, trackingFor } from '../../admin/server/messaging.mjs';
// @ts-expect-error
import { generateReport, reportToCsv } from '../../admin/server/reports.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  בדיקות מנוע הקונסולה
 * ═══════════════════════════════════════════════════════════════
 *  הקונסולה מציגה מספרים שעל בסיסם אני מקבל החלטות על החדרים של
 *  אנשים אחרים — לאשר קנייה, לאפס מאזן, לארכב חדר. לכן הנגזרות
 *  נבדקות על עולם קטן ומפורש שאפשר לספור ביד.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

/** עולם מינימלי: חדר בריא אחד, חדר נטוש אחד, שלושה משתמשים. */
function fixture() {
  return {
    users: {
      u1: { email: 'a@x.com', displayName: 'אביב', createdAt: NOW - 200 * DAY, lastActiveAt: NOW - 3600_000 },
      u2: { email: 'b@x.com', displayName: 'בר', createdAt: NOW - 200 * DAY, lastActiveAt: NOW - 2 * DAY },
      u3: { email: 'c@x.com', displayName: 'גיל', createdAt: NOW - 200 * DAY, lastActiveAt: NOW - 120 * DAY },
    },
    rooms: {
      AAA111: {
        metadata: { name: 'חדר בריא', createdAt: NOW - 100 * DAY, createdBy: 'u1', adminId: 'u1' },
        members: {
          u1: { name: 'אביב', email: 'a@x.com', joinedAt: NOW - 100 * DAY, status: 'active', role: 'admin' },
          u2: { name: 'בר', email: 'b@x.com', joinedAt: NOW - 99 * DAY, status: 'active', role: 'member' },
        },
        items: {
          i1: { name: 'חלב', reportedBy: 'u2', reportedAt: NOW - DAY, status: 'needed', priority: 'normal', category: 'kitchen' },
        },
        purchases: {
          p1: {
            title: 'לחם',
            boughtBy: 'u1',
            amount: 1000,
            date: NOW - 2 * DAY,
            createdAt: NOW - 2 * DAY,
            splitMethod: 'equal',
            shares: { u1: 500, u2: 500 },
            status: 'approved',
            approvedBy: 'u1',
          },
        },
        settlements: {},
        taskCompletions: {},
        chat: {},
      },
      BBB222: {
        metadata: { name: 'חדר נטוש', createdAt: NOW - 300 * DAY, createdBy: 'u3', adminId: 'u3' },
        members: {
          u3: { name: 'גיל', email: 'c@x.com', joinedAt: NOW - 300 * DAY, status: 'active', role: 'admin' },
          u2: { name: 'בר', email: 'b@x.com', joinedAt: NOW - 290 * DAY, status: 'active', role: 'member' },
        },
        items: {
          old1: { name: 'קפה', reportedBy: 'u3', reportedAt: NOW - 60 * DAY, status: 'needed', priority: 'normal', category: 'kitchen' },
        },
        purchases: {
          big: {
            title: 'קנייה גדולה',
            boughtBy: 'u3',
            amount: 400_000,
            date: NOW - 50 * DAY,
            createdAt: NOW - 50 * DAY,
            splitMethod: 'equal',
            shares: { u3: 200_000, u2: 200_000 },
            status: 'approved',
            approvedBy: 'u3',
          },
        },
        settlements: {},
        taskCompletions: {},
        chat: {},
      },
    },
    feedback: {
      f1: { roomCode: 'AAA111', userId: 'u2', type: 'bug', subject: 'כפתור שבור', body: 'לא עובד', createdAt: NOW - 3600_000 },
      f2: { roomCode: 'AAA111', userId: 'u1', type: 'compliment', subject: 'תודה', body: 'מעולה', createdAt: NOW - 5 * DAY },
    },
    adminConsole: {
      feedbackState: { f2: { status: 'resolved', priority: 'low', updatedAt: NOW - 4 * DAY } },
      messages: {
        m1: {
          title: 'הודעה',
          body: 'גוף',
          kind: 'info',
          audience: { type: 'all' },
          createdAt: NOW - DAY,
          sendAt: NOW - DAY,
          status: 'sent',
          recipients: {
            u1: { deliveredAt: NOW - DAY, readAt: NOW - DAY + 60_000, clickedAt: null },
            u2: { deliveredAt: NOW - DAY, readAt: null, clickedAt: null },
          },
        },
      },
    },
  };
}

const world = () => buildWorld(fixture(), NOW);

/* ═══════════════════ שפיות נתוני ההדגמה ═══════════════════ */

describe('נתוני ההדגמה', () => {
  it('כל קוד חדר תקף לפי הכללים ולפי מחולל הקודים של האפליקציה', async () => {
    // ‼️ הבדיקה הזו נולדה מבאג אמיתי: נתוני ההדגמה נבנו עם קודים בני
    //    ארבעה תווים ("AB12"), בעוד המערכת מייצרת שישה. הכול נראה תקין
    //    בקונסולה — שקוראת דרך Admin SDK ולכן עוקפת כללים — אבל כל
    //    כתיבה מהאפליקציה לחדרים האלה נדחתה ב-PERMISSION_DENIED.
    const { buildSeed } = await import('../../admin/server/seed.mjs');
    const ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
    const RULES_PATTERN = /^[A-Z0-9]{6}$/;

    const seed = buildSeed(NOW) as { rooms: Record<string, unknown> };
    const codes = Object.keys(seed.rooms);
    expect(codes.length).toBeGreaterThan(0);

    for (const code of codes) {
      expect(code, `קוד החדר ${code} אינו עומד בכללי האבטחה`).toMatch(RULES_PATTERN);
      expect(code, `קוד החדר ${code} מכיל תווים שהמחולל לא מייצר`).toMatch(ALPHABET);
    }
  });
});

/* ═══════════════════ מודל העולם ═══════════════════ */

describe('buildWorld', () => {
  it('מחשב מאזנים מתוך יומן הקניות', () => {
    const w = world();
    const room = w.rooms.get('AAA111');
    // u1 שילם 1000 ונשא 500 → מגיע לו 500; u2 חייב 500
    expect(room.balances.u1).toBe(500);
    expect(room.balances.u2).toBe(-500);
    expect(room.spread).toBe(1000);
  });

  it('מרכיב לכל משתמש את רשימת החדרים שלו עם התפקיד', () => {
    const w = world();
    const u2 = w.users.get('u2');
    expect(u2.memberships.map((m: { roomCode: string }) => m.roomCode).sort()).toEqual(['AAA111', 'BBB222']);
    expect(w.users.get('u1').memberships[0].role).toBe('admin');
  });

  it('פעילות אחרונה של חדר היא החותמת הגדולה ביותר בכל הענפים', () => {
    const w = world();
    expect(w.rooms.get('AAA111').lastActivityAt).toBe(NOW - DAY); // דיווח המוצר
    expect(w.rooms.get('BBB222').idleDays).toBeGreaterThan(45);
  });
});

/* ═══════════════════ אירועים ═══════════════════ */

describe('buildEvents', () => {
  it('מייצר אירוע לכל רשומה, ממוין מהחדש לישן', () => {
    const events = buildEvents(world());
    expect(events.length).toBeGreaterThan(5);
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].ts).toBeGreaterThanOrEqual(events[i].ts);
    }
  });

  it('מזהה אירוע בצורה דטרמיניסטית — אותו עולם, אותם מזהים', () => {
    const a = buildEvents(world()).map((e: { id: string }) => e.id);
    const b = buildEvents(world()).map((e: { id: string }) => e.id);
    expect(a).toEqual(b);
  });

  it('סינון לפי חדר, לפי משתמש ולפי טקסט', () => {
    const events = buildEvents(world());
    expect(filterEvents(events, { room: 'AAA111' }).every((e: { roomCode: string }) => e.roomCode === 'AAA111')).toBe(true);
    expect(filterEvents(events, { user: 'u1' }).every((e: { actorId: string }) => e.actorId === 'u1')).toBe(true);
    expect(filterEvents(events, { search: 'לחם' }).length).toBeGreaterThan(0);
  });

  it('ציר הזמן של משתמש מקובץ לפי ימים ומכיל רק את הפעולות שלו', () => {
    const events = buildEvents(world());
    const groups = userTimeline(events, 'u1');
    for (const group of groups) {
      for (const event of group.events) expect(event.actorId).toBe('u1');
    }
  });
});

/* ═══════════════════ בריאות חדרים ═══════════════════ */

describe('assessRoom', () => {
  it('חדר תקין מקבל ציון גבוה ובלי בעיות', () => {
    const w = world();
    const health = assessRoom(w.rooms.get('AAA111'), w);
    expect(health.level).toBe('healthy');
    expect(health.issues).toHaveLength(0);
    expect(health.score).toBe(100);
  });

  it('חדר נטוש מזוהה כקריטי, עם סיבה לכל ניקוד שנגרע', () => {
    const w = world();
    const health = assessRoom(w.rooms.get('BBB222'), w);
    expect(health.level).toBe('critical');
    const codes = health.issues.map((i: { code: string }) => i.code);
    expect(codes).toContain('room_idle');
    expect(codes).toContain('items_stuck');
    expect(codes).toContain('balance_extreme');
    // ‼️ הכלל שלא נשבר: ציון נמוך תמיד מלווה ברשימת בעיות שאפשר לפעול לפיה
    expect(health.issues.length).toBeGreaterThan(0);
  });

  it('ספים מותאמים משנים את התוצאה', () => {
    const w = world();
    const lenient = assessRoom(w.rooms.get('BBB222'), w, {
      ...HEALTH_THRESHOLDS,
      idleCriticalDays: 999,
      idleWarnDays: 998,
      openItemCriticalDays: 999,
      openItemWarnDays: 998,
      spreadCriticalAgorot: 10_000_000,
      spreadWarnAgorot: 9_000_000,
    });
    expect(lenient.issues).toHaveLength(0);
  });
});

/* ═══════════════════ תובנות ═══════════════════ */

describe('insights', () => {
  it('מסווג משתמש שלא נכנס 120 יום כרדום', () => {
    const w = world();
    const events = buildEvents(w);
    const profile = analyzeUser(w.users.get('u3'), events, w, 30);
    expect(profile.segments).toContain('dormant');
    expect(profile.daysSinceActive).toBeGreaterThan(90);
  });

  it('מסמן כפעיל מי שנכנס בשבוע האחרון', () => {
    const w = world();
    const profile = analyzeUser(w.users.get('u1'), buildEvents(w), w, 30);
    expect(profile.segments).toContain('active');
  });

  it('סיכום כללי סופר משתמשים, פלחים ושימוש בפיצ׳רים', () => {
    const w = world();
    const analytics = analyzeAll(w, buildEvents(w), 30);
    expect(analytics.totals.users).toBe(3);
    expect(analytics.totals.rooms).toBe(2);
    expect(analytics.bySegment.dormant).toContain('u3');
    expect(analytics.daily).toHaveLength(30);
  });
});

/* ═══════════════════ משוב ═══════════════════ */

describe('feedback', () => {
  it('ממזג את מצב הטיפול בלי לגעת בעדות המשתמש', () => {
    const items = buildFeedbackList(world());
    const resolved = items.find((i: { id: string }) => i.id === 'f2');
    const fresh = items.find((i: { id: string }) => i.id === 'f1');
    expect(resolved.status).toBe('resolved');
    expect(fresh.status).toBe('new');
    // תקלה נכנסת אוטומטית בעדיפות גבוהה
    expect(fresh.priority).toBe('high');
    expect(fresh.body).toBe('לא עובד');
  });

  it('הסינון "פתוחים" לא מחזיר משוב שטופל', () => {
    const items = buildFeedbackList(world());
    const open = filterFeedback(items, { status: 'open' });
    expect(open.map((i: { id: string }) => i.id)).toEqual(['f1']);
  });
});

/* ═══════════════════ התראות ═══════════════════ */

describe('alerts', () => {
  it('מייצר התראה קריטית לחדר נטוש ומידעית למשוב חדש', () => {
    const w = world();
    const config = mergeConfig(null);
    const alerts = buildAlerts(w, buildEvents(w), buildFeedbackList(w), config);
    expect(alerts.some((a: { severity: string; roomCode: string }) => a.severity === 'critical' && a.roomCode === 'BBB222')).toBe(true);
    expect(alerts.some((a: { category: string }) => a.category === 'feedback')).toBe(true);
  });

  it('טריגר שכובה אינו מייצר התראות', () => {
    const w = world();
    const config = mergeConfig({ triggers: { abandoned_rooms: { enabled: false } } });
    const alerts = buildAlerts(w, buildEvents(w), buildFeedbackList(w), config);
    expect(alerts.some((a: { trigger: string }) => a.trigger === 'abandoned_rooms')).toBe(false);
  });

  it('שעות שקט מזוהות גם כשהחלון חוצה חצות', () => {
    const config = mergeConfig({ quietHours: { enabled: true, from: '22:00', to: '07:00' } });
    expect(inQuietHours(config, new Date('2024-01-01T23:30:00'))).toBe(true);
    expect(inQuietHours(config, new Date('2024-01-01T03:00:00'))).toBe(true);
    expect(inQuietHours(config, new Date('2024-01-01T12:00:00'))).toBe(false);
  });
});

/* ═══════════════════ הודעות ═══════════════════ */

describe('messaging', () => {
  it('פותר קהל יעד לרשימת משתמשים קונקרטית', () => {
    const w = world();
    expect(resolveAudience({ type: 'all' }, w).uids.sort()).toEqual(['u1', 'u2', 'u3']);
    expect(resolveAudience({ type: 'room', roomCode: 'AAA111' }, w).uids.sort()).toEqual(['u1', 'u2']);
    expect(resolveAudience({ type: 'admins' }, w).uids.sort()).toEqual(['u1', 'u3']);
    expect(resolveAudience({ type: 'inactive' }, w).uids).toEqual(['u3']);
  });

  it('מחשב אחוזי מסירה וקריאה', () => {
    const w = world();
    const message = { id: 'm1', ...fixture().adminConsole.messages.m1 };
    const tracking = trackingFor(message, w, fixture());
    expect(tracking.stats.sent).toBe(2);
    expect(tracking.stats.read).toBe(1);
    expect(tracking.stats.readPercent).toBe(50);
  });

  it('קבלת קריאה מתיבת המשתמש גוברת על הרשומה השמורה', () => {
    const w = world();
    const snapshot = { ...fixture(), adminMessages: { u2: { m1: { readAt: NOW } } } };
    const message = { id: 'm1', ...fixture().adminConsole.messages.m1 };
    expect(trackingFor(message, w, snapshot).stats.read).toBe(2);
  });
});

/* ═══════════════════ דוחות ═══════════════════ */

describe('reports', () => {
  it('דוח בריאות מכיל שורה לכל חדר', () => {
    const w = world();
    const report = generateReport('health', {
      world: w,
      events: buildEvents(w),
      analytics: analyzeAll(w, buildEvents(w), 30),
      feedbackItems: buildFeedbackList(w),
      range: { days: 30 },
    });
    expect(report.tables[0].rows).toHaveLength(2);
    expect(report.cards.find((c: { label: string }) => c.label === 'קריטיים').value).toBe(1);
  });

  it('ייצוא CSV מתחיל ב-BOM ומכיל את כותרות הטבלה', () => {
    const w = world();
    const report = generateReport('health', {
      world: w,
      events: buildEvents(w),
      analytics: analyzeAll(w, buildEvents(w), 30),
      feedbackItems: buildFeedbackList(w),
      range: { days: 30 },
    });
    const csv = reportToCsv(report);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('חדר,ציון');
  });
});
