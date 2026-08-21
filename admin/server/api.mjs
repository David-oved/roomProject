import { pushId } from './db.mjs';
import { EVENT_CATEGORIES, filterEvents, roomLog, userTimeline } from './activity.mjs';
import { SEGMENT_LABELS, analyzeAll, analyzeUser, roomContributors } from './insights.mjs';
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  PRIORITIES,
  feedbackAnalytics,
  filterFeedback,
  timelineEntry,
} from './feedback.mjs';
import {
  AUDIENCE_TYPES,
  MESSAGE_KINDS,
  dueMessages,
  listMessages,
  listThreads,
  nextOccurrence,
  resolveAudience,
  trackingFor,
} from './messaging.mjs';
import { HEALTH_THRESHOLDS } from './roomHealth.mjs';
import { DEFAULT_ALERT_CONFIG, inQuietHours, mergeConfig } from './alerts.mjs';
import { REPORT_TYPES, generateReport, reportToCsv, reportToHtml } from './reports.mjs';
import * as actions from './actions.mjs';
import { config } from './config.mjs';

const CONSOLE = 'adminConsole';

/**
 * ═══════════════════════════════════════════════════════════════
 *  שכבת ה-API
 * ═══════════════════════════════════════════════════════════════
 *  נתיבים מוגדרים כטבלה אחת עם ביטויים רגולריים. כל handler מקבל
 *  ctx אחיד ומחזיר אובייקט — הסריאליזציה, השגיאות והקודים מטופלים
 *  במקום אחד (index.mjs).
 * ═══════════════════════════════════════════════════════════════
 */

const routes = [];

function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\//g, '\\/')
        .replace(/:(\w+)/g, (_, key) => {
          keys.push(key);
          return '([^\\/]+)';
        }) +
      '$'
  );
  routes.push({ method, regex, keys, handler });
}

export function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.regex.exec(pathname);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { handler: r.handler, params };
  }
  return null;
}

const num = (v, fallback) => (v === undefined || v === null || v === '' ? fallback : Number(v));

/* ═══════════════════ מצב כללי ═══════════════════ */

route('GET', '/api/bootstrap', ({ state }) => {
  const s = state.get();
  return {
    version: s.version,
    mode: config.mode,
    missing: config.missing,
    now: Date.now(),
    counts: {
      users: s.world.userList.length,
      rooms: s.world.roomList.length,
      alerts: s.alerts.filter((a) => !a.dismissed).length,
      criticalAlerts: s.alerts.filter((a) => !a.dismissed && a.severity === 'critical').length,
      feedbackNew: s.feedbackCounts.new,
      unreadThreads: listThreads(s.world).reduce((a, t) => a + t.unread, 0),
    },
    rooms: s.world.roomList.map((r) => ({ code: r.code, name: r.name })),
    users: s.world.userList.map((u) => ({ uid: u.uid, name: u.displayName, email: u.email })),
    dictionaries: {
      eventCategories: EVENT_CATEGORIES,
      feedbackTypes: FEEDBACK_TYPES,
      feedbackStatuses: FEEDBACK_STATUSES,
      priorities: PRIORITIES,
      messageKinds: MESSAGE_KINDS,
      audienceTypes: AUDIENCE_TYPES,
      segments: SEGMENT_LABELS,
      reportTypes: REPORT_TYPES,
      healthThresholds: HEALTH_THRESHOLDS,
    },
    quietHours: inQuietHours(s.alertConfig),
  };
});

route('GET', '/api/overview', ({ state }) => {
  const s = state.get();
  const { world, analytics, health, events } = s;
  const DAY = 86_400_000;

  const todayEvents = events.filter((e) => e.ts > Date.now() - DAY && e.category !== 'session');
  const spendToday = todayEvents
    .filter((e) => e.type === 'purchase_made')
    .reduce((a, e) => a + (e.amount ?? 0), 0);

  return {
    cards: {
      users: world.userList.length,
      activeUsers: analytics.totals.activeNow,
      activePercent: analytics.totals.activePercent,
      rooms: world.roomList.length,
      roomsCritical: health.filter((h) => h.level === 'critical').length,
      roomsAtRisk: health.filter((h) => h.level === 'risk').length,
      actionsToday: todayEvents.length,
      spendToday,
      openFeedback: s.feedbackCounts.open,
      newFeedback: s.feedbackCounts.new,
      openAlerts: s.alerts.filter((a) => !a.dismissed).length,
      pendingPurchases: world.roomList.reduce((a, r) => a + r.pendingPurchases.length, 0),
      pendingJoins: world.roomList.reduce((a, r) => a + r.pendingRequests.length, 0),
      openItems: world.roomList.reduce((a, r) => a + r.openItems.length, 0),
    },
    daily: analytics.daily.slice(-14),
    topAlerts: s.alerts.filter((a) => !a.dismissed).slice(0, 5),
    worstRooms: health.slice(0, 4),
    recentEvents: events.filter((e) => e.category !== 'session').slice(0, 12),
    latestFeedback: s.feedbackItems.slice(0, 4),
  };
});

/* ═══════════════════ פיד פעילות ═══════════════════ */

route('GET', '/api/activity', ({ state, query }) => {
  const s = state.get();
  const filtered = filterEvents(s.events, query);
  const limit = num(query.limit, 60);
  const offset = num(query.offset, 0);
  return {
    version: s.version,
    total: filtered.length,
    events: filtered.slice(offset, offset + limit),
    hasMore: offset + limit < filtered.length,
  };
});

/* ═══════════════════ משתמשים ═══════════════════ */

route('GET', '/api/users', ({ state, query }) => {
  const s = state.get();
  const needle = query.search ? String(query.search).toLowerCase() : null;
  let profiles = s.analytics.profiles;

  if (query.segment && query.segment !== 'all') {
    profiles = profiles.filter((p) => p.segments.includes(query.segment));
  }
  if (query.room) {
    profiles = profiles.filter((p) => p.memberships.some((m) => m.roomCode === query.room));
  }
  if (needle) {
    profiles = profiles.filter(
      (p) =>
        p.displayName.toLowerCase().includes(needle) ||
        (p.email ?? '').toLowerCase().includes(needle) ||
        p.uid.toLowerCase().includes(needle)
    );
  }

  const sort = query.sort ?? 'activity';
  profiles = [...profiles].sort((a, b) => {
    if (sort === 'name') return a.displayName.localeCompare(b.displayName, 'he');
    if (sort === 'spend') return b.stats.totalSpent - a.stats.totalSpent;
    if (sort === 'recent') return b.lastActiveAt - a.lastActiveAt;
    return b.window.actions - a.window.actions;
  });

  return { total: profiles.length, users: profiles, segments: s.analytics.bySegment };
});

route('GET', '/api/users/:uid', ({ state, params, query }) => {
  const s = state.get();
  const user = s.world.users.get(params.uid);
  if (!user) return { status: 404, body: { error: 'משתמש לא נמצא' } };

  const profile = analyzeUser(user, s.events, s.world, num(query.days, 30));
  const threads = listThreads(s.world).find((t) => t.uid === params.uid) ?? null;

  return {
    profile,
    timeline: userTimeline(s.events, params.uid, { limit: num(query.limit, 200) }),
    feedback: s.feedbackItems.filter((f) => f.userId === params.uid),
    thread: threads,
    suspended: Boolean(s.snapshot.suspensions?.[params.uid]),
  };
});

/* ═══════════════════ חדרים ═══════════════════ */

route('GET', '/api/rooms', ({ state, query }) => {
  const s = state.get();
  let rooms = s.health;
  if (query.level && query.level !== 'all') rooms = rooms.filter((r) => r.level === query.level);
  if (query.search) {
    const needle = String(query.search).toLowerCase();
    rooms = rooms.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle)
    );
  }
  return { rooms, thresholds: HEALTH_THRESHOLDS };
});

route('GET', '/api/rooms/:code', ({ state, params, query }) => {
  const s = state.get();
  const room = s.world.rooms.get(params.code);
  if (!room) return { status: 404, body: { error: 'חדר לא נמצא' } };
  const health = s.health.find((h) => h.code === params.code);

  return {
    health,
    room: {
      code: room.code,
      name: room.name,
      description: room.description,
      adminId: room.adminId,
      adminName: s.world.nameOf(room.adminId),
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt,
      totalSpent: room.totalSpent,
      spread: room.spread,
      archivedAt: s.snapshot.rooms?.[params.code]?.metadata?.archivedAt ?? null,
    },
    members: room.members.map((m) => ({
      ...m,
      balance: room.balances[m.uid] ?? 0,
      lastActiveAt: s.world.users.get(m.uid)?.lastActiveAt ?? 0,
    })),
    contributors: roomContributors(room, s.world),
    openItems: room.openItems.sort((a, b) => a.reportedAt - b.reportedAt),
    pendingPurchases: room.pendingPurchases,
    pendingRequests: room.pendingRequests,
    balances: room.balances,
    tasks: room.tasks,
    feedback: s.feedbackItems.filter((f) => f.roomCode === params.code),
    log: roomLog(s.events, params.code, { limit: num(query.limit, 250), category: query.category }),
  };
});

route('POST', '/api/rooms/:code/action', async ({ db, state, params, body }) => {
  const { action } = body;
  const roomCode = params.code;

  switch (action) {
    case 'approve_purchase':
      return actions.approvePurchase(db, state, { roomCode, purchaseId: body.purchaseId });
    case 'reject_purchase':
      return actions.rejectPurchase(db, state, {
        roomCode,
        purchaseId: body.purchaseId,
        reason: body.reason,
      });
    case 'approve_join':
      return actions.approveJoinRequest(db, state, { roomCode, uid: body.uid });
    case 'reject_join':
      return actions.rejectJoinRequest(db, state, { roomCode, uid: body.uid });
    case 'remove_member':
      return actions.removeMember(db, state, { roomCode, uid: body.uid, reason: body.reason });
    case 'transfer_admin':
      return actions.transferAdmin(db, state, { roomCode, uid: body.uid });
    case 'force_sync':
      return actions.forceSync(db, state, { roomCode });
    case 'reset_balances':
      return actions.resetBalances(db, state, { roomCode, reason: body.reason });
    case 'archive':
      return actions.archiveRoom(db, state, { roomCode, reason: body.reason });
    case 'unarchive':
      return actions.unarchiveRoom(db, state, { roomCode });
    case 'announce':
      return actions.announceToRoom(db, state, { roomCode, text: body.text });
    default:
      return { status: 400, body: { error: `פעולה לא מוכרת: ${action}` } };
  }
});

route('POST', '/api/users/:uid/action', async ({ db, state, params, body }) => {
  if (body.action === 'suspend' || body.action === 'unsuspend') {
    return actions.suspendUser(db, state, {
      uid: params.uid,
      suspended: body.action === 'suspend',
      reason: body.reason,
    });
  }
  return { status: 400, body: { error: `פעולה לא מוכרת: ${body.action}` } };
});

/* ═══════════════════ תובנות ═══════════════════ */

route('GET', '/api/insights', ({ state, query }) => {
  const s = state.get();
  const days = num(query.days, 30);
  // חלון 30 יום כבר מחושב במטמון; כל חלון אחר מחושב לפי דרישה
  const analytics = days === 30 ? s.analytics : analyzeAll(s.world, s.events, days);
  return { analytics: stripProfiles(analytics), segments: SEGMENT_LABELS };
});

/** רשימת הפרופילים המלאה כבדה; מסך התובנות מקבל רק את הסיכומים. */
function stripProfiles(analytics) {
  const { profiles, ...rest } = analytics;
  return {
    ...rest,
    profileSummaries: profiles.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      actions: p.window.actions,
      actionsPerWeek: p.window.actionsPerWeek,
      activeDays: p.window.activeDays,
      avgSessionMs: p.window.avgSessionMs,
      roomsCount: p.roomsCount,
      segments: p.segments,
      daysSinceActive: p.daysSinceActive,
      totalSpent: p.stats.totalSpent,
      reported: p.window.reported,
      bought: p.window.bought,
    })),
  };
}

/* ═══════════════════ משוב ═══════════════════ */

route('GET', '/api/feedback', ({ state, query }) => {
  const s = state.get();
  return {
    items: filterFeedback(s.feedbackItems, query),
    counts: s.feedbackCounts,
    analytics: feedbackAnalytics(s.feedbackItems, s.world),
  };
});

route('GET', '/api/feedback/:id', ({ state, params }) => {
  const s = state.get();
  const item = s.feedbackItems.find((f) => f.id === params.id);
  if (!item) return { status: 404, body: { error: 'משוב לא נמצא' } };
  return { item };
});

route('POST', '/api/feedback/:id/state', async ({ db, state, params, body }) => {
  const s = state.get();
  const item = s.feedbackItems.find((f) => f.id === params.id);
  if (!item) return { status: 404, body: { error: 'משוב לא נמצא' } };

  const patch = { updatedAt: Date.now() };
  const changes = [];
  for (const key of ['status', 'priority', 'category', 'assignee']) {
    if (body[key] !== undefined && body[key] !== item[key]) {
      patch[key] = body[key];
      changes.push(`${key}: ${item[key] ?? '—'} ← ${body[key]}`);
    }
  }
  if (changes.length) {
    patch.timeline = {
      ...(s.world.console?.feedbackState?.[params.id]?.timeline ?? {}),
      ...timelineEntry(changes.join(' · ')),
    };
  }
  await db.update(`${CONSOLE}/feedbackState/${params.id}`, patch);
  state.invalidate();
  return { ok: true, changes };
});

route('POST', '/api/feedback/:id/note', async ({ db, state, params, body }) => {
  if (!body.text?.trim()) return { status: 400, body: { error: 'הערה ריקה' } };
  await db.set(`${CONSOLE}/feedbackState/${params.id}/notes/${pushId()}`, {
    text: body.text.trim(),
    createdAt: Date.now(),
  });
  await db.update(`${CONSOLE}/feedbackState/${params.id}`, { updatedAt: Date.now() });
  state.invalidate();
  return { ok: true };
});

route('POST', '/api/feedback/:id/respond', async ({ db, state, params, body }) => {
  const s = state.get();
  const item = s.feedbackItems.find((f) => f.id === params.id);
  if (!item) return { status: 404, body: { error: 'משוב לא נמצא' } };
  if (!body.text?.trim()) return { status: 400, body: { error: 'תשובה ריקה' } };

  const sentAt = Date.now();
  const responseId = pushId();
  await db.set(`${CONSOLE}/feedbackState/${params.id}/responses/${responseId}`, {
    text: body.text.trim(),
    sentAt,
  });

  // התשובה מגיעה למשתמש כהודעה אישית — אותו ערוץ של יתר ההודעות
  if (item.userId) {
    await db.set(`${CONSOLE}/dm/${item.userId}/${responseId}`, {
      from: 'admin',
      text: body.text.trim(),
      sentAt,
      readAt: null,
      relatedFeedback: params.id,
    });
    await db.set(`adminMessages/${item.userId}/${responseId}`, {
      title: `תשובה למשוב: ${item.subject}`,
      body: body.text.trim(),
      kind: 'info',
      sentAt,
      readAt: null,
    });
  }

  await db.update(`${CONSOLE}/feedbackState/${params.id}`, {
    updatedAt: sentAt,
    ...(body.status ? { status: body.status } : {}),
    timeline: {
      ...(s.world.console?.feedbackState?.[params.id]?.timeline ?? {}),
      ...timelineEntry('נשלחה תשובה לשולח'),
    },
  });
  state.invalidate();
  return { ok: true, responseId };
});

/* ═══════════════════ הודעות ═══════════════════ */

route('GET', '/api/messages', ({ state }) => {
  const s = state.get();
  return {
    messages: listMessages(s.world),
    templates: Object.entries(s.world.console?.templates ?? {})
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  };
});

route('GET', '/api/messages/:id', ({ state, params }) => {
  const s = state.get();
  const raw = s.world.console?.messages?.[params.id];
  if (!raw) return { status: 404, body: { error: 'הודעה לא נמצאה' } };
  const message = { id: params.id, ...raw };
  return { message, tracking: trackingFor(message, s.world, s.snapshot) };
});

route('POST', '/api/messages/preview', ({ state, body }) => {
  const s = state.get();
  const resolved = resolveAudience(body.audience, s.world, s.analytics);
  return {
    count: resolved.uids.length,
    description: resolved.description,
    sample: resolved.uids.slice(0, 12).map((uid) => ({ uid, name: s.world.nameOf(uid) })),
  };
});

route('POST', '/api/messages', async ({ db, state, body }) => {
  const s = state.get();
  if (!body.title?.trim() || !body.body?.trim()) {
    return { status: 400, body: { error: 'כותרת וגוף הודעה הם שדות חובה' } };
  }

  const id = pushId();
  const now = Date.now();
  const status = body.status ?? 'send'; // send | schedule | draft
  const sendAt = status === 'schedule' ? Number(body.sendAt) : now;

  if (status === 'schedule' && (!sendAt || sendAt <= now)) {
    return { status: 400, body: { error: 'מועד השליחה חייב להיות בעתיד' } };
  }

  const record = {
    title: body.title.trim(),
    body: body.body.trim(),
    kind: body.kind ?? 'info',
    audience: body.audience ?? { type: 'all' },
    cta: body.cta?.text && body.cta?.url ? body.cta : null,
    recurrence: body.recurrence ?? null,
    createdAt: now,
    sendAt,
    status: status === 'send' ? 'sent' : status === 'schedule' ? 'scheduled' : 'draft',
    recipients: {},
  };

  if (status === 'send') {
    const resolved = resolveAudience(record.audience, s.world, s.analytics);
    record.recipients = await deliver(db, id, record, resolved.uids);
  }

  await db.set(`${CONSOLE}/messages/${id}`, record);
  await actions.audit(db, {
    action: `message_${record.status}`,
    entityId: id,
    detail: record.title,
  });
  state.invalidate();
  return { ok: true, id, recipients: Object.keys(record.recipients).length };
});

/** כתיבת ההודעה לתיבות המשתמשים. זהו רגע ה"נשלח". */
async function deliver(db, messageId, record, uids) {
  const now = Date.now();
  const recipients = {};
  for (const uid of uids) {
    await db.set(`adminMessages/${uid}/${messageId}`, {
      title: record.title,
      body: record.body,
      kind: record.kind,
      cta: record.cta,
      sentAt: now,
      readAt: null,
    });
    recipients[uid] = { deliveredAt: now, readAt: null, clickedAt: null };
  }
  return recipients;
}

route('POST', '/api/messages/:id/resend', async ({ db, state, params }) => {
  const s = state.get();
  const raw = s.world.console?.messages?.[params.id];
  if (!raw) return { status: 404, body: { error: 'הודעה לא נמצאה' } };

  const resolved = resolveAudience(raw.audience, s.world, s.analytics);
  const id = pushId();
  const record = { ...raw, createdAt: Date.now(), sendAt: Date.now(), status: 'sent', recipients: {} };
  record.recipients = await deliver(db, id, record, resolved.uids);
  await db.set(`${CONSOLE}/messages/${id}`, record);
  await actions.audit(db, { action: 'message_resent', entityId: id, detail: raw.title });
  state.invalidate();
  return { ok: true, id };
});

route('DELETE', '/api/messages/:id', async ({ db, state, params }) => {
  await db.remove(`${CONSOLE}/messages/${params.id}`);
  await actions.audit(db, { action: 'message_deleted', entityId: params.id });
  state.invalidate();
  return { ok: true };
});

/* ═══════════════════ תבניות ═══════════════════ */

route('POST', '/api/templates', async ({ db, state, body }) => {
  if (!body.name?.trim()) return { status: 400, body: { error: 'לתבנית חייב להיות שם' } };
  const id = body.id ?? pushId();
  await db.set(`${CONSOLE}/templates/${id}`, {
    name: body.name.trim(),
    title: body.title ?? '',
    body: body.body ?? '',
    kind: body.kind ?? 'info',
    createdAt: body.createdAt ?? Date.now(),
  });
  state.invalidate();
  return { ok: true, id };
});

route('DELETE', '/api/templates/:id', async ({ db, state, params }) => {
  await db.remove(`${CONSOLE}/templates/${params.id}`);
  state.invalidate();
  return { ok: true };
});

/* ═══════════════════ שיחות אישיות ═══════════════════ */

route('GET', '/api/threads', ({ state }) => {
  const s = state.get();
  return { threads: listThreads(s.world) };
});

route('GET', '/api/threads/:uid', ({ state, params }) => {
  const s = state.get();
  const thread = listThreads(s.world).find((t) => t.uid === params.uid) ?? {
    uid: params.uid,
    name: s.world.nameOf(params.uid),
    messages: [],
    unread: 0,
  };
  const user = s.world.users.get(params.uid);
  return {
    thread,
    user: user
      ? {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          lastActiveAt: user.lastActiveAt,
          memberships: user.memberships,
        }
      : null,
  };
});

route('POST', '/api/threads/:uid', async ({ db, state, params, body }) => {
  if (!body.text?.trim()) return { status: 400, body: { error: 'הודעה ריקה' } };
  const id = pushId();
  const sentAt = Date.now();

  await db.set(`${CONSOLE}/dm/${params.uid}/${id}`, {
    from: 'admin',
    text: body.text.trim(),
    sentAt,
    readAt: null,
  });
  await db.set(`adminMessages/${params.uid}/${id}`, {
    title: body.title?.trim() || 'הודעה ממנהל המערכת',
    body: body.text.trim(),
    kind: body.kind ?? 'info',
    sentAt,
    readAt: null,
  });
  await actions.audit(db, { action: 'dm_sent', entityId: params.uid, detail: body.text.trim() });
  state.invalidate();
  return { ok: true, id };
});

route('POST', '/api/threads/:uid/read', async ({ db, state, params }) => {
  const s = state.get();
  const thread = s.world.console?.dm?.[params.uid] ?? {};
  const now = Date.now();
  for (const [id, m] of Object.entries(thread)) {
    if (m.from === 'user' && !m.adminReadAt) {
      await db.update(`${CONSOLE}/dm/${params.uid}/${id}`, { adminReadAt: now });
    }
  }
  state.invalidate();
  return { ok: true };
});

/* ═══════════════════ התראות ═══════════════════ */

route('GET', '/api/alerts', ({ state, query }) => {
  const s = state.get();
  let alerts = s.alerts;
  if (query.severity && query.severity !== 'all') {
    alerts = alerts.filter((a) => a.severity === query.severity);
  }
  if (query.includeDismissed !== 'true') alerts = alerts.filter((a) => !a.dismissed);
  return {
    alerts,
    counts: {
      critical: s.alerts.filter((a) => !a.dismissed && a.severity === 'critical').length,
      warn: s.alerts.filter((a) => !a.dismissed && a.severity === 'warn').length,
      info: s.alerts.filter((a) => !a.dismissed && a.severity === 'info').length,
      dismissed: s.alerts.filter((a) => a.dismissed).length,
    },
    config: s.alertConfig,
    quietHours: inQuietHours(s.alertConfig),
  };
});

route('POST', '/api/alerts/:id/dismiss', async ({ db, state, params }) => {
  await db.update(`${CONSOLE}/alertState/${encodeKey(params.id)}`, { dismissedAt: Date.now() });
  state.invalidate();
  return { ok: true };
});

route('POST', '/api/alerts/:id/restore', async ({ db, state, params }) => {
  await db.remove(`${CONSOLE}/alertState/${encodeKey(params.id)}/dismissedAt`);
  state.invalidate();
  return { ok: true };
});

route('POST', '/api/alerts/seen', async ({ db, state }) => {
  const s = state.get();
  const now = Date.now();
  for (const a of s.alerts) {
    const key = encodeKey(a.id);
    if (!s.world.console?.alertState?.[key]?.firstSeenAt) {
      await db.update(`${CONSOLE}/alertState/${key}`, { firstSeenAt: now });
    }
  }
  state.invalidate();
  return { ok: true };
});

route('PUT', '/api/alerts/config', async ({ db, state, body }) => {
  const merged = mergeConfig(body);
  await db.set(`${CONSOLE}/alertConfig`, merged);
  state.invalidate();
  return { ok: true, config: merged };
});

route('POST', '/api/alerts/config/reset', async ({ db, state }) => {
  await db.set(`${CONSOLE}/alertConfig`, DEFAULT_ALERT_CONFIG);
  state.invalidate();
  return { ok: true, config: DEFAULT_ALERT_CONFIG };
});

/** מפתחות RTDB לא מכילים . $ # [ ] / — מזהי ההתראות בנויים מנקודתיים. */
function encodeKey(id) {
  return String(id).replace(/[.$#[\]/]/g, '_');
}

/* ═══════════════════ דוחות ═══════════════════ */

route('GET', '/api/reports/:type', ({ state, params, query }) => {
  const s = state.get();
  const report = generateReport(params.type, {
    world: s.world,
    events: s.events,
    analytics: s.analytics,
    feedbackItems: s.feedbackItems,
    range: rangeFromQuery(query),
    metrics: query.metrics ? String(query.metrics).split(',').filter(Boolean) : [],
    groupBy: query.groupBy,
  });
  return { report };
});

route('GET', '/api/reports/:type/export', ({ state, params, query }) => {
  const s = state.get();
  const report = generateReport(params.type, {
    world: s.world,
    events: s.events,
    analytics: s.analytics,
    feedbackItems: s.feedbackItems,
    range: rangeFromQuery(query),
    metrics: query.metrics ? String(query.metrics).split(',').filter(Boolean) : [],
    groupBy: query.groupBy,
  });

  const format = query.format ?? 'csv';
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    return {
      raw: {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json; charset=utf-8',
        filename: `${params.type}-${stamp}.json`,
      },
    };
  }
  if (format === 'html' || format === 'pdf') {
    return {
      raw: {
        body: reportToHtml(report),
        contentType: 'text/html; charset=utf-8',
        filename: `${params.type}-${stamp}.html`,
        inline: true,
      },
    };
  }
  return {
    raw: {
      body: reportToCsv(report),
      contentType: 'text/csv; charset=utf-8',
      filename: `${params.type}-${stamp}.csv`,
    },
  };
});

function rangeFromQuery(query) {
  if (query.from && query.to) return { from: Number(query.from), to: Number(query.to) };
  // בלי days מפורש — כל דוח נשאר עם ברירת המחדל הטבעית שלו (reports.mjs)
  return query.days ? { days: Number(query.days) } : {};
}

/* ═══════════════════ יומן ביקורת ומערכת ═══════════════════ */

route('GET', '/api/audit', ({ state, query }) => {
  const s = state.get();
  const entries = Object.entries(s.world.console?.auditLog ?? {})
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.at - a.at)
    .slice(0, num(query.limit, 100));
  return { entries };
});

route('GET', '/api/system', ({ state }) => {
  const s = state.get();
  const usage = process.memoryUsage();
  return {
    mode: config.mode,
    databaseURL: config.databaseURL,
    serviceAccount: config.serviceAccountPath ? 'נטען' : 'חסר',
    missing: config.missing,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(usage.rss / 1024 / 1024),
    stateVersion: s.version,
    builtAt: s.builtAt,
    counts: {
      users: s.world.userList.length,
      rooms: s.world.roomList.length,
      events: s.events.length,
      feedback: s.feedbackItems.length,
      alerts: s.alerts.length,
    },
  };
});

route('POST', '/api/system/demo-reset', async ({ db, state }) => {
  if (config.mode !== 'demo') return { status: 400, body: { error: 'זמין רק במצב הדגמה' } };
  await db.reset();
  state.invalidate();
  return { ok: true };
});

/* ═══════════════════ מתוזמנות ═══════════════════ */

/** נקרא מהלולאה ב-index.mjs — שולח הודעות שהגיע זמנן. */
export async function flushScheduledMessages(db, state) {
  const s = state.get();
  const due = dueMessages(s.world);
  for (const message of due) {
    const resolved = resolveAudience(message.audience, s.world, s.analytics);
    const recipients = await deliver(db, message.id, message, resolved.uids);
    await db.update(`${CONSOLE}/messages/${message.id}`, {
      status: 'sent',
      recipients,
      sendAt: Date.now(),
    });

    if (message.recurrence) {
      const next = nextOccurrence(Date.now(), message.recurrence);
      if (next) {
        const id = pushId();
        await db.set(`${CONSOLE}/messages/${id}`, {
          ...message,
          id: undefined,
          createdAt: Date.now(),
          sendAt: next,
          status: 'scheduled',
          recipients: {},
        });
      }
    }
    await actions.audit(db, {
      action: 'message_sent_scheduled',
      entityId: message.id,
      detail: message.title,
    });
  }
  if (due.length) state.invalidate();
  return due.length;
}
