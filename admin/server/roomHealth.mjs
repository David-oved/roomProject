import { agorot } from './money.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  בריאות חדרים
 * ═══════════════════════════════════════════════════════════════
 *  ציון 0–100 שנגזר מרשימת בעיות מפורשת — ולא ההפך. כל ניכוד ניקוד
 *  מגיע עם בעיה שאפשר להצביע עליה ולפעול לפיה, כי ציון בלי סיבה
 *  הוא מספר שאי אפשר לעשות איתו כלום.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;

/** ספי ההתראה — נשלפים גם למסך ההגדרות, כדי שיהיה מקור אמת אחד. */
export const HEALTH_THRESHOLDS = {
  idleWarnDays: 14,
  idleCriticalDays: 30,
  openItemWarnDays: 7,
  openItemCriticalDays: 30,
  spreadWarnAgorot: 50_000,
  spreadCriticalAgorot: 200_000,
  joinRequestWarnHours: 48,
  pendingPurchaseWarnDays: 3,
  inactiveMemberDays: 30,
};

function issue(severity, code, title, detail, action) {
  return { severity, code, title, detail, action };
}

export function assessRoom(room, world, thresholds = HEALTH_THRESHOLDS) {
  const now = world.now;
  const issues = [];
  let score = 100;

  /* ── חוסר פעילות ── */
  const idleDays = room.idleDays ?? 0;
  if (idleDays >= thresholds.idleCriticalDays) {
    score -= 40;
    issues.push(
      issue(
        'critical',
        'room_idle',
        `אין פעילות ${idleDays} ימים`,
        'החדר ככל הנראה נטוש. שווה לפנות למנהל החדר לפני ארכוב.',
        'notify_admin'
      )
    );
  } else if (idleDays >= thresholds.idleWarnDays) {
    score -= 18;
    issues.push(
      issue('warn', 'room_quiet', `אין פעילות ${idleDays} ימים`, 'קצב הפעילות ירד משמעותית.', 'notify_room')
    );
  }

  /* ── מוצרים פתוחים ותקועים ── */
  const oldestDays = room.oldestOpenItemDays ?? 0;
  if (room.openItems.length > 0) {
    if (oldestDays >= thresholds.openItemCriticalDays) {
      score -= 25;
      issues.push(
        issue(
          'critical',
          'items_stuck',
          `${room.openItems.length} מוצרים פתוחים, הוותיק ${oldestDays} ימים`,
          `שווי משוער ${agorot.format(room.pendingItemsValue)} שאף אחד לא קונה.`,
          'notify_room'
        )
      );
    } else if (oldestDays >= thresholds.openItemWarnDays) {
      score -= 12;
      issues.push(
        issue(
          'warn',
          'items_aging',
          `מוצר פתוח ${oldestDays} ימים`,
          `${room.openItems.length} מוצרים ממתינים לקנייה.`,
          'notify_room'
        )
      );
    }
  }

  /* ── פערי מאזן ── */
  if (room.spread >= thresholds.spreadCriticalAgorot) {
    score -= 25;
    issues.push(
      issue(
        'critical',
        'balance_extreme',
        `פער מאזנים ${agorot.format(room.spread)}`,
        'פער בסדר גודל כזה כמעט תמיד מסתיים בוויכוח. שווה להציע סגירת חשבון.',
        'suggest_settle'
      )
    );
  } else if (room.spread >= thresholds.spreadWarnAgorot) {
    score -= 10;
    issues.push(
      issue('warn', 'balance_gap', `פער מאזנים ${agorot.format(room.spread)}`, 'החדר לא מאוזן.', 'suggest_settle')
    );
  }

  /* ── קניות שממתינות לאישור ── */
  const stalePending = room.pendingPurchases.filter(
    (p) => now - (p.createdAt ?? p.date ?? now) > thresholds.pendingPurchaseWarnDays * DAY
  );
  if (stalePending.length) {
    score -= Math.min(15, stalePending.length * 6);
    issues.push(
      issue(
        'warn',
        'purchases_pending',
        `${stalePending.length} קניות ממתינות לאישור`,
        'מנהל החדר לא מאשר. עד שיאשר, המאזנים שהחברים רואים שגויים.',
        'notify_admin'
      )
    );
  }

  /* ── בקשות הצטרפות תקועות ── */
  const staleRequests = room.pendingRequests.filter(
    (r) => now - (r.requestedAt ?? now) > thresholds.joinRequestWarnHours * 3_600_000
  );
  if (staleRequests.length) {
    score -= 10;
    issues.push(
      issue(
        'warn',
        'join_pending',
        `${staleRequests.length} בקשות הצטרפות ממתינות`,
        'מי שביקש להצטרף תקוע במסך המתנה.',
        'notify_admin'
      )
    );
  }

  /* ── חברים שנעלמו ── */
  const inactive = room.activeMembers.filter((m) => {
    const u = world.users.get(m.uid);
    return u && now - (u.lastActiveAt ?? 0) > thresholds.inactiveMemberDays * DAY;
  });
  if (room.activeMembers.length && inactive.length / room.activeMembers.length > 0.5) {
    score -= 10;
    issues.push(
      issue(
        'warn',
        'members_inactive',
        `${inactive.length} מתוך ${room.activeMembers.length} חברים לא נכנסו חודש`,
        'החדר מתרוקן מבפנים גם אם יש בו פעילות.',
        'notify_room'
      )
    );
  }

  /* ── חדר בלי מנהל תקף ── */
  if (!room.adminId || !room.members.some((m) => m.uid === room.adminId && m.status === 'active')) {
    score -= 20;
    issues.push(
      issue(
        'critical',
        'no_admin',
        'אין מנהל פעיל לחדר',
        'אף אחד לא יכול לאשר קניות או לצרף חברים. דורש התערבות ידנית.',
        'assign_admin'
      )
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? 'healthy' : score >= 50 ? 'risk' : 'critical';

  return {
    code: room.code,
    name: room.name,
    score,
    level,
    issues,
    adminId: room.adminId,
    adminName: world.nameOf(room.adminId),
    membersActive: room.activeMembers.length,
    membersTotal: room.members.length,
    membersInactive: inactive.length,
    pendingRequests: room.pendingRequests.length,
    openItems: room.openItems.length,
    oldestOpenItemDays: room.oldestOpenItemDays,
    pendingPurchases: room.pendingPurchases.length,
    spread: room.spread,
    totalSpent: room.totalSpent,
    lastActivityAt: room.lastActivityAt,
    idleDays: room.idleDays,
    createdAt: room.createdAt,
  };
}

export function assessAllRooms(world, thresholds) {
  return world.roomList
    .map((room) => assessRoom(room, world, thresholds))
    .sort((a, b) => a.score - b.score);
}
