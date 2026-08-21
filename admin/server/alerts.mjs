import { assessAllRooms } from './roomHealth.mjs';
import { agorot } from './money.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מרכז ההתראות
 * ═══════════════════════════════════════════════════════════════
 *  התראה = בעיה שקיימת *עכשיו* בנתונים. היא נגזרת מחדש בכל רענון,
 *  ולכן היא נעלמת מעצמה כשהבעיה נפתרת — בלי "לסמן כטופל" ידני.
 *
 *  מה כן נשמר (adminConsole/alertState): מתי ראיתי אותה לראשונה, ואם
 *  ביטלתי אותה. כך "חדש מאז שיצאתי" הוא מידע אמין, וביטול לא נמחק
 *  ברענון הבא.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const DEFAULT_ALERT_CONFIG = {
  triggers: {
    abandoned_rooms: { enabled: true, severity: 'critical', label: 'חדרים נטושים (מעל 30 יום)' },
    large_imbalance: { enabled: true, severity: 'critical', label: 'פערי מאזן גדולים (מעל ₪2,000)' },
    no_admin: { enabled: true, severity: 'critical', label: 'חדר בלי מנהל פעיל' },
    stale_items: { enabled: true, severity: 'warn', label: 'מוצרים פתוחים מעל 7 ימים' },
    pending_purchases: { enabled: true, severity: 'warn', label: 'קניות שממתינות לאישור' },
    pending_members: { enabled: true, severity: 'warn', label: 'בקשות הצטרפות מעל 48 שעות' },
    balance_gap: { enabled: true, severity: 'warn', label: 'פער מאזנים מעל ₪500' },
    low_health: { enabled: true, severity: 'warn', label: 'ציון בריאות חדר מתחת ל-50' },
    unusual_activity: { enabled: true, severity: 'warn', label: 'פעילות חריגה (התפרצות פעולות)' },
    new_feedback: { enabled: true, severity: 'info', label: 'משוב חדש מהחדרים' },
    urgent_feedback: { enabled: true, severity: 'critical', label: 'משוב בעדיפות דחופה/קריטית' },
    new_users: { enabled: true, severity: 'info', label: 'משתמשים חדשים נרשמו' },
    dormant_users: { enabled: true, severity: 'info', label: 'משתמשים רדומים (מעל 90 יום)' },
    data_integrity: { enabled: true, severity: 'critical', label: 'בעיות שלמות נתונים' },
  },
  delivery: {
    desktop: true,
    sound: false,
    email: false,
    emailAddress: '',
    badge: true,
  },
  quietHours: { enabled: true, from: '22:00', to: '07:00', criticalOnly: true },
  thresholds: {
    unusualActionsPerHour: 40,
    dormantDays: 90,
  },
};

export function mergeConfig(stored) {
  if (!stored) return structuredClone(DEFAULT_ALERT_CONFIG);
  const merged = structuredClone(DEFAULT_ALERT_CONFIG);
  for (const [key, val] of Object.entries(stored.triggers ?? {})) {
    if (merged.triggers[key]) merged.triggers[key] = { ...merged.triggers[key], ...val };
  }
  merged.delivery = { ...merged.delivery, ...(stored.delivery ?? {}) };
  merged.quietHours = { ...merged.quietHours, ...(stored.quietHours ?? {}) };
  merged.thresholds = { ...merged.thresholds, ...(stored.thresholds ?? {}) };
  return merged;
}

function alert(list, config, trigger, base) {
  const t = config.triggers[trigger];
  if (!t?.enabled) return;
  list.push({ trigger, severity: t.severity, ...base });
}

export function buildAlerts(world, events, feedbackItems, config) {
  const out = [];
  const health = assessAllRooms(world);

  /* ── חדרים ── */
  for (const room of health) {
    for (const issue of room.issues) {
      const map = {
        room_idle: 'abandoned_rooms',
        room_quiet: 'low_health',
        items_stuck: 'stale_items',
        items_aging: 'stale_items',
        balance_extreme: 'large_imbalance',
        balance_gap: 'balance_gap',
        purchases_pending: 'pending_purchases',
        join_pending: 'pending_members',
        members_inactive: 'low_health',
        no_admin: 'no_admin',
      };
      alert(out, config, map[issue.code] ?? 'low_health', {
        id: `room:${room.code}:${issue.code}`,
        category: 'room',
        title: `${room.name} — ${issue.title}`,
        detail: issue.detail,
        roomCode: room.code,
        severity: issue.severity === 'critical' ? 'critical' : 'warn',
        action: issue.action,
      });
    }
    if (room.score < 50) {
      alert(out, config, 'low_health', {
        id: `room:${room.code}:score`,
        category: 'room',
        title: `${room.name} — ציון בריאות ${room.score}`,
        detail: `${room.issues.length} בעיות פתוחות בחדר.`,
        roomCode: room.code,
      });
    }
  }

  /* ── משוב ── */
  for (const fb of feedbackItems) {
    if (fb.status === 'new') {
      alert(out, config, 'new_feedback', {
        id: `feedback:new:${fb.id}`,
        category: 'feedback',
        title: `משוב חדש: ${fb.subject}`,
        detail: `${fb.userName} · ${fb.roomName ?? 'ללא חדר'} · ${fb.typeLabel}`,
        entityId: fb.id,
        roomCode: fb.roomCode,
      });
    }
    if (['urgent', 'critical'].includes(fb.priority) && fb.status !== 'resolved' && fb.status !== 'closed') {
      alert(out, config, 'urgent_feedback', {
        id: `feedback:urgent:${fb.id}`,
        category: 'feedback',
        title: `משוב דחוף: ${fb.subject}`,
        detail: `${fb.userName} · ${fb.roomName ?? '—'}`,
        entityId: fb.id,
        roomCode: fb.roomCode,
      });
    }
  }

  /* ── פעילות חריגה ── */
  const perUserHour = new Map();
  for (const e of events) {
    if (world.now - e.ts > HOUR || e.category === 'session') continue;
    perUserHour.set(e.actorId, (perUserHour.get(e.actorId) ?? 0) + 1);
  }
  for (const [uid, count] of perUserHour) {
    if (count >= config.thresholds.unusualActionsPerHour) {
      alert(out, config, 'unusual_activity', {
        id: `user:${uid}:burst`,
        category: 'user',
        title: `פעילות חריגה: ${world.nameOf(uid)}`,
        detail: `${count} פעולות בשעה האחרונה.`,
        userId: uid,
      });
    }
  }

  /* ── משתמשים ── */
  const newUsers = world.userList.filter((u) => world.now - (u.createdAt ?? 0) < DAY);
  if (newUsers.length) {
    alert(out, config, 'new_users', {
      id: `users:new:${new Date(world.now).toISOString().slice(0, 10)}`,
      category: 'user',
      title: `${newUsers.length} משתמשים חדשים היום`,
      detail: newUsers.map((u) => u.displayName).join(', '),
    });
  }

  const dormant = world.userList.filter(
    (u) => world.now - (u.lastActiveAt ?? 0) > config.thresholds.dormantDays * DAY
  );
  if (dormant.length) {
    alert(out, config, 'dormant_users', {
      id: `users:dormant:${dormant.length}`,
      category: 'user',
      title: `${dormant.length} משתמשים רדומים`,
      detail: `לא נכנסו מעל ${config.thresholds.dormantDays} יום.`,
    });
  }

  /* ── שלמות נתונים ──
     בדיקות שאמורות תמיד לעבור. אם אחת נכשלת, משהו בקוד או בכללים
     שבור — ולכן אלו קריטיות ולא אזהרות. */
  for (const room of world.roomList) {
    const orphanShares = room.purchases.filter((p) =>
      Object.keys(p.shares ?? {}).some((uid) => !room.members.some((m) => m.uid === uid))
    );
    if (orphanShares.length) {
      alert(out, config, 'data_integrity', {
        id: `data:${room.code}:orphan_shares`,
        category: 'system',
        title: `${room.name} — חלוקות לחברים שאינם בחדר`,
        detail: `${orphanShares.length} קניות מחלקות חוב למי שאינו חבר. המאזן שם לא ניתן לסגירה.`,
        roomCode: room.code,
      });
    }
    const brokenSplit = room.purchases.filter((p) => {
      const sum = Object.values(p.shares ?? {}).reduce((a, b) => a + b, 0);
      return p.status !== 'rejected' && sum !== p.amount;
    });
    if (brokenSplit.length) {
      alert(out, config, 'data_integrity', {
        id: `data:${room.code}:split_mismatch`,
        category: 'system',
        title: `${room.name} — חלוקה שאינה מסתכמת לסכום`,
        detail: `${brokenSplit.length} קניות שבהן סכום החלקים ≠ הסכום. פער כולל ${agorot.format(
          brokenSplit.reduce(
            (a, p) => a + Math.abs(p.amount - Object.values(p.shares ?? {}).reduce((x, y) => x + y, 0)),
            0
          )
        )}.`,
        roomCode: room.code,
      });
    }
  }

  const usersWithoutRooms = world.userList.filter((u) => u.memberships.length === 0);
  if (usersWithoutRooms.length) {
    alert(out, config, 'new_users', {
      id: `users:roomless:${usersWithoutRooms.length}`,
      category: 'user',
      title: `${usersWithoutRooms.length} משתמשים בלי חדר`,
      detail: 'נרשמו ולא הצטרפו לשום חדר — נקודת נטישה קלאסית.',
    });
  }

  return out;
}

/** מיזוג המצב השמור (נראה לראשונה / בוטל) על ההתראות שנגזרו עכשיו. */
export function decorateAlerts(alerts, state, now) {
  return alerts
    .map((a) => {
      const st = state?.[a.id] ?? {};
      return {
        ...a,
        firstSeenAt: st.firstSeenAt ?? now,
        dismissed: Boolean(st.dismissedAt),
        dismissedAt: st.dismissedAt ?? null,
        acknowledged: Boolean(st.ackAt),
        isNew: !st.firstSeenAt || now - st.firstSeenAt < 6 * HOUR,
      };
    })
    .sort((a, b) => {
      const rank = { critical: 0, warn: 1, info: 2 };
      return rank[a.severity] - rank[b.severity] || b.firstSeenAt - a.firstSeenAt;
    });
}

/** האם כרגע שעות שקט (ולכן רק קריטי מותר לצוץ על המסך). */
export function inQuietHours(config, date = new Date()) {
  if (!config.quietHours?.enabled) return false;
  const [fromH, fromM] = config.quietHours.from.split(':').map(Number);
  const [toH, toM] = config.quietHours.to.split(':').map(Number);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const from = fromH * 60 + fromM;
  const to = toH * 60 + toM;
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}
