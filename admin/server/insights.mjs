/**
 * ═══════════════════════════════════════════════════════════════
 *  תובנות משתמשים
 * ═══════════════════════════════════════════════════════════════
 *  אין כאן SDK אנליטיקה ואין מעקב בדפדפן. כל מספר נגזר מאירועים
 *  שקיימים ממילא בבסיס הנתונים.
 *
 *  ‼️ "אורך סשן" הוא הערכה ולא מדידה: אשכול של פעולות אותו משתמש
 *     עם פער קטן מ-30 דקות נחשב לסשן אחד. זה מסומן בממשק כהערכה
 *     במפורש — מספר שמתחזה למדויק גרוע ממספר שמודה שהוא הערכה.
 * ═══════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;
const SESSION_GAP = 30 * 60_000;

/** מיפוי אירוע ← "פיצ'ר" באפליקציה, לצורך דוח שימוש בפיצ'רים. */
const FEATURE_OF_EVENT = {
  item_reported: 'דיווח מוצר',
  purchase_made: 'רישום קנייה',
  purchase_approved: 'אישור קנייה',
  settlement: 'סגירת חשבון',
  task_completed: 'מטלות',
  chat_message: 'צ׳אט',
  room_announcement: 'שידור לחדר',
  member_joined: 'הצטרפות לחדר',
  join_requested: 'בקשת הצטרפות',
  feedback_bug: 'שליחת משוב',
  feedback_feature: 'שליחת משוב',
  feedback_issue: 'שליחת משוב',
  feedback_question: 'שליחת משוב',
  feedback_compliment: 'שליחת משוב',
};

function sessionsOf(timestamps) {
  if (timestamps.length === 0) return [];
  const sorted = [...timestamps].sort((a, b) => a - b);
  const sessions = [];
  let start = sorted[0];
  let last = sorted[0];
  let count = 1;

  for (const ts of sorted.slice(1)) {
    if (ts - last > SESSION_GAP) {
      sessions.push({ start, end: last, count });
      start = ts;
      count = 1;
    } else {
      count++;
    }
    last = ts;
  }
  sessions.push({ start, end: last, count });
  return sessions;
}

/** ניתוח מלא למשתמש יחיד בחלון זמן נתון. */
export function analyzeUser(user, events, world, windowDays = 30) {
  const since = world.now - windowDays * DAY;
  const mine = events.filter((e) => e.actorId === user.uid);
  const inWindow = mine.filter((e) => e.ts >= since);

  const actionEvents = inWindow.filter((e) => e.category !== 'session');
  const days = new Set(actionEvents.map((e) => new Date(e.ts).toISOString().slice(0, 10)));
  const sessions = sessionsOf(actionEvents.map((e) => e.ts));
  const durations = sessions.map((s) => Math.max(60_000, s.end - s.start));
  const avgSession = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  for (const e of actionEvents) {
    const d = new Date(e.ts);
    hours[d.getHours()]++;
    weekdays[d.getDay()]++;
  }

  const features = {};
  for (const e of actionEvents) {
    const f = FEATURE_OF_EVENT[e.type];
    if (f) features[f] = (features[f] ?? 0) + 1;
  }

  const reported = actionEvents.filter((e) => e.type === 'item_reported').length;
  const bought = actionEvents.filter((e) => e.type === 'purchase_made').length;

  const daysSinceActive = Math.floor((world.now - (user.lastActiveAt ?? 0)) / DAY);
  const actionsPerWeek = windowDays > 0 ? (actionEvents.length / windowDays) * 7 : 0;

  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    daysSinceActive,
    memberships: user.memberships,
    roomsCount: user.memberships.filter((m) => m.status === 'active').length,
    stats: user.stats,
    window: {
      days: windowDays,
      actions: actionEvents.length,
      actionsPerWeek: Math.round(actionsPerWeek * 10) / 10,
      activeDays: days.size,
      activeDayRatio: Math.round((days.size / windowDays) * 100),
      sessions: sessions.length,
      avgSessionMs: avgSession,
      hours,
      weekdays,
      features,
      reported,
      bought,
      reportToBuyRatio: bought === 0 ? (reported > 0 ? Infinity : 0) : reported / bought,
    },
    segments: segmentsOf({ actionsPerWeek, daysSinceActive, reported, bought, user }),
  };
}

/** שיוך משתמש לפלחים. משתמש יכול להשתייך ליותר מאחד. */
function segmentsOf({ actionsPerWeek, daysSinceActive, reported, bought, user }) {
  const segs = [];

  if (daysSinceActive <= 7) segs.push('active');
  if (daysSinceActive > 30 && daysSinceActive <= 90) segs.push('inactive');
  if (daysSinceActive > 90) segs.push('dormant');
  if (daysSinceActive > 14 && daysSinceActive <= 30) segs.push('at_risk');

  if (actionsPerWeek >= 20) segs.push('power');
  else if (actionsPerWeek >= 5) segs.push('regular');
  else if (actionsPerWeek > 0) segs.push('casual');
  else segs.push('silent');

  // "טרמפיסט" — מדווח הרבה, כמעט לא קונה. סף מכוון גבוה כדי לא
  // להדביק את התווית הזו למי שפשוט לא קנה החודש.
  if (reported >= 5 && bought <= 1 && reported / Math.max(1, bought) >= 5) segs.push('freeloader');
  if (user.stats.purchasesMade >= 8 && user.stats.totalSpent >= 50_000) segs.push('power_buyer');
  if (user.memberships.some((m) => m.role === 'admin' && m.status === 'active')) segs.push('room_admin');

  return segs;
}

export const SEGMENT_LABELS = {
  active: { label: 'פעילים', hint: 'נכנסו בשבוע האחרון', tone: 'success' },
  regular: { label: 'קבועים', hint: '5–20 פעולות בשבוע', tone: 'info' },
  power: { label: 'כבדים', hint: 'מעל 20 פעולות בשבוע', tone: 'success' },
  casual: { label: 'מזדמנים', hint: 'עד 5 פעולות בשבוע', tone: 'neutral' },
  silent: { label: 'שקטים', hint: 'ללא פעולות בחלון', tone: 'neutral' },
  at_risk: { label: 'בסיכון', hint: 'שבועיים עד חודש בלי כניסה', tone: 'warn' },
  inactive: { label: 'לא פעילים', hint: 'מעל חודש בלי כניסה', tone: 'warn' },
  dormant: { label: 'רדומים', hint: 'מעל שלושה חודשים', tone: 'danger' },
  freeloader: { label: 'טרמפיסטים', hint: 'מדווחים ולא קונים', tone: 'warn' },
  power_buyer: { label: 'קונים מובילים', hint: 'נושאים את רוב הקניות', tone: 'success' },
  room_admin: { label: 'מנהלי חדרים', hint: 'מנהלים לפחות חדר אחד', tone: 'info' },
};

/** תמונת מצב כוללת של כלל המשתמשים. */
export function analyzeAll(world, events, windowDays = 30) {
  const profiles = world.userList.map((u) => analyzeUser(u, events, world, windowDays));
  const since = world.now - windowDays * DAY;
  const prevSince = since - windowDays * DAY;

  const activeNow = profiles.filter((p) => p.daysSinceActive <= 7).length;
  const newUsers = world.userList.filter((u) => (u.createdAt ?? 0) >= since).length;
  const newUsersPrev = world.userList.filter(
    (u) => (u.createdAt ?? 0) >= prevSince && (u.createdAt ?? 0) < since
  ).length;
  const churned = profiles.filter((p) => p.daysSinceActive > 30).length;

  const bySegment = {};
  for (const key of Object.keys(SEGMENT_LABELS)) bySegment[key] = [];
  for (const p of profiles) for (const s of p.segments) bySegment[s]?.push(p.uid);

  const featureUsers = {};
  for (const p of profiles) {
    for (const f of Object.keys(p.window.features)) {
      featureUsers[f] = (featureUsers[f] ?? 0) + 1;
    }
  }
  const featureUsage = Object.entries(featureUsers)
    .map(([feature, users]) => ({
      feature,
      users,
      percent: profiles.length ? Math.round((users / profiles.length) * 100) : 0,
    }))
    .sort((a, b) => b.users - a.users);

  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  for (const p of profiles) {
    p.window.hours.forEach((v, i) => (hours[i] += v));
    p.window.weekdays.forEach((v, i) => (weekdays[i] += v));
  }

  const sessionCount = profiles.reduce((a, p) => a + p.window.sessions, 0);
  const avgSessionMs = sessionCount
    ? Math.round(
        profiles.reduce((a, p) => a + p.window.avgSessionMs * p.window.sessions, 0) / sessionCount
      )
    : 0;

  /* גרף פעילות יומי */
  const daily = [];
  for (let d = windowDays - 1; d >= 0; d--) {
    const dayStart = world.now - d * DAY;
    const key = new Date(dayStart).toISOString().slice(0, 10);
    const dayEvents = events.filter(
      (e) => e.category !== 'session' && new Date(e.ts).toISOString().slice(0, 10) === key
    );
    daily.push({
      date: key,
      actions: dayEvents.length,
      users: new Set(dayEvents.map((e) => e.actorId)).size,
    });
  }

  return {
    windowDays,
    totals: {
      users: profiles.length,
      activeNow,
      activePercent: profiles.length ? Math.round((activeNow / profiles.length) * 100) : 0,
      newUsers,
      newUsersDelta: newUsers - newUsersPrev,
      churned,
      churnPercent: profiles.length ? Math.round((churned / profiles.length) * 100) : 0,
      rooms: world.roomList.length,
      avgRoomsPerUser:
        profiles.length
          ? Math.round((profiles.reduce((a, p) => a + p.roomsCount, 0) / profiles.length) * 10) / 10
          : 0,
      avgSessionMs,
      sessionsPerUserPerWeek: profiles.length
        ? Math.round((sessionCount / profiles.length / (windowDays / 7)) * 10) / 10
        : 0,
    },
    peakHour: hours.indexOf(Math.max(...hours)),
    peakWeekday: weekdays.indexOf(Math.max(...weekdays)),
    hours,
    weekdays,
    featureUsage,
    daily,
    bySegment,
    profiles,
  };
}

/** דירוג "מי הכי פעיל / מי נושא הכי הרבה" בתוך חדר יחיד. */
export function roomContributors(room, world) {
  return room.activeMembers
    .map((m) => {
      const borne = room.contributions.borne[m.uid] ?? 0;
      const paidOut = room.contributions.paidOut[m.uid] ?? 0;
      const reported = room.items.filter((i) => i.reportedBy === m.uid).length;
      const bought = room.purchases.filter(
        (p) => p.boughtBy === m.uid && (p.status === 'approved' || p.status === 'settled')
      ).length;
      const tasks = room.taskCompletions.filter((t) => t.completedBy === m.uid).length;
      return {
        uid: m.uid,
        name: world.nameOf(m.uid),
        role: m.uid === room.adminId ? 'admin' : m.role,
        balance: room.balances[m.uid] ?? 0,
        borne,
        paidOut,
        reported,
        bought,
        tasks,
        /** יחס דיווח:קנייה — הסימן הכי ברור ל"טרמפיסט" בתוך חדר. */
        ratio: bought === 0 ? (reported > 0 ? null : 0) : Math.round((reported / bought) * 10) / 10,
      };
    })
    .sort((a, b) => b.borne - a.borne);
}
