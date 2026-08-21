import { pushId } from './db.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  ניהול משוב
 * ═══════════════════════════════════════════════════════════════
 *  שני צמתים, בכוונה:
 *   feedback/{id}                     — מה שהמשתמש שלח. לא נוגעים בו.
 *   adminConsole/feedbackState/{id}   — מה שאני עשיתי עם זה.
 *
 *  ‼️ ההפרדה קריטית: המשוב הוא עדות של המשתמש. אם הייתי מעדכן סטטוס
 *     בתוך אותה רשומה, כל שינוי שלי היה נראה כאילו הוא כתב אותו —
 *     וגם היה מחייב לתת ללקוח הרשאת כתיבה על שדות שהם שלי בלבד.
 * ═══════════════════════════════════════════════════════════════
 */

export const FEEDBACK_TYPES = {
  bug: { label: 'תקלה', icon: '🐛', tone: 'danger' },
  feature: { label: 'בקשת פיצ׳ר', icon: '💡', tone: 'info' },
  issue: { label: 'בעיה', icon: '⚠️', tone: 'warn' },
  question: { label: 'שאלה', icon: '❓', tone: 'neutral' },
  compliment: { label: 'מחמאה', icon: '💚', tone: 'success' },
  other: { label: 'אחר', icon: '📝', tone: 'neutral' },
};

export const FEEDBACK_STATUSES = {
  new: { label: 'חדש', tone: 'info' },
  read: { label: 'נקרא', tone: 'neutral' },
  in_progress: { label: 'בטיפול', tone: 'warn' },
  resolved: { label: 'טופל', tone: 'success' },
  closed: { label: 'סגור', tone: 'neutral' },
  wont_fix: { label: 'לא יטופל', tone: 'neutral' },
  duplicate: { label: 'כפילות', tone: 'neutral' },
  archived: { label: 'בארכיון', tone: 'neutral' },
};

export const PRIORITIES = {
  low: { label: 'נמוכה', tone: 'neutral', weight: 1 },
  medium: { label: 'בינונית', tone: 'info', weight: 2 },
  high: { label: 'גבוהה', tone: 'warn', weight: 3 },
  urgent: { label: 'דחופה', tone: 'danger', weight: 4 },
  critical: { label: 'קריטית', tone: 'danger', weight: 5 },
};

/** עדיפות ברירת מחדל לפי סוג — תקלה נכנסת גבוה, מחמאה נמוך. */
function defaultPriority(type) {
  if (type === 'bug') return 'high';
  if (type === 'issue') return 'medium';
  if (type === 'question') return 'medium';
  return 'low';
}

/**
 * זיהוי כפילויות: אותו סוג + חפיפה מילולית גבוהה בכותרת.
 * לא ניסיון לזהות "אותה בעיה" באמת — רק לסמן למי שקורא שכדאי להשוות.
 */
function similarity(a, b) {
  const wordsA = new Set(String(a).toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(String(b).toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.min(wordsA.size, wordsB.size);
}

export function buildFeedbackList(world) {
  const state = world.console?.feedbackState ?? {};
  const raw = Object.entries(world.feedback ?? {});

  const items = raw.map(([id, fb]) => {
    const st = state[id] ?? {};
    const type = fb.type ?? 'other';
    return {
      id,
      type,
      typeLabel: FEEDBACK_TYPES[type]?.label ?? type,
      subject: fb.subject ?? '(ללא נושא)',
      body: fb.body ?? '',
      environment: fb.environment ?? null,
      attachments: fb.attachments ?? [],
      createdAt: fb.createdAt ?? 0,
      roomCode: fb.roomCode ?? null,
      roomName: fb.roomCode ? world.roomNameOf(fb.roomCode) : null,
      userId: fb.userId ?? null,
      userName: world.nameOf(fb.userId),
      userRole:
        world.rooms.get(fb.roomCode)?.adminId === fb.userId ? 'admin' : 'member',
      status: st.status ?? 'new',
      priority: st.priority ?? defaultPriority(type),
      category: st.category ?? type,
      assignee: st.assignee ?? null,
      notes: Object.entries(st.notes ?? {})
        .map(([nid, n]) => ({ id: nid, ...n }))
        .sort((a, b) => a.createdAt - b.createdAt),
      responses: Object.entries(st.responses ?? {})
        .map(([rid, r]) => ({ id: rid, ...r }))
        .sort((a, b) => a.sentAt - b.sentAt),
      timeline: Object.entries(st.timeline ?? {})
        .map(([tid, t]) => ({ id: tid, ...t }))
        .sort((a, b) => a.at - b.at),
      updatedAt: st.updatedAt ?? fb.createdAt ?? 0,
    };
  });

  // כפילויות — מסומנות אחרי שכל הרשומות קיימות
  for (const item of items) {
    item.duplicates = items
      .filter(
        (other) =>
          other.id !== item.id &&
          other.type === item.type &&
          similarity(other.subject, item.subject) >= 0.6
      )
      .map((o) => ({ id: o.id, subject: o.subject, roomName: o.roomName }));
  }

  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}

export function feedbackCounts(items) {
  const counts = {
    total: items.length,
    new: 0,
    open: 0,
    resolved: 0,
    archived: 0,
    byType: {},
    byPriority: {},
  };
  for (const it of items) {
    if (it.status === 'new') counts.new++;
    if (['new', 'read', 'in_progress'].includes(it.status)) counts.open++;
    if (it.status === 'resolved' || it.status === 'closed') counts.resolved++;
    if (it.status === 'archived') counts.archived++;
    counts.byType[it.type] = (counts.byType[it.type] ?? 0) + 1;
    counts.byPriority[it.priority] = (counts.byPriority[it.priority] ?? 0) + 1;
  }
  return counts;
}

/** מיון וסינון של התיבה — אותו קוד משרת את המסך ואת הדוחות. */
export function filterFeedback(items, query = {}) {
  const { status, type, room, priority, search, assignee } = query;
  const needle = search ? String(search).toLowerCase() : null;

  let out = items.filter((it) => {
    if (status && status !== 'all') {
      if (status === 'open' && !['new', 'read', 'in_progress'].includes(it.status)) return false;
      if (status !== 'open' && it.status !== status) return false;
    }
    if (!status || status === 'all') {
      // ברירת מחדל: ארכיון לא מציף את התיבה
      if (it.status === 'archived') return false;
    }
    if (type && type !== 'all' && it.type !== type) return false;
    if (room && it.roomCode !== room) return false;
    if (priority && priority !== 'all' && it.priority !== priority) return false;
    if (assignee && it.assignee !== assignee) return false;
    if (needle) {
      const hay = `${it.subject} ${it.body} ${it.userName} ${it.roomName ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sort = query.sort ?? 'newest';
  if (sort === 'oldest') out = out.sort((a, b) => a.createdAt - b.createdAt);
  else if (sort === 'priority')
    out = out.sort(
      (a, b) =>
        (PRIORITIES[b.priority]?.weight ?? 0) - (PRIORITIES[a.priority]?.weight ?? 0) ||
        b.createdAt - a.createdAt
    );
  else if (sort === 'room') out = out.sort((a, b) => (a.roomName ?? '').localeCompare(b.roomName ?? ''));
  else out = out.sort((a, b) => b.createdAt - a.createdAt);

  return out;
}

/** ניתוח מגמות — מה מגיע, מאיפה, ובאיזה קצב. */
export function feedbackAnalytics(items, world) {
  const DAY = 86_400_000;
  const byType = {};
  const byRoom = {};
  const weekly = [];

  for (const it of items) {
    byType[it.type] = (byType[it.type] ?? 0) + 1;
    if (it.roomCode) {
      byRoom[it.roomCode] = byRoom[it.roomCode] ?? { code: it.roomCode, name: it.roomName, count: 0 };
      byRoom[it.roomCode].count++;
    }
  }

  for (let w = 7; w >= 0; w--) {
    const start = world.now - (w + 1) * 7 * DAY;
    const end = world.now - w * 7 * DAY;
    weekly.push({
      weekStart: start,
      count: items.filter((it) => it.createdAt >= start && it.createdAt < end).length,
    });
  }

  const resolved = items.filter((it) => it.status === 'resolved' || it.status === 'closed');
  const resolutionTimes = resolved
    .map((it) => it.updatedAt - it.createdAt)
    .filter((ms) => ms > 0);
  const avgResolutionMs = resolutionTimes.length
    ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
    : 0;

  const positive = items.filter((it) => it.type === 'compliment').length;
  const negative = items.filter((it) => it.type === 'bug' || it.type === 'issue').length;
  const sentiment =
    positive + negative === 0 ? 0 : Math.round(((positive - negative) / (positive + negative)) * 100);

  return {
    byType,
    byRoom: Object.values(byRoom).sort((a, b) => b.count - a.count),
    weekly,
    avgResolutionMs,
    sentiment,
    responseRate: items.length
      ? Math.round((items.filter((it) => it.responses.length > 0).length / items.length) * 100)
      : 0,
  };
}

/** רישום שורה בציר הזמן של המשוב. כל שינוי מתועד — זה כלי ביקורת. */
export function timelineEntry(text, actor = 'admin') {
  return { [pushId()]: { text, actor, at: Date.now() } };
}
