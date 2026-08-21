/**
 * ═══════════════════════════════════════════════════════════════
 *  מנוע הפעילות
 * ═══════════════════════════════════════════════════════════════
 *  RTDB לא מחזיק "יומן אירועים" — הוא מחזיק מצב. הפיד החי נגזר
 *  מהמצב: לכל רשומה יש חותמת זמן, וממנה מיוצר אירוע.
 *
 *  היתרון על יומן ייעודי: אי אפשר לאבד אירוע ואי אפשר לזייף אחד.
 *  מה שרואים בפיד הוא בדיוק מה שקיים בבסיס הנתונים, תמיד.
 *
 *  מזהה האירוע דטרמיניסטי (type:room:entity) — כך "אירוע חדש"
 *  מזוהה בוודאות גם אחרי הפעלה מחדש של השרת, בלי מונה מתמשך.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;

/** קטגוריות הפיד — משמשות גם ככפתורי סינון ב-UI. */
export const EVENT_CATEGORIES = {
  item: { label: 'מוצרים', icon: '📦' },
  purchase: { label: 'קניות', icon: '🛒' },
  member: { label: 'חברים', icon: '👥' },
  balance: { label: 'כספים', icon: '💰' },
  task: { label: 'מטלות', icon: '🧹' },
  chat: { label: 'שיחות', icon: '💬' },
  feedback: { label: 'משוב', icon: '📝' },
  message: { label: 'הודעות מנהל', icon: '📢' },
  session: { label: 'התחברויות', icon: '🔑' },
};

function ev(base) {
  return {
    severity: 'info',
    status: null,
    entityId: null,
    actorId: null,
    roomCode: null,
    ...base,
  };
}

/**
 * בונה את כל אירועי המערכת מתוך מודל העולם.
 * מוחזר ממוין מהחדש לישן.
 */
export function buildEvents(world) {
  const out = [];
  const { now } = world;

  for (const room of world.roomList) {
    const rn = room.name;

    for (const item of room.items) {
      out.push(
        ev({
          id: `item:${room.code}:${item.id}`,
          ts: item.reportedAt ?? 0,
          category: 'item',
          type: 'item_reported',
          roomCode: room.code,
          roomName: rn,
          actorId: item.reportedBy,
          actorName: world.nameOf(item.reportedBy),
          text: `דיווח על "${item.name}"`,
          detail: item.priority === 'high' ? 'עדיפות גבוהה' : null,
          status: item.status,
          entityId: item.id,
          severity:
            item.status === 'needed' && now - (item.reportedAt ?? now) > 14 * DAY ? 'warn' : 'info',
        })
      );
    }

    for (const p of room.purchases) {
      out.push(
        ev({
          id: `purchase:${room.code}:${p.id}`,
          ts: p.createdAt ?? p.date ?? 0,
          category: 'purchase',
          type: 'purchase_made',
          roomCode: room.code,
          roomName: rn,
          actorId: p.boughtBy,
          actorName: world.nameOf(p.boughtBy),
          text: `קנה "${p.title}"`,
          amount: p.amount,
          detail: p.splitMethod === 'covered' ? 'לקח על עצמו' : null,
          status: p.status,
          entityId: p.id,
          severity: p.status === 'pending' ? 'warn' : 'info',
        })
      );

      if ((p.status === 'approved' || p.status === 'settled') && p.approvedBy) {
        out.push(
          ev({
            id: `approval:${room.code}:${p.id}`,
            // אין חותמת אישור נפרדת במודל — האישור מוצג ברזולוציית הקנייה
            ts: (p.createdAt ?? p.date ?? 0) + 1,
            category: 'balance',
            type: 'purchase_approved',
            roomCode: room.code,
            roomName: rn,
            actorId: p.approvedBy,
            actorName: world.nameOf(p.approvedBy),
            text: `אישר את הקנייה "${p.title}" — המאזנים עודכנו`,
            amount: p.amount,
            status: 'approved',
            entityId: p.id,
          })
        );
      }
    }

    for (const m of room.members) {
      out.push(
        ev({
          id: `member:${room.code}:${m.uid}`,
          ts: m.joinedAt ?? 0,
          category: 'member',
          type: m.status === 'removed' ? 'member_removed' : 'member_joined',
          roomCode: room.code,
          roomName: rn,
          actorId: m.uid,
          actorName: m.name ?? world.nameOf(m.uid),
          text: m.status === 'removed' ? `הוסר מהחדר` : `הצטרף לחדר`,
          detail: m.uid === room.adminId ? 'מנהל החדר' : null,
          status: m.status,
          entityId: m.uid,
        })
      );
    }

    for (const req of room.pendingRequests) {
      out.push(
        ev({
          id: `join:${room.code}:${req.userId}`,
          ts: req.requestedAt ?? 0,
          category: 'member',
          type: 'join_requested',
          roomCode: room.code,
          roomName: rn,
          actorId: req.userId,
          actorName: req.displayName ?? world.nameOf(req.userId),
          text: `ביקש להצטרף לחדר`,
          detail: 'ממתין לאישור מנהל החדר',
          status: 'pending',
          entityId: req.userId,
          severity: now - (req.requestedAt ?? now) > 2 * DAY ? 'warn' : 'info',
        })
      );
    }

    for (const s of room.settlements) {
      out.push(
        ev({
          id: `settlement:${room.code}:${s.id}`,
          ts: s.date ?? 0,
          category: 'balance',
          type: 'settlement',
          roomCode: room.code,
          roomName: rn,
          actorId: s.from,
          actorName: world.nameOf(s.from),
          text: `העביר ל${world.nameOf(s.to)} סגירת חשבון`,
          amount: s.amount,
          status: s.confirmedBy ? 'confirmed' : 'pending',
          entityId: s.id,
          severity: s.confirmedBy ? 'info' : 'warn',
        })
      );
    }

    for (const t of room.taskCompletions) {
      out.push(
        ev({
          id: `task:${room.code}:${t.id}`,
          ts: t.completedAt ?? 0,
          category: 'task',
          type: 'task_completed',
          roomCode: room.code,
          roomName: rn,
          actorId: t.completedBy,
          actorName: world.nameOf(t.completedBy),
          text: `סיים את המטלה "${t.taskName}"`,
          entityId: t.taskId,
        })
      );
    }

    for (const a of room.announcements) {
      out.push(
        ev({
          id: `announce:${room.code}:${a.id}`,
          ts: a.sentAt ?? 0,
          category: 'message',
          type: 'room_announcement',
          roomCode: room.code,
          roomName: rn,
          actorId: a.senderId,
          actorName: world.nameOf(a.senderId),
          text: `שידר לחדר: ${a.text}`,
          entityId: a.id,
        })
      );
    }

    for (const c of room.chat) {
      out.push(
        ev({
          id: `chat:${room.code}:${c.id}`,
          ts: c.sentAt ?? 0,
          category: 'chat',
          type: 'chat_message',
          roomCode: room.code,
          roomName: rn,
          actorId: c.senderId,
          actorName: world.nameOf(c.senderId),
          text: 'כתב הודעה בצ׳אט החדר',
          /**
           * ‼️ תוכן ההודעה מסומן כרגיש ומוסתר בממשק עד לחיצה מפורשת.
           *    לניטור מספיק לדעת *שדובר*; לקרוא שיחה פרטית של שותפים
           *    זו החלטה נפרדת, ולכן היא דורשת פעולה נפרדת.
           */
          sensitive: c.text,
          entityId: c.id,
        })
      );
    }
  }

  /* ── משוב שהגיע מהחדרים ── */
  for (const [id, fb] of Object.entries(world.feedback ?? {})) {
    out.push(
      ev({
        id: `feedback:${id}`,
        ts: fb.createdAt ?? 0,
        category: 'feedback',
        type: `feedback_${fb.type ?? 'other'}`,
        roomCode: fb.roomCode ?? null,
        roomName: fb.roomCode ? world.roomNameOf(fb.roomCode) : null,
        actorId: fb.userId,
        actorName: world.nameOf(fb.userId),
        text: `שלח משוב: "${fb.subject}"`,
        entityId: id,
        severity: fb.type === 'bug' ? 'warn' : 'info',
      })
    );
  }

  /* ── הודעות שיצאו מהקונסולה ── */
  for (const [id, msg] of Object.entries(world.console?.messages ?? {})) {
    if (msg.status !== 'sent') continue;
    const recipients = Object.keys(msg.recipients ?? {}).length;
    out.push(
      ev({
        id: `message:${id}`,
        ts: msg.sendAt ?? msg.createdAt ?? 0,
        category: 'message',
        type: 'broadcast_sent',
        actorId: 'admin',
        actorName: 'מנהל המערכת',
        text: `שידור יצא: "${msg.title}"`,
        detail: `${recipients} נמענים`,
        entityId: id,
      })
    );
  }

  /* ── התחברויות (lastActiveAt) ── */
  for (const u of world.userList) {
    if (!u.lastActiveAt) continue;
    out.push(
      ev({
        id: `session:${u.uid}:${u.lastActiveAt}`,
        ts: u.lastActiveAt,
        category: 'session',
        type: 'user_active',
        actorId: u.uid,
        actorName: u.displayName,
        text: 'היה פעיל באפליקציה',
        entityId: u.uid,
      })
    );
  }

  out.sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id));
  return out;
}

/** סינון הפיד — משותף ל-API ול-SSE. */
export function filterEvents(events, query = {}) {
  const { room, user, category, type, search, since, until } = query;
  const needle = search ? String(search).toLowerCase() : null;

  return events.filter((e) => {
    if (room && e.roomCode !== room) return false;
    if (user && e.actorId !== user) return false;
    if (category && category !== 'all' && e.category !== category) return false;
    if (type && e.type !== type) return false;
    if (since && e.ts < Number(since)) return false;
    if (until && e.ts > Number(until)) return false;
    if (needle) {
      const hay = `${e.text} ${e.actorName ?? ''} ${e.roomName ?? ''} ${e.detail ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/** ציר הזמן של משתמש יחיד, מקובץ לפי ימים. */
export function userTimeline(events, uid, { limit = 200 } = {}) {
  const mine = events.filter((e) => e.actorId === uid).slice(0, limit);
  const groups = new Map();
  for (const e of mine) {
    const key = new Date(e.ts).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, events: items }));
}

/** יומן החדר, מקובץ לפי ימים. */
export function roomLog(events, code, { limit = 250, category } = {}) {
  const mine = events
    .filter((e) => e.roomCode === code && (!category || category === 'all' || e.category === category))
    .slice(0, limit);
  const groups = new Map();
  for (const e of mine) {
    const key = new Date(e.ts).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, events: items }));
}
