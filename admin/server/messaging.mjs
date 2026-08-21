/**
 * ═══════════════════════════════════════════════════════════════
 *  מערכת ההודעות
 * ═══════════════════════════════════════════════════════════════
 *  חוזה הנתונים מול אפליקציית המשתמשים (ראו docs/13-admin-console.md):
 *
 *   adminConsole/messages/{id}            — ההודעה כפי שנשלחה + מעקב
 *   adminMessages/{uid}/{id}              — התיבה של המשתמש: הוא קורא
 *                                            אותה, וכותב לעצמו readAt
 *   adminConsole/dm/{uid}/{msgId}         — שיחה אישית מולי
 *
 *  ‼️ קבלות קריאה נקראות מ-adminMessages ולא נכתבות על ידי — הקונסולה
 *     לעולם לא מסמנת "נקרא" בשם משתמש. אחרת המעקב היה מודד את עצמו.
 * ═══════════════════════════════════════════════════════════════
 */

export const MESSAGE_KINDS = {
  info: { label: 'מידע', tone: 'info', icon: 'ℹ️' },
  success: { label: 'הצלחה', tone: 'success', icon: '✅' },
  warning: { label: 'אזהרה', tone: 'warn', icon: '⚠️' },
  error: { label: 'תקלה', tone: 'danger', icon: '🛑' },
  maintenance: { label: 'תחזוקה', tone: 'warn', icon: '🛠️' },
};

export const AUDIENCE_TYPES = {
  all: 'כל המשתמשים',
  room: 'חדר מסוים',
  users: 'משתמשים נבחרים',
  active: 'פעילים בלבד (7 ימים)',
  inactive: 'לא פעילים (מעל 30 יום)',
  admins: 'מנהלי חדרים',
  segment: 'פלח מותאם',
};

const DAY = 86_400_000;

/**
 * הופך הגדרת קהל לרשימת uid קונקרטית.
 * מוחזרת גם הסיבה לכל בחירה — כדי שהמסך יוכל להסביר "למה 42 אנשים".
 */
export function resolveAudience(audience, world, analytics) {
  const type = audience?.type ?? 'all';
  const all = world.userList;

  switch (type) {
    case 'room': {
      const room = world.rooms.get(audience.roomCode);
      if (!room) return { uids: [], description: `חדר ${audience.roomCode} לא נמצא` };
      return {
        uids: room.activeMembers.map((m) => m.uid),
        description: `חברי ${room.name} (${room.code})`,
      };
    }
    case 'users':
      return {
        uids: (audience.uids ?? []).filter((uid) => world.users.has(uid)),
        description: `${(audience.uids ?? []).length} משתמשים נבחרים`,
      };
    case 'active':
      return {
        uids: all.filter((u) => world.now - (u.lastActiveAt ?? 0) <= 7 * DAY).map((u) => u.uid),
        description: 'משתמשים שנכנסו בשבוע האחרון',
      };
    case 'inactive':
      return {
        uids: all.filter((u) => world.now - (u.lastActiveAt ?? 0) > 30 * DAY).map((u) => u.uid),
        description: 'משתמשים שלא נכנסו מעל חודש',
      };
    case 'admins':
      return {
        uids: all
          .filter((u) => u.memberships.some((m) => m.role === 'admin' && m.status === 'active'))
          .map((u) => u.uid),
        description: 'מנהלי חדרים',
      };
    case 'segment': {
      const uids = analytics?.bySegment?.[audience.segment] ?? [];
      return { uids: [...uids], description: `פלח: ${audience.segment}` };
    }
    default:
      return { uids: all.map((u) => u.uid), description: 'כל המשתמשים' };
  }
}

/** מיזוג קבלות הקריאה מתיבות המשתמשים לתוך רשומת המעקב. */
export function trackingFor(message, world, snapshot) {
  const inbox = snapshot.adminMessages ?? {};
  const recipients = Object.entries(message.recipients ?? {}).map(([uid, r]) => {
    const live = inbox[uid]?.[message.id];
    const readAt = live?.readAt ?? r.readAt ?? null;
    const clickedAt = live?.clickedAt ?? r.clickedAt ?? null;
    return {
      uid,
      name: world.nameOf(uid),
      deliveredAt: r.deliveredAt ?? null,
      readAt,
      clickedAt,
      failed: Boolean(r.failed),
      timeToReadMs: readAt && message.sendAt ? readAt - message.sendAt : null,
    };
  });

  const sent = recipients.length;
  const delivered = recipients.filter((r) => r.deliveredAt).length;
  const read = recipients.filter((r) => r.readAt).length;
  const clicked = recipients.filter((r) => r.clickedAt).length;
  const failed = recipients.filter((r) => r.failed).length;
  const times = recipients.map((r) => r.timeToReadMs).filter((t) => typeof t === 'number' && t > 0);

  /* פילוח לפי חדר — "מי בחדר קרא" הוא השאלה שהכי שימושי לענות עליה */
  const byRoom = [];
  for (const room of world.roomList) {
    const inRoom = recipients.filter((r) => room.memberIds.includes(r.uid));
    if (!inRoom.length) continue;
    byRoom.push({
      code: room.code,
      name: room.name,
      total: inRoom.length,
      read: inRoom.filter((r) => r.readAt).length,
    });
  }

  return {
    recipients,
    stats: {
      sent,
      delivered,
      read,
      clicked,
      failed,
      pending: sent - delivered,
      deliveredPercent: sent ? Math.round((delivered / sent) * 100) : 0,
      readPercent: sent ? Math.round((read / sent) * 100) : 0,
      clickPercent: sent ? Math.round((clicked / sent) * 100) : 0,
      engagementPercent: sent
        ? Math.round((recipients.filter((r) => r.readAt || r.clickedAt).length / sent) * 100)
        : 0,
      avgTimeToReadMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      fastestMs: times.length ? Math.min(...times) : 0,
      slowestMs: times.length ? Math.max(...times) : 0,
    },
    byRoom,
  };
}

export function listMessages(world) {
  return Object.entries(world.console?.messages ?? {})
    .map(([id, m]) => {
      const recipients = Object.values(m.recipients ?? {});
      return {
        id,
        ...m,
        recipientCount: recipients.length,
        readCount: recipients.filter((r) => r.readAt).length,
      };
    })
    .sort((a, b) => (b.sendAt ?? b.createdAt ?? 0) - (a.sendAt ?? a.createdAt ?? 0));
}

/** שיחות אישיות — רשימת שרשורים עם תצוגה מקדימה. */
export function listThreads(world) {
  const dm = world.console?.dm ?? {};
  return Object.entries(dm)
    .map(([uid, messages]) => {
      const list = Object.entries(messages).map(([id, m]) => ({ id, ...m }));
      list.sort((a, b) => a.sentAt - b.sentAt);
      const last = list[list.length - 1];
      const user = world.users.get(uid);
      return {
        uid,
        name: world.nameOf(uid),
        lastActiveAt: user?.lastActiveAt ?? 0,
        online: user ? world.now - (user.lastActiveAt ?? 0) < 5 * 60_000 : false,
        messages: list,
        lastMessage: last ?? null,
        unread: list.filter((m) => m.from === 'user' && !m.adminReadAt).length,
      };
    })
    .sort((a, b) => (b.lastMessage?.sentAt ?? 0) - (a.lastMessage?.sentAt ?? 0));
}

/** הודעות מתוזמנות שהגיע זמנן. מופעל מהלולאה ב-index.mjs. */
export function dueMessages(world) {
  return Object.entries(world.console?.messages ?? {})
    .filter(([, m]) => m.status === 'scheduled' && (m.sendAt ?? 0) <= world.now)
    .map(([id, m]) => ({ id, ...m }));
}

/** חישוב מועד השליחה הבא של הודעה חוזרת. */
export function nextOccurrence(sendAt, recurrence) {
  const d = new Date(sendAt);
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return d.getTime();
}
